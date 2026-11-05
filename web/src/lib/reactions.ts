// Tepkiler: yazı yazılabilen her yerde (yorum, forum, mesaj, etkinlik sohbeti, profil yorumu, ekip sohbeti) beğeni ve emoji.
// Sayfadaki bütün yazıların tepkileri tek seferde istenir (her yazı için ayrı istek olmasın); tablo: reactions (migration 035).
import { sb } from "./supabase";

export const EMOJIS = ["♥", "👍", "😂", "😮", "😢", "🔥", "👏", "🤔"] as const;
export type ReactionKind = "comment" | "forum_thread" | "forum_post" | "message" | "event_post" | "pcomment" | "support";
export interface ReactionRow { target: string; user_id: string; emoji: string }

const cache = new Map<string, ReactionRow[]>();
const pending = new Set<string>();
const subs = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;
let off = false; // tablo yoksa (SQL çalışmadıysa) düğmeler hiç görünmez
let tick = 0;    // değişince abone olan bileşenler yeniden çizilir

const emit = () => { tick++; subs.forEach((f) => f()); };
export const subscribe = (fn: () => void) => { subs.add(fn); return () => { subs.delete(fn); }; };
export const snapshot = () => tick;
export const reactionsOff = () => off;
export const reactionsOf = (target: string) => cache.get(target);

async function flush() {
  const list = [...pending];
  pending.clear();
  for (let i = 0; i < list.length; i += 150) {
    const part = list.slice(i, i + 150);
    const { data, error } = await sb().from("reactions").select("target, user_id, emoji").in("target", part);
    if (error) { off = true; emit(); return; }
    for (const t of part) cache.set(t, []);
    for (const r of (data || []) as ReactionRow[]) cache.get(r.target)?.push(r);
  }
  emit();
}

// Bileşen çizilince ister; aynı anda istenenler birlikte gelir
export function want(target: string) {
  if (off || cache.has(target) || pending.has(target)) return;
  pending.add(target);
  clearTimeout(timer);
  timer = setTimeout(flush, 40);
}

// Kendi tepkini ekle / kaldır (anında görünür, olmazsa geri alınır)
export async function toggleReaction(target: string, emoji: string, me: string) {
  const rows = cache.get(target) || [];
  const had = rows.some((r) => r.user_id === me && r.emoji === emoji);
  cache.set(target, had ? rows.filter((r) => !(r.user_id === me && r.emoji === emoji)) : [...rows, { target, user_id: me, emoji }]);
  emit();
  const { error } = had
    ? await sb().from("reactions").delete().eq("target", target).eq("user_id", me).eq("emoji", emoji)
    : await sb().from("reactions").insert({ target, emoji });
  if (error) {
    cache.set(target, rows);
    emit();
    throw new Error(error.message);
  }
}
