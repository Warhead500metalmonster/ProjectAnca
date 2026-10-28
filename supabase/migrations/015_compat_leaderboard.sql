-- 015: sitenin en uyumlu ikilileri (uyum sıralaması). Puan, profildeki Uyum ile aynı formülle hesaplanır.
-- Supabase → SQL Editor → New query → hepsini yapıştır → Run. Tekrar çalıştırmak zararsızdır.
-- p_type boşsa genel uyum (bütün kayıtlar), doluysa sadece o türün kayıtları (game, movie, show, music, anime).

create or replace function public.compat_leaderboard(p_type text, p_limit int)
returns table (a uuid, b uuid, score int, common int)
language sql stable security definer set search_path = '' as $$
  with k as (
    select distinct on (e.user_id, public.content_key(e.type, e.title, e.rawg_id))
      e.user_id, public.content_key(e.type, e.title, e.rawg_id) as ckey, e.rating
    from public.entries e
    where p_type is null or e.type = p_type
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
