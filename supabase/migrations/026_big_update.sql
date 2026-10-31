-- 026: Büyük güncelleme: yanıtlama, raporlanan sohbetin tamamı, sıralamalar, site istatistikleri, God of War düzeltmesi.
-- Supabase → SQL Editor → New query → hepsini yapıştır → Run. Tekrar çalıştırmak zararsızdır.

-- ---------- Yanıtla: mesaj, forum, yorum ve etkinlik sohbetinde ----------
alter table public.messages add column if not exists reply_to uuid references public.messages on delete set null;
alter table public.forum_posts add column if not exists reply_to uuid references public.forum_posts on delete set null;
alter table public.comments add column if not exists reply_to uuid references public.comments on delete set null;
alter table public.event_posts add column if not exists reply_to uuid references public.event_posts on delete set null;
-- Bu tablolarda yazma izni sütun sütun verilmiş; yeni sütun için de izin gerekir
grant insert (reply_to) on public.messages, public.forum_posts, public.comments, public.event_posts to authenticated;

-- ---------- Raporlanan sohbetin tamamı: sadece yönetici, sadece raporlanan iki kişi arasındaki mesajlar ----------
create or replace function public.report_conversation(p_report uuid)
returns table (id uuid, sender_id uuid, body text, created_at timestamptz, reply_to uuid)
language plpgsql stable security definer set search_path = '' as $$
declare a uuid; b uuid;
begin
  if not public.is_admin() then raise exception 'Bunun için yönetici olmalısın.'; end if;
  select r.reporter_id, r.target_user into a, b from public.reports r where r.id = p_report and r.kind = 'message';
  if a is null or b is null then return; end if;
  return query
    select m.id, m.sender_id, m.body, m.created_at, m.reply_to from public.messages m
    where (m.sender_id = a and m.receiver_id = b) or (m.sender_id = b and m.receiver_id = a)
    order by m.created_at limit 2000;
end;
$$;
revoke all on function public.report_conversation(uuid) from public, anon;
grant execute on function public.report_conversation(uuid) to authenticated;

-- ---------- Kişi sıralamaları: sadece herkese açık profiller, gizlenen türler sayılmaz ----------
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
      and (p_year is null or extract(year from case when p_metric = 'entries' then e.created_at else coalesce(e.date::timestamptz, e.updated_at) end) = p_year)
    group by e.user_id
  ) t
  where t.n > 0
  order by t.n desc, t.user_id
  limit least(greatest(p_limit, 1), 200);
$$;
revoke all on function public.leaderboard(text, text, int, int) from public;
grant execute on function public.leaderboard(text, text, int, int) to anon, authenticated;

-- ---------- Site istatistikleri ----------
-- Son görülme zamanı: sadece "kaç kişi çevrimiçi" saymak için; kimse okuyamaz (kural yok, tablo kapalı)
create table if not exists public.presence (
  user_id uuid primary key references public.profiles on delete cascade,
  seen_at timestamptz not null default now()
);
alter table public.presence enable row level security;

create or replace function public.touch_presence() returns void
language sql security definer set search_path = '' as $$
  insert into public.presence (user_id) select auth.uid() where auth.uid() is not null
  on conflict (user_id) do update set seen_at = now();
$$;
revoke all on function public.touch_presence() from public, anon;
grant execute on function public.touch_presence() to authenticated;

-- Sadece toplam sayılar döner, kimin ne yaptığı değil
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
    'finished', (select count(*) from public.entries where type = 'game' and status = 'completed'
      and coalesce(date::timestamptz, updated_at) > now() - interval '7 days' and coalesce(date::timestamptz, updated_at) <= now())
  );
$$;
revoke all on function public.site_stats() from public;
grant execute on function public.site_stats() to anon, authenticated;

-- ---------- God of War: RAWG'deki 2023 tarihli sahte kayda eşleşenler gerçek oyuna döner ----------
-- Önce 2018'e; kişide 2018 zaten varsa bu kayıt onun 2005'idir.
update public.entries e set rawg_id = 58175, title = 'God of War (2018)', year = 2018,
  cover = 'https://media.rawg.io/media/crop/600/400/games/4be/4be6a6ad0364751a96229c56bf69be59.jpg'
where e.rawg_id = 930477 and not exists (select 1 from public.entries x where x.user_id = e.user_id and x.rawg_id = 58175);
update public.entries e set rawg_id = 29179, title = 'God of War I', year = 2005,
  cover = 'https://media.rawg.io/media/crop/600/400/games/1aa/1aa4ca34a8a6bb57a2e065c8332dc230.jpg'
where e.rawg_id = 930477 and not exists (select 1 from public.entries x where x.user_id = e.user_id and x.rawg_id = 29179);

notify pgrst, 'reload schema';
