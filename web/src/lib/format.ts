export const safeUrl = (u?: string | null) => (/^https?:\/\//i.test(u || "") ? (u as string) : "");

// style içine güvenle konabilen url(); tırnak ve parantezler kodlanır
export const cssUrl = (u: string) => `url('${u.replace(/["'()\\\s<>&]/g, (c) => "%" + c.charCodeAt(0).toString(16))}')`;

export function today() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
export const fmtDate = (d: string) => new Date(d + "T00:00").toLocaleDateString("tr", { day: "numeric", month: "long", year: "numeric" });
export const fmtHours = (h: number | string) => `${Number(h).toLocaleString("tr", { maximumFractionDigits: 1 })} saat`;
export const fmtRating = (r: number) => (r / 2).toLocaleString("tr");

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
