/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Entry, PageEdit, RawgGame, RawgRef } from "@/lib/types";
import { ENTRY_COLS, statusLabel } from "@/lib/constants";
import { avgText, cssUrl, fmtDate, fmtDur, forumHref, num, playSec, resized, safeUrl, scoreText, smallImage } from "@/lib/format";
import { rawg } from "@/lib/rawg";
import { fetchPageEdit } from "@/lib/data";
import { q, sb, supabaseConfigured } from "@/lib/supabase";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "@/components/AppProvider";
import { Feed, RatingBars } from "@/components/ui";
import { Lightbox } from "@/components/Lightbox";
import { PageEditor } from "@/components/PageEditor";
import { ListsWith } from "@/components/ListsWith";

const names = (list?: { name: string }[]) => (list || []).map((x) => x.name);

// Tür, platform, geliştirici, yayıncı ve mağazaya tıklayınca o gruptaki oyunlar listelenir
const BY_SLUG = ["genres", "developers", "publishers"];
const gamesHref = (kind: string, r: RawgRef) => `/games?${new URLSearchParams({ [kind]: BY_SLUG.includes(kind) ? r.slug : String(r.id), label: r.name })}`;
const refLinks = (kind: string, list?: RawgRef[]) => list?.length
  ? <>{list.map((r, i) => <span key={r.id}>{i ? <br /> : null}<Link className="flink" href={gamesHref(kind, r)}>{r.name}</Link></span>)}</>
  : null;

export default function GamePage() {
  const { id } = useParams<{ id: string }>();
  const { me, version, openForm, pickList, scale, isAdmin, following } = useApp();
  const [more, setMore] = useState(false);
  const [shown, setShown] = useState<number | null>(null); // büyük gösterilen görsel
  const [editing, setEditing] = useState(false);

  const { data, error } = useLoad(async () => {
    const [g, logs, shots, edit] = await Promise.all([
      rawg<RawgGame>(`games/${encodeURIComponent(id)}`).catch(() => null),
      q<Entry[]>(sb().from("entries").select(ENTRY_COLS).eq("rawg_id", Number(id) || 0).order("updated_at", { ascending: false }).limit(200)),
      rawg<{ results?: { image: string }[] }>(`games/${encodeURIComponent(id)}/screenshots`, { page_size: 10 }).then((r) => r.results || []).catch(() => []),
      fetchPageEdit(`g:${id}`),
    ]);
    return { g, logs, shots, edit };
  }, [id, version], supabaseConfigured());

  if (!supabaseConfigured()) return <div className="empty">Supabase ayarları eksik.</div>;
  if (error) return <div className="empty">Bir şeyler ters gitti: {error}</div>;
  if (!data) return <div className="loading">Yükleniyor…</div>;
  const { g, logs, shots, edit } = data;
  if (!g && !logs.length) return <div className="empty">Bu oyun bulunamadı.</div>;

  const source: PageEdit = {
    title: g?.name || logs[0]?.title, creator: names(g?.developers).join(", ") || logs[0]?.creator || undefined,
    year: parseInt(g?.released || "") || logs[0]?.year || undefined,
    cover: safeUrl(g?.background_image) ? resized(g!.background_image!) : safeUrl(logs[0]?.cover) || undefined,
    description: (g?.description_raw || "").trim(), genres: names(g?.genres),
  };
  const name = edit.title || source.title || "";
  const art = safeUrl(edit.cover) || source.cover;
  const backdrop = safeUrl(edit.backdrop) || art;
  const images = [...(art ? [art] : []), ...shots.map((s) => resized(s.image, 1280))];
  const rated = logs.filter((l) => l.rating);
  const avg = rated.length ? rated.reduce((s, l) => s + Number(l.rating), 0) / rated.length : 0;
  // Takip ettiklerinin ortalaması (en az bir kişi puan verdiyse)
  const fr = rated.filter((l) => following.has(l.user_id));
  const friendAvg = fr.length ? { avg: fr.reduce((s, l) => s + Number(l.rating), 0) / fr.length, n: fr.length } : null;
  const timed = logs.filter((l) => playSec(l) > 0);
  const avgSec = timed.length ? timed.reduce((s, l) => s + playSec(l), 0) / timed.length : 0;
  const item = { type: "game" as const, title: name, year: edit.year || source.year || null,
    creator: edit.creator || source.creator || null, cover: safeUrl(edit.cover) || logs[0]?.cover || (g?.background_image ? smallImage(g.background_image) : null),
    rawg_id: Number(id), ext_id: null };
  const mine = me && logs.find((l) => l.user_id === me.id);
  const count = (s: Entry["status"]) => logs.filter((l) => l.status === s).length;
  const devs = edit.creator || names(g?.developers).join(", ");
  const desc = edit.description || source.description || "";
  const year = edit.year || (g?.released ? Number(g.released.slice(0, 4)) : null);
  const facts = ([
    ["Geliştirici", edit.creator || refLinks("developers", g?.developers)],
    ["Yayıncı", refLinks("publishers", g?.publishers)],
    ["Çıkış tarihi", g?.released ? fmtDate(g.released) : edit.year ? String(edit.year) : ""],
    ["Ortalama süre (RAWG)", g?.playtime ? `${num(g.playtime)} sa` : ""],
    ["Ortalama süre (Ancalog)", avgSec ? fmtDur(Math.round(avgSec / 60) * 60 || Math.round(avgSec)) : ""],
    ["Mağazalar", refLinks("stores", g?.stores?.map((s) => s.store))],
    ["Yaş sınırı", g?.esrb_rating?.name || ""],
  ] as [string, React.ReactNode][]).filter(([, v]) => v);

  return (
    <>
      <section className="gh">
        <div className="gh-bg" style={backdrop ? { backgroundImage: cssUrl(backdrop) } : undefined} />
        <div className="gh-inner">
          <div className="gh-left">
            <div className="gh-cover">{art ? <button className="zoom" onClick={() => setShown(0)} aria-label="Büyüt"><img src={art} alt="" /></button> : <div className="ph">Oyun</div>}</div>
            <div className="gh-counts">
              <span><b>{logs.length}</b>kayıt</span>
              <span><b>{count("active")}</b>devam</span>
              <span><b>{count("completed")}</b>oynadı</span>
              <span><b>{count("planned")}</b>planlı</span>
            </div>
            {!me ? <Link className="btn primary wide" href="/login">+ Kütüphaneme ekle</Link>
              : mine ? <button className="btn primary wide" onClick={() => openForm(mine)}>{statusLabel(mine.status, "game")} · Düzenle</button>
              : g ? <button className="btn primary wide" onClick={() => openForm(null, { game: g })}>+ Kütüphaneme ekle</button> : null}
            {item.title && <button className="btn wide" onClick={() => pickList(item)}>Listeye ekle</button>}
            {item.title && <Link className="btn wide" href={forumHref(item)}>Forumda tartış</Link>}
            {isAdmin && <button className="btn wide ghost" onClick={() => setEditing(true)}>Sayfayı düzenle</button>}
          </div>
          <div className="gh-main">
            <div className="crumbs"><Link href="/search?type=game">Oyunlar</Link> / {name}</div>
            <h1>{name} {year ? <small>{year}</small> : null}</h1>
            {devs && <div className="gh-dev">{devs}</div>}
            {desc && <p className={`gh-desc ${more ? "" : "clamp"}`}>{desc}</p>}
            {desc.length > 300 && !more && <button className="link" onClick={() => setMore(true)}>Devamını oku</button>}
            {g?.platforms?.length ? (
              <div className="gh-line"><b>Platformlar:</b> {g.platforms.map((p, i) => <span key={p.platform.id}>{i ? ", " : ""}<Link className="flink" href={gamesHref("platforms", p.platform)}>{p.platform.name}</Link></span>)}</div>
            ) : null}
            {edit.genres?.length ? <div className="genres">{edit.genres.map((x) => <span key={x}>{x}</span>)}</div>
              : g?.genres?.length ? <div className="genres">{g.genres.map((x) => <Link key={x.id} href={gamesHref("genres", x)}>{x.name}</Link>)}</div> : null}
          </div>
          <div className="gh-score">
            <div><b>★ {avg ? avgText(avg, scale) : "–"}</b><span>{rated.length} oy · Ancalog</span><RatingBars ratings={rated.map((l) => Number(l.rating))} /></div>
            {mine?.rating ? <div><b className="you">★ {scoreText(Number(mine.rating), scale)}</b><span>Senin puanın</span></div> : null}
            {friendAvg ? <div title="Takip ettiklerinin bu içeriğe verdiği puanların ortalaması"><b className="friends">★ {avgText(friendAvg.avg, scale)}</b><span>{friendAvg.n} takip ettiğin</span></div> : null}
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
              {shots.slice(0, 5).map((s, i) => (
                <button key={s.image} onClick={() => setShown(i + (art ? 1 : 0))} aria-label="Büyüt">
                  <img src={resized(s.image)} alt="" loading="lazy" />
                  {i === 4 && shots.length > 5 && <span className="more">+{shots.length - 5}</span>}
                </button>
              ))}
            </div>
          )}
          <section className="section">
            <div className="section-head"><h2>Ancalog&apos;da kimler logladı</h2></div>
            <Feed list={logs} empty={<div className="empty">Henüz kimse loglamadı. İlk sen ol!</div>} />
          </section>
          <ListsWith rawgId={Number(id) || undefined} />
        </div>
      </div>
      {shown !== null && <Lightbox images={images} start={shown} onClose={() => setShown(null)} />}
      {editing && <PageEditor editKey={`g:${id}`} edit={edit} source={source} creatorLabel="Geliştirici" onClose={() => setEditing(false)} />}
    </>
  );
}
