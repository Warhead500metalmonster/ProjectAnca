-- 027: Keşfet araması sunucuda toplanır (11 binden fazla kaydı tarayıcıya indirmeden), istatistiklerde içe aktarılan eski oyunlar "bu hafta bitti" sayılmaz.
-- Supabase → SQL Editor → New query → hepsini yapıştır → Run. Tekrar çalıştırmak zararsızdır.

-- ---------- Keşfet: içerik bazında toplama. Çağıranın izinleriyle çalışır, gizli profiller yine görünmez ----------
create or replace function public.search_content(p_text text default null, p_type text default null, p_from int default null, p_to int default null, p_sort text default 'logged', p_limit int default 48)
returns table (type text, title text, year int, creator text, cover text, rawg_id int, ext_id text, n bigint, done bigint, active bigint, avg numeric)
language sql stable set search_path = '' as $$
  select t.type, t.title, t.year, t.creator, t.cover, t.rawg_id, t.ext_id, t.n, t.done, t.active, t.avg
  from (
    select
      min(e.type) as type,
      (array_agg(e.title order by e.created_at))[1] as title,
      max(e.year) as year,
      (array_agg(e.creator) filter (where e.creator is not null))[1] as creator,
      (array_agg(e.cover) filter (where e.cover is not null))[1] as cover,
      max(e.rawg_id) as rawg_id,
      (array_agg(e.ext_id) filter (where e.ext_id is not null))[1] as ext_id,
      count(*) as n,
      count(*) filter (where e.status = 'completed') as done,
      count(*) filter (where e.status = 'active') as active,
      coalesce(avg(e.rating) filter (where e.rating > 0), 0) as avg
    from public.entries e
    where (p_type is null or e.type = p_type)
      and (p_from is null or e.year >= p_from)
      and (p_to is null or e.year <= p_to)
      and (p_text is null or e.title ilike '%' || p_text || '%')
    group by case when e.type = 'game' and e.rawg_id is not null then 'g:' || e.rawg_id else e.type || ':' || lower(btrim(e.title)) end
  ) t
  order by
    (p_text is not null and p_sort = 'logged' and lower(t.title) = lower(p_text)) desc,
    case when p_sort = 'logged' then t.n end desc nulls last,
    case when p_sort = 'completed' then t.done end desc nulls last,
    case when p_sort = 'active' then t.active end desc nulls last,
    case when p_sort = 'rating' then t.avg end desc nulls last,
    case when p_sort = 'newest' then t.year end desc nulls last,
    case when p_sort = 'oldest' then t.year end asc nulls last,
    case when p_sort = 'title' then lower(t.title) end asc nulls last,
    t.n desc
  limit least(greatest(p_limit, 1), 100);
$$;
grant execute on function public.search_content(text, text, int, int, text, int) to anon, authenticated;

-- ---------- Site istatistikleri: "bitirilen oyun" gerçekten son 7 günde bitenler ----------
-- Tarihi yazılı olanlar o tarihe göre; tarihi olmayanlar sadece eklendikten sonra işaretlendiyse (içe aktarılan eski oyunlar sayılmaz)
create or replace function public.site_stats() returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'users', (select count(*) from public.profiles),
    'online', (select count(*) from public.presence where seen_at > now() - interval '5 minutes'),
    'new_users', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'active_users', (select count(*) from (
      select user_id from public.presence where seen_at > now() - interval '7 days'
      union select user_id from public.entries where updated_at > now() - interval '7 days') a),
    'backlogged', (select count(*) from public.entries where type = 'game' and status = 'planned' and created_at > now() - interval '7 days'),
    'finished', (select count(*) from public.entries where type = 'game' and status = 'completed' and (
      (date is not null and date > (now() - interval '7 days')::date and date <= now()::date)
      or (date is null and updated_at > now() - interval '7 days' and updated_at > created_at + interval '1 minute')))
  );
$$;
revoke all on function public.site_stats() from public;
grant execute on function public.site_stats() to anon, authenticated;

-- ---------- Sıralamalar: "bu yıl bitiren" sadece bitirme tarihi bu yıl olanları sayar ----------
create or replace function public.leaderboard(p_type text default null, p_metric text default 'entries', p_year int default null, p_limit int default 100)
returns table (user_id uuid, n bigint)
language sql stable security definer set search_path = '' as $$
  select t.user_id, t.n from (
    select e.user_id,
      case p_metric
        when 'completed' then count(*) filter (where e.status = 'completed')
        when 'hours' then coalesce(round(sum(coalesce(e.playtime_sec, e.hours * 3600, 0)) / 3600), 0)::bigint
        else count(*) filter (where e.status <> 'planned')
      end as n
    from public.entries e
    join public.profiles p on p.id = e.user_id
    where p.privacy = 'public'
      and not coalesce(e.type = any (p.hidden_types), false)
      and (p_type is null or e.type = p_type)
      and (p_year is null or extract(year from case p_metric
        when 'entries' then e.created_at
        when 'completed' then e.date::timestamptz
        else coalesce(e.date::timestamptz, e.updated_at) end) = p_year)
    group by e.user_id
  ) t
  where t.n > 0
  order by t.n desc, t.user_id
  limit least(greatest(p_limit, 1), 200);
$$;
revoke all on function public.leaderboard(text, text, int, int) from public;
grant execute on function public.leaderboard(text, text, int, int) to anon, authenticated;

notify pgrst, 'reload schema';
