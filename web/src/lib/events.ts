// Etkinlikler: yönetim bir etkinlik açar (ör. "Hep birlikte Ocarina of Time"), üyeler katılıp sürümünü seçer,
// nerede olduğunu yazar, bitirince işaretler. Tablolar: events, event_members (supabase/migrations/023).
import type { Entry, EntryType, ProfileLite } from "./types";
import { PROFILE_COLS } from "./constants";
import { smallImage, today } from "./format";
import { q, sb } from "./supabase";

export interface EventOption {
  id: string; label: string; sub?: string;   // "Switch 2 remake", "Nintendo Switch 2 · 2026"
  title?: string; rawg_id?: number | null; ext_id?: string | null; cover?: string | null; platform?: string | null; year?: number | null;
}
export interface AncEvent {
  id: string; title: string; description: string | null; cover: string | null; kind: EntryType;
  options: EventOption[]; starts_on: string; ends_on: string | null; created_at: string;
}
export type MemberStatus = "joined" | "playing" | "done";
export interface EventMember {
  event_id: string; user_id: string; choice: string | null; status: MemberStatus; note: string | null;
  joined_at: string; updated_at: string; finished_at: string | null; profiles?: ProfileLite | null;
}

// Henüz başlamadı / sürüyor / bitti
export function eventState(ev: Pick<AncEvent, "starts_on" | "ends_on">): "upcoming" | "live" | "ended" {
  const t = today();
  if (ev.starts_on > t) return "upcoming";
  return ev.ends_on && ev.ends_on < t ? "ended" : "live";
}

const fmt = (d: string) => new Date(d + "T00:00").toLocaleDateString("tr", { day: "numeric", month: "long", year: "numeric" });
// Tarih yazısı (Türkçe ek hatası olmasın diye eksiz: "Başlangıç: 5 Kasım 2026")
export function dateLine(ev: Pick<AncEvent, "starts_on" | "ends_on">) {
  const s = eventState(ev);
  if (s === "upcoming") return `Başlangıç: ${fmt(ev.starts_on)} · ${ev.ends_on ? `Bitiş: ${fmt(ev.ends_on)}` : "süresiz"}`;
  if (s === "ended") return `${fmt(ev.starts_on)} – ${fmt(ev.ends_on!)} · bitti`;
  return ev.ends_on ? `Sürüyor · Bitiş: ${fmt(ev.ends_on)}` : "Sürüyor · süresiz, herkes kendi hızında";
}

// Tablo henüz yoksa (SQL çalıştırılmadıysa) boş liste: site bozulmasın
export async function fetchEvents(): Promise<AncEvent[]> {
  return q<AncEvent[]>(sb().from("events").select("*").order("starts_on", { ascending: false }).limit(50)).catch(() => []);
}
export async function fetchEvent(id: string) {
  const [ev, members] = await Promise.all([
    q<AncEvent | null>(sb().from("events").select("*").eq("id", id).maybeSingle()),
    q<EventMember[]>(sb().from("event_members").select(`*, profiles(${PROFILE_COLS})`).eq("event_id", id).order("joined_at")).catch(() => [] as EventMember[]),
  ]);
  return { ev, members };
}
// Etkinlik başına katılımcı sayısı (liste ve ana sayfa için)
export async function memberCounts(ids: string[]): Promise<Record<string, number>> {
  if (!ids.length) return {};
  const rows = await q<{ event_id: string }[]>(sb().from("event_members").select("event_id").in("event_id", ids)).catch(() => []);
  return rows.reduce<Record<string, number>>((m, r) => ({ ...m, [r.event_id]: (m[r.event_id] || 0) + 1 }), {});
}

// Kütüphanedeki karşılığı (aynı RAWG ya da dış kaynak kimliği)
export const libraryEntry = (mine: Entry[], o?: EventOption | null) =>
  o ? mine.find((e) => (o.rawg_id && e.rawg_id === o.rawg_id) || (o.ext_id && e.ext_id === o.ext_id)) : undefined;

// Seçtiği sürümü kütüphanesine ekle: etkinlik başladıysa "Oynuyorum", başlamadıysa "Planlandı"
export async function addToLibrary(userId: string, ev: AncEvent, o: EventOption) {
  const live = eventState(ev) !== "upcoming";
  await q(sb().from("entries").insert({
    user_id: userId, type: ev.kind, title: (o.title || o.label).slice(0, 200), year: o.year ?? null, creator: null,
    cover: o.cover ? smallImage(o.cover) : null, rawg_id: o.rawg_id ?? null, ext_id: o.ext_id ?? null, platform: o.platform ?? null,
    status: live ? "active" : "planned", started_on: live ? today() : null, rating: 0, updated_at: new Date().toISOString(),
  }));
}
