// Profilin görünüm ayarları (hepsi profiles.home_layout içinde durur): üstteki sayılar, kapak görseli, ana sayfa bölümleri.
// Yeni açılan profiller sade başlar: sayılar kapalı, ana sayfada sadece son eklenenler. İsteyen vitrinini kendisi kurar.
// Eski profillerin görünümü değişmez (sahibi bir şey seçmediyse eski varsayılan geçerli).
import type { Entry, EntryType, Profile } from "./types";

const CLEAN_FROM = Date.parse("2026-10-29T18:30:00Z");
export const isNewProfile = (p: Pick<Profile, "created_at">) => Date.parse(p.created_at) >= CLEAN_FROM;

export const DEFAULT_SECTIONS = ["favs", "played", "playing", "recent", "reviews", "stats"];
export const defaultSections = (p: Pick<Profile, "created_at">) => (isNewProfile(p) ? ["recent"] : DEFAULT_SECTIONS);

// Profilin üstündeki büyük sayılar
export const COUNT_ITEMS: [string, string][] = [
  ["entries", "Kayıt"],
  ["year", "Bu yıl bitti"],
  ["planned", "Planlanan"],
  ["followers", "Takipçi"],
  ["following", "Takip"],
];
export interface CountsCfg { show: boolean; items?: string[]; types?: EntryType[] }

export function countsOf(p: Pick<Profile, "created_at" | "home_layout">): { show: boolean; items: string[]; types: EntryType[] } {
  const c = p.home_layout?.counts;
  const all = COUNT_ITEMS.map(([k]) => k);
  if (!c) return { show: !isNewProfile(p), items: all, types: [] };
  return { show: c.show, items: c.items?.length ? all.filter((k) => c.items!.includes(k)) : all, types: c.types || [] };
}

// Sayılara girecek kayıtlar (seçilen türler; hiçbiri seçili değilse hepsi)
export const countedEntries = (entries: Entry[], types: EntryType[]) => (types.length ? entries.filter((e) => types.includes(e.type)) : entries);

// Kapak görseli: sahibi kapatmadıysa görünür
export const bannerOn = (p: Pick<Profile, "home_layout">) => p.home_layout?.banner !== false;
