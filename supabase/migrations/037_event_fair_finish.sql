-- 037: Etkinlikte adil bitirme. Oyun etkinlik süresi içinde başlanıp bitirilmeli; ödül (rozet, İlk bitiren) için hile yapılamasın.
--  * "Oynuyorum" ancak etkinlik başlayınca denebilir; başlama zamanını sunucu yazar (started_at), kimse elle değiştiremez.
--  * "Bitirdim" ancak önce "Oynuyorum" denmişse, etkinlik bitmeden ve başladıktan en az min_hours saat sonra denebilir.
--  * Bitirme zamanını (finished_at) da sunucu yazar: eski bir tarih gönderip İlk bitiren olunamaz.
--  * Yönetici bir bitirmeyi geçersiz sayabilir (rozetleri geri alınır, İlk bitirense rozet sıradakine geçer).
--  * Bu kurala uymayan eski bitirmeler geçersiz sayılır, kişiye bildirim gider.
-- Supabase → SQL Editor → New query → hepsini yapıştır → Run. Tekrar çalıştırmak zararsızdır.

alter table public.event_members add column if not exists started_at timestamptz;
-- Başladıktan sonra en az kaç saat geçmeden "Bitirdim" denemez (boş ya da 0: sınır yok)
alter table public.events add column if not exists min_hours int check (min_hours is null or min_hours between 0 and 2000);

-- Etkinliğin başlangıç ve bitiş anı (Türkiye saatiyle gün başı / gün sonu)
create or replace function public.event_window(p_event uuid, out st timestamptz, out en timestamptz)
language sql stable security definer set search_path = '' as $$
  select (e.starts_on::timestamp at time zone 'Europe/Istanbul'),
         case when e.ends_on is null then null else ((e.ends_on + 1)::timestamp at time zone 'Europe/Istanbul') end
  from public.events e where e.id = p_event;
$$;

-- Eski katılımcılar: başlama anı, katıldığı an ile etkinliğin başladığı andan hangisi sonraysa o (lehine olan)
update public.event_members m set started_at = greatest(m.joined_at, w.st)
from public.events e, lateral public.event_window(e.id) w
where e.id = m.event_id and m.status in ('playing', 'done') and m.started_at is null;

-- Hyrule etkinliği: başladıktan en az 24 saat sonra bitirilebilir
update public.events set min_hours = 24 where id = '0c0a1998-0000-4000-8000-000000000001' and min_hours is null;

-- Bir bitirmeyi geri al: durum "Oynuyorum"a döner, bu etkinliğin rozetleri alınır, İlk bitirense rozet sıradakine geçer
create or replace function public.event_undo_done(p_event uuid, p_user uuid, p_msg text) returns void
language plpgsql security definer set search_path = '' as $$
declare nxt uuid; was_first boolean;
begin
  update public.event_members set status = case when now() < (select w.st from public.event_window(p_event) w) then 'joined' else 'playing' end, updated_at = now()
    where event_id = p_event and user_id = p_user and status = 'done';
  if not found then return; end if;
  delete from public.user_badges where user_id = p_user and badge = 'ev_' || left(p_event::text, 8);
  if not exists (select 1 from public.event_members where user_id = p_user and status = 'done') then
    delete from public.user_badges where user_id = p_user and badge = 'event';
  end if;
  select coalesce(first_user = p_user, false) into was_first from public.events where id = p_event;
  if was_first then
    select m.user_id into nxt from public.event_members m where m.event_id = p_event and m.status = 'done' and not m.no_first
      order by m.finished_at nulls last limit 1;
    update public.events set first_user = nxt where id = p_event;
    perform public.sync_first_badge(p_user);
    perform public.sync_first_badge(nxt);
    if nxt is not null then
      perform public.notify_user(nxt, 'event_first', null, 'Etkinliği ilk bitiren sen oldun! İlk bitiren rozeti senin.', '/events/' || p_event);
    end if;
  end if;
  if p_msg is not null then perform public.notify_user(p_user, 'event', null, p_msg, '/events/' || p_event); end if;
end;
$$;
revoke all on function public.event_undo_done(uuid, uuid, text) from public, anon, authenticated;

-- Yönetici: bir bitirmeyi geçersiz say
create or replace function public.admin_event_undone(p_event uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Bunun için yönetici olmalısın.'; end if;
  perform public.event_undo_done(p_event, p_user,
    'Etkinlikteki bitirme kaydın yönetim tarafından geçersiz sayıldı. Etkinlik süresi içinde başlayıp bitirdiğinde yeniden Bitirdim diyebilirsin.');
end;
$$;
revoke all on function public.admin_event_undone(uuid, uuid) from public, anon;
grant execute on function public.admin_event_undone(uuid, uuid) to authenticated;

-- Kurala uymayan eski bitirmeler: başlamadan önce ya da başladıktan sonra en az süre dolmadan bitirilmiş olanlar
do $$
declare r record;
begin
  for r in
    select m.event_id, m.user_id, e.min_hours from public.event_members m
    join public.events e on e.id = m.event_id
    cross join lateral public.event_window(e.id) w
    where m.status = 'done' and (
      m.finished_at is null or m.finished_at < w.st
      or (coalesce(e.min_hours, 0) > 0 and m.finished_at < coalesce(m.started_at, w.st) + make_interval(hours => e.min_hours)))
  loop
    perform public.event_undo_done(r.event_id, r.user_id,
      'Etkinlikteki bitirme kaydın geçersiz sayıldı: oyunu etkinlik süresi içinde başlayıp bitirmek gerekiyor'
      || case when coalesce(r.min_hours, 0) > 0 then ' (başladıktan en az ' || r.min_hours || ' saat sonra)' else '' end
      || '. Bitirdiğinde yeniden Bitirdim diyebilirsin.');
  end loop;
end $$;

-- Kural: durum değişirken zamanları sunucu yazar, kurala uymayan "Bitirdim" reddedilir
create or replace function public.event_member_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare st timestamptz; en timestamptz; mh int;
begin
  select w.st, w.en into st, en from public.event_window(new.event_id) w;
  select min_hours into mh from public.events where id = new.event_id;
  if tg_op = 'UPDATE' then
    new.started_at := old.started_at;
    new.finished_at := old.finished_at;
    if new.status is not distinct from old.status then return new; end if;
  else
    new.started_at := null;
    new.finished_at := null;
  end if;
  if new.status = 'joined' then
    new.finished_at := null;
  elsif new.status = 'playing' then
    if now() < st then raise exception 'Etkinlik daha başlamadı. Başlayınca Oynuyorum diyebilirsin.'; end if;
    if new.started_at is null or tg_op = 'INSERT' then new.started_at := now(); end if;
    new.finished_at := null;
  elsif new.status = 'done' then
    if now() < st then raise exception 'Etkinlik daha başlamadı.'; end if;
    if en is not null and now() >= en then raise exception 'Etkinlik bitti; artık Bitirdim denemez.'; end if;
    if new.started_at is null then
      raise exception 'Önce Oynuyorum de: etkinlikte sayılması için oyuna etkinlik süresi içinde başlayıp bitirmen gerekiyor.';
    end if;
    if coalesce(mh, 0) > 0 and now() < new.started_at + make_interval(hours => mh) then
      raise exception 'Başladıktan en az % saat sonra Bitirdim diyebilirsin (% sonra açılır).', mh,
        to_char((new.started_at + make_interval(hours => mh)) at time zone 'Europe/Istanbul', 'DD.MM HH24:MI');
    end if;
    new.finished_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists event_members_guard on public.event_members;
create trigger event_members_guard before insert or update on public.event_members for each row execute function public.event_member_guard();

notify pgrst, 'reload schema';
