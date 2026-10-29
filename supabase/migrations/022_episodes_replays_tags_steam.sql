-- 022: dizi/anime bölüm takibi, tekrar oynama/izleme geçmişi, kendi etiketlerin, Steam otomatik senkronu.
-- Supabase → SQL Editor → New query → hepsini yapıştır → Run. Tekrar çalıştırmak zararsızdır.

-- Bölüm takibi: kaçıncı sezon, kaçıncı bölüm, toplam kaç bölüm (dizi ve animelerde)
alter table public.entries add column if not exists season int check (season between 0 and 1000);
alter table public.entries add column if not exists episode int check (episode between 0 and 100000);
alter table public.entries add column if not exists episodes_total int check (episodes_total between 0 and 100000);

-- Tekrar oynama / izleme: önceki seferler [{"started_on": "...", "date": "...", "rating": 9, "playtime_sec": 3600}]
alter table public.entries add column if not exists plays jsonb not null default '[]'::jsonb;

-- Kendi etiketlerin: "co-op", "çocukluğum", "yağmurlu gün" gibi (en fazla 20)
alter table public.entries add column if not exists tags text[] not null default '{}';
do $$ begin
  alter table public.entries add constraint entries_tags_max check (cardinality(tags) <= 20);
exception when duplicate_object then null; end $$;
create index if not exists entries_tags_idx on public.entries using gin (tags);

-- Steam otomatik senkron: Steam kimliği sadece sahibinde durur, profilde herkese görünmez
create table if not exists public.steam_links (
  user_id uuid primary key default auth.uid() references public.profiles on delete cascade,
  steam_id text not null check (steam_id ~ '^\d{17}$'),
  created_at timestamptz not null default now()
);
alter table public.steam_links enable row level security;
drop policy if exists "steam_links own" on public.steam_links;
create policy "steam_links own" on public.steam_links for all using (user_id = auth.uid()) with check (user_id = auth.uid());

notify pgrst, 'reload schema';
