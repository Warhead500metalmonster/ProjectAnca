-- 005: profil şarkısı artık herkese açık (004'te sadece site sahibine özeldi).
-- Supabase → SQL Editor → New query → yapıştır → Run. Tekrar çalıştırmak zararsızdır.
drop trigger if exists profiles_song on public.profiles;
drop function if exists public.check_profile_song();

notify pgrst, 'reload schema';
