-- 020: engelleme ve raporlama.
-- Engellenen kişi engelleyeni takip edemez, ona mesaj yazamaz, kayıtlarına yorum yapamaz; engelleyince iki yöndeki takip de kalkar.
-- Raporlar sadece yönetim panelinde görünür; raporlayan kendi raporunu görebilir.
-- Supabase → SQL Editor → New query → hepsini yapıştır → Run. Tekrar çalıştırmak zararsızdır.

-- ---------- Engelleme ----------
create table if not exists public.blocks (
  blocker_id uuid not null default auth.uid() references public.profiles on delete cascade,
  blocked_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
drop policy if exists "kendi engellerini gör" on public.blocks;
create policy "kendi engellerini gör" on public.blocks for select using (auth.uid() = blocker_id);
drop policy if exists "engelle" on public.blocks;
create policy "engelle" on public.blocks for insert with check (auth.uid() = blocker_id);
drop policy if exists "engeli kaldır" on public.blocks;
create policy "engeli kaldır" on public.blocks for delete using (auth.uid() = blocker_id);
grant select, insert, delete on public.blocks to authenticated;

-- İki kişiden biri diğerini engellemiş mi?
create or replace function public.blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;
grant execute on function public.blocked_between(uuid, uuid) to authenticated;

-- Engelleyince aradaki takipler kalkar
create or replace function public.blocks_unfollow() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.follows where (follower_id = new.blocker_id and following_id = new.blocked_id)
    or (follower_id = new.blocked_id and following_id = new.blocker_id);
  return new;
end $$;
drop trigger if exists blocks_unfollow on public.blocks;
create trigger blocks_unfollow after insert on public.blocks for each row execute function public.blocks_unfollow();

-- Engel varsa takip, mesaj ve yorum yazılamaz
create or replace function public.no_blocked_contact() returns trigger
language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  if tg_table_name = 'follows' then target := new.following_id;
  elsif tg_table_name = 'messages' then target := new.receiver_id;
  elsif tg_table_name = 'comments' then select e.user_id into target from public.entries e where e.id = new.entry_id;
  end if;
  if target is not null and public.blocked_between(auth.uid(), target) then
    raise exception 'Bu kişiyle aranızda engel var.';
  end if;
  return new;
end $$;
drop trigger if exists follows_blocked on public.follows;
create trigger follows_blocked before insert on public.follows for each row execute function public.no_blocked_contact();
drop trigger if exists messages_blocked on public.messages;
create trigger messages_blocked before insert on public.messages for each row execute function public.no_blocked_contact();
drop trigger if exists comments_blocked on public.comments;
create trigger comments_blocked before insert on public.comments for each row execute function public.no_blocked_contact();

-- ---------- Raporlar ----------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles on delete cascade,
  kind text not null check (kind in ('profile', 'entry', 'comment', 'list', 'forum_thread', 'forum_post', 'message')),
  target_id text not null check (char_length(target_id) <= 200),
  target_user uuid references public.profiles on delete set null,
  reason text not null check (char_length(reason) between 1 and 60),
  note text check (char_length(note) <= 1000),
  excerpt text check (char_length(excerpt) <= 600), -- raporlanan yazının o anki hali (silinse de görülsün)
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);
create index if not exists reports_status_idx on public.reports (status, created_at desc);
alter table public.reports enable row level security;
drop policy if exists "rapor gönder" on public.reports;
create policy "rapor gönder" on public.reports for insert with check (auth.uid() = reporter_id and status = 'open');
drop policy if exists "raporları yönetim ve raporlayan görür" on public.reports;
create policy "raporları yönetim ve raporlayan görür" on public.reports for select using (public.is_admin() or auth.uid() = reporter_id);
drop policy if exists "raporu yönetim kapatır" on public.reports;
create policy "raporu yönetim kapatır" on public.reports for update using (public.is_admin());
drop policy if exists "raporu yönetim siler" on public.reports;
create policy "raporu yönetim siler" on public.reports for delete using (public.is_admin());
grant select, insert, update, delete on public.reports to authenticated;

-- ---------- Yönetimden uyarı: kişi siteye girince üstte görür, "Anladım" deyince kapanır ----------
create table if not exists public.warnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
alter table public.warnings enable row level security;
drop policy if exists "uyarını gör" on public.warnings;
create policy "uyarını gör" on public.warnings for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "uyarıyı yönetim yazar" on public.warnings;
create policy "uyarıyı yönetim yazar" on public.warnings for insert with check (public.is_admin());
drop policy if exists "uyarıyı okundu say" on public.warnings;
create policy "uyarıyı okundu say" on public.warnings for update using (auth.uid() = user_id);
revoke all on public.warnings from anon, authenticated;
grant select, insert on public.warnings to authenticated;
grant update (read_at) on public.warnings to authenticated;

notify pgrst, 'reload schema';
