-- 013: yöneticiye yeni yetkiler: susturma, profil temizleme, inceleme / kayıt / liste kaldırma.
-- Supabase → SQL Editor → New query → hepsini yapıştır → Run. Tekrar çalıştırmak zararsızdır.

-- Yönetici bu kişiye işlem yapabilir mi? Site sahibine kimse dokunamaz; yöneticilere sadece site sahibi.
create or replace function public.can_moderate(p_target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin()
    and not exists (select 1 from public.user_badges where user_id = p_target and badge = 'owner')
    and (not exists (select 1 from public.user_badges where user_id = p_target and badge = 'admin')
         or exists (select 1 from public.user_badges where user_id = auth.uid() and badge = 'owner'));
$$;
grant execute on function public.can_moderate(uuid) to authenticated;

create or replace function public.moderated_user(p_username text) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid;
begin
  select id into uid from public.profiles where username = lower(btrim(p_username, ' @'));
  if uid is null then raise exception 'Böyle bir kullanıcı yok.'; end if;
  if not public.can_moderate(uid) then raise exception 'Bu kişiye bu işlemi yapamazsın.'; end if;
  return uid;
end;
$$;
revoke all on function public.moderated_user(text) from public, anon, authenticated;

-- ---------- Susturma: süre bitene kadar yorum, forum ve mesaj yazamaz (site sahibine yazabilir) ----------
alter table public.profiles add column if not exists muted_until timestamptz;

-- Kişi kendi susturmasını profil düzenlerken kaldıramasın
create or replace function public.keep_muted() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.muted_until is distinct from old.muted_until and not public.is_admin() then new.muted_until := old.muted_until; end if;
  return new;
end;
$$;
drop trigger if exists profiles_keep_muted on public.profiles;
create trigger profiles_keep_muted before update on public.profiles for each row execute function public.keep_muted();

create or replace function public.block_muted() returns trigger
language plpgsql security definer set search_path = '' as $$
declare who uuid;
begin
  if tg_table_name = 'messages' then
    if exists (select 1 from public.user_badges where user_id = new.receiver_id and badge = 'owner') then return new; end if;
    who := new.sender_id;
  else
    who := new.user_id;
  end if;
  if exists (select 1 from public.profiles where id = who and muted_until > now()) then
    raise exception 'Susturuldun: % tarihine kadar yazı yazamazsın. Site sahibine yazabilirsin.',
      to_char((select muted_until from public.profiles where id = who) at time zone 'Europe/Istanbul', 'DD.MM.YYYY HH24:MI');
  end if;
  return new;
end;
$$;
drop trigger if exists comments_muted on public.comments;
create trigger comments_muted before insert on public.comments for each row execute function public.block_muted();
drop trigger if exists forum_threads_muted on public.forum_threads;
create trigger forum_threads_muted before insert on public.forum_threads for each row execute function public.block_muted();
drop trigger if exists forum_posts_muted on public.forum_posts;
create trigger forum_posts_muted before insert on public.forum_posts for each row execute function public.block_muted();
drop trigger if exists messages_muted on public.messages;
create trigger messages_muted before insert on public.messages for each row execute function public.block_muted();

-- p_hours = 0 susturmayı kaldırır
create or replace function public.admin_mute(p_username text, p_hours int) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.moderated_user(p_username);
begin
  update public.profiles set muted_until = case when p_hours > 0 then now() + make_interval(hours => p_hours) else null end where id = uid;
end;
$$;
revoke all on function public.admin_mute(text, int) from public, anon;
grant execute on function public.admin_mute(text, int) to authenticated;

-- ---------- Profil temizleme: uygunsuz ad, yazı, fotoğraf, kapak, arka plan, şarkı ----------
create or replace function public.admin_reset_profile(p_username text, p_parts text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.moderated_user(p_username);
begin
  update public.profiles set
    display_name = case when 'name' = any(p_parts) then null else display_name end,
    bio          = case when 'bio' = any(p_parts) then null else bio end,
    avatar_url   = case when 'avatar' = any(p_parts) then null else avatar_url end,
    banner_url   = case when 'banner' = any(p_parts) then null else banner_url end,
    bg_url       = case when 'bg' = any(p_parts) then null else bg_url end,
    song_url     = case when 'song' = any(p_parts) then null else song_url end,
    song_title   = case when 'song' = any(p_parts) then null else song_title end,
    home_layout  = case when 'home' = any(p_parts) and home_layout is not null then home_layout - 'text' else home_layout end
  where id = uid;
end;
$$;
revoke all on function public.admin_reset_profile(text, text[]) from public, anon;
grant execute on function public.admin_reset_profile(text, text[]) to authenticated;

-- ---------- İnceleme / kayıt / liste kaldırma ----------
create or replace function public.admin_clear_review(p_entry uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare owner uuid;
begin
  select user_id into owner from public.entries where id = p_entry;
  if owner is null then raise exception 'Kayıt bulunamadı.'; end if;
  if not public.can_moderate(owner) then raise exception 'Bu kişiye bu işlemi yapamazsın.'; end if;
  update public.entries set notes = null, progress = null, drop_note = null where id = p_entry;
end;
$$;
revoke all on function public.admin_clear_review(uuid) from public, anon;
grant execute on function public.admin_clear_review(uuid) to authenticated;

create or replace function public.admin_delete_entry(p_entry uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare owner uuid;
begin
  select user_id into owner from public.entries where id = p_entry;
  if owner is null then raise exception 'Kayıt bulunamadı.'; end if;
  if not public.can_moderate(owner) then raise exception 'Bu kişiye bu işlemi yapamazsın.'; end if;
  delete from public.entries where id = p_entry;
end;
$$;
revoke all on function public.admin_delete_entry(uuid) from public, anon;
grant execute on function public.admin_delete_entry(uuid) to authenticated;

create or replace function public.admin_delete_list(p_list uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare owner uuid;
begin
  select user_id into owner from public.lists where id = p_list;
  if owner is null then raise exception 'Liste bulunamadı.'; end if;
  if not public.can_moderate(owner) then raise exception 'Bu kişiye bu işlemi yapamazsın.'; end if;
  delete from public.lists where id = p_list;
end;
$$;
revoke all on function public.admin_delete_list(uuid) from public, anon;
grant execute on function public.admin_delete_list(uuid) to authenticated;

notify pgrst, 'reload schema';
