-- 009: rozetler hedefe ulaşınca kendiliğinden verilir; yıllık hedefler.
-- Supabase → SQL Editor → New query → hepsini yapıştır → Run. Tekrar çalıştırmak zararsızdır.

-- ---------- Yıllık hedefler: {"2026": {"game": 30, "movie": 50}} ----------
alter table public.profiles
  add column if not exists goals jsonb not null default '{}'
    check (jsonb_typeof(goals) = 'object' and pg_column_size(goals) < 2000);

-- ---------- Otomatik rozetler (verilen rozet geri alınmaz) ----------
create or replace function public.award_badges(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  got text[] := '{}';
  done_of int;
begin
  if p_user is null then return; end if;
  if (select count(*) from public.entries where user_id = p_user and btrim(coalesce(notes, '')) <> '') >= 10 then got := got || 'critic'; end if;
  if (select count(*) from public.entries where user_id = p_user and type = 'game' and status = 'completed') >= 50 then got := got || 'completionist'; end if;
  if (select coalesce(sum(coalesce(playtime_sec, round(hours * 3600))), 0) from public.entries where user_id = p_user) >= 3600000 then got := got || 'marathon'; end if;
  if (select count(*) from public.follows a
      join public.follows b on b.follower_id = a.following_id and b.following_id = a.follower_id
      where a.follower_id = p_user) >= 10 then got := got || 'social'; end if;
  if (select count(*) from public.lists where user_id = p_user and is_public) >= 5 then got := got || 'curator'; end if;
  select count(*) into done_of from public.entries where user_id = p_user and type = 'movie' and status = 'completed';
  if done_of >= 100 then got := got || 'cinephile'; end if;
  select count(*) into done_of from public.entries where user_id = p_user and type = 'anime' and status = 'completed';
  if done_of >= 50 then got := got || 'otaku'; end if;
  select count(*) into done_of from public.entries where user_id = p_user and type = 'music' and status = 'completed';
  if done_of >= 100 then got := got || 'melomane'; end if;
  if cardinality(got) > 0 then
    insert into public.user_badges (user_id, badge) select p_user, unnest(got) on conflict do nothing;
  end if;
end;
$$;
revoke all on function public.award_badges(uuid) from public, anon, authenticated;

create or replace function public.award_badges_trg() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'follows' then
    perform public.award_badges(new.follower_id);
    perform public.award_badges(new.following_id);
  else
    perform public.award_badges(new.user_id);
  end if;
  return null;
end;
$$;
drop trigger if exists entries_badges on public.entries;
drop trigger if exists lists_badges on public.lists;
drop trigger if exists follows_badges on public.follows;
create trigger entries_badges after insert or update on public.entries for each row execute function public.award_badges_trg();
create trigger lists_badges after insert or update on public.lists for each row execute function public.award_badges_trg();
create trigger follows_badges after insert on public.follows for each row execute function public.award_badges_trg();

-- Şimdiye kadar hak edenlere hemen ver
select public.award_badges(id) from public.profiles;

notify pgrst, 'reload schema';
