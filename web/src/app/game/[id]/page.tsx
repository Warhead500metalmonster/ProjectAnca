/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Entry, RawgGame } from "@/lib/types";
import { ENTRY_COLS, statusLabel } from "@/lib/constants";
import { avgText, cssUrl, fmtDate, fmtDur, num, playSec, resized, safeUrl, scoreText, smallImage } from "@/lib/format";
import { rawg } from "@/lib/rawg";
import { q, sb, supabaseConfigured } from "@/lib/supabase";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "@/components/AppProvider";
import { Feed } from "@/components/ui";

const names = (list?: { name?: string; platform?: { name: string }; store?: { name: string } }[]) =>
  (list || []).map((x) => x.name || x.platform?.name || x.store?.name).filter(Boolean) as string[];

export default function GamePage() {
  const { id } = useParams<{ id: string }>();
  const { me, version, openForm, pickList, scale } = useApp();
  const [more, setMore] = useState(false);

  const { data, error } = useLoad(async () => {
    const [g, logs, shots] = await Promise.all([
      rawg<RawgGame>(`games/${encodeURIComponent(id)}`).catch(() => null),
      q<Entry[]>(sb().from("entries").select(ENTRY_COLS).eq("rawg_id", Number(id) || 0).order("updated_at", { ascending: false }).limit(200)),
      rawg<{ results?: { image: string }[] }>(`games/${encodeURIComponent(id)}/screenshots`, { page_size: 5 }).then((r) => r.results || []).catch(() => []),
    ]);
    return { g, logs, shots };
  }, [id, version], supabaseConfigured());

  if (!supabaseConfigured()) return <div className="empty">Supabase ayarları eksik.</div>;
  if (error) return <div className="empty">Bir şeyler ters gitti: {error}</div>;
  if (!data) return <div className="loading">Yükleniyor…</div>;
  const { g, logs, shots } = data;
  if (!g && !logs.length) return <div className="empty">Bu oyun bulunamadı.</div>;

  const name = g?.name || logs[0].title;
  const art = safeUrl(g?.background_image) ? resized(g!.background_image!) : safeUrl(logs[0]?.cover);
  const rated = logs.filter((l) => l.rating);
  const avg = rated.length ? rated.reduce((s, l) => s + Number(l.rating), 0) / rated.length : 0;
  const timed = logs.filter((l) => playSec(l) > 0);
  const avgSec = timed.length ? timed.reduce((s, l) => s + playSec(l), 0) / timed.length : 0;
  const item = { type: "game" as const, title: g?.name || logs[0]?.title || "", year: parseInt(g?.released || "") || logs[0]?.year || null,
    creator: names(g?.developers).join(", ") || logs[0]?.creator || null, cover: logs[0]?.cover || (g?.background_image ? smallImage(g.background_image) : null),
    rawg_id: Number(id), ext_id: null };
  const mine = me && logs.find((l) => l.user_id === me.id);
  const count = (s: Entry["status"]) => logs.filter((l) => l.status === s).length;
  const devs = names(g?.developers).join(", ");
  const desc = (g?.description_raw || "").trim();
  const facts: [string, string][] = ([
    ["Geliştirici", names(g?.developers).join("\n")],
    ["Yayıncı", names(g?.publishers).join("\n")],
    ["Çıkış tarihi", g?.released ? fmtDate(g.released) : ""],
    ["Ortalama süre (RAWG)", g?.playtime ? `${num(g.playtime)} sa` : ""],
    ["Ortalama süre (Ancalog)", avgSec ? fmtDur(Math.round(avgSec)) : ""],
    ["Mağazalar", names(g?.stores as never).join("\n")],
    ["Yaş sınırı", g?.esrb_rating?.name || ""],
  ] as [string, string][]).filter(([, v]) => v);

  return (
    <>
      <section className="gh">
        <div className="gh-bg" style={art ? { backgroundImage: cssUrl(art) } : undefined} />
        <div className="gh-inner">
          <div className="gh-left">
            <div className="gh-cover">{art ? <img src={art} alt="" /> : <div className="ph">Oyun</div>}</div>
            <div className="gh-counts">
              <span>{logs.length} kayıt</span>
              <span>{count("active")} devam</span>
              <span>{count("completed")} bitirdi</span>
              <span>{count("planned")} planlı</span>
            </div>
            {!me ? <Link className="btn primary wide" href="/login">+ Kütüphaneme ekle</Link>
              : mine ? <button className="btn primary wide" onClick={() => openForm(mine)}>{statusLabel(mine.status, "game")} · Düzenle</button>
              : g ? <button className="btn primary wide" onClick={() => openForm(null, { game: g })}>+ Kütüphaneme ekle</button> : null}
            {item.title && <button className="btn wide" onClick={() => pickList(item)}>Listeye ekle</button>}
          </div>
          <div className="gh-main">
            <div className="crumbs"><Link href="/search?type=game">Oyunlar</Link> / {name}</div>
            <h1>{name} {g?.released ? <small>{g.released.slice(0, 4)}</small> : null}</h1>
            {devs && <div className="gh-dev">{devs}</div>}
            {desc && <p className={`gh-desc ${more ? "" : "clamp"}`}>{desc}</p>}
            {desc.length > 300 && !more && <button className="link" onClick={() => setMore(true)}>Devamını oku</button>}
            {g?.platforms?.length ? <div className="gh-line"><b>Platformlar:</b> {names(g.platforms as never).join(", ")}</div> : null}
            {g?.genres?.length ? <div className="genres">{g.genres.map((x) => <span key={x.name}>{x.name}</span>)}</div> : null}
          </div>
          <div className="gh-score">
            <div><b>★ {avg ? avgText(avg, scale) : "–"}</b><span>{rated.length} oy · Ancalog</span></div>
            {mine?.rating ? <div><b className="you">★ {scoreText(Number(mine.rating), scale)}</b><span>Senin puanın</span></div> : null}
            {g?.metacritic ? <div><b className="mc">{g.metacritic}</b><span>Metacritic</span></div> : null}
          </div>
        </div>
      </section>
      <div className="game-body">
        <aside className="facts">
          {facts.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}
          <span className="muted" style={{ fontSize: 12 }}>
            Oyun bilgileri: <a href={`https://rawg.io/games/${g?.slug || id}`} target="_blank" rel="noopener" style={{ color: "var(--accent-2)" }}>RAWG</a>
          </span>
        </aside>
        <div>
          {shots.length > 0 && (
            <div className="shots">
              {shots.map((s) => <a key={s.image} href={s.image} target="_blank" rel="noopener"><img src={resized(s.image)} alt="" loading="lazy" /></a>)}
            </div>
          )}
          <section className="section">
            <div className="section-head"><h2>Ancalog&apos;da kimler logladı</h2></div>
            <Feed list={logs} empty={<div className="empty">Henüz kimse loglamadı. İlk sen ol!</div>} />
          </section>
        </div>
      </div>
    </>
  );
}
