-- 018: Topluluk sayfasında duyurular. Herkes okur; sadece site sahibi yazar, düzenler, siler.
-- Supabase → SQL Editor → New query → hepsini yapıştır → Run. Tekrar çalıştırmak zararsızdır.

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  body text check (char_length(body) <= 4000),
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.announcements enable row level security;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_badges where user_id = auth.uid() and badge = 'owner');
$$;
grant execute on function public.is_owner() to anon, authenticated;

drop policy if exists "duyuruları herkes okur" on public.announcements;
create policy "duyuruları herkes okur" on public.announcements for select using (true);
drop policy if exists "duyuruyu site sahibi yazar" on public.announcements;
create policy "duyuruyu site sahibi yazar" on public.announcements for insert with check (public.is_owner() and author_id = auth.uid());
drop policy if exists "duyuruyu site sahibi düzenler" on public.announcements;
create policy "duyuruyu site sahibi düzenler" on public.announcements for update using (public.is_owner());
drop policy if exists "duyuruyu site sahibi siler" on public.announcements;
create policy "duyuruyu site sahibi siler" on public.announcements for delete using (public.is_owner());

notify pgrst, 'reload schema';
