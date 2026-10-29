-- 024: Etkinlik rozetleri, sohbette fotoğraf, biten etkinliğin arşivlenmesi.
-- Supabase → SQL Editor → New query → hepsini yapıştır → Run. Tekrar çalıştırmak zararsızdır.

-- Etkinliğe özel rozet (bitiren herkese): adı ve simgesi; anahtarı ev_ + etkinlik kimliğinin ilk 8 harfi
alter table public.events add column if not exists badge_name text check (char_length(badge_name) <= 40);
alter table public.events add column if not exists badge_icon text check (char_length(badge_icon) <= 4);
update public.events set badge_name = 'Hyrule Kahramanı', badge_icon = '⚔'
  where id = '0c0a1998-0000-4000-8000-000000000001' and badge_name is null;

-- Sohbette link ile fotoğraf
alter table public.event_posts add column if not exists image text check (image is null or (image ~ '^https://' and char_length(image) <= 500));

-- Etkinlik açık mı (bitiş günü geçmediyse)
create or replace function public.event_open(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.events where id = p_event and (ends_on is null or ends_on >= current_date));
$$;
grant execute on function public.event_open(uuid) to anon, authenticated;

-- Biten etkinlik arşivdir: katılma, durum/not değiştirme, ayrılma ve sohbete yazma kapanır; okumak serbest
drop policy if exists "event_members join" on public.event_members;
create policy "event_members join" on public.event_members for insert with check (user_id = auth.uid() and public.event_open(event_id));
drop policy if exists "event_members own" on public.event_members;
create policy "event_members own" on public.event_members for update using (user_id = auth.uid() and public.event_open(event_id)) with check (user_id = auth.uid());
drop policy if exists "event_members leave" on public.event_members;
create policy "event_members leave" on public.event_members for delete using ((user_id = auth.uid() and public.event_open(event_id)) or public.is_admin());
drop policy if exists "event_posts write" on public.event_posts;
create policy "event_posts write" on public.event_posts for insert with check (user_id = auth.uid() and public.event_open(event_id));

-- Rozetler: katılana Etkinlikçi, 3 etkinliğe katılana Müdavim; bitirene Etkinlik ruhu,
-- herkesten önce bitirene İlk bitiren, etkinliğin kendi rozeti varsa o da
create or replace function public.event_badge() returns trigger
language plpgsql security definer set search_path = '' as $$
declare special text;
begin
  insert into public.user_badges (user_id, badge) values (new.user_id, 'event_join') on conflict do nothing;
  if (select count(*) from public.event_members where user_id = new.user_id) >= 3 then
    insert into public.user_badges (user_id, badge) values (new.user_id, 'event_regular') on conflict do nothing;
  end if;
  if new.status = 'done' then
    insert into public.user_badges (user_id, badge) values (new.user_id, 'event') on conflict do nothing;
    if not exists (select 1 from public.event_members where event_id = new.event_id and user_id <> new.user_id and status = 'done') then
      insert into public.user_badges (user_id, badge) values (new.user_id, 'event_first') on conflict do nothing;
    end if;
    select badge_name into special from public.events where id = new.event_id;
    if special is not null then
      insert into public.user_badges (user_id, badge) values (new.user_id, 'ev_' || left(new.event_id::text, 8)) on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists event_members_badge on public.event_members;
create trigger event_members_badge after insert or update of status on public.event_members for each row execute function public.event_badge();

-- Daha önce katılmış / bitirmiş olanlara rozetleri şimdi ver
insert into public.user_badges (user_id, badge) select distinct user_id, 'event_join' from public.event_members on conflict do nothing;
insert into public.user_badges (user_id, badge) select user_id, 'event_regular' from public.event_members group by user_id having count(*) >= 3 on conflict do nothing;
insert into public.user_badges (user_id, badge) select distinct user_id, 'event' from public.event_members where status = 'done' on conflict do nothing;
insert into public.user_badges (user_id, badge)
  select distinct on (m.event_id) m.user_id, 'event_first' from public.event_members m where m.status = 'done' order by m.event_id, m.finished_at nulls last
  on conflict do nothing;
insert into public.user_badges (user_id, badge)
  select m.user_id, 'ev_' || left(m.event_id::text, 8) from public.event_members m join public.events e on e.id = m.event_id
  where m.status = 'done' and e.badge_name is not null
  on conflict do nothing;

notify pgrst, 'reload schema';
