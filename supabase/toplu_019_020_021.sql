-- Toplu: 019 (profil gizliliği) + 020 (engelleme, raporlar, uyarılar) + 021 (yönetici yetkileri, geliştirici rozeti).
-- Supabase → SQL Editor → New query → hepsini yapıştır → Run. Tekrar çalıştırmak zararsızdır.

-- 019: profil gizliliği (Steam gibi): herkese açık / sadece arkadaşlar / gizli.
-- Gizli profilde ad, fotoğraf, kapak ve arka plan görünür; kayıtlar, listeler ve istatistikler görünmez.
-- Kural veritabanında: kayıtlar başka yoldan da okunamaz; sıralama ve uyum hesapları da göremediğin kişileri saymaz.
-- Supabase → SQL Editor → New query → hepsini yapıştır → Run. Tekrar çalıştırmak zararsızdır.

alter table public.profiles add column if not exists privacy text not null default 'public';
alter table public.profiles drop constraint if exists profiles_privacy_check;
alter table public.profiles add constraint profiles_privacy_check check (privacy in ('public', 'friends', 'private'));

-- Bu kişinin kayıtlarını şu an bakan kişi görebilir mi? (kendisi, herkese açık, ya da karşılıklı takipleşen arkadaş)
create or replace function public.can_see(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_user = auth.uid() or exists (
    select 1 from public.profiles p where p.id = p_user and (
      p.privacy = 'public'
      or (p.privacy = 'friends' and auth.uid() is not null
        and exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = p_user)
        and exists (select 1 from public.follows f where f.follower_id = p_user and f.following_id = auth.uid()))
    ));
$$;
grant execute on function public.can_see(uuid) to anon, authenticated;

-- Kayıtlar: görebildiğin kişilerinkiler (alt sorgu bir kez çalışır, satır satır değil)
drop policy if exists "kayıtlar herkese açık" on public.entries;
drop policy if exists "görebildiğin kayıtlar" on public.entries;
create policy "görebildiğin kayıtlar" on public.entries for select
  using (user_id in (select v.id from public.profiles v where public.can_see(v.id)));

-- Listeler: kendi listelerin, ya da görebildiğin kişinin açık / liste dışı listeleri
drop policy if exists "açık listeler ve kendi listelerin" on public.lists;
create policy "açık listeler ve kendi listelerin" on public.lists for select
  using (auth.uid() = user_id or ((is_public or unlisted) and user_id in (select v.id from public.profiles v where public.can_see(v.id))));

drop policy if exists "görülebilen listelerin içeriği" on public.list_items;
create policy "görülebilen listelerin içeriği" on public.list_items for select using (
  exists (select 1 from public.lists l where l.id = list_id and (l.user_id = auth.uid()
    or ((l.is_public or l.unlisted) and public.can_see(l.user_id))))
);

-- Sıralama ve uyum: göremediğin kişilerin kayıtları hesaba girmez
create or replace function public.compat_stats(p_user uuid)
returns table (user_id uuid, type text, common int, rated int, diff_sum numeric, total int)
language sql stable security definer set search_path = '' as $$
  with k as (
    select distinct on (e.user_id, public.content_key(e.type, e.title, e.rawg_id))
      e.user_id, e.type, public.content_key(e.type, e.title, e.rawg_id) as ckey, e.rating
    from public.entries e
    where e.user_id in (select v.id from public.profiles v where public.can_see(v.id))
    order by e.user_id, public.content_key(e.type, e.title, e.rawg_id), e.updated_at desc
  ),
  mine as (select * from k where k.user_id = p_user),
  totals as (select k.user_id, k.type, count(*)::int as n from k where k.user_id <> p_user group by 1, 2),
  pairs as (
    select t.user_id, t.type, count(*)::int as common,
      count(*) filter (where m.rating > 0 and t.rating > 0)::int as rated,
      coalesce(sum(abs(m.rating - t.rating)) filter (where m.rating > 0 and t.rating > 0), 0) as diff_sum
    from k t join mine m on m.ckey = t.ckey
    where t.user_id <> p_user
    group by 1, 2
  )
  -- Ortak bir şeyi olan herkesin bütün türleri gelir (genel uyumda karşı tarafın tüm kayıtları sayılsın)
  select tt.user_id, tt.type, coalesce(p.common, 0), coalesce(p.rated, 0), coalesce(p.diff_sum, 0), tt.n
  from totals tt left join pairs p on p.user_id = tt.user_id and p.type = tt.type
  where tt.user_id in (select pairs.user_id from pairs);
$$;
grant execute on function public.compat_stats(uuid) to anon, authenticated;

create or replace function public.ranked_content(p_type text, p_min int, p_asc boolean, p_limit int)
returns table (type text, title text, year int, creator text, cover text, rawg_id int, ext_id text, avg numeric, votes int)
language sql stable security definer set search_path = '' as $$
  with r as (
    select e.*, public.content_key(e.type, e.title, e.rawg_id) as ckey
    from public.entries e
    where e.type = p_type and e.rating > 0
      and e.user_id in (select v.id from public.profiles v where public.can_see(v.id))
  ),
  g as (
    select ckey,
      (array_agg(title order by (cover is null), updated_at desc))[1] as title,
      max(year) as year,
      (array_agg(creator order by (creator is null), updated_at desc))[1] as creator,
      (array_agg(cover order by (cover is null), updated_at desc))[1] as cover,
      max(rawg_id) as rawg_id,
      max(ext_id) as ext_id,
      round(avg(rating), 2) as avg,
      count(distinct user_id)::int as votes
    from r group by ckey
    having count(distinct user_id) >= greatest(p_min, 1)
  )
  select p_type, g.title, g.year, g.creator, g.cover, g.rawg_id, g.ext_id, g.avg, g.votes
  from g
  order by case when p_asc then g.avg end asc, case when not p_asc then g.avg end desc, g.votes desc
  limit least(greatest(p_limit, 1), 200);
$$;
grant execute on function public.ranked_content(text, int, boolean, int) to anon, authenticated;

create or replace function public.compat_leaderboard(p_type text, p_limit int)
returns table (a uuid, b uuid, score int, common int)
language sql stable security definer set search_path = '' as $$
  with k as (
    select distinct on (e.user_id, public.content_key(e.type, e.title, e.rawg_id))
      e.user_id, public.content_key(e.type, e.title, e.rawg_id) as ckey, e.rating
    from public.entries e
    where (p_type is null or e.type = p_type) and e.user_id in (select v.id from public.profiles v where public.can_see(v.id))
    order by e.user_id, public.content_key(e.type, e.title, e.rawg_id), e.updated_at desc
  ),
  totals as (select k.user_id, count(*) as n from k group by 1),
  pairs as (
    select x.user_id as a, y.user_id as b, count(*) as common,
      count(*) filter (where x.rating > 0 and y.rating > 0) as rated,
      coalesce(sum(abs(x.rating - y.rating)) filter (where x.rating > 0 and y.rating > 0), 0) as diff_sum
    from k x join k y on x.ckey = y.ckey and x.user_id < y.user_id
    group by 1, 2
    having count(*) >= 3
  ),
  scored as (
    select p.a, p.b, p.common,
      case when p.rated >= 3
        then round((0.7 * (1 - p.diff_sum / p.rated / 10) + 0.3 * least(1, p.common::numeric / greatest(1, least(ta.n, tb.n)) * 3)) * 100)
        else round(least(1, p.common::numeric / greatest(1, least(ta.n, tb.n)) * 3) * 60)
      end as score
    from pairs p join totals ta on ta.user_id = p.a join totals tb on tb.user_id = p.b
  )
  select s.a, s.b, s.score::int, s.common::int from scored s
  order by s.score desc, s.common desc
  limit least(greatest(p_limit, 1), 100);
$$;
grant execute on function public.compat_leaderboard(text, int) to anon, authenticated;

notify pgrst, 'reload schema';

-- 020: engelleme ve raporlama.
-- Engellenen kişi engelleyeni takip edemez, ona mesaj yazamaz, kayıtlarına yorum yapamaz; engelleyince iki yöndeki takip de kalkar.
-- Raporlar sadece yönetim panelinde görünür; raporlayan kendi raporunu görebilir.
-- Supabase → SQL Editor → New query → hepsini yapıştır → Run. Tekrar çalıştırmak zararsızdır.

-- ---------- Engelleme ----------
create table if not exists public.blocks (
  blocker_id uuid not null default auth.uid() references public.profiles on delete cascade,
  blocked_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
drop policy if exists "kendi engellerini gör" on public.blocks;
create policy "kendi engellerini gör" on public.blocks for select using (auth.uid() = blocker_id);
drop policy if exists "engelle" on public.blocks;
create policy "engelle" on public.blocks for insert with check (auth.uid() = blocker_id);
drop policy if exists "engeli kaldır" on public.blocks;
create policy "engeli kaldır" on public.blocks for delete using (auth.uid() = blocker_id);
grant select, insert, delete on public.blocks to authenticated;

-- İki kişiden biri diğerini engellemiş mi?
create or replace function public.blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;
grant execute on function public.blocked_between(uuid, uuid) to authenticated;

-- Engelleyince aradaki takipler kalkar
create or replace function public.blocks_unfollow() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.follows where (follower_id = new.blocker_id and following_id = new.blocked_id)
    or (follower_id = new.blocked_id and following_id = new.blocker_id);
  return new;
end $$;
drop trigger if exists blocks_unfollow on public.blocks;
create trigger blocks_unfollow after insert on public.blocks for each row execute function public.blocks_unfollow();

-- Engel varsa takip, mesaj ve yorum yazılamaz
create or replace function public.no_blocked_contact() returns trigger
language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  if tg_table_name = 'follows' then target := new.following_id;
  elsif tg_table_name = 'messages' then target := new.receiver_id;
  elsif tg_table_name = 'comments' then select e.user_id into target from public.entries e where e.id = new.entry_id;
  end if;
  if target is not null and public.blocked_between(auth.uid(), target) then
    raise exception 'Bu kişiyle aranızda engel var.';
  end if;
  return new;
end $$;
drop trigger if exists follows_blocked on public.follows;
create trigger follows_blocked before insert on public.follows for each row execute function public.no_blocked_contact();
drop trigger if exists messages_blocked on public.messages;
create trigger messages_blocked before insert on public.messages for each row execute function public.no_blocked_contact();
drop trigger if exists comments_blocked on public.comments;
create trigger comments_blocked before insert on public.comments for each row execute function public.no_blocked_contact();

-- ---------- Raporlar ----------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles on delete cascade,
  kind text not null check (kind in ('profile', 'entry', 'comment', 'list', 'forum_thread', 'forum_post', 'message')),
  target_id text not null check (char_length(target_id) <= 200),
  target_user uuid references public.profiles on delete set null,
  reason text not null check (char_length(reason) between 1 and 60),
  note text check (char_length(note) <= 1000),
  excerpt text check (char_length(excerpt) <= 600), -- raporlanan yazının o anki hali (silinse de görülsün)
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);
create index if not exists reports_status_idx on public.reports (status, created_at desc);
alter table public.reports enable row level security;
drop policy if exists "rapor gönder" on public.reports;
create policy "rapor gönder" on public.reports for insert with check (auth.uid() = reporter_id and status = 'open');
drop policy if exists "raporları yönetim ve raporlayan görür" on public.reports;
create policy "raporları yönetim ve raporlayan görür" on public.reports for select using (public.is_admin() or auth.uid() = reporter_id);
drop policy if exists "raporu yönetim kapatır" on public.reports;
create policy "raporu yönetim kapatır" on public.reports for update using (public.is_admin());
drop policy if exists "raporu yönetim siler" on public.reports;
create policy "raporu yönetim siler" on public.reports for delete using (public.is_admin());
grant select, insert, update, delete on public.reports to authenticated;

-- ---------- Yönetimden uyarı: kişi siteye girince üstte görür, "Anladım" deyince kapanır ----------
create table if not exists public.warnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
alter table public.warnings enable row level security;
drop policy if exists "uyarını gör" on public.warnings;
create policy "uyarını gör" on public.warnings for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "uyarıyı yönetim yazar" on public.warnings;
create policy "uyarıyı yönetim yazar" on public.warnings for insert with check (public.is_admin());
drop policy if exists "uyarıyı okundu say" on public.warnings;
create policy "uyarıyı okundu say" on public.warnings for update using (auth.uid() = user_id);
revoke all on public.warnings from anon, authenticated;
grant select, insert on public.warnings to authenticated;
grant update (read_at) on public.warnings to authenticated;

notify pgrst, 'reload schema';

-- 021: yöneticiler site sahibiyle aynı yetkilere sahip (yönetici atama, hesap silme, duyuru, diğer yöneticilere işlem);
-- sadece site sahibine dokunulamaz. Geliştirici rozeti: @arno4436 ve @wulfa'ya özel, panelden verilemez.
-- Supabase → SQL Editor → New query → hepsini yapıştır → Run. Tekrar çalıştırmak zararsızdır.

-- Yönetici atama / kaldırma: site sahibi ve yöneticiler (yönetici rozeti de böylece kendiliğinden gelir)
create or replace function public.set_admin(p_username text, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'Bunun için yönetici olmalısın.'; end if;
  select id into uid from public.profiles where username = lower(btrim(p_username, ' @'));
  if uid is null then raise exception 'Böyle bir kullanıcı yok.'; end if;
  if exists (select 1 from public.user_badges where user_id = uid and badge = 'owner') then
    raise exception 'Site sahibine işlem yapılamaz.';
  end if;
  if p_on then
    insert into public.user_badges (user_id, badge) values (uid, 'admin') on conflict do nothing;
  else
    delete from public.user_badges where user_id = uid and badge = 'admin';
  end if;
end;
$$;
revoke all on function public.set_admin(text, boolean) from public, anon;
grant execute on function public.set_admin(text, boolean) to authenticated;

-- Moderasyon: yönetici site sahibi dışında herkese işlem yapabilir
create or replace function public.can_moderate(p_target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin()
    and not exists (select 1 from public.user_badges where user_id = p_target and badge = 'owner');
$$;
grant execute on function public.can_moderate(uuid) to authenticated;

-- Hesap silme: yöneticiler de yapabilir (site sahibinin hesabı silinemez)
create or replace function public.admin_delete_user(p_username text, p_ban boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'Bunun için yönetici olmalısın.'; end if;
  select id into uid from public.profiles where username = lower(btrim(p_username, ' @'));
  if uid is null then raise exception 'Böyle bir kullanıcı yok.'; end if;
  if exists (select 1 from public.user_badges where user_id = uid and badge = 'owner') then
    raise exception 'Site sahibinin hesabı silinemez.';
  end if;
  if p_ban then
    insert into public.blocked_emails (email) select lower(email) from auth.users where id = uid and email is not null on conflict do nothing;
  end if;
  delete from auth.users where id = uid;
end;
$$;
revoke all on function public.admin_delete_user(text, boolean) from public, anon;
grant execute on function public.admin_delete_user(text, boolean) to authenticated;

-- Duyurular: yöneticiler de yazar, düzenler, siler
drop policy if exists "duyuruyu site sahibi yazar" on public.announcements;
create policy "duyuruyu site sahibi yazar" on public.announcements for insert with check (public.is_admin() and author_id = auth.uid());
drop policy if exists "duyuruyu site sahibi düzenler" on public.announcements;
create policy "duyuruyu site sahibi düzenler" on public.announcements for update using (public.is_admin());
drop policy if exists "duyuruyu site sahibi siler" on public.announcements;
create policy "duyuruyu site sahibi siler" on public.announcements for delete using (public.is_admin());

-- Rozet verme: site sahibi, yönetici ve geliştirici rozetleri panelden verilemez
create or replace function public.set_badge(p_username text, p_badge text, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'Bunun için yönetici olmalısın.'; end if;
  if p_badge in ('owner', 'admin', 'dev') or p_badge !~ '^[a-z_]{2,30}$' then
    raise exception 'Bu rozet buradan verilemez.';
  end if;
  select id into uid from public.profiles where username = lower(btrim(p_username, ' @'));
  if uid is null then raise exception 'Böyle bir kullanıcı yok.'; end if;
  if p_on then
    insert into public.user_badges (user_id, badge) values (uid, p_badge) on conflict do nothing;
  else
    delete from public.user_badges where user_id = uid and badge = p_badge;
  end if;
end;
$$;
revoke all on function public.set_badge(text, text, boolean) from public, anon;
grant execute on function public.set_badge(text, text, boolean) to authenticated;

-- Geliştirici rozeti: sadece @arno4436 ve @wulfa
insert into public.user_badges (user_id, badge)
  select id, 'dev' from public.profiles where username in ('arno4436', 'wulfa')
  on conflict do nothing;

notify pgrst, 'reload schema';
