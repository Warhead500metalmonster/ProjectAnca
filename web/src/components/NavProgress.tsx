"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Bir linke tıklanınca üstte ince bir çubuk: sunucu geç cevap verse de tıklamanın alındığı görünsün, site donmuş sanılmasın
export function NavProgress() {
  const path = usePathname();
  const params = useSearchParams().toString();
  const [going, setGoing] = useState(false);

  // Yeni sayfa açıldı: çubuk kalkar
  useEffect(() => { const t = setTimeout(() => setGoing(false)); return () => clearTimeout(t); }, [path, params]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const el = e.target as Element;
      const a = el.closest?.("a");
      if (!a || el.closest("button") || a.target === "_blank" || a.hasAttribute("download")) return; // kartın içindeki düğme sayfa değiştirmez
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      setGoing(true);
    };
    // Yakalama aşamasında dinlenir: Next'in Link'i tıklamayı kendisi işleyip varsayılanı iptal ediyor
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Sayfa hiç gelmezse çubuk sonsuza kadar dönmesin
  useEffect(() => {
    if (!going) return;
    const t = setTimeout(() => setGoing(false), 15000);
    return () => clearTimeout(t);
  }, [going]);

  return going ? <div className="nav-progress" role="progressbar" aria-label="Sayfa açılıyor" /> : null;
}
