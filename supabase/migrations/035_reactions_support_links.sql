-- 035: Büyük güncelleme. Supabase → SQL Editor → New query → hepsini yapıştır → Run. Tekrar çalıştırmak zararsızdır.
-- Hiçbir kayıt silinmez; sadece yeni tablolar, yeni alanlar ve yeni fonksiyonlar eklenir.
--  1) Bildirimler (tepki, profil yorumu, ekip sohbeti, sayfasız oyun)
--  2) Tepkiler ve beğeniler: yorum, forum, mesaj, etkinlik sohbeti, profil yorumu, ekip sohbeti
--  3) Profil yorumları (Steam'deki gibi)
--  4) Bize yaz: bütün yöneticilerin ortak cevap verdiği ekip sohbeti
--  5) Etkinlikte İlk bitiren: haksız alınan rozet geri alınır, sıradaki bitirene geçer; yönetici panelden ayarlar
--  6) Sayfaya bağlı olmayan oyunlar: yönetici listesi, kullanıcının kendi kaydını bağlaması, kataloğu gerçek içeriğe bağlama
--  7) Kişisel görünüm tercihleri (dil, kapak, dizi-anime birlikte)

-- ---------- 1) Bildirimler ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  kind text not null check (char_length(kind) <= 30),
  actor_id uuid references public.profiles on delete cascade,
  body text check (char_length(body) <= 300),
  link text check (char_length(link) <= 300),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "notifications own read" on public.notifications;
create policy "notifications own read" on public.notifications for select using (user_id = auth.uid());
drop policy if exists "notifications own update" on public.notifications;
create policy "notifications own update" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "notifications own delete" on public.notifications;
create policy "notifications own delete" on public.notifications for delete using (user_id = auth.uid());
revoke insert on public.notifications from anon, authenticated;

-- Bildirimi sadece veritabanı yazar: kendine, engellediğine bildirim gitmez
create or replace function public.notify_user(p_user uuid, p_kind text, p_actor uuid, p_body text, p_link text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null or p_user = p_actor then return; end if;
  if p_actor is not null and public.blocked_between(p_user, p_actor) then return; end if;
  insert into public.notifications (user_id, kind, actor_id, body, link) values (p_user, p_kind, p_actor, left(p_body, 300), left(p_link, 300));
end;
$$;
revoke all on function public.notify_user(uuid, text, uuid, text, text) from public, anon, authenticated;

-- Bütün yöneticilere (site sahibi dahil)
create or replace function public.notify_team(p_kind text, p_actor uuid, p_body text, p_link text) returns void
language plpgsql security definer set search_path = '' as $$
declare a uuid;
begin
  for a in select distinct user_id from public.user_badges where badge in ('owner', 'admin') loop
    perform public.notify_user(a, p_kind, p_actor, p_body, p_link);
  end loop;
end;
$$;
revoke all on function public.notify_team(text, uuid, text, text) from public, anon, authenticated;

-- ---------- 3) Profil yorumları ----------
alter table public.profiles add column if not exists comments_mode text not null default 'all';
do $$ begin
  alter table public.profiles add constraint profiles_comments_mode_chk check (comments_mode in ('all', 'friends', 'off'));
exception when duplicate_object then null; end $$;

create table if not exists public.profile_comments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  reply_to uuid references public.profile_comments on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists profile_comments_profile_idx on public.profile_comments (profile_id, created_at desc);

-- Profile yorum yazılabilir mi: sahibi kapattıysa hayır, sadece arkadaşlara açtıysa karşılıklı takip gerekir
create or replace function public.can_comment_profile(p_profile uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (p_profile = auth.uid() or (
    not public.blocked_between(auth.uid(), p_profile) and public.can_see(p_profile) and exists (
      select 1 from public.profiles p where p.id = p_profile and (
        p.comments_mode = 'all'
        or (p.comments_mode = 'friends'
          and exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = p_profile)
          and exists (select 1 from public.follows f where f.follower_id = p_profile and f.following_id = auth.uid()))))));
$$;
grant execute on function public.can_comment_profile(uuid) to anon, authenticated;

alter table public.profile_comments enable row level security;
drop policy if exists "profile_comments read" on public.profile_comments;
create policy "profile_comments read" on public.profile_comments for select using (public.can_see(profile_id) or public.is_admin());
drop policy if exists "profile_comments write" on public.profile_comments;
create policy "profile_comments write" on public.profile_comments for insert with check (user_id = auth.uid() and public.can_comment_profile(profile_id));
drop policy if exists "profile_comments delete" on public.profile_comments;
create policy "profile_comments delete" on public.profile_comments for delete using (user_id = auth.uid() or profile_id = auth.uid() or public.is_admin());
drop trigger if exists profile_comments_muted on public.profile_comments;
create trigger profile_comments_muted before insert on public.profile_comments for each row execute function public.block_muted();

create or replace function public.profile_comment_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
declare uname text; parent uuid;
begin
  select username into uname from public.profiles where id = new.profile_id;
  perform public.notify_user(new.profile_id, 'pcomment', new.user_id, new.body, '/u/' || uname || '#yorumlar');
  if new.reply_to is not null then
    select user_id into parent from public.profile_comments where id = new.reply_to;
    if parent is distinct from new.profile_id then
      perform public.notify_user(parent, 'pcomment_reply', new.user_id, new.body, '/u/' || uname || '#yorumlar');
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists profile_comments_notify on public.profile_comments;
create trigger profile_comments_notify after insert on public.profile_comments for each row execute function public.profile_comment_notify();

-- Profil yorumu da raporlanabilir
alter table public.reports drop constraint if exists reports_kind_check;
alter table public.reports add constraint reports_kind_check
  check (kind in ('profile', 'entry', 'comment', 'list', 'forum_thread', 'forum_post', 'message', 'event_post', 'pcomment'));

-- ---------- 4) Bize yaz: ekip sohbeti ----------
-- Her üyenin ekiple tek bir konuşması olur (user_id). Bütün yöneticiler görür, herhangi biri cevap verir.
create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,      -- konuşmanın sahibi (ekibe yazan üye)
  sender_id uuid not null default auth.uid() references public.profiles on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  reply_to uuid references public.support_messages on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists support_messages_user_idx on public.support_messages (user_id, created_at);
create table if not exists public.support_threads (
  user_id uuid primary key references public.profiles on delete cascade,
  last_at timestamptz not null default now(),
  last_sender uuid references public.profiles on delete set null,
  last_body text,
  user_seen_at timestamptz,
  done boolean not null default false            -- ekip "çözüldü" işaretledi; üye yeniden yazınca açılır
);
alter table public.support_messages enable row level security;
alter table public.support_threads enable row level security;
drop policy if exists "support read" on public.support_messages;
create policy "support read" on public.support_messages for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "support write" on public.support_messages;
create policy "support write" on public.support_messages for insert with check (sender_id = auth.uid() and (user_id = auth.uid() or public.is_admin()));
drop policy if exists "support delete" on public.support_messages;
create policy "support delete" on public.support_messages for delete using (public.is_admin());
drop policy if exists "support threads read" on public.support_threads;
create policy "support threads read" on public.support_threads for select using (user_id = auth.uid() or public.is_admin());
revoke insert, update, delete on public.support_threads from anon, authenticated;

create or replace function public.support_after() returns trigger
language plpgsql security definer set search_path = '' as $$
declare uname text;
begin
  insert into public.support_threads (user_id, last_at, last_sender, last_body, done, user_seen_at)
    values (new.user_id, new.created_at, new.sender_id, left(new.body, 200), false, case when new.sender_id = new.user_id then new.created_at end)
    on conflict (user_id) do update set last_at = excluded.last_at, last_sender = excluded.last_sender, last_body = excluded.last_body,
      done = case when new.sender_id = new.user_id then false else public.support_threads.done end,
      user_seen_at = case when new.sender_id = new.user_id then excluded.last_at else public.support_threads.user_seen_at end;
  select username into uname from public.profiles where id = new.user_id;
  if new.sender_id = new.user_id then
    perform public.notify_team('support', new.sender_id, new.body, '/support/' || uname);
  else
    perform public.notify_user(new.user_id, 'support_reply', new.sender_id, new.body, '/support');
  end if;
  return new;
end;
$$;
drop trigger if exists support_after on public.support_messages;
create trigger support_after after insert on public.support_messages for each row execute function public.support_after();

-- Üye okudu ya da ekip çözüldü / açık işaretledi
create or replace function public.support_mark(p_user uuid, p_done boolean default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_user = auth.uid() then
    update public.support_threads set user_seen_at = now() where user_id = p_user;
  elsif public.is_admin() and p_done is not null then
    update public.support_threads set done = p_done where user_id = p_user;
  end if;
end;
$$;
grant execute on function public.support_mark(uuid, boolean) to authenticated;

-- ---------- 2) Tepkiler ----------
create table if not exists public.reactions (
  target text not null check (target ~ '^(comment|forum_thread|forum_post|message|event_post|pcomment|support):[0-9a-f-]{36}$'),
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  emoji text not null check (emoji in ('♥', '👍', '😂', '😮', '😢', '🔥', '👏', '🤔')),
  owner uuid references public.profiles on delete cascade,   -- tepki verilen yazının sahibi (bildirim için)
  created_at timestamptz not null default now(),
  primary key (target, user_id, emoji)
);
create index if not exists reactions_target_idx on public.reactions (target);
create index if not exists reactions_owner_idx on public.reactions (owner, created_at desc);

-- Yazının sahibini bul; özel yazılarda (mesaj, ekip sohbeti) sadece konuşmadakiler tepki verebilir
create or replace function public.reaction_before() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_kind text := split_part(new.target, ':', 1); v_id uuid := split_part(new.target, ':', 2)::uuid; v_other uuid;
begin
  new.user_id := auth.uid();
  if v_kind = 'comment' then select user_id into new.owner from public.comments where id = v_id;
  elsif v_kind = 'forum_thread' then select user_id into new.owner from public.forum_threads where id = v_id;
  elsif v_kind = 'forum_post' then select user_id into new.owner from public.forum_posts where id = v_id;
  elsif v_kind = 'event_post' then select user_id into new.owner from public.event_posts where id = v_id;
  elsif v_kind = 'pcomment' then select user_id into new.owner from public.profile_comments where id = v_id;
  elsif v_kind = 'message' then
    select sender_id, receiver_id into new.owner, v_other from public.messages where id = v_id;
    if auth.uid() is distinct from new.owner and auth.uid() is distinct from v_other then raise exception 'Bu mesaja tepki veremezsin.'; end if;
  elsif v_kind = 'support' then
    select sender_id, user_id into new.owner, v_other from public.support_messages where id = v_id;
    if auth.uid() is distinct from v_other and not public.is_admin() then raise exception 'Bu mesaja tepki veremezsin.'; end if;
  end if;
  if new.owner is null then raise exception 'Yazı bulunamadı.'; end if;
  if public.blocked_between(auth.uid(), new.owner) then raise exception 'Bu kişiyle aranızda engel var.'; end if;
  return new;
end;
$$;
drop trigger if exists reaction_before on public.reactions;
create trigger reaction_before before insert on public.reactions for each row execute function public.reaction_before();

create or replace function public.reaction_after() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_kind text := split_part(new.target, ':', 1); v_id uuid := split_part(new.target, ':', 2)::uuid; v_link text; v_body text; v_name text; v_ref uuid;
begin
  if v_kind = 'comment' then
    select c.body, p.username, c.entry_id into v_body, v_name, v_ref from public.comments c join public.entries e on e.id = c.entry_id join public.profiles p on p.id = e.user_id where c.id = v_id;
    v_link := '/u/' || v_name || '?entry=' || v_ref;
  elsif v_kind = 'forum_thread' then select t.title, '/forum/' || t.id into v_body, v_link from public.forum_threads t where t.id = v_id;
  elsif v_kind = 'forum_post' then select fp.body, '/forum/' || fp.thread_id into v_body, v_link from public.forum_posts fp where fp.id = v_id;
  elsif v_kind = 'event_post' then select ep.body, '/events/' || ep.event_id into v_body, v_link from public.event_posts ep where ep.id = v_id;
  elsif v_kind = 'pcomment' then
    select c.body, p.username into v_body, v_name from public.profile_comments c join public.profiles p on p.id = c.profile_id where c.id = v_id;
    v_link := '/u/' || v_name || '#yorumlar';
  elsif v_kind = 'message' then
    select m.body into v_body from public.messages m where m.id = v_id;
    select p.username into v_name from public.profiles p where p.id = new.user_id;
    v_link := '/chat/' || v_name;
  elsif v_kind = 'support' then
    select s.body, p.username, s.user_id into v_body, v_name, v_ref from public.support_messages s join public.profiles p on p.id = s.user_id where s.id = v_id;
    v_link := case when new.owner = v_ref then '/support' else '/support/' || v_name end;
  end if;
  -- Aynı yazıya aynı kişiden art arda tepki bildirimleri birikmesin
  if not exists (select 1 from public.notifications n where n.user_id = new.owner and n.actor_id = new.user_id and n.kind = 'reaction'
      and n.link = v_link and n.created_at > now() - interval '10 minutes') then
    perform public.notify_user(new.owner, 'reaction', new.user_id, new.emoji || ' ' || coalesce(v_body, ''), v_link);
  end if;
  return new;
end;
$$;
drop trigger if exists reaction_after on public.reactions;
create trigger reaction_after after insert on public.reactions for each row execute function public.reaction_after();

alter table public.reactions enable row level security;
drop policy if exists "reactions read" on public.reactions;
create policy "reactions read" on public.reactions for select using (
  (target !~ '^(message|support):') or user_id = auth.uid() or owner = auth.uid()
  or (target ~ '^message:' and exists (select 1 from public.messages m where m.id = split_part(target, ':', 2)::uuid and auth.uid() in (m.sender_id, m.receiver_id)))
  or (target ~ '^support:' and (public.is_admin() or exists (select 1 from public.support_messages s where s.id = split_part(target, ':', 2)::uuid and s.user_id = auth.uid()))));
drop policy if exists "reactions write" on public.reactions;
create policy "reactions write" on public.reactions for insert with check (auth.uid() is not null);
drop policy if exists "reactions delete" on public.reactions;
create policy "reactions delete" on public.reactions for delete using (user_id = auth.uid());

-- ---------- 5) Etkinlikte İlk bitiren ----------
-- first_user: rozeti alan kişi (null = henüz yok, ilk bitiren alır). no_first: ilk bitiren sayılmaz (yönetici kararı)
alter table public.events add column if not exists first_user uuid references public.profiles on delete set null;
alter table public.event_members add column if not exists no_first boolean not null default false;

-- Var olan etkinliklerde ilk bitiren: en erken bitiren
update public.events e set first_user = (
  select m.user_id from public.event_members m where m.event_id = e.id and m.status = 'done' and not m.no_first
  order by m.finished_at nulls last limit 1)
where e.first_user is null;

-- Rozet, kişi en az bir etkinliğin ilk bitireniyse durur
create or replace function public.sync_first_badge(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null then return; end if;
  if exists (select 1 from public.events where first_user = p_user) then
    insert into public.user_badges (user_id, badge) values (p_user, 'event_first') on conflict do nothing;
  else
    delete from public.user_badges where user_id = p_user and badge = 'event_first';
  end if;
end;
$$;
revoke all on function public.sync_first_badge(uuid) from public, anon, authenticated;

create or replace function public.event_badge() returns trigger
language plpgsql security definer set search_path = '' as $$
declare special text;
begin
  insert into public.user_badges (user_id, badge) values (new.user_id, 'event_join') on conflict do nothing;
  if (select count(*) from public.event_members where user_id = new.user_id) >= 3 then
    insert into public.user_badges (user_id, badge) values (new.user_id, 'event_regular') on conflict do nothing;
  end if;
  if new.status = 'done' then
    insert into public.user_badges (user_id, badge) values (new.user_id, 'event') on conflict do nothing;
    -- İlk bitiren: daha önce kimse almadıysa ve bu kişi yönetimce hariç tutulmadıysa
    if not new.no_first then
      update public.events set first_user = new.user_id where id = new.event_id and first_user is null;
      if found then perform public.sync_first_badge(new.user_id); end if;
    end if;
    select badge_name into special from public.events where id = new.event_id;
    if special is not null then
      insert into public.user_badges (user_id, badge) values (new.user_id, 'ev_' || left(new.event_id::text, 8)) on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;

-- Yönetici: p_mode = 'revoke' (kişi ilk bitiren sayılmaz; rozet sıradaki bitirene, kimse yoksa ilk bitirecek olana),
-- 'give' (bu kişiyi ilk bitiren yap), 'restore' (hariç tutmayı kaldır)
create or replace function public.admin_event_first(p_event uuid, p_user uuid, p_mode text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare old uuid; nxt uuid;
begin
  if not public.is_admin() then raise exception 'Bunun için yönetici olmalısın.'; end if;
  select first_user into old from public.events where id = p_event;
  if p_mode = 'revoke' then
    update public.event_members set no_first = true where event_id = p_event and user_id = p_user;
    if old = p_user or old is null then
      select m.user_id into nxt from public.event_members m where m.event_id = p_event and m.status = 'done' and not m.no_first
        order by m.finished_at nulls last limit 1;
      update public.events set first_user = nxt where id = p_event;
      perform public.sync_first_badge(p_user);
      perform public.sync_first_badge(nxt);
      if nxt is not null then
        perform public.notify_user(nxt, 'event_first', null, 'Etkinliği ilk bitiren sen oldun! İlk bitiren rozeti senin.', '/events/' || p_event);
      end if;
    end if;
  elsif p_mode = 'give' then
    if not exists (select 1 from public.event_members where event_id = p_event and user_id = p_user and status = 'done') then
      raise exception 'Bu kişi etkinliği bitirmemiş.';
    end if;
    update public.event_members set no_first = false where event_id = p_event and user_id = p_user;
    update public.events set first_user = p_user where id = p_event;
    perform public.sync_first_badge(old);
    perform public.sync_first_badge(p_user);
    perform public.notify_user(p_user, 'event_first', null, 'Etkinliği ilk bitiren sen sayıldın! İlk bitiren rozeti senin.', '/events/' || p_event);
  elsif p_mode = 'restore' then
    update public.event_members set no_first = false where event_id = p_event and user_id = p_user;
  else
    raise exception 'Geçersiz işlem.';
  end if;
  return (select first_user from public.events where id = p_event);
end;
$$;
revoke all on function public.admin_event_first(uuid, uuid, text) from public, anon;
grant execute on function public.admin_event_first(uuid, uuid, text) to authenticated;

-- @aligothenburg: Hyrule etkinliğinde İlk bitiren rozeti haksız alındı. Rozet geri alınır, hakkı kaybolmaz:
-- ondan sonra bitiren varsa ona geçer, yoksa ilk bitirdim diyen alır.
do $$
declare u uuid; ev uuid := '0c0a1998-0000-4000-8000-000000000001'; nxt uuid;
begin
  select id into u from public.profiles where username = 'aligothenburg';
  if u is null then return; end if;
  update public.event_members set no_first = true where event_id = ev and user_id = u;
  select m.user_id into nxt from public.event_members m where m.event_id = ev and m.status = 'done' and not m.no_first
    order by m.finished_at nulls last limit 1;
  update public.events set first_user = nxt where id = ev;
  perform public.sync_first_badge(u);
  perform public.sync_first_badge(nxt);
end $$;

-- ---------- 6) Sayfasız oyunlar ve katalog ----------
-- Bir oyun sayfasına bağlı değil: numarası yok ya da eski numarasının yeni kaynakta karşılığı yok
create or replace function public.game_unlinked(p_rawg int) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_rawg is null or (p_rawg > 0 and not exists (select 1 from public.game_map m where m.rawg_id = p_rawg));
$$;
grant execute on function public.game_unlinked(int) to anon, authenticated;

-- Yönetici listesi: aynı oyun bir kez, kaç kişide olduğu ile
create or replace function public.unlinked_games() returns table (rawg_id int, title text, year int, cover text, n bigint, users bigint, last_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Bunun için yönetici olmalısın.'; end if;
  return query
    select e.rawg_id, (array_agg(e.title order by e.updated_at desc))[1], max(e.year), (array_agg(e.cover order by e.updated_at desc) filter (where e.cover is not null))[1],
      count(*), count(distinct e.user_id), max(e.updated_at)
    from public.entries e
    where e.type = 'game' and public.game_unlinked(e.rawg_id)
    group by e.rawg_id, case when e.rawg_id is null then lower(btrim(e.title)) else '' end
    order by count(*) desc, max(e.updated_at) desc
    limit 500;
end;
$$;
grant execute on function public.unlinked_games() to authenticated;

-- Yeni eklenen oyun bir sayfaya bağlı değilse ekibe haber (aynı kişiden saatte bir; içe aktarmada yüzlerce bildirim olmasın)
create or replace function public.entry_unlinked_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.type = 'game' and public.game_unlinked(new.rawg_id)
     and not exists (select 1 from public.notifications n where n.kind = 'unlinked' and n.actor_id = new.user_id and n.created_at > now() - interval '1 hour') then
    perform public.notify_team('unlinked', new.user_id, new.title, '/admin?tab=content');
  end if;
  return new;
end;
$$;
drop trigger if exists entries_unlinked_notify on public.entries;
create trigger entries_unlinked_notify after insert on public.entries for each row execute function public.entry_unlinked_notify();

-- Yönetici: kullanıcıların elle eklediği içeriği gerçek kaynaktaki karşılığına bağlar (TMDB, AniList, Deezer, Apple Music).
-- Onu loglayan herkesin kaydı ve listeleri gerçek içeriğe geçer, katalogdaki kopya kalkar.
create or replace function public.link_catalog(p_id uuid, p_ext text, p_title text, p_creator text, p_year int, p_cover text) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.catalog;
begin
  if not public.is_admin() then raise exception 'Bunun için yönetici olmalısın.'; end if;
  if p_ext is null or p_ext !~ '^(tmdb:(movie|tv):\d+|anilist:\d+|deezer:(album|track):\d+|itunes:\d+)$' then raise exception 'Geçersiz kaynak.'; end if;
  if p_cover is not null and p_cover !~ '^https://' then raise exception 'Geçersiz kapak.'; end if;
  select * into c from public.catalog where id = p_id;
  if c.id is null then raise exception 'İçerik bulunamadı.'; end if;
  p_title := left(btrim(p_title), 200);
  update public.entries set ext_id = p_ext, title = p_title, creator = coalesce(nullif(btrim(p_creator), ''), creator), year = coalesce(p_year, year),
      cover = case when cover is null or cover = c.cover then coalesce(p_cover, cover) else cover end
    where ext_id = c.ext_id;
  update public.list_items set ext_id = p_ext, title = p_title, creator = coalesce(nullif(btrim(p_creator), ''), creator), year = coalesce(p_year, year),
      cover = coalesce(p_cover, cover)
    where ext_id = c.ext_id;
  delete from public.catalog where id = c.id;
end;
$$;
revoke all on function public.link_catalog(uuid, text, text, text, int, text) from public, anon;
grant execute on function public.link_catalog(uuid, text, text, text, int, text) to authenticated;

-- Yönetici: elle yazılmış (kaynağı olmayan) film, dizi, anime kayıtlarını aynı adla duranların hepsiyle birlikte gerçek içeriğe bağlar
create or replace function public.link_titles(p_type text, p_title text, p_ext text, p_new_title text, p_creator text, p_year int, p_cover text) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'Bunun için yönetici olmalısın.'; end if;
  if p_ext is null or p_ext !~ '^(tmdb:(movie|tv):\d+|anilist:\d+|deezer:(album|track):\d+|itunes:\d+)$' then raise exception 'Geçersiz kaynak.'; end if;
  update public.entries set ext_id = p_ext, title = left(btrim(p_new_title), 200), creator = coalesce(nullif(btrim(p_creator), ''), creator),
      year = coalesce(p_year, year), cover = coalesce(cover, p_cover)
    where type = p_type and lower(btrim(title)) = lower(btrim(p_title)) and (ext_id is null or ext_id like 'cat:%');
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.link_titles(text, text, text, text, text, int, text) from public, anon;
grant execute on function public.link_titles(text, text, text, text, text, int, text) to authenticated;

-- Yönetici listesi: kaynağı olmayan film / dizi / anime kayıtları
create or replace function public.unlinked_titles() returns table (type text, title text, year int, cover text, n bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Bunun için yönetici olmalısın.'; end if;
  return query
    select e.type, (array_agg(e.title order by e.updated_at desc))[1], max(e.year), (array_agg(e.cover) filter (where e.cover is not null))[1], count(*)
    from public.entries e
    where e.type in ('movie', 'show', 'anime') and e.ext_id is null
    group by e.type, lower(btrim(e.title))
    order by count(*) desc
    limit 300;
end;
$$;
grant execute on function public.unlinked_titles() to authenticated;

-- ---------- 7) Görünüm tercihleri ----------
-- { "merge": true/false (dizi ve anime birlikte), "asked": true, "titles": {"movie": "tr|en|orig", ...}, "covers": {...}, "lang": "tr|en" }
alter table public.profiles add column if not exists prefs jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';

select
  (select count(*) from public.entries where type = 'game' and public.game_unlinked(rawg_id)) as sayfasiz_oyun_kaydi,
  (select first_user from public.events where id = '0c0a1998-0000-4000-8000-000000000001') as hyrule_ilk_bitiren;
