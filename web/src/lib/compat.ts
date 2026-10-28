import type { Entry, EntryType } from "./types";
import { contentKey } from "./format";
import { TYPE_KEYS } from "./constants";

export interface Pair { mine: Entry; theirs: Entry }

// Uyum yüzdesi: ortaklık oranı ve ortak puanlananlarda puanların yakınlığı. Sunucudaki sayılarla da aynı hesap yapılır.
export function scoreOf(common: number, rated: number, diffSum: number, mineN: number, theirN: number) {
  if (!common) return null;
  const overlap = Math.min(1, common / Math.max(1, Math.min(mineN, theirN)) * 3); // üçte bir ortaklık = tam puan
  const agree = rated ? 1 - diffSum / rated / 10 : 0;
  return rated >= 3 ? Math.round((0.7 * agree + 0.3 * overlap) * 100) : Math.round(overlap * 60);
}

// İki kütüphaneyi karşılaştırır: ortak içerikler ve puan uyumu üzerinden 0-100 arası bir "uyum" puanı
export function compat(mine: Entry[], theirs: Entry[]) {
  const map = new Map(mine.map((e) => [contentKey(e), e]));
  const common: Pair[] = [];
  for (const t of theirs) {
    const m = map.get(contentKey(t));
    if (m) common.push({ mine: m, theirs: t });
  }
  const rated = common.filter((p) => p.mine.rating && p.theirs.rating);
  const diff = rated.reduce((s, p) => s + Math.abs(Number(p.mine.rating) - Number(p.theirs.rating)), 0);
  const score = scoreOf(common.length, rated.length, diff, mine.length, theirs.length);
  const mineKeys = new Set(map.keys());
  return {
    score,
    common,
    // İkinizin de sevdikleri (8+ ya da favori)
    loved: common.filter((p) => (p.mine.rating >= 8 || p.mine.favorite) && (p.theirs.rating >= 8 || p.theirs.favorite)),
    // En çok ayrıştığınız
    split: rated.filter((p) => Math.abs(Number(p.mine.rating) - Number(p.theirs.rating)) >= 4)
      .sort((a, b) => Math.abs(b.mine.rating - b.theirs.rating) - Math.abs(a.mine.rating - a.theirs.rating)),
    // Onun sevip senin henüz kütüphanende olmayanlar: öneri
    suggest: theirs.filter((t) => (t.rating >= 8 || t.favorite) && !mineKeys.has(contentKey(t)))
      .sort((a, b) => b.rating - a.rating),
  };
}

// Türe göre uyum: oyunlarda, filmlerde... ayrı ayrı (ortak içerik yoksa o tür yok)
export function compatByType(mine: Entry[], theirs: Entry[]) {
  return TYPE_KEYS.map((t) => {
    const c = compat(mine.filter((e) => e.type === t), theirs.filter((e) => e.type === t));
    return { type: t as EntryType, score: c.score, common: c.common.length };
  }).filter((x) => x.score !== null);
}
