"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { setUnlinked, skipped, unlinkedOf } from "@/lib/unlinked";
import { useApp } from "./AppProvider";

// Kütüphanede bir sayfaya bağlı olmayan kayıt varsa bir kez sorar; sonra yenileri eklenirse (ör. içe aktarma) yeniden.
// Sayı tarayıcıda saklanır: aynı uyarı her açılışta çıkmaz.
export function UnlinkedNotice() {
  const { me, mine, mineLoaded } = useApp();
  const path = usePathname();
  const [n, setN] = useState(0);
  const ref = useRef<HTMLDialogElement>(null);
  const seenKey = me ? `ancalog.unlinkedSeen.${me.id}` : "";

  useEffect(() => {
    if (!me || !mineLoaded || !mine.length) return;
    let stale = false;
    // Kütüphane her değişince değil, biraz durulunca bakılır (içe aktarmada art arda değişir)
    const t = setTimeout(() => {
      unlinkedOf(mine).then((list) => {
        if (stale) return;
        const skip = skipped(me.id);
        const count = new Set(list.filter((e) => !skip.has(e.id)).map((e) => `${e.type}|${e.rawg_id || ""}|${e.title.trim().toLocaleLowerCase("tr")}`)).size;
        setUnlinked(me.id, count);
        let seen = 0;
        try { seen = Number(localStorage.getItem(seenKey)) || 0; } catch { /* yok say */ }
        if (count > seen) setN(count);
        else if (count < seen) try { localStorage.setItem(seenKey, String(count)); } catch { /* yok say */ }
      }).catch(() => {});
    }, 2500);
    return () => { stale = true; clearTimeout(t); };
  }, [me, mine, mineLoaded, seenKey]);

  // Gösterildiği an görülmüş sayılır: sayfa değişince ya da yenilenince tekrar çıkmaz (sayı artarsa yeniden)
  useEffect(() => {
    if (!n || path === "/fix" || path === "/import" || document.querySelector("dialog[open]")) return;
    ref.current?.showModal();
    try { localStorage.setItem(seenKey, String(n)); } catch { /* yok say */ }
  }, [n, path, seenKey]);

  function done() {
    try { localStorage.setItem(seenKey, String(n)); } catch { /* yok say */ }
    ref.current?.close();
  }

  if (!n || path === "/fix") return null;
  return (
    <dialog ref={ref} className="notice-dialog" onClose={() => { try { localStorage.setItem(seenKey, String(n)); } catch { /* yok say */ } setN(0); }}>
      <div className="dialog-head">
        <h2>{n} kaydın bir sayfaya bağlı değil</h2>
        <button type="button" className="icon-btn" aria-label="Kapat" onClick={done}>✕</button>
      </div>
      <p>
        Oyun bilgilerimiz yeni kaynağa taşındı; bazı eski ya da başka siteden getirilen kayıtların sayfası eşleşmedi.
        Bunlar kütüphanende durur ama oyun sayfasında, ortalamalarda ve uyum hesabında görünmez.
      </p>
      <p className="muted small">Düzeltmek bir dakika: listede her birinin yanındaki <b>Bağla</b>&apos;ya basıp doğrusunu seçiyorsun. Puanların ve notların değişmez.</p>
      <div className="actions">
        <span className="spacer" />
        <button className="btn" onClick={done}>Sonra</button>
        <Link className="btn primary" href="/fix" onClick={done}>Şimdi düzelt</Link>
      </div>
    </dialog>
  );
}
