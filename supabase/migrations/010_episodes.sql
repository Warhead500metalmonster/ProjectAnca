-- Dizi ve animede bölüm bölüm ilerleme: { "1": [1, 2, 3], "2": [1] } (sezon -> izlenen bölümler).
-- Var olan veritabanına bir kez çalıştırılır (Supabase SQL Editor).

alter table public.entries
  add column if not exists episodes jsonb check (episodes is null or jsonb_typeof(episodes) = 'object');

-- Supabase API'nin yeni sütunu hemen görmesi için
notify pgrst, 'reload schema';
