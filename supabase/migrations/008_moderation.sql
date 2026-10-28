-- 008: yasaklı kelimeler (kullanıcı adı ve görünen adda geçemez), yasaklı e-postalar,
-- site sahibi bir hesabı silebilir; @noldoisttv silinir ve tekrar kayıt olamaz.
-- Supabase → SQL Editor → New query → hepsini yapıştır → Run. Tekrar çalıştırmak zararsızdır.

-- ---------- Yasaklı kelimeler ve e-postalar (sadece yöneticiler görür) ----------
create table if not exists public.blocked_words (
  word text primary key check (word ~ '^[a-z0-9]{2,30}$'),
  created_at timestamptz not null default now()
);
create table if not exists public.blocked_emails (
  email text primary key check (char_length(email) <= 320),
  created_at timestamptz not null default now()
);
alter table public.blocked_words enable row level security;
alter table public.blocked_emails enable row level security;
drop policy if exists "yasaklı kelimeleri yönetici görür" on public.blocked_words;
drop policy if exists "yasaklı kelime ekle" on public.blocked_words;
drop policy if exists "yasaklı kelime kaldır" on public.blocked_words;
create policy "yasaklı kelimeleri yönetici görür" on public.blocked_words for select using (public.is_admin());
create policy "yasaklı kelime ekle" on public.blocked_words for insert with check (public.is_admin());
create policy "yasaklı kelime kaldır" on public.blocked_words for delete using (public.is_admin());
revoke all on public.blocked_words, public.blocked_emails from anon, authenticated;
grant select, insert, delete on public.blocked_words to authenticated;

-- Kayıt olurken ve ad değiştirirken: yasaklı kelime geçiyorsa ya da e-posta yasaklıysa reddet.
-- Boşluk, alt çizgi ve noktalar yok sayılır ("Noldoist TV", "noldoist_tv" de yakalanır).
create or replace function public.check_blocked_names() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  u text := regexp_replace(lower(new.username), '[^a-z0-9]', '', 'g');
  d text := regexp_replace(lower(coalesce(new.display_name, '')), '[^a-z0-9]', '', 'g');
begin
  if exists (select 1 from public.blocked_words w where u like '%' || w.word || '%' or d like '%' || w.word || '%') then
    raise exception 'Bu ad kullanılamaz.';
  end if;
  if tg_op = 'INSERT' and exists (
    select 1 from public.blocked_emails b join auth.users a on lower(a.email) = b.email where a.id = new.id
  ) then
    raise exception 'Bu e-posta ile kayıt olunamaz.';
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_blocked on public.profiles;
create trigger profiles_blocked before insert or update of username, display_name on public.profiles
  for each row execute function public.check_blocked_names();

-- ---------- Site sahibi bir hesabı silebilir (istenirse e-postası da yasaklanır) ----------
create or replace function public.admin_delete_user(p_username text, p_ban boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  if not exists (select 1 from public.user_badges where user_id = auth.uid() and badge = 'owner') then
    raise exception 'Hesap silmeyi sadece site sahibi yapabilir.';
  end if;
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

-- ---------- @noldoisttv: e-postası yasaklanır, hesabı silinir, adı yasaklanır ----------
insert into public.blocked_words (word) values ('noldoist') on conflict do nothing;
insert into public.blocked_emails (email)
  select lower(a.email) from auth.users a join public.profiles p on p.id = a.id
  where p.username = 'noldoisttv' and a.email is not null
  on conflict do nothing;
delete from auth.users where id in (select id from public.profiles where username = 'noldoisttv');

notify pgrst, 'reload schema';
