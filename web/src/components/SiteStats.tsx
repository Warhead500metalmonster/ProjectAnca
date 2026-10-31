"use client";

import { num } from "@/lib/format";
import { q, sb, supabaseConfigured } from "@/lib/supabase";
import { useLoad } from "@/lib/useLoad";

interface Stats { users: number; online: number; new_users: number; active_users: number; backlogged: number; finished: number }

// Ana sayfanın altı: site ne kadar canlı. Sadece toplam sayılar; kim ne zaman girdi kimseye görünmez.
export function SiteStats() {
  const { data } = useLoad(() => q<Stats>(sb().rpc("site_stats")).catch(() => null), [], supabaseConfigured());
  if (!data) return null; // yüklenemezse boş kutu göstermeyelim
  const tiles: [number, string, string?][] = [
    [data.users, "Toplam üye"],
    [data.online, "Şu an çevrimiçi", "live"],
    [data.new_users, "Son 7 günde yeni üye"],
    [data.active_users, "Son 7 günde aktif üye"],
    [data.backlogged, "Son 7 günde backlog'a eklenen oyun"],
    [data.finished, "Son 7 günde bitirilen oyun"],
  ];
  return (
    <section className="section site-stats">
      <div className="site-stats-head"><h2>Ancalog şu an</h2></div>
      <div className="site-stats-grid">
        {tiles.map(([n, label, cls]) => (
          <div key={label} className={cls}>
            <b>{num(n)}</b>
            <span>{cls && <i aria-hidden="true" />}{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
