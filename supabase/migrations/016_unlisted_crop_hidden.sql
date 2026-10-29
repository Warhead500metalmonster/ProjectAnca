-- 016: liste dışı listeler (sadece linki olan görür), profil fotoğrafı kırpma, profilde türleri gizleme.
-- Supabase → SQL Editor → New query → hepsini yapıştır → Run. Tekrar çalıştırmak zararsızdır.

-- ---------- Liste dışı listeler: YouTube'daki gibi, listelerde görünmez ama linki olan açabilir ----------
alter table public.lists add column if not exists unlisted boolean not null default false;

drop policy if exists "açık listeler ve kendi listelerin" on public.lists;
create policy "açık listeler ve kendi listelerin" on public.lists for select
  using (is_public or unlisted or auth.uid() = user_id);

drop policy if exists "görülebilen listelerin içeriği" on public.list_items;
create policy "görülebilen listelerin içeriği" on public.list_items for select using (
  exists (select 1 from public.lists l where l.id = list_id and (l.is_public or l.unlisted or l.user_id = auth.uid()))
);

-- ---------- Profil fotoğrafının görünen kısmı: {x, y} odak (yüzde), z yakınlaştırma ----------
alter table public.profiles add column if not exists avatar_crop jsonb;

-- ---------- Profilde gizlenen türler (ör. {game}): başkaları profilde bu türleri görmez ----------
alter table public.profiles add column if not exists hidden_types text[];

notify pgrst, 'reload schema';
