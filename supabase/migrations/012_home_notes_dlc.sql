-- Kayıtta "DLC ile bitirdim" işareti ve bırakılan oyun için bırakma notu; not alanı 1000 karaktere çıkar (HLTB General Notes sığsın)
alter table public.entries
  add column if not exists dlc boolean not null default false,
  add column if not exists drop_note text check (char_length(drop_note) <= 2000);
alter table public.entries drop constraint if exists entries_progress_check;
alter table public.entries add constraint entries_progress_check check (char_length(progress) <= 1000);

-- Listedeki her içeriğe listeye özel not
alter table public.list_items add column if not exists note text check (char_length(note) <= 1000);

-- Profil ana sayfası: hangi bölümler hangi sırayla görünsün, üstteki serbest yazı
alter table public.profiles add column if not exists home_layout jsonb;
