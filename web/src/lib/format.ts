import type { Entry, Item } from "./types";

export const safeUrl = (u?: string | null) => (/^https?:\/\//i.test(u || "") ? (u as string) : "");

// style içine güvenle konabilen url(); tırnak ve parantezler kodlanır
export const cssUrl = (u: string) => `url('${u.replace(/["'()\\\s<>&]/g, (c) => "%" + c.charCodeAt(0).toString(16))}')`;

export function today() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
export const fmtDate = (d: string) => new Date(d + "T00:00").toLocaleDateString("tr", { day: "numeric", month: "long", year: "numeric" });
export const num = (x: number, digits = 1) => Number(x).toLocaleString("tr", { maximumFractionDigits: digits });

// RAWG görselini genişliğe göre küçült (dikey kapak CSS ile kırpılır)
export const resized = (url: string, w = 640) => url.replace(/\/media\/(games|screenshots)\//, `/media/resize/${w}/-/$1/`);
// RAWG'nin küçültülmüş görsel adresi (tam boy görseller birkaç MB olabiliyor)
export const smallImage = (url: string) => url.replace(/\/media\/(games|screenshots)\//, "/media/crop/600/400/$1/");

export function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "az önce";
  const units: [number, string][] = [[60, "dakika"], [3600, "saat"], [86400, "gün"], [604800, "hafta"], [2592000, "ay"], [31536000, "yıl"]];
  let i = units.length - 1;
  while (i > 0 && s < units[i][0]) i--;
  return `${Math.floor(s / units[i][0])} ${units[i][1]} önce`;
}

// ---------- Süreler (saniye olarak tutulur, saat-dakika-saniye gösterilir) ----------

export function fmtDur(sec?: number | null) {
  if (!sec) return "";
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return [h && `${h.toLocaleString("tr")} sa`, m && `${m} dk`, s && `${s} sn`].filter(Boolean).join(" ");
}
// Eski kayıtlarda süre sadece saat olarak durabilir
export const playSec = (e: Pick<Entry, "playtime_sec" | "hours">) =>
  e.playtime_sec ?? (e.hours ? Math.round(Number(e.hours) * 3600) : 0);
export const fmtHoursShort = (sec: number) => `${Math.round(sec / 3600).toLocaleString("tr")} sa`;

// Başlama ve bitirme tarihi varsa kaç günde bitirildiği (aynı gün = 1 gün)
export function daysTaken(e: Pick<Entry, "status" | "started_on" | "date">) {
  if (e.status !== "completed" || !e.started_on || !e.date) return null;
  return Math.round((new Date(e.date + "T00:00").getTime() - new Date(e.started_on + "T00:00").getTime()) / 86400000) + 1;
}

// ---------- Puan: 0-10 tutulur, izleyenin seçtiği ölçekte (5 ya da 10) gösterilir ----------

export const scoreText = (r: number, scale: number, digits = 1) => scale === 10 ? `${num(r, digits)}/10` : `${num(r / 2, digits + 1)}/5`;
// Ortalamalar tek ondalıkla
export const avgText = (r: number, scale: number) => scale === 10 ? `${num(r, 1)}/10` : `${num(r / 2, 1)}/5`;
export const scoreShort = (r: number, scale: number) => scale === 10 ? num(r) : num(r / 2, 2);

// ---------- İçerik kimliği: oyunlarda RAWG id, diğerlerinde tür + isim ----------

export const norm = (s?: string | null) => String(s || "").trim().toLocaleLowerCase("tr");
export const contentKey = (x: Pick<Item, "type" | "title" | "rawg_id">) =>
  x.type === "game" && x.rawg_id ? `g:${x.rawg_id}` : `${x.type}:${norm(x.title)}`;
export const contentHref = (x: Pick<Item, "type" | "title" | "rawg_id" | "ext_id">) =>
  x.type === "game" && x.rawg_id ? `/game/${x.rawg_id}`
    : `/c/${x.type}/${encodeURIComponent(x.title)}${x.ext_id ? `?ext=${encodeURIComponent(x.ext_id)}` : ""}`;
// Forumda bu içerikle ilgili konular (yeni konu açınca içerik hazır seçili gelir)
export const forumHref = (x: Item) => "/forum?" + new URLSearchParams(Object.entries({
  type: x.type, title: x.title, rawg: x.rawg_id ? String(x.rawg_id) : "", year: x.year ? String(x.year) : "",
  creator: x.creator || "", cover: x.cover || "", ext: x.ext_id || "",
}).filter(([, v]) => v)).toString();
export const itemOf = (e: Item): Item => ({ type: e.type, title: e.title, year: e.year, creator: e.creator, cover: e.cover, rawg_id: e.rawg_id, ext_id: e.ext_id ?? null });

// ilike içinde % _ \ harfiyen aransın
export const likeEsc = (s: string) => s.replace(/[\\%_]/g, (c) => "\\" + c);
