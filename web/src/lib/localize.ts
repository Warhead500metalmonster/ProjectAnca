// İçerik adını ve kapağını kişinin seçtiği dilde göster (Ayarlar → Görünüm). Veritabanındaki kayıt değişmez; sadece gösterim.
// "Kaydedildiği gibi" seçiliyse hiçbir şey indirilmez. Oyun adları her zaman IGDB'deki gibi (İngilizce).
import { useEffect, useSyncExternalStore } from "react";
import type { EntryType, Prefs, TitleLang } from "./types";

type Loc = { title?: string; cover?: string | null };
type Langs = Partial<Record<"tr" | "en" | "orig" | "romaji", Loc>>;

const cache = new Map<string, Langs | null>();
const pending = new Set<string>();
const subs = new Set<() => void>();
let tick = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const subscribe = (fn: () => void) => { subs.add(fn); return () => { subs.delete(fn); }; };
const snap = () => tick;

async function flush() {
  const list = [...pending];
  pending.clear();
  for (let i = 0; i < list.length; i += 40) {
    const part = list.slice(i, i + 40);
    const got: Record<string, Langs> = await fetch(`/api/titles?ids=${encodeURIComponent(part.join(","))}`).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
    for (const id of part) cache.set(id, got[id] || null);
    tick++;
    subs.forEach((f) => f());
  }
}

function want(ext: string) {
  if (cache.has(ext) || pending.has(ext)) return;
  pending.add(ext);
  clearTimeout(timer);
  timer = setTimeout(flush, 60);
}

// Bu türde ad / kapak için bir dil seçilmiş mi
const supported = (ext?: string | null) => !!ext && /^(tmdb:(movie|tv):\d+|anilist:\d+)$/.test(ext);
export const needsLocal = (prefs: Prefs, type: EntryType, ext?: string | null) =>
  supported(ext) && ((prefs.titles?.[type] || "default") !== "default" || (prefs.covers?.[type] || "default") !== "default");

function pickOf(langs: Langs | null | undefined, lang: TitleLang) {
  if (!langs || lang === "default") return null;
  return langs[lang] || (lang === "romaji" ? langs.orig : null) || null;
}

// Kartlarda: seçilen dildeki ad ve kapak (yoksa kayıttaki)
export function useLocalized(prefs: Prefs, x: { type: EntryType; title: string; cover: string | null; ext_id?: string | null }) {
  const on = needsLocal(prefs, x.type, x.ext_id);
  useSyncExternalStore(subscribe, snap, () => 0);
  useEffect(() => { if (on) want(x.ext_id!); }, [on, x.ext_id]);
  if (!on) return { title: x.title, cover: x.cover };
  const langs = cache.get(x.ext_id!);
  const t = pickOf(langs, prefs.titles?.[x.type] || "default");
  const c = pickOf(langs, prefs.covers?.[x.type] || "default");
  return { title: t?.title || x.title, cover: c?.cover || x.cover };
}

export const TITLE_LANGS: Record<EntryType, [TitleLang, string][]> = {
  game: [["default", "IGDB'deki gibi (İngilizce)"]],
  movie: [["default", "Kaydedildiği gibi"], ["tr", "Türkçe"], ["en", "İngilizce"], ["orig", "Orijinal dilinde"]],
  show: [["default", "Kaydedildiği gibi"], ["tr", "Türkçe"], ["en", "İngilizce"], ["orig", "Orijinal dilinde"]],
  anime: [["default", "Kaydedildiği gibi"], ["en", "İngilizce"], ["romaji", "Japonca (Latin harfle)"], ["orig", "Japonca (日本語)"]],
  music: [["default", "Kaydedildiği gibi"]],
};
