-- Ancalog veritabanı şeması.
-- Supabase panelinde: SQL Editor → New query → bu dosyanın tamamını yapıştır → Run.

-- Kullanıcı profilleri (her hesap için bir satır, kayıt olunca otomatik oluşur)
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text check (char_length(display_name) <= 40),
  bio text check (char_length(bio) <= 300),
  avatar_url text check (avatar_url ~ '^https://'),
  created_at timestamptz not null default now()
);

-- Log kayıtları
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  type text not null check (type in ('game', 'movie', 'show', 'music', 'anime')),
  title text not null check (char_length(title) between 1 and 200),
  year int check (year between 1800 and 2100),
  creator text check (char_length(creator) <= 200),
  status text not null check (status in ('completed', 'active', 'planned', 'paused', 'dropped')),
  date date,
  rating int not null default 0 check (rating between 0 and 10),
  cover text check (cover ~ '^https?://'),
  notes text check (char_length(notes) <= 5000),
  rawg_id int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.entries (user_id, updated_at desc);
create index on public.entries (updated_at desc);
create index on public.entries (rawg_id);

-- Takip (arkadaş) ilişkileri
create table public.follows (
  follower_id uuid not null default auth.uid() references public.profiles on delete cascade,
  following_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index on public.follows (following_id);

-- Güvenlik: herkes okuyabilir, herkes sadece kendi verisini değiştirebilir
alter table public.profiles enable row level security;
alter table public.entries enable row level security;
alter table public.follows enable row level security;

create policy "profiller herkese açık" on public.profiles for select using (true);
create policy "kendi profilini düzenle" on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

create policy "kayıtlar herkese açık" on public.entries for select using (true);
create policy "kendi kaydını ekle" on public.entries for insert with check (auth.uid() = user_id);
create policy "kendi kaydını düzenle" on public.entries for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "kendi kaydını sil" on public.entries for delete using (auth.uid() = user_id);

create policy "takipler herkese açık" on public.follows for select using (true);
create policy "takip et" on public.follows for insert with check (auth.uid() = follower_id);
create policy "takibi bırak" on public.follows for delete using (auth.uid() = follower_id);

grant select on public.profiles, public.entries, public.follows to anon, authenticated;
grant update on public.profiles to authenticated;
grant insert, update, delete on public.entries to authenticated;
grant insert, delete on public.follows to authenticated;

-- Kayıt olunca profili oluştur (kullanıcı adı kayıt formundan gelir)
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    lower(new.raw_user_meta_data ->> 'username'),
    left(coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'username'), 40)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
