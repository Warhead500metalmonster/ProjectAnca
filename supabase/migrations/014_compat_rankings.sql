-- 014: sitede en uyumlu olduğun kişiler ve Ancalog puanına göre sıralama.
-- Supabase → SQL Editor → New query → hepsini yapıştır → Run. Tekrar çalıştırmak zararsızdır.

-- İçeriğin ortak anahtarı (sitedeki contentKey ile aynı): oyunlar RAWG numarasıyla, diğerleri türü ve adıyla
create or replace function public.content_key(p_type text, p_title text, p_rawg int) returns text
language sql immutable set search_path = '' as $$
  select case when p_type = 'game' and p_rawg is not null then 'g:' || p_rawg else p_type || ':' || lower(btrim(p_title)) end;
$$;

-- Bir kişiyle herkes arasında, türe göre: ortak içerik, ikisinin de puanladığı, puan farkları toplamı, karşı tarafın kayıt sayısı.
-- Uyum yüzdesi bu sayılardan sitede, profildeki Uyum ile aynı formülle hesaplanır.
create or replace function public.compat_stats(p_user uuid)
returns table (user_id uuid, type text, common int, rated int, diff_sum numeric, total int)
language sql stable security definer set search_path = '' as $$
  with k as (
    select distinct on (e.user_id, public.content_key(e.type, e.title, e.rawg_id))
      e.user_id, e.type, public.content_key(e.type, e.title, e.rawg_id) as ckey, e.rating
    from public.entries e
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

-- Ancalog puanına göre içerikler: en az p_min kişinin puanladıkları, ortalamaya göre (p_asc = en düşükler önce)
create or replace function public.ranked_content(p_type text, p_min int, p_asc boolean, p_limit int)
returns table (type text, title text, year int, creator text, cover text, rawg_id int, ext_id text, avg numeric, votes int)
language sql stable security definer set search_path = '' as $$
  with r as (
    select e.*, public.content_key(e.type, e.title, e.rawg_id) as ckey
    from public.entries e
    where e.type = p_type and e.rating > 0
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

notify pgrst, 'reload schema';
