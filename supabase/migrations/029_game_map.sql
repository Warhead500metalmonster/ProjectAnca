-- 029: IGDB geçişi için eşleştirme tablosu. Kayıtlara (entries) dokunmaz, hiçbir şey silmez.
-- Supabase → SQL Editor → New query → hepsini yapıştır → Run. Tekrar çalıştırmak zararsızdır.

-- Sitedeki eski oyun numarası → IGDB'deki numarası. Bu tablo olmadan da bütün loglar yerinde durur.
create table if not exists public.game_map (
  rawg_id int primary key,
  igdb_id int not null,
  n int not null default 0,   -- bu numarayla kaç log var (aynı oyuna bağlı iki eski numaradan çok loglu olan öne çıkar)
  how text not null check (how in ('steam', 'name', 'manual'))
);
create index if not exists game_map_igdb_idx on public.game_map (igdb_id);
alter table public.game_map enable row level security;
drop policy if exists "game_map herkese açık" on public.game_map;
create policy "game_map herkese açık" on public.game_map for select using (true);
grant select on public.game_map to anon, authenticated;

-- Eşleştirilecek oyunların listesi (kimin olduğu yok, sadece oyun adı ve sayı). Eşleştirme bitince kaldırılacak.
create or replace function public.games_to_map()
returns table (rawg_id int, title text, year int, steam text, n bigint)
language sql stable security definer set search_path = '' as $$
  select e.rawg_id, (array_agg(e.title order by e.created_at))[1], max(e.year),
    (array_agg(e.ext_id) filter (where e.ext_id like 'steam:%'))[1], count(*)
  from public.entries e
  where e.type = 'game' and e.rawg_id is not null
  group by e.rawg_id;
$$;
grant execute on function public.games_to_map() to anon, authenticated;

notify pgrst, 'reload schema';
