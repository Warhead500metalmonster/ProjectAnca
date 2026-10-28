-- Yeni türler: kitap, yer, yemek.
-- entries, list_items ve catalog tablolarındaki tür kısıtı genişletilir. Var olan veritabanına bir kez çalıştırılır.

do $$
declare r record;
begin
  -- Eski kısıtın adı sürüme göre değişebilir; 'anime' geçen tür kısıtlarını bulup kaldırır
  for r in
    select conrelid::regclass as tbl, conname from pg_constraint
    where contype = 'c'
      and conrelid in ('public.entries'::regclass, 'public.list_items'::regclass, 'public.catalog'::regclass)
      and pg_get_constraintdef(oid) like '%''anime''%'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

alter table public.entries    add constraint entries_type_check    check (type in ('game', 'movie', 'show', 'music', 'anime', 'book', 'place', 'food'));
alter table public.list_items add constraint list_items_type_check check (type in ('game', 'movie', 'show', 'music', 'anime', 'book', 'place', 'food'));
alter table public.catalog    add constraint catalog_type_check    check (type in ('game', 'movie', 'show', 'music', 'anime', 'book', 'place', 'food'));

notify pgrst, 'reload schema';
