-- 010: forum, yeni rozetler, herkes site sahibine mesaj atabilir, favori sırası.
-- Supabase → SQL Editor → New query → hepsini yapıştır → Run. Tekrar çalıştırmak zararsızdır.

-- ---------- Favori sırası (sahibi sürükleyerek ayarlar) ----------
alter table public.entries add column if not exists fav_pos smallint check (fav_pos between 0 and 99);

-- ---------- Yeni durum: Kategorisiz (Steam'den gelen oyunlar hiçbir kategoriye konmaz) ----------
do $$
declare c text;
begin
  for c in select conname from pg_constraint
    where conrelid = 'public.entries'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%status%' and pg_get_constraintdef(oid) like '%dropped%'
  loop
    execute format('alter table public.entries drop constraint %I', c);
  end loop;
end $$;
alter table public.entries add constraint entries_status_check
  check (status in ('completed', 'active', 'planned', 'paused', 'dropped', 'owned'));

-- Daha önce Steam'den otomatik kategoriye konan oyunlar kategorisiz olsun
-- (puan, not, tarih verilmiş ya da favoriye alınmış olanlara, yani elle düzenlenenlere dokunulmaz)
alter table public.entries disable trigger entries_badges;
update public.entries set status = 'owned'
  where ext_id like 'steam:%' and status in ('active', 'paused', 'planned')
    and rating = 0 and btrim(coalesce(notes, '')) = '' and date is null and started_on is null and not favorite;
alter table public.entries enable trigger entries_badges;

-- ---------- Herkes site sahibine yazabilir, site sahibi herkese cevap verebilir ----------
drop policy if exists "site sahibiyle yazış" on public.messages;
create policy "site sahibiyle yazış" on public.messages for insert with check (
  auth.uid() = sender_id and (
    exists (select 1 from public.user_badges where user_id = receiver_id and badge = 'owner')
    or exists (select 1 from public.user_badges where user_id = auth.uid() and badge = 'owner')
  )
);

-- ---------- Forum ----------
create table if not exists public.forum_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  title text not null check (char_length(title) between 3 and 140),
  body text not null check (char_length(body) between 1 and 8000),
  category text not null default 'genel' check (category in ('genel', 'oyun', 'film', 'dizi', 'muzik', 'anime', 'oneri', 'destek')),
  item jsonb check (item is null or (jsonb_typeof(item) = 'object' and pg_column_size(item) < 3000)), -- tartışılan oyun / film
  content_key text check (char_length(content_key) <= 260),
  pinned boolean not null default false,
  locked boolean not null default false,
  reply_count int not null default 0,
  last_post_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists forum_threads_last_idx on public.forum_threads (pinned desc, last_post_at desc);
create index if not exists forum_threads_key_idx on public.forum_threads (content_key);

create table if not exists public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.forum_threads on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists forum_posts_thread_idx on public.forum_posts (thread_id, created_at);

alter table public.forum_threads enable row level security;
alter table public.forum_posts enable row level security;
drop policy if exists "konular herkese açık" on public.forum_threads;
drop policy if exists "konu aç" on public.forum_threads;
drop policy if exists "konuyu düzenle" on public.forum_threads;
drop policy if exists "konuyu sil" on public.forum_threads;
create policy "konular herkese açık" on public.forum_threads for select using (true);
create policy "konu aç" on public.forum_threads for insert with check (auth.uid() = user_id);
create policy "konuyu düzenle" on public.forum_threads for update using (auth.uid() = user_id or public.is_admin());
create policy "konuyu sil" on public.forum_threads for delete using (auth.uid() = user_id or public.is_admin());
drop policy if exists "cevaplar herkese açık" on public.forum_posts;
drop policy if exists "cevap yaz" on public.forum_posts;
drop policy if exists "cevabı düzenle" on public.forum_posts;
drop policy if exists "cevabı sil" on public.forum_posts;
create policy "cevaplar herkese açık" on public.forum_posts for select using (true);
create policy "cevap yaz" on public.forum_posts for insert with check (
  auth.uid() = user_id and not exists (select 1 from public.forum_threads t where t.id = thread_id and t.locked)
);
create policy "cevabı düzenle" on public.forum_posts for update using (auth.uid() = user_id);
create policy "cevabı sil" on public.forum_posts for delete using (auth.uid() = user_id or public.is_admin());
revoke all on public.forum_threads, public.forum_posts from anon, authenticated;
grant select on public.forum_threads, public.forum_posts to anon, authenticated;
grant insert (title, body, category, item, content_key) on public.forum_threads to authenticated;
grant update (title, body, category, pinned, locked, updated_at) on public.forum_threads to authenticated;
grant insert (thread_id, body), update (body, updated_at) on public.forum_posts to authenticated;
grant delete on public.forum_threads, public.forum_posts to authenticated;

-- Sabitleme / kilitleme sadece yönetici; spam olmasın diye günlük sınır
create or replace function public.forum_thread_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.forum_threads where user_id = new.user_id and created_at > now() - interval '1 day') >= 10 then
      raise exception 'Bugün çok fazla konu açtın, yarın tekrar dene.';
    end if;
    new.pinned := false; new.locked := false; new.reply_count := 0; new.last_post_at := now();
  elsif (new.pinned is distinct from old.pinned or new.locked is distinct from old.locked) and not public.is_admin() then
    raise exception 'Sabitleme ve kilitleme sadece yöneticiler içindir.';
  end if;
  return new;
end;
$$;
drop trigger if exists forum_thread_guard on public.forum_threads;
create trigger forum_thread_guard before insert or update on public.forum_threads for each row execute function public.forum_thread_guard();

create or replace function public.forum_post_count() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.forum_posts where user_id = new.user_id and created_at > now() - interval '1 day') >= 300 then
      raise exception 'Bugün çok fazla mesaj yazdın, yarın tekrar dene.';
    end if;
    update public.forum_threads set reply_count = reply_count + 1, last_post_at = now() where id = new.thread_id;
    return new;
  end if;
  update public.forum_threads set reply_count = greatest(reply_count - 1, 0) where id = old.thread_id;
  return old;
end;
$$;
drop trigger if exists forum_post_count on public.forum_posts;
create trigger forum_post_count before insert or delete on public.forum_posts for each row execute function public.forum_post_count();

-- ---------- Rozetler: yenileri de kendiliğinden verilir ----------
create or replace function public.award_badges(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  got text[] := '{}';
  total int; rated int; done_game int; done_movie int; done_show int; done_anime int; done_music int; done_year int; kinds int;
begin
  if p_user is null then return; end if;
  select count(*), count(*) filter (where rating > 0),
         count(*) filter (where type = 'game' and status = 'completed'),
         count(*) filter (where type = 'movie' and status = 'completed'),
         count(*) filter (where type = 'show' and status = 'completed'),
         count(*) filter (where type = 'anime' and status = 'completed'),
         count(*) filter (where type = 'music' and status = 'completed'),
         count(*) filter (where status = 'completed' and date >= date_trunc('year', now())::date),
         count(distinct type)
    into total, rated, done_game, done_movie, done_show, done_anime, done_music, done_year, kinds
    from public.entries where user_id = p_user;

  if total >= 1 then got := array_append(got, 'first_log'); end if;
  if total >= 100 then got := array_append(got, 'collector'); end if;
  if total >= 1000 then got := array_append(got, 'archivist'); end if;
  if rated >= 50 then got := array_append(got, 'rater'); end if;
  if kinds >= 5 then got := array_append(got, 'versatile'); end if;
  if done_game >= 50 then got := array_append(got, 'completionist'); end if;
  if done_game >= 200 then got := array_append(got, 'legend'); end if;
  if done_movie >= 100 then got := array_append(got, 'cinephile'); end if;
  if done_show >= 25 then got := array_append(got, 'binger'); end if;
  if done_anime >= 50 then got := array_append(got, 'otaku'); end if;
  if done_music >= 100 then got := array_append(got, 'melomane'); end if;
  if done_year >= 25 then got := array_append(got, 'year_star'); end if;
  if (select count(*) from public.entries where user_id = p_user and btrim(coalesce(notes, '')) <> '') >= 10 then got := array_append(got, 'critic'); end if;
  if (select coalesce(sum(coalesce(playtime_sec, round(hours * 3600))), 0) from public.entries where user_id = p_user) >= 3600000 then got := array_append(got, 'marathon'); end if;
  if exists (select 1 from public.entries where user_id = p_user and status = 'completed' and started_on is not null and started_on = date) then got := array_append(got, 'speedrun'); end if;
  if exists (select 1 from public.entries where user_id = p_user and ext_id like 'steam:%') then got := array_append(got, 'steam'); end if;
  if (select count(*) from public.follows a
      join public.follows b on b.follower_id = a.following_id and b.following_id = a.follower_id
      where a.follower_id = p_user) >= 10 then got := array_append(got, 'social'); end if;
  if (select count(*) from public.follows where following_id = p_user) >= 10 then got := array_append(got, 'popular'); end if;
  if (select count(*) from public.lists where user_id = p_user and is_public) >= 5 then got := array_append(got, 'curator'); end if;
  if (select count(*) from public.comments where user_id = p_user) >= 25 then got := array_append(got, 'commenter'); end if;
  if (select count(*) from public.likes l join public.entries e on e.id = l.entry_id where e.user_id = p_user) >= 25 then got := array_append(got, 'loved'); end if;
  if (select count(*) from public.forum_posts where user_id = p_user) + (select count(*) from public.forum_threads where user_id = p_user) >= 10 then got := array_append(got, 'forum'); end if;

  if cardinality(got) > 0 then
    insert into public.user_badges (user_id, badge) select p_user, unnest(got) on conflict do nothing;
  end if;
end;
$$;
revoke all on function public.award_badges(uuid) from public, anon, authenticated;

create or replace function public.award_badges_trg() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'follows' then
    perform public.award_badges(new.follower_id);
    perform public.award_badges(new.following_id);
  elsif tg_table_name = 'likes' then
    perform public.award_badges((select user_id from public.entries where id = new.entry_id));
  else
    perform public.award_badges(new.user_id);
  end if;
  return null;
end;
$$;
drop trigger if exists comments_badges on public.comments;
drop trigger if exists likes_badges on public.likes;
drop trigger if exists forum_threads_badges on public.forum_threads;
drop trigger if exists forum_posts_badges on public.forum_posts;
create trigger comments_badges after insert on public.comments for each row execute function public.award_badges_trg();
create trigger likes_badges after insert on public.likes for each row execute function public.award_badges_trg();
create trigger forum_threads_badges after insert on public.forum_threads for each row execute function public.award_badges_trg();
create trigger forum_posts_badges after insert on public.forum_posts for each row execute function public.award_badges_trg();

-- Şimdiye kadar hak edenlere hemen ver
select public.award_badges(id) from public.profiles;

notify pgrst, 'reload schema';
