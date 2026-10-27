-- Kayıtlara platform, mağaza, başlama tarihi, oynama süresi ve ilerleme alanları.
-- (Var olan veritabanına bir kez çalıştırılır. Yeni kurulumda schema.sql zaten içeriyor.)

alter table public.entries
  add column if not exists platform text check (char_length(platform) <= 60),
  add column if not exists store text check (char_length(store) <= 60),
  add column if not exists started_on date,
  add column if not exists hours numeric(7, 1) check (hours >= 0 and hours < 100000),
  add column if not exists progress text check (char_length(progress) <= 200);

-- Supabase API'nin yeni sütunları hemen görmesi için
notify pgrst, 'reload schema';
