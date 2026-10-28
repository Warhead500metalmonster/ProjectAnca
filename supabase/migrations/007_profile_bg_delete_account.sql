-- 007: Steam'deki gibi profil teması ve profilin arkasını kaplayan arka plan resmi (link ile);
-- herkes kendi hesabını silebilir.
-- Supabase → SQL Editor → New query → hepsini yapıştır → Run. Tekrar çalıştırmak zararsızdır.
alter table public.profiles
  add column if not exists bg_url text check (bg_url ~ '^https://' and char_length(bg_url) <= 1000),
  add column if not exists profile_theme text check (profile_theme ~ '^[a-z]{1,20}$');

-- Hesabı kalıcı olarak siler. Profil, kayıtlar, listeler, beğeniler, yorumlar, mesajlar ve takipler de
-- bağlı oldukları için birlikte silinir. Eklediği ortak katalog içerikleri herkes kullandığı için kalır.
create or replace function public.delete_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Giriş yapmalısın.'; end if;
  if exists (select 1 from public.user_badges where user_id = auth.uid() and badge = 'owner') then
    raise exception 'Site sahibinin hesabı buradan silinemez.';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;

notify pgrst, 'reload schema';
