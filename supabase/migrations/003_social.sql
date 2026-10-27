-- 003: saniyeli süre, emülatör, favoriler, 10'luk puan, profil kişiselleştirme,
-- rozetler, beğeni/yorum, listeler ve arkadaş sohbeti.
-- Supabase → SQL Editor → New query → hepsini yapıştır → Run. Tekrar çalıştırmak zararsızdır.

-- ---------- Kayıtlar ----------
alter table public.entries
  add column if not exists playtime_sec int check (playtime_sec >= 0 and playtime_sec < 360000000),
  add column if not exists progress_sec int check (progress_sec >= 0 and progress_sec < 360000000),
  add column if not exists emulated boolean not null default false,
  add column if not exists favorite boolean not null default false,
  -- Dış kaynaktaki kimlik: tmdb:movie:123, tmdb:tv:456, anilist:789, itunes:321
  add column if not exists ext_id text check (char_length(ext_id) <= 60);

update public.entries set playtime_sec = round(hours * 3600) where hours is not null and playtime_sec is null;

-- Puan 0-10 arası, yarım adımlı (5'lik ölçekte yarım yıldız = 1, 10'luk ölçekte 7,5 gibi)
alter table public.entries alter column rating type numeric(3, 1);
alter table public.entries drop constraint if exists entries_rating_half;
alter table public.entries add constraint entries_rating_half check (rating * 2 = floor(rating * 2));

-- Her kategoride en fazla 10 favori
create or replace function public.check_favorites() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.entries
      where user_id = new.user_id and type = new.type and favorite and id <> new.id) >= 10 then
    raise exception 'Her kategoride en fazla 10 favori seçebilirsin.';
  end if;
  return new;
end;
$$;
drop trigger if exists entries_favorites on public.entries;
create trigger entries_favorites before insert or update on public.entries
  for each row when (new.favorite) execute function public.check_favorites();

-- ---------- Profil ----------
alter table public.profiles
  add column if not exists banner_url text check (banner_url ~ '^https://'),
  add column if not exists accent text check (accent ~ '^#[0-9a-fA-F]{6}$'),
  add column if not exists rating_scale smallint not null default 5 check (rating_scale in (5, 10)),
  add column if not exists socials jsonb not null default '{}'
    check (jsonb_typeof(socials) = 'object' and pg_column_size(socials) < 2000),
  add column if not exists location text check (char_length(location) <= 40),
  add column if not exists pronouns text check (char_length(pronouns) <= 20);

-- Not: aşağıdaki tablolarda önce "revoke all" var, çünkü Supabase yeni tablolara varsayılan olarak tüm izinleri verir.

-- ---------- Rozetler (sadece veritabanından verilir, kullanıcı kendine ekleyemez) ----------
create table if not exists public.user_badges (
  user_id uuid not null references public.profiles on delete cascade,
  badge text not null check (char_length(badge) <= 30),
  granted_at timestamptz not null default now(),
  primary key (user_id, badge)
);
alter table public.user_badges enable row level security;
drop policy if exists "rozetler herkese açık" on public.user_badges;
create policy "rozetler herkese açık" on public.user_badges for select using (true);
revoke all on public.user_badges from anon, authenticated;
grant select on public.user_badges to anon, authenticated;

-- İlk 6 üye + sonra katılan 15 kişi "Öncü" rozeti alır; site sahibi @arno4436
insert into public.user_badges (user_id, badge)
  select id, 'founder' from public.profiles
  where username in ('arno4436', 'vacir', 'lears', 'end', 'kaanyews', 'wulfa')
  on conflict do nothing;
insert into public.user_badges (user_id, badge)
  select id, 'owner' from public.profiles where username = 'arno4436'
  on conflict do nothing;

create or replace function public.grant_founder() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.user_badges where badge = 'founder') < 21 then
    insert into public.user_badges (user_id, badge) values (new.id, 'founder') on conflict do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists on_profile_created on public.profiles;
create trigger on_profile_created after insert on public.profiles
  for each row execute function public.grant_founder();

-- ---------- Beğeniler ----------
create table if not exists public.likes (
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  entry_id uuid not null references public.entries on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, entry_id)
);
create index if not exists likes_entry_idx on public.likes (entry_id);
alter table public.likes enable row level security;
drop policy if exists "beğeniler herkese açık" on public.likes;
drop policy if exists "beğen" on public.likes;
drop policy if exists "beğeniyi geri al" on public.likes;
create policy "beğeniler herkese açık" on public.likes for select using (true);
create policy "beğen" on public.likes for insert with check (auth.uid() = user_id);
create policy "beğeniyi geri al" on public.likes for delete using (auth.uid() = user_id);
revoke all on public.likes from anon, authenticated;
grant select on public.likes to anon, authenticated;
grant insert (entry_id), delete on public.likes to authenticated;

-- ---------- Yorumlar ----------
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists comments_entry_idx on public.comments (entry_id, created_at);
alter table public.comments enable row level security;
drop policy if exists "yorumlar herkese açık" on public.comments;
drop policy if exists "yorum yaz" on public.comments;
drop policy if exists "yorumu sil" on public.comments;
create policy "yorumlar herkese açık" on public.comments for select using (true);
create policy "yorum yaz" on public.comments for insert with check (auth.uid() = user_id);
-- Yorumu yazan ya da kaydın sahibi silebilir
create policy "yorumu sil" on public.comments for delete using (
  auth.uid() = user_id or auth.uid() = (select e.user_id from public.entries e where e.id = entry_id)
);
revoke all on public.comments from anon, authenticated;
grant select on public.comments to anon, authenticated;
grant insert (entry_id, body), delete on public.comments to authenticated;

-- ---------- Listeler ----------
create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  description text check (char_length(description) <= 1000),
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lists_user_idx on public.lists (user_id, updated_at desc);

create table if not exists public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists on delete cascade,
  type text not null check (type in ('game', 'movie', 'show', 'music', 'anime')),
  title text not null check (char_length(title) between 1 and 200),
  year int check (year between 1800 and 2100),
  creator text check (char_length(creator) <= 200),
  cover text check (cover ~ '^https?://'),
  rawg_id int,
  ext_id text check (char_length(ext_id) <= 60),
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists list_items_list_idx on public.list_items (list_id, position);
alter table public.list_items add column if not exists ext_id text check (char_length(ext_id) <= 60);

alter table public.lists enable row level security;
alter table public.list_items enable row level security;
drop policy if exists "açık listeler ve kendi listelerin" on public.lists;
drop policy if exists "liste oluştur" on public.lists;
drop policy if exists "listeni düzenle" on public.lists;
drop policy if exists "listeni sil" on public.lists;
create policy "açık listeler ve kendi listelerin" on public.lists for select using (is_public or auth.uid() = user_id);
create policy "liste oluştur" on public.lists for insert with check (auth.uid() = user_id);
create policy "listeni düzenle" on public.lists for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "listeni sil" on public.lists for delete using (auth.uid() = user_id);

drop policy if exists "görülebilen listelerin içeriği" on public.list_items;
drop policy if exists "kendi listene ekle" on public.list_items;
drop policy if exists "kendi listeni düzenle" on public.list_items;
drop policy if exists "kendi listenden sil" on public.list_items;
create policy "görülebilen listelerin içeriği" on public.list_items for select using (
  exists (select 1 from public.lists l where l.id = list_id and (l.is_public or l.user_id = auth.uid()))
);
create policy "kendi listene ekle" on public.list_items for insert with check (
  exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid())
);
create policy "kendi listeni düzenle" on public.list_items for update
  using (exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid()))
  with check (exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid()));
create policy "kendi listenden sil" on public.list_items for delete using (
  exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid())
);
revoke all on public.lists, public.list_items from anon, authenticated;
grant select on public.lists, public.list_items to anon, authenticated;
grant insert, update, delete on public.lists, public.list_items to authenticated;

-- ---------- Sohbet (sadece karşılıklı takipleşen arkadaşlar) ----------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null default auth.uid() references public.profiles on delete cascade,
  receiver_id uuid not null references public.profiles on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> receiver_id)
);
create index if not exists messages_receiver_idx on public.messages (receiver_id, created_at desc);
create index if not exists messages_sender_idx on public.messages (sender_id, created_at desc);
alter table public.messages enable row level security;
drop policy if exists "kendi mesajlarını gör" on public.messages;
drop policy if exists "arkadaşına yaz" on public.messages;
drop policy if exists "okundu işaretle" on public.messages;
create policy "kendi mesajlarını gör" on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);
create policy "arkadaşına yaz" on public.messages for insert with check (
  auth.uid() = sender_id
  and exists (select 1 from public.follows where follower_id = auth.uid() and following_id = receiver_id)
  and exists (select 1 from public.follows where follower_id = receiver_id and following_id = auth.uid())
);
create policy "okundu işaretle" on public.messages for update
  using (auth.uid() = receiver_id) with check (auth.uid() = receiver_id);
-- Supabase yeni tablolara varsayılan olarak her izni verir; önce geri al, sonra sadece gerekenleri ver
revoke all on public.messages from anon, authenticated;
grant select on public.messages to authenticated;
grant insert (receiver_id, body), update (read_at) on public.messages to authenticated;

notify pgrst, 'reload schema';
