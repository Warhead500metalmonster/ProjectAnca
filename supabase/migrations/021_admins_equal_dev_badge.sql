-- 021: yöneticiler site sahibiyle aynı yetkilere sahip (yönetici atama, hesap silme, duyuru, diğer yöneticilere işlem);
-- sadece site sahibine dokunulamaz. Geliştirici rozeti: @arno4436 ve @wulfa'ya özel, panelden verilemez.
-- Supabase → SQL Editor → New query → hepsini yapıştır → Run. Tekrar çalıştırmak zararsızdır.

-- Yönetici atama / kaldırma: site sahibi ve yöneticiler (yönetici rozeti de böylece kendiliğinden gelir)
create or replace function public.set_admin(p_username text, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'Bunun için yönetici olmalısın.'; end if;
  select id into uid from public.profiles where username = lower(btrim(p_username, ' @'));
  if uid is null then raise exception 'Böyle bir kullanıcı yok.'; end if;
  if exists (select 1 from public.user_badges where user_id = uid and badge = 'owner') then
    raise exception 'Site sahibine işlem yapılamaz.';
  end if;
  if p_on then
    insert into public.user_badges (user_id, badge) values (uid, 'admin') on conflict do nothing;
  else
    delete from public.user_badges where user_id = uid and badge = 'admin';
  end if;
end;
$$;
revoke all on function public.set_admin(text, boolean) from public, anon;
grant execute on function public.set_admin(text, boolean) to authenticated;

-- Moderasyon: yönetici site sahibi dışında herkese işlem yapabilir
create or replace function public.can_moderate(p_target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin()
    and not exists (select 1 from public.user_badges where user_id = p_target and badge = 'owner');
$$;
grant execute on function public.can_moderate(uuid) to authenticated;

-- Hesap silme: yöneticiler de yapabilir (site sahibinin hesabı silinemez)
create or replace function public.admin_delete_user(p_username text, p_ban boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'Bunun için yönetici olmalısın.'; end if;
  select id into uid from public.profiles where username = lower(btrim(p_username, ' @'));
  if uid is null then raise exception 'Böyle bir kullanıcı yok.'; end if;
  if exists (select 1 from public.user_badges where user_id = uid and badge = 'owner') then
    raise exception 'Site sahibinin hesabı silinemez.';
  end if;
  if p_ban then
    insert into public.blocked_emails (email) select lower(email) from auth.users where id = uid and email is not null on conflict do nothing;
  end if;
  delete from auth.users where id = uid;
end;
$$;
revoke all on function public.admin_delete_user(text, boolean) from public, anon;
grant execute on function public.admin_delete_user(text, boolean) to authenticated;

-- Duyurular: yöneticiler de yazar, düzenler, siler
drop policy if exists "duyuruyu site sahibi yazar" on public.announcements;
create policy "duyuruyu site sahibi yazar" on public.announcements for insert with check (public.is_admin() and author_id = auth.uid());
drop policy if exists "duyuruyu site sahibi düzenler" on public.announcements;
create policy "duyuruyu site sahibi düzenler" on public.announcements for update using (public.is_admin());
drop policy if exists "duyuruyu site sahibi siler" on public.announcements;
create policy "duyuruyu site sahibi siler" on public.announcements for delete using (public.is_admin());

-- Rozet verme: site sahibi, yönetici ve geliştirici rozetleri panelden verilemez
create or replace function public.set_badge(p_username text, p_badge text, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'Bunun için yönetici olmalısın.'; end if;
  if p_badge in ('owner', 'admin', 'dev') or p_badge !~ '^[a-z_]{2,30}$' then
    raise exception 'Bu rozet buradan verilemez.';
  end if;
  select id into uid from public.profiles where username = lower(btrim(p_username, ' @'));
  if uid is null then raise exception 'Böyle bir kullanıcı yok.'; end if;
  if p_on then
    insert into public.user_badges (user_id, badge) values (uid, p_badge) on conflict do nothing;
  else
    delete from public.user_badges where user_id = uid and badge = p_badge;
  end if;
end;
$$;
revoke all on function public.set_badge(text, text, boolean) from public, anon;
grant execute on function public.set_badge(text, text, boolean) to authenticated;

-- Geliştirici rozeti: sadece @arno4436 ve @wulfa
insert into public.user_badges (user_id, badge)
  select id, 'dev' from public.profiles where username in ('arno4436', 'wulfa')
  on conflict do nothing;

notify pgrst, 'reload schema';
