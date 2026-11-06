-- 036: MyAnimeList desteği: yönetimde elle eklenen ya da kaynağı olmayan animeler MyAnimeList'teki karşılığına da bağlanabilir.
-- Supabase → SQL Editor → New query → hepsini yapıştır → Run. Tekrar çalıştırmak zararsızdır. Hiçbir kayıt silinmez.

create or replace function public.link_catalog(p_id uuid, p_ext text, p_title text, p_creator text, p_year int, p_cover text) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.catalog;
begin
  if not public.is_admin() then raise exception 'Bunun için yönetici olmalısın.'; end if;
  if p_ext is null or p_ext !~ '^(tmdb:(movie|tv):\d+|anilist:\d+|mal:\d+|deezer:(album|track):\d+|itunes:\d+)$' then raise exception 'Geçersiz kaynak.'; end if;
  if p_cover is not null and p_cover !~ '^https://' then raise exception 'Geçersiz kapak.'; end if;
  select * into c from public.catalog where id = p_id;
  if c.id is null then raise exception 'İçerik bulunamadı.'; end if;
  p_title := left(btrim(p_title), 200);
  update public.entries set ext_id = p_ext, title = p_title, creator = coalesce(nullif(btrim(p_creator), ''), creator), year = coalesce(p_year, year),
      cover = case when cover is null or cover = c.cover then coalesce(p_cover, cover) else cover end
    where ext_id = c.ext_id;
  update public.list_items set ext_id = p_ext, title = p_title, creator = coalesce(nullif(btrim(p_creator), ''), creator), year = coalesce(p_year, year),
      cover = coalesce(p_cover, cover)
    where ext_id = c.ext_id;
  delete from public.catalog where id = c.id;
end;
$$;
revoke all on function public.link_catalog(uuid, text, text, text, int, text) from public, anon;
grant execute on function public.link_catalog(uuid, text, text, text, int, text) to authenticated;

create or replace function public.link_titles(p_type text, p_title text, p_ext text, p_new_title text, p_creator text, p_year int, p_cover text) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'Bunun için yönetici olmalısın.'; end if;
  if p_ext is null or p_ext !~ '^(tmdb:(movie|tv):\d+|anilist:\d+|mal:\d+|deezer:(album|track):\d+|itunes:\d+)$' then raise exception 'Geçersiz kaynak.'; end if;
  update public.entries set ext_id = p_ext, title = left(btrim(p_new_title), 200), creator = coalesce(nullif(btrim(p_creator), ''), creator),
      year = coalesce(p_year, year), cover = coalesce(cover, p_cover)
    where type = p_type and lower(btrim(title)) = lower(btrim(p_title)) and (ext_id is null or ext_id like 'cat:%');
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.link_titles(text, text, text, text, text, int, text) from public, anon;
grant execute on function public.link_titles(text, text, text, text, text, int, text) to authenticated;

notify pgrst, 'reload schema';
