/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";

// Tam genişlikte, iki sıra halinde zıt yönlerde kayan kapaklar
export function CoverMarquee({ covers }: { covers: string[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [away, setAway] = useState(false);

  // Ekrandan çıkınca durur: görünmeyen şey için cihaz yorulmasın
  useEffect(() => {
    if (!box.current || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setAway(!e.isIntersecting));
    io.observe(box.current);
    return () => io.disconnect();
  }, []);

  // Telefonda daha az kapak yeter (kapaklar veri geldikten sonra, tarayıcıda hesaplanır)
  const list = typeof window !== "undefined" && window.innerWidth < 640 ? covers.slice(0, 16) : covers;
  // Kapak azsa tekrarlayarak şeridi doldur
  const fill = (l: string[]) => (l.length ? Array.from({ length: Math.max(l.length, 8) }, (_, i) => l[i % l.length]) : []);
  const rows = [fill(list.filter((_, i) => i % 2 === 0)), fill(list.filter((_, i) => i % 2 === 1))];
  return (
    <div ref={box} className={`marquee ${away ? "away" : ""}`} aria-hidden>
      {rows.map((row, r) => (
        <div className={`mq-row ${r ? "rev" : ""}`} key={r}>
          {[...row, ...row].map((c, i) => <img key={i} src={c} alt="" decoding="async" loading={i < 8 ? "eager" : "lazy"} onError={(e) => e.currentTarget.remove()} />)}
        </div>
      ))}
    </div>
  );
}
