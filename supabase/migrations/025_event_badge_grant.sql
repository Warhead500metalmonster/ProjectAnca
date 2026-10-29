-- 025: Etkinliğe özel rozetler (ev_0c0a1998 gibi, içinde rakam var) yönetim panelinden verilip alınabilsin.
-- Supabase → SQL Editor → New query → hepsini yapıştır → Run. Tekrar çalıştırmak zararsızdır.
create or replace function public.set_badge(p_username text, p_badge text, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'Bunun için yönetici olmalısın.'; end if;
  if p_badge in ('owner', 'admin', 'dev') or p_badge !~ '^[a-z0-9_]{2,30}$' then
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

notify pgrst, 'reload schema';
