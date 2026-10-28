"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { RawgGame, RawgRef } from "@/lib/types";
import { smallImage } from "@/lib/format";
import { rawg } from "@/lib/rawg";
import { q, sb, supabaseConfigured } from "@/lib/supabase";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "@/components/AppProvider";
import { Cover } from "@/components/ui";

// Oyun sayfasında türe, platforma, geliştiriciye, yayıncıya ya da mağazaya tıklanınca gelinen liste
const KINDS: [string, string][] = [["genres", "Tür"], ["platforms", "Platform"], ["developers", "Geliştirici"], ["publishers", "Yayıncı"], ["stores", "Mağaza"]];
const SORTS: [string, string][] = [["-added", "En popüler"], ["-metacritic", "Metacritic puanı"], ["-rating", "Oyuncu puanı"], ["-released", "En yeni çıkan"], ["released", "En eski çıkan"]];
const PAGE = 24;

export default function GamesPage() {
  const { openForm } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [pages, setPages] = useState(1);
  const filter = KINDS.find(([k]) => params.get(k));
  const label = params.get("label") || "";
  const ordering = params.get("ordering") || "-added";
  const key = params.toString();

  const { data: genres } = useLoad(() => rawg<{ results?: RawgRef[] }>("genres", { page_size: 40 }).then((r) => r.results || []).catch(() => []), []);

  const { data, error } = useLoad(async () => {
    const p: Record<string, string | number> = { page_size: PAGE, ordering };
    for (const [k] of KINDS) if (params.get(k)) p[k] = params.get(k)!;
    if (ordering === "released") p.dates = "1970-01-01,2100-12-31";
    if (ordering === "-released") p.dates = `1970-01-01,${new Date().toISOString().slice(0, 10)}`;
    const all = await Promise.all(Array.from({ length: pages }, (_, i) => rawg<{ results?: RawgGame[]; count?: number }>("games", { ...p, page: i + 1 })));
    const list = all.flatMap((r) => r.results || []);
    // Ancalog'da kaç kişi loglamış
    const ids = list.map((g) => g.id);
    const logs = ids.length && supabaseConfigured()
      ? await q<{ rawg_id: number }[]>(sb().from("entries").select("rawg_id").in("rawg_id", ids).limit(2000)).catch(() => [])
      : [];
    const counts = new Map<number, number>();
    for (const l of logs) counts.set(l.rawg_id, (counts.get(l.rawg_id) || 0) + 1);
    return { list, total: all[0].count || 0, counts };
  }, [key, pages]);

  function set(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) if (v) next.set(k, v); else next.delete(k);
    setPages(1);
    router.replace(`${path}?${next}`, { scroll: false });
  }

  const heading = filter ? `${label || params.get(filter[0])}` : "Tüm oyunlar";

  return (
    <>
      <section className="search-hero">
        <div className="crumbs"><Link href="/search?type=game">Oyunlar</Link>{filter ? ` / ${filter[1]}` : ""}</div>
        <h1>{heading}</h1>
        {filter && <p className="muted" style={{ margin: 0 }}>{filter[1]}: {heading}{data ? ` · ${data.total.toLocaleString("tr")} oyun` : ""}</p>}
        <div className="filters">
          <select value={ordering} onChange={(e) => set({ ordering: e.target.value === "-added" ? null : e.target.value })} aria-label="Sırala">
            {SORTS.map(([k, l]) => <option key={k} value={k}>↕ {l}</option>)}
          </select>
          {filter && <button className="link" onClick={() => set({ [filter[0]]: null, label: null })}>✕ {filter[1]} filtresini kaldır</button>}
        </div>
        {genres && genres.length > 0 && (
          <div className="chips">
            {genres.map((g) => (
              <button key={g.id} className={`chip ${params.get("genres") === g.slug ? "active" : ""}`}
                onClick={() => set({ ...Object.fromEntries(KINDS.map(([k]) => [k, null])), genres: g.slug, label: g.name })}>{g.name}</button>
            ))}
          </div>
        )}
      </section>
      <section className="section">
        {error ? <div className="empty">Oyunlar yüklenemedi: {error}</div>
          : !data ? <div className="loading">Yükleniyor…</div>
          : data.list.length ? (
            <>
              <div className="grid">
                {data.list.map((g) => (
                  <div key={g.id} className="qwrap"><Link className="card" href={`/game/${g.id}`}>
                    <div className="poster">
                      <div className="ph"></div><Cover src={g.background_image ? smallImage(g.background_image) : null} />
                      {data.counts.get(g.id) ? <span className="rating">{data.counts.get(g.id)}</span> : g.metacritic ? <span className="rating">MC {g.metacritic}</span> : null}
                    </div>
                    <div className="card-title">{g.name}</div>
                    <div className="card-meta">{[g.released?.slice(0, 4), g.genres?.slice(0, 2).map((x) => x.name).join(", ")].filter(Boolean).join(" · ")}</div>
                  </Link>
                  <button className="qadd" title="Kütüphaneme ekle" aria-label={`${g.name} ekle`} onClick={() => openForm(null, { game: g })}>+</button>
                  </div>
                ))}
              </div>
              {data.list.length < data.total && pages < 8 && (
                <div style={{ textAlign: "center", marginTop: 20 }}><button className="btn" onClick={() => setPages((n) => n + 1)}>Daha fazla göster</button></div>
              )}
            </>
          ) : <div className="empty">Bu filtrede oyun bulunamadı.</div>}
        <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>Oyun bilgileri: <a href="https://rawg.io" target="_blank" rel="noopener">RAWG</a></p>
      </section>
    </>
  );
}
