-- 017: Topluluk sayfasındaki "Popüler oyunlar" sunucuda sayılır (önceden bütün kayıtlar tarayıcıya indiriliyordu).
-- Supabase → SQL Editor → New query → hepsini yapıştır → Run. Tekrar çalıştırmak zararsızdır.
-- security definer değil: görünürlük kuralları (RLS) aynen geçerli, kimse göremediği kaydı saydıramaz.

create or replace function public.popular_games(p_users uuid[] default null, p_limit int default 12)
returns table (rawg_id int, n bigint, title text, cover text)
language sql stable set search_path = public as $$
  with c as (
    select e.rawg_id, count(distinct e.user_id) as n
    from entries e
    where e.type = 'game' and e.rawg_id is not null and (p_users is null or e.user_id = any(p_users))
    group by e.rawg_id
    order by n desc, e.rawg_id
    limit least(coalesce(p_limit, 12), 50)
  )
  select c.rawg_id, c.n, x.title, x.cover
  from c cross join lateral (
    select e.title, e.cover from entries e where e.rawg_id = c.rawg_id and e.type = 'game'
    order by (e.cover is null), e.updated_at desc limit 1
  ) x
  order by c.n desc, c.rawg_id;
$$;

grant execute on function public.popular_games(uuid[], int) to anon, authenticated;

notify pgrst, 'reload schema';
