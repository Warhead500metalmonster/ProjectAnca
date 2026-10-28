-- 011: yöneticiler bütün rozetleri verebilsin (kendilerine de), 20 yeni rozet.
-- Supabase → SQL Editor → New query → hepsini yapıştır → Run. Tekrar çalıştırmak zararsızdır.

-- ---------- Panelden rozet verme: site sahibi rozeti dışında hepsi ----------
create or replace function public.set_badge(p_username text, p_badge text, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'Bunun için yönetici olmalısın.'; end if;
  if p_badge in ('owner', 'admin') or p_badge !~ '^[a-z_]{2,30}$' then
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

-- ---------- Rozetler: hedefe ulaşınca kendiliğinden verilir ----------
create or replace function public.award_badges(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  got text[] := '{}';
  total int; rated int; done_game int; done_movie int; done_show int; done_anime int; done_music int; done_year int; kinds int;
  notes_n int; perfect int; harsh int; retro int; fresh int; pc int; console int; planned int; dropped int; top_sec bigint; favs int;
begin
  if p_user is null then return; end if;
  select count(*), count(*) filter (where rating > 0),
         count(*) filter (where type = 'game' and status = 'completed'),
         count(*) filter (where type = 'movie' and status = 'completed'),
         count(*) filter (where type = 'show' and status = 'completed'),
         count(*) filter (where type = 'anime' and status = 'completed'),
         count(*) filter (where type = 'music' and status = 'completed'),
         count(*) filter (where status = 'completed' and date >= date_trunc('year', now())::date),
         count(distinct type),
         count(*) filter (where btrim(coalesce(notes, '')) <> ''),
         count(*) filter (where rating = 10),
         count(*) filter (where rating between 1 and 3),
         count(*) filter (where year < 1995),
         count(*) filter (where status = 'completed' and year is not null and date is not null and year = extract(year from date)::int),
         count(*) filter (where type = 'game' and platform in ('PC', 'Steam Deck')),
         count(*) filter (where type = 'game' and (platform like 'PlayStation%' or platform like 'Xbox%' or platform like 'Nintendo%')),
         count(*) filter (where status = 'planned'),
         count(*) filter (where status = 'dropped'),
         coalesce(max(coalesce(playtime_sec, round(hours * 3600))), 0),
         count(*) filter (where favorite)
    into total, rated, done_game, done_movie, done_show, done_anime, done_music, done_year, kinds,
         notes_n, perfect, harsh, retro, fresh, pc, console, planned, dropped, top_sec, favs
    from public.entries where user_id = p_user;

  if total >= 1 then got := array_append(got, 'first_log'); end if;
  if total >= 100 then got := array_append(got, 'collector'); end if;
  if total >= 1000 then got := array_append(got, 'archivist'); end if;
  if rated >= 50 then got := array_append(got, 'rater'); end if;
  if kinds >= 5 then got := array_append(got, 'versatile'); end if;
  if done_game >= 50 then got := array_append(got, 'completionist'); end if;
  if done_game >= 200 then got := array_append(got, 'legend'); end if;
  if done_movie >= 100 then got := array_append(got, 'cinephile'); end if;
  if done_movie >= 500 then got := array_append(got, 'film_buff'); end if;
  if done_show >= 25 then got := array_append(got, 'binger'); end if;
  if done_anime >= 50 then got := array_append(got, 'otaku'); end if;
  if done_music >= 100 then got := array_append(got, 'melomane'); end if;
  if done_year >= 25 then got := array_append(got, 'year_star'); end if;
  if notes_n >= 10 then got := array_append(got, 'critic'); end if;
  if notes_n >= 50 then got := array_append(got, 'pen'); end if;
  if perfect >= 10 then got := array_append(got, 'perfect'); end if;
  if harsh >= 10 then got := array_append(got, 'harsh'); end if;
  if retro >= 10 then got := array_append(got, 'retro'); end if;
  if fresh >= 10 then got := array_append(got, 'fresh'); end if;
  if pc >= 50 then got := array_append(got, 'pc'); end if;
  if console >= 25 then got := array_append(got, 'console'); end if;
  if planned >= 100 then got := array_append(got, 'backlog'); end if;
  if dropped >= 10 then got := array_append(got, 'quitter'); end if;
  if top_sec >= 360000 then got := array_append(got, 'devoted'); end if;
  if top_sec >= 1800000 then got := array_append(got, 'iron'); end if;
  if favs >= 10 then got := array_append(got, 'tastemaker'); end if;
  if (select coalesce(sum(coalesce(playtime_sec, round(hours * 3600))), 0) from public.entries where user_id = p_user) >= 3600000 then got := array_append(got, 'marathon'); end if;
  if exists (select 1 from public.entries where user_id = p_user and status = 'completed' and started_on is not null and started_on = date) then got := array_append(got, 'speedrun'); end if;
  if exists (select 1 from public.entries where user_id = p_user and ext_id like 'steam:%') then got := array_append(got, 'steam'); end if;
  if exists (select 1 from public.entries where user_id = p_user and ext_id like 'psn:%') then got := array_append(got, 'psn'); end if;
  if exists (select 1 from public.entries where user_id = p_user and ext_id like 'xbox:%') then got := array_append(got, 'xbox'); end if;
  if exists (select 1 from public.entries where user_id = p_user and (ext_id like 'spotify:%' or store = 'Last.fm')) then got := array_append(got, 'music_link'); end if;
  if (select count(*) from public.follows a
      join public.follows b on b.follower_id = a.following_id and b.following_id = a.follower_id
      where a.follower_id = p_user) >= 10 then got := array_append(got, 'social'); end if;
  if (select count(*) from public.follows where following_id = p_user) >= 10 then got := array_append(got, 'popular'); end if;
  if (select count(*) from public.lists where user_id = p_user and is_public) >= 5 then got := array_append(got, 'curator'); end if;
  if (select count(*) from public.lists where user_id = p_user) >= 15 then got := array_append(got, 'lister'); end if;
  if (select count(*) from public.comments where user_id = p_user) >= 25 then got := array_append(got, 'commenter'); end if;
  if (select count(*) from public.likes l join public.entries e on e.id = l.entry_id where e.user_id = p_user) >= 25 then got := array_append(got, 'loved'); end if;
  if (select count(*) from public.likes where user_id = p_user) >= 50 then got := array_append(got, 'generous'); end if;
  if (select count(*) from public.forum_posts where user_id = p_user) + (select count(*) from public.forum_threads where user_id = p_user) >= 10 then got := array_append(got, 'forum'); end if;
  if (select count(*) from public.forum_threads where user_id = p_user) >= 5 then got := array_append(got, 'starter'); end if;
  if (select created_at from public.profiles where id = p_user) < now() - interval '1 year' then got := array_append(got, 'veteran'); end if;

  if cardinality(got) > 0 then
    insert into public.user_badges (user_id, badge) select p_user, unnest(got) on conflict do nothing;
  end if;
end;
$$;
revoke all on function public.award_badges(uuid) from public, anon, authenticated;

-- Beğeni verenin de rozeti (Cömert) güncellensin
create or replace function public.award_badges_trg() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'follows' then
    perform public.award_badges(new.follower_id);
    perform public.award_badges(new.following_id);
  elsif tg_table_name = 'likes' then
    perform public.award_badges((select user_id from public.entries where id = new.entry_id));
    perform public.award_badges(new.user_id);
  else
    perform public.award_badges(new.user_id);
  end if;
  return null;
end;
$$;

-- Şimdiye kadar hak edenlere hemen ver
select public.award_badges(id) from public.profiles;

notify pgrst, 'reload schema';
