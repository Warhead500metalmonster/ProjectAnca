import type { Entry } from "./types";
import { contentKey } from "./format";

export interface Pair { mine: Entry; theirs: Entry }

// İki kütüphaneyi karşılaştırır: ortak içerikler ve puan uyumu üzerinden 0-100 arası bir "uyum" puanı
export function compat(mine: Entry[], theirs: Entry[]) {
  const map = new Map(mine.map((e) => [contentKey(e), e]));
  const common: Pair[] = [];
  for (const t of theirs) {
    const m = map.get(contentKey(t));
    if (m) common.push({ mine: m, theirs: t });
  }
  const rated = common.filter((p) => p.mine.rating && p.theirs.rating);
  const overlap = Math.min(1, common.length / Math.max(1, Math.min(mine.length, theirs.length)) * 3); // üçte bir ortaklık = tam puan
  const agree = rated.length ? 1 - rated.reduce((s, p) => s + Math.abs(Number(p.mine.rating) - Number(p.theirs.rating)), 0) / rated.length / 10 : 0;
  const score = !common.length ? null
    : rated.length >= 3 ? Math.round((0.7 * agree + 0.3 * overlap) * 100)
    : Math.round(overlap * 60);
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
