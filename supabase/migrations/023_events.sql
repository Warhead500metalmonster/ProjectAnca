-- 023: Etkinlikler. Yönetim bir etkinlik açar (ör. "Hep birlikte Ocarina of Time"), üyeler katılıp sürümünü seçer,
-- nerede olduğunu yazar, bitirince işaretler. İlk etkinlik: 5 Kasım 2026'da başlayan Ocarina of Time.
-- Supabase → SQL Editor → New query → hepsini yapıştır → Run. Tekrar çalıştırmak zararsızdır.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 4000),
  cover text check (cover is null or cover ~ '^https://'),
  kind text not null default 'game' check (kind in ('game', 'movie', 'show', 'music', 'anime')),
  -- Seçilebilecek sürümler: [{"id": "n64", "label": "Orijinal", "sub": "Nintendo 64 · 1998", "title": "...", "rawg_id": 25097, "cover": "https://..."}]
  options jsonb not null default '[]'::jsonb,
  starts_on date not null default current_date,
  ends_on date,
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);
alter table public.events enable row level security;
drop policy if exists "events read" on public.events;
create policy "events read" on public.events for select using (true);
drop policy if exists "events admin" on public.events;
create policy "events admin" on public.events for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.event_members (
  event_id uuid not null references public.events on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  choice text check (char_length(choice) <= 40),              -- seçtiği sürüm (options[].id)
  status text not null default 'joined' check (status in ('joined', 'playing', 'done')),
  note text check (char_length(note) <= 140),                  -- "Su Tapınağı'ndayım" gibi
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  primary key (event_id, user_id)
);
alter table public.event_members enable row level security;
drop policy if exists "event_members read" on public.event_members;
create policy "event_members read" on public.event_members for select using (true);
drop policy if exists "event_members join" on public.event_members;
create policy "event_members join" on public.event_members for insert with check (user_id = auth.uid());
drop policy if exists "event_members own" on public.event_members;
create policy "event_members own" on public.event_members for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "event_members leave" on public.event_members;
create policy "event_members leave" on public.event_members for delete using (user_id = auth.uid() or public.is_admin());
create index if not exists event_members_user_idx on public.event_members (user_id);

-- Etkinlik sohbeti: katılanlar ve izleyenler yazar; spoiler içeren mesaj gizli gösterilir
create table if not exists public.event_posts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  spoiler boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.event_posts enable row level security;
drop policy if exists "event_posts read" on public.event_posts;
create policy "event_posts read" on public.event_posts for select using (true);
drop policy if exists "event_posts write" on public.event_posts;
create policy "event_posts write" on public.event_posts for insert with check (user_id = auth.uid());
drop policy if exists "event_posts delete" on public.event_posts;
create policy "event_posts delete" on public.event_posts for delete using (user_id = auth.uid() or public.is_admin());
create index if not exists event_posts_event_idx on public.event_posts (event_id, created_at);
-- Susturulan kişi etkinlik sohbetine de yazamaz
drop trigger if exists event_posts_muted on public.event_posts;
create trigger event_posts_muted before insert on public.event_posts for each row execute function public.block_muted();

-- Etkinlik mesajları da raporlanabilir
alter table public.reports drop constraint if exists reports_kind_check;
alter table public.reports add constraint reports_kind_check
  check (kind in ('profile', 'entry', 'comment', 'list', 'forum_thread', 'forum_post', 'message', 'event_post'));

-- Bir etkinliği bitirene "Etkinlik ruhu" rozeti (bir kez)
create or replace function public.event_badge() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'done' then
    insert into public.user_badges (user_id, badge) values (new.user_id, 'event') on conflict do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists event_members_badge on public.event_members;
create trigger event_members_badge after insert or update of status on public.event_members for each row execute function public.event_badge();

-- İlk etkinlik: Ocarina of Time (orijinal, 3DS ya da Switch 2 remake; hangisini istersen)
insert into public.events (id, title, description, cover, kind, options, starts_on, created_by)
values (
  '0c0a1998-0000-4000-8000-000000000001',
  'Hep birlikte Ocarina of Time',
  'Hyrule''a birlikte dönüyoruz! 5 Kasım''da Switch 2 remake''i çıkıyor, biz de o gün hep beraber başlıyoruz.' || chr(10) ||
  'Hangi sürümü istersen onu oyna: 1998''in efsane orijinali, 3DS''in yenilenmiş 3D''si ya da yepyeni Switch 2 remake''i. Acele yok, herkes kendi hızında.' || chr(10) ||
  'Katıl, sürümünü seç, nerede olduğunu arada bir yaz (ör. "Su Tapınağı''ndayım, yardım!"), bitirince işaretle. Spoiler vermeden birbirimize gaz verelim.',
  'https://media.rawg.io/media/screenshots/027/027d98b047ff674113dd77d2d4614276.jpg',
  'game',
  '[
    {"id": "n64", "label": "Orijinal", "sub": "Nintendo 64 · 1998", "title": "The Legend of Zelda: Ocarina of Time", "rawg_id": 25097, "cover": "https://media.rawg.io/media/games/3a0/3a0c8e9ed3a711c542218831b893a0fa.jpg", "platform": "Nintendo 64"},
    {"id": "3ds", "label": "3DS remake", "sub": "Nintendo 3DS · 2011", "title": "The Legend of Zelda: Ocarina of Time 3D", "rawg_id": 27969, "cover": "https://media.rawg.io/media/games/c91/c916af1fa182bc2d674b4d9270bb7713.jpg", "platform": "Nintendo 3DS"},
    {"id": "switch2", "label": "Switch 2 remake", "sub": "Nintendo Switch 2 · 2026", "title": "The Legend of Zelda: Ocarina of Time", "rawg_id": 1019942, "cover": "https://media.rawg.io/media/games/c3b/c3bc70310175785b0c9d7bfc93624d5f.jpg", "platform": "Nintendo Switch 2"}
  ]'::jsonb,
  '2026-11-05',
  (select id from public.profiles where username = 'arno4436')
)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
