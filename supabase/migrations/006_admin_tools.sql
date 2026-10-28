-- 006: yöneticiler rozet verebilir, site geneline duyuru yazabilir.
-- Supabase → SQL Editor → New query → hepsini yapıştır → Run. Tekrar çalıştırmak zararsızdır.

-- ---------- Rozet ver / al (site sahibi ve yönetici rozetleri hariç) ----------
create or replace function public.set_badge(p_username text, p_badge text, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'Bunun için yönetici olmalısın.'; end if;
  if p_badge not in ('founder', 'critic', 'completionist', 'marathon', 'social', 'curator', 'cinephile', 'otaku', 'melomane') then
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

-- ---------- Site ayarları (şimdilik: herkesin göreceği duyuru) ----------
create table if not exists public.site_settings (
  key text primary key check (char_length(key) <= 40),
  value jsonb not null default '{}' check (pg_column_size(value) < 5000),
  updated_by uuid default auth.uid() references public.profiles on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
drop policy if exists "ayarlar herkese açık" on public.site_settings;
drop policy if exists "ayarı yönetici ekler" on public.site_settings;
drop policy if exists "ayarı yönetici değiştirir" on public.site_settings;
drop policy if exists "ayarı yönetici siler" on public.site_settings;
create policy "ayarlar herkese açık" on public.site_settings for select using (true);
create policy "ayarı yönetici ekler" on public.site_settings for insert with check (public.is_admin());
create policy "ayarı yönetici değiştirir" on public.site_settings for update using (public.is_admin());
create policy "ayarı yönetici siler" on public.site_settings for delete using (public.is_admin());
revoke all on public.site_settings from anon, authenticated;
grant select on public.site_settings to anon, authenticated;
grant insert, update, delete on public.site_settings to authenticated;

notify pgrst, 'reload schema';
