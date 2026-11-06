"use client";

import { useState } from "react";
import Link from "next/link";
import type { Entry } from "@/lib/types";
import { norm, smallImage } from "@/lib/format";
import { searchGames, searchSource } from "@/lib/data";
import { q, sb } from "@/lib/supabase";
import { resetSkips, setUnlinked, unlinkedOf } from "@/lib/unlinked";
import { useApp } from "./AppProvider";

const plain = (s: string) => norm(s).replace(/[™®©]/g, "").replace(/[^\p{L}\p{N}]+/gu, "");
const AUTO = /(images\.igdb\.com|media\.rawg\.io|howlongtobeat\.com|steamstatic\.com|image\.tmdb\.org|anilist\.co|simkl\.in)/;

// Sayfasız kayıtları yeniden tarar; adı (ve yılı) birebir tutanları kendiliğinden bağlar, emin olunamayanları listede bırakır.
// Yanlış eşleşme olmasın diye sadece adı harfi harfine aynı olanlar bağlanır.
export function RescanButton({ onDone, big = false }: { onDone?: () => void; big?: boolean }) {
  const { me, mine, refresh, toast } = useApp();
  const [step, setStep] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ linked: number; left: number } | null>(null);

  async function run() {
    if (!me || step) return;
    resetSkips(me.id); // "Böyle kalsın" denenler de yeniden sorulur
    setResult(null);
    const list = await unlinkedOf(mine);
    const groups = new Map<string, Entry[]>();
    for (const e of list) {
      const k = `${e.type}|${e.rawg_id || ""}|${plain(e.title)}`;
      groups.set(k, [...(groups.get(k) || []), e]);
    }
    const todo = [...groups.values()];
    setStep({ done: 0, total: todo.length });
    let linked = 0, done = 0, next = 0;
    await Promise.all(Array.from({ length: 3 }, async () => {
      while (next < todo.length) {
        const g = todo[next++];
        const e = g[0];
        try {
          const want = plain(e.title);
          const yearOk = (y: number | null) => !e.year || !y || Math.abs(e.year - y) <= 1;
          if (e.type === "game") {
            const hit = (await searchGames(e.title, 8)).find((f) => plain(f.title) === want && yearOk(f.year));
            if (hit) {
              const cover = !e.cover || AUTO.test(e.cover) ? (hit.cover ? smallImage(hit.cover) : e.cover) : e.cover;
              await q(sb().from("entries").update({ rawg_id: hit.rawg_id, cover, year: e.year ?? hit.year }).in("id", g.map((x) => x.id)));
              linked += g.length;
            }
          } else {
            const hit = (await searchSource(e.type, e.title)).find((f) => f.ext_id && (plain(f.title) === want || plain(f.sub || "").split(/·/).some((s) => plain(s) === want)) && yearOk(f.year));
            if (hit) {
              await q(sb().from("entries").update({ ext_id: hit.ext_id, ...(!e.cover && hit.cover && { cover: hit.cover }), ...(!e.year && hit.year && { year: hit.year }) }).in("id", g.map((x) => x.id)));
              linked += g.length;
            }
          }
        } catch { /* bu kayıt listede kalır */ }
        setStep({ done: ++done, total: todo.length });
      }
    }));
    const left = list.length - linked;
    setUnlinked(me.id, left);
    try { localStorage.removeItem(`ancalog.unlinkedSeen.${me.id}`); } catch { /* yok say */ }
    setStep(null);
    setResult({ linked, left });
    toast(linked ? `${linked} kayıt kendiliğinden bağlandı ✓` : "Kendiliğinden bağlanabilecek kayıt bulunamadı");
    refresh();
    onDone?.();
  }

  return (
    <div className="rescan">
      <button type="button" className={`btn ${big ? "primary" : ""}`} disabled={!!step} onClick={run}>
        {step ? `Taranıyor… ${step.done} / ${step.total}` : "Yeniden tara ve kendiliğinden eşleştir"}
      </button>
      {result && (
        <span className="muted small">
          {result.linked} kayıt bağlandı. {result.left ? <>{result.left} kayıt seçmeni bekliyor: <Link className="grad" href="/fix">Sayfasız kayıtlarım</Link></> : "Hepsi bağlı!"}
        </span>
      )}
    </div>
  );
}
