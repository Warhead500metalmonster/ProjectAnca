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
