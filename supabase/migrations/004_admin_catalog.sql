-- 004: yöneticiler, herkesin ortak kullandığı özel içerik kataloğu ve içerik sayfası düzenlemeleri.
-- Supabase → SQL Editor → New query → hepsini yapıştır → Run. Tekrar çalıştırmak zararsızdır.

-- ---------- Yöneticiler ("admin" rozeti; site sahibi de yöneticidir) ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_badges where user_id = auth.uid() and badge in ('owner', 'admin'));
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- Sadece site sahibi yönetici ekleyip çıkarabilir
create or replace function public.set_admin(p_username text, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  if not exists (select 1 from public.user_badges where user_id = auth.uid() and badge = 'owner') then
    raise exception 'Sadece site sahibi yönetici atayabilir.';
  end if;
  select id into uid from public.profiles where username = lower(btrim(p_username, ' @'));
  if uid is null then raise exception 'Böyle bir kullanıcı yok.'; end if;
  if p_on then
    insert into public.user_badges (user_id, badge) values (uid, 'admin') on conflict do nothing;
  else
    delete from public.user_badges where user_id = uid and badge = 'admin';
  end if;
end;
$$;
revoke all on function public.set_admin(text, boolean) from public, anon;
grant execute on function public.set_admin(text, boolean) to authenticated;

-- Yöneticiler uygunsuz yorumları silebilir
drop policy if exists "yorumu sil" on public.comments;
create policy "yorumu sil" on public.comments for delete using (
  auth.uid() = user_id or auth.uid() = (select e.user_id from public.entries e where e.id = entry_id) or public.is_admin()
);

-- ---------- Özel içerik kataloğu ----------
-- Aramada çıkmayan bir şarkı / albüm / film elle ya da linkle eklenince buraya bir kez yazılır.
-- Başkası aynı şeyi eklemek isteyince aramada bu kayıt çıkar; aynı isim + sanatçı ya da aynı link ikinci kez eklenmez.
create table if not exists public.catalog (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('game', 'movie', 'show', 'music', 'anime')),
  title text not null check (char_length(title) between 1 and 200),
  creator text check (char_length(creator) <= 200),
  year int check (year between 1800 and 2100),
  cover text check (cover ~ '^https?://' and char_length(cover) <= 1000),
  ext_id text unique check (char_length(ext_id) <= 60), -- kayıtlar bu kimlikle bağlanır: yt:..., spotify:..., cat:<id>
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists catalog_name_idx on public.catalog (type, lower(title), lower(coalesce(creator, '')));
create index if not exists entries_ext_idx on public.entries (ext_id);

create or replace function public.catalog_ext() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.ext_id := coalesce(new.ext_id, 'cat:' || new.id);
  return new;
end;
$$;
drop trigger if exists catalog_ext on public.catalog;
create trigger catalog_ext before insert on public.catalog for each row execute function public.catalog_ext();

-- Yönetici katalogdaki adı / kapağı düzeltince o içeriği loglayan herkesin kaydı ve listeleri de düzelir
create or replace function public.catalog_sync() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.entries set title = new.title, creator = new.creator, year = new.year, cover = new.cover where ext_id = new.ext_id;
  update public.list_items set title = new.title, creator = new.creator, year = new.year, cover = new.cover where ext_id = new.ext_id;
  return new;
end;
$$;
drop trigger if exists catalog_sync on public.catalog;
create trigger catalog_sync after update on public.catalog for each row execute function public.catalog_sync();

alter table public.catalog enable row level security;
drop policy if exists "katalog herkese açık" on public.catalog;
drop policy if exists "katalog yönetici düzenler" on public.catalog;
drop policy if exists "katalog yönetici siler" on public.catalog;
create policy "katalog herkese açık" on public.catalog for select using (true);
create policy "katalog yönetici düzenler" on public.catalog for update using (public.is_admin());
create policy "katalog yönetici siler" on public.catalog for delete using (public.is_admin());
revoke all on public.catalog from anon, authenticated;
grant select on public.catalog to anon, authenticated;
grant update (title, creator, year, cover), delete on public.catalog to authenticated;

-- Eklemek sadece bu fonksiyonla: aynısı varsa yenisini açmaz, var olanı döndürür
create or replace function public.add_catalog(p_type text, p_title text, p_creator text, p_year int, p_cover text, p_ext_id text)
returns public.catalog
language plpgsql security definer set search_path = '' as $$
declare r public.catalog;
begin
  if auth.uid() is null then raise exception 'Giriş yapmalısın.'; end if;
  p_title := btrim(p_title);
  p_creator := nullif(btrim(p_creator), '');
  p_cover := nullif(btrim(p_cover), '');
  select * into r from public.catalog c
    where (p_ext_id is not null and c.ext_id = p_ext_id)
       or (c.type = p_type and lower(c.title) = lower(p_title) and lower(coalesce(c.creator, '')) = lower(coalesce(p_creator, '')))
    limit 1;
  if found then
    if (r.cover is null and p_cover is not null) or (r.year is null and p_year is not null) then
      update public.catalog set cover = coalesce(cover, p_cover), year = coalesce(year, p_year) where id = r.id returning * into r;
    end if;
    return r;
  end if;
  -- Kalabalık olmasın: kişi başı günde en fazla 30 yeni içerik
  if (select count(*) from public.catalog where created_by = auth.uid() and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Bugün çok fazla yeni içerik ekledin, yarın tekrar dene.';
  end if;
  insert into public.catalog (type, title, creator, year, cover, ext_id, created_by)
    values (p_type, p_title, p_creator, p_year, p_cover, p_ext_id, auth.uid())
    returning * into r;
  return r;
end;
$$;
revoke all on function public.add_catalog(text, text, text, int, text, text) from public, anon;
grant execute on function public.add_catalog(text, text, text, int, text, text) to authenticated;

-- Yönetici iki kopyayı birleştirir: kopyayı kullanan kayıtlar asıl içeriğe bağlanır, kopya silinir
create or replace function public.merge_catalog(p_from uuid, p_into uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.catalog; b public.catalog;
begin
  if not public.is_admin() then raise exception 'Bunun için yönetici olmalısın.'; end if;
  select * into a from public.catalog where id = p_from;
  select * into b from public.catalog where id = p_into;
  if a.id is null or b.id is null or a.id = b.id then raise exception 'İçerik bulunamadı.'; end if;
  update public.entries set ext_id = b.ext_id, title = b.title, creator = b.creator, year = b.year, cover = coalesce(b.cover, cover)
    where ext_id = a.ext_id;
  update public.list_items set ext_id = b.ext_id, title = b.title, creator = b.creator, year = b.year, cover = coalesce(b.cover, cover)
    where ext_id = a.ext_id;
  delete from public.catalog where id = a.id;
end;
$$;
revoke all on function public.merge_catalog(uuid, uuid) from public, anon;
grant execute on function public.merge_catalog(uuid, uuid) to authenticated;

-- ---------- İçerik sayfası düzenlemeleri (oyun / film / albüm sayfasındaki ad, kapak, açıklama...) ----------
create table if not exists public.content_edits (
  key text primary key check (char_length(key) <= 260), -- oyunlarda g:<rawg id>, diğerlerinde tür:isim
  data jsonb not null default '{}' check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 20000),
  updated_by uuid default auth.uid() references public.profiles on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.content_edits enable row level security;
drop policy if exists "düzenlemeler herkese açık" on public.content_edits;
drop policy if exists "yönetici ekler" on public.content_edits;
drop policy if exists "yönetici değiştirir" on public.content_edits;
drop policy if exists "yönetici kaldırır" on public.content_edits;
create policy "düzenlemeler herkese açık" on public.content_edits for select using (true);
create policy "yönetici ekler" on public.content_edits for insert with check (public.is_admin());
create policy "yönetici değiştirir" on public.content_edits for update using (public.is_admin());
create policy "yönetici kaldırır" on public.content_edits for delete using (public.is_admin());
revoke all on public.content_edits from anon, authenticated;
grant select on public.content_edits to anon, authenticated;
grant insert, update, delete on public.content_edits to authenticated;

-- ---------- Kişisel site rengi (sadece kendisi görür) ve profil şarkısı ----------
alter table public.profiles
  add column if not exists site_color text check (site_color ~ '^#[0-9a-fA-F]{6}$'),
  add column if not exists song_url text check (song_url ~ '^https://' and char_length(song_url) <= 300),
  add column if not exists song_title text check (char_length(song_title) <= 120),
  add column if not exists song_volume smallint not null default 15 check (song_volume between 1 and 100);

-- Profil şarkısı şimdilik sadece site sahibine özel
create or replace function public.check_profile_song() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.song_url is distinct from old.song_url or new.song_title is distinct from old.song_title or new.song_volume is distinct from old.song_volume)
     and not exists (select 1 from public.user_badges where user_id = new.id and badge = 'owner') then
    raise exception 'Profil şarkısı şimdilik sadece site sahibine özel.';
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_song on public.profiles;
create trigger profiles_song before update on public.profiles for each row execute function public.check_profile_song();

update public.profiles
  set song_url = 'https://www.youtube.com/watch?v=Tu7oq3VNgpY', song_title = 'Pink Floyd — Shine On You Crazy Diamond (Pts. 1-5)', song_volume = 15
  where username = 'arno4436' and song_url is null;

notify pgrst, 'reload schema';
