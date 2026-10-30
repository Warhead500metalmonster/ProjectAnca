"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";

// GTA VI geri sayımı: 19 Kasım 2026 00.00 TSİ (kimin saati neyse fark etmez). O an gelince kendiliğinden yok olur.
const RELEASE = Date.parse("2026-11-19T00:00:00+03:00");

const everySecond = (cb: () => void) => { const t = setInterval(cb, 250); return () => clearInterval(t); };
const pad = (n: number) => String(n).padStart(2, "0");

export function Gta6Countdown() {
  const now = useSyncExternalStore(everySecond, () => Math.floor(Date.now() / 1000), () => 0);
  const left = Math.floor(RELEASE / 1000) - now;
  if (!now || left <= 0) return null;

  const parts: [string, string][] = [
    [String(Math.floor(left / 86400)), "gün"],
    [pad(Math.floor(left / 3600) % 24), "saat"],
    [pad(Math.floor(left / 60) % 60), "dakika"],
    [pad(left % 60), "saniye"],
  ];

  return (
    <aside className="gta6">
      <Link className="gta6-in" href="/game/972995">
        <div className="gta6-title">
          <small>Çıkışına kalan süre</small>
          <b>GTA VI</b>
          <span>19 Kasım 2026, 00.00 TSİ</span>
        </div>
        <div className="gta6-clock" role="timer" aria-label={`GTA VI çıkışına ${parts.map(([n, l]) => `${n} ${l}`).join(" ")} kaldı`}>
          {parts.map(([n, l]) => <div key={l}><b key={n}>{n}</b><span>{l}</span></div>)}
        </div>
      </Link>
    </aside>
  );
}
