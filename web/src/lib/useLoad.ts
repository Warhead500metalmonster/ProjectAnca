"use client";

import { useEffect, useState } from "react";

// Son gelen veriler: geri dönünce sayfa "Yükleniyor" demeden eski haliyle hemen açılır, arkadan tazelenir
const memo = new Map<string, unknown>();

// Veriyi çeker; deps değişince (örn. giriş, kayıt eklendi) yeniden çeker.
// cacheKey verilirse son sonuç saklanır ve aynı sayfaya dönünce önce o gösterilir.
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[], enabled = true, cacheKey?: string) {
  const [state, setState] = useState<{ data?: T; error?: string }>(() => (cacheKey && memo.has(cacheKey) ? { data: memo.get(cacheKey) as T } : {}));
  useEffect(() => {
    if (!enabled) return;
    let stale = false; // kullanıcı bu arada başka sayfaya geçtiyse sonucu yok say
    fn().then((data) => {
      if (cacheKey) memo.set(cacheKey, data);
      if (!stale) setState({ data });
    }, (err) => !stale && setState({ error: (err as Error).message }));
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled]);
  return state;
}

// ---------- Geri dönünce kaldığın yer ----------
// Tarayıcının geri / ileri düğmesiyle gelindi mi (o zaman sayfa eski haliyle ve eski kaydırma yerinde açılır)
let lastPop = 0;
if (typeof window !== "undefined") window.addEventListener("popstate", () => { lastPop = Date.now(); });
export const cameBack = () => Date.now() - lastPop < 15000;

// Sayfanın kaydırma yeri: sayfa açıkken saklanır, geri gelince içerik çizildikten sonra oraya dönülür
const scrolls = new Map<string, number>();
export function useScrollMemory(key: string, ready: boolean) {
  useEffect(() => {
    let raf = 0;
    const save = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => scrolls.set(key, window.scrollY)); };
    window.addEventListener("scroll", save, { passive: true });
    return () => { window.removeEventListener("scroll", save); cancelAnimationFrame(raf); };
  }, [key]);
  useEffect(() => {
    if (!ready || !cameBack()) return;
    const y = scrolls.get(key);
    if (!y) return;
    // Next sayfayı başa alabilir; içerik yerleşene kadar birkaç kez dene
    const timers = [0, 80, 250, 600].map((ms) => setTimeout(() => { if (Math.abs(window.scrollY - y) > 40) window.scrollTo(0, y); }, ms));
    return () => timers.forEach(clearTimeout);
  }, [ready, key]);
}
