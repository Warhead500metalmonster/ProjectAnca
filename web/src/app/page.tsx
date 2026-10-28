/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import Link from "next/link";
import type { Entry } from "@/lib/types";
import { LOCAL_KEY, STATUSES, TYPES } from "@/lib/constants";
import { safeUrl } from "@/lib/format";
import { fetchEntries, fetchFeed } from "@/lib/data";
import { rawg } from "@/lib/rawg";
import { q, sb, supabaseConfigured } from "@/lib/supabase";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "@/components/AppProvider";
import { CoverMarquee } from "@/components/CoverMarquee";
import { Goals } from "@/components/Goals";
import { NextBadges } from "@/components/profile/BadgesTab";
import { GettingStarted } from "@/components/GettingStarted";
import { Avatar, EntryCard, Feed, Stars, Stats, displayName } from "@/components/ui";

interface LocalEntry { title?: string; type?: string; year?: string; creator?: string; status?: string; date?: string; rating?: string; cover?: string; notes?: string; updated?: number }

function localEntries(): LocalEntry[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "null") || []; } catch { return []; }
}

export default function Home() {
  const { me, ready, following, version } = useApp();
  if (!supabaseConfigured()) return <div className="empty">Supabase ayarları eksik. <code>.env.local</code> dosyasını doldur.</div>;
  if (!ready) return <div className="loading">Yükleniyor…</div>;
  return me ? <Dashboard key={me.id} version={version} followingIds={[...following]} /> : <Landing version={version} />;
}

function Ico({ children }: { children: React.ReactNode }) {
  return <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}

function Landing({ version }: { version: number }) {
  const { data, error } = useLoad(() => fetchFeed({ limit: 40 }), [version]);
  if (error) return <div className="empty">Bir şeyler ters gitti: {error}</div>;

  const covers = [...new Set((data || []).map((e) => safeUrl(e.cover)).filter(Boolean))];
  const people = [...new Map((data || []).filter((e) => e.profiles?.username).map((e) => [e.profiles!.username, e.profiles])).values()].slice(0, 5);

  return (
    <>
      <section className="hero2">
        <CoverMarquee covers={covers} />
        <div className="hero2-text">
          <h1>Oynadığın, izlediğin, dinlediğin <span className="grad">her şey</span> tek yerde.</h1>
          <p>Oyunlarını, filmlerini, dizilerini, müziklerini ve animelerini logla. Puanla, not al, arkadaşlarının neyle uğraştığını gör.</p>
          <div className="hero-actions">
            <Link className="btn primary big" href="/signup">Ücretsiz katıl</Link>
            <Link className="btn big ghost" href="/login">Giriş yap</Link>
          </div>
        </div>
      </section>

      <div className="bento">
        <div className="tile big">
          <Ico><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></Ico>
          <b>Her şeyi logla</b>
          <span>Oyun, film, dizi, müzik ve anime tek kütüphanede. Platform, süre, tarih ve notlarınla.</span>
          {data ? <Feed list={data.slice(0, 3)} /> : <div className="loading">Yükleniyor…</div>}
        </div>
        <div className="tile">
          <Ico><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" /></Ico>
          <b>5 ya da 10 üzerinden puanla</b>
          <span>Hangi ölçeği seversen. İncelemelerini arkadaşların beğenip yorumlayabilir.</span>
          <Stars r={9} style={{ fontSize: 26, marginTop: "auto" }} />
        </div>
        <div className="tile">
          <Ico><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></Ico>
          <b>Listeler yap</b>
          <span>Herkese açık ya da gizli; hangilerini bitirdiğini yüzdesiyle gör.</span>
          <div className="mini-collage">{covers.slice(0, 4).map((c) => <img key={c} src={c} alt="" loading="lazy" />)}</div>
        </div>
        <div className="tile">
          <Ico><path d="M18 20V10M12 20V4M6 20v-6" /></Ico>
          <b>İstatistikler</b>
          <span>Yıla, türe ve çıkış tarihine göre süzülebilen ayrıntılı rakamlar.</span>
          <div className="mini-bars" aria-hidden>{[30, 55, 40, 80, 65, 95, 70].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div>
        </div>
        <div className="tile">
          <Ico><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></Ico>
          <b>Arkadaşlar, favoriler, rozetler</b>
          <span>Takip et, mesajlaş, puanlarınızı karşılaştır. Her kategoriden 10 favorini sergile.</span>
          <div className="avatar-stack">{people.map((p) => <Avatar key={p!.username} p={p} />)}</div>
        </div>
      </div>

      <section className="section">
        <div className="section-head"><h2>Toplulukta son hareketler</h2><Link href="/community">Tümü →</Link></div>
        {data ? <Feed list={data.slice(3, 13)} /> : <div className="loading">Yükleniyor…</div>}
      </section>
    </>
  );
}

function Dashboard({ version, followingIds }: { version: number; followingIds: string[] }) {
  const { me, toast, refresh } = useApp();
  const user = me!;
  const [localCount, setLocalCount] = useState(() => localEntries().length);
  const [importing, setImporting] = useState(false);
  const [tab, setTab] = useState<"friends" | "all" | null>(null); // null: arkadaş akışı doluysa o, değilse herkes

  const { data, error } = useLoad(async () => {
    const [mine, friends, community] = await Promise.all([
      fetchEntries(user.id),
      followingIds.length ? fetchFeed({ users: followingIds, limit: 40 }) : Promise.resolve([] as Entry[]),
      fetchFeed({ limit: 40 }),
    ]);
    return { mine: mine.map((e) => ({ ...e, profiles: user })), friends, community };
  }, [version, followingIds.join(",")]);

  async function importLocal() {
    setImporting(true);
    try {
      const rows = [];
      for (const i of localEntries().filter((i) => i && i.title && i.type && i.type in TYPES)) {
        const row: Record<string, unknown> = {
          user_id: user.id, type: i.type, title: String(i.title).slice(0, 200),
          year: parseInt(i.year || "") || null, creator: i.creator || null,
          status: STATUSES.includes(i.status as never) ? i.status : "completed",
          date: i.date || null, rating: Math.max(0, Math.min(10, parseInt(i.rating || "") || 0)),
          cover: safeUrl(i.cover) || null, notes: i.notes || null, rawg_id: null,
          updated_at: new Date(i.updated || Date.now()).toISOString(),
        };
        if (i.type === "game") {
          // Oyunu RAWG'de bul, topluluk sayfasına bağlansın
          const found = (await rawg<{ results?: { id: number; name: string }[] }>("games", { search: String(i.title), page_size: 5 }).catch(() => ({ results: [] }))).results || [];
          const g = found.find((x) => x.name.toLowerCase() === String(row.title).toLowerCase()) || found[0];
          if (g) row.rawg_id = g.id;
        }
        rows.push(row);
      }
      if (rows.length) await q(sb().from("entries").insert(rows));
      localStorage.setItem(LOCAL_KEY + ".imported", localStorage.getItem(LOCAL_KEY) || "");
      localStorage.removeItem(LOCAL_KEY);
      toast(`${rows.length} kayıt hesabına aktarıldı ✓`);
      refresh();
    } catch (err) {
      setImporting(false);
      toast("Aktarılamadı: " + (err as Error).message);
    }
  }

  function dismissLocal() {
    localStorage.setItem(LOCAL_KEY + ".dismissed", localStorage.getItem(LOCAL_KEY) || "");
    localStorage.removeItem(LOCAL_KEY);
    setLocalCount(0);
  }

  if (error) return <div className="empty">Bir şeyler ters gitti: {error}</div>;
  if (!data) return <div className="loading">Yükleniyor…</div>;
  const { mine, friends, community } = data;
  const view = tab ?? (friends.length ? "friends" : "all");
  const active = mine.filter((e) => e.status === "active");
  const backlog = mine.filter((e) => e.status === "planned").sort((a, b) => a.created_at.localeCompare(b.created_at)); // en eski bekleyen önce
  // Önce kendi kapakların; azsa topluluğunkilerle tamamla
  const own = [...new Set(mine.map((e) => safeUrl(e.cover)).filter(Boolean))];
  const heroCovers = own.length >= 8 ? own : [...own, ...community.map((e) => safeUrl(e.cover)).filter(Boolean)];
  const hour = new Date().getHours();
  const hello = hour < 6 ? "İyi geceler" : hour < 12 ? "Günaydın" : hour < 18 ? "Selam" : "İyi akşamlar";

  return (
    <>
      <section className="hero2 compact">
        <CoverMarquee covers={heroCovers} />
        <div className="hero2-text">
          <h1>{hello}, <span className="grad">{displayName(user)}</span></h1>
          <p>{mine.length ? `Kütüphanende ${mine.length} kayıt var.` : "Kütüphanen boş, ilk kaydını ekleyerek başla."}</p>
          <div className="hero-actions">
            {mine.some((e) => e.status === "planned") && <Roulette list={mine.filter((e) => e.status === "planned")} />}
            <AddButton />
          </div>
        </div>
      </section>
      {localCount > 0 && (
        <div className="banner">
          <span>Bu tarayıcıda hesap öncesinden kalan <b>{localCount}</b> kayıt var.</span>
          <button className="btn primary" disabled={importing} onClick={importLocal}>{importing ? "Aktarılıyor…" : "Hesabıma aktar"}</button>
          <button className="btn ghost" onClick={dismissLocal}>Yoksay</button>
        </div>
      )}
      <GettingStarted user={user} mine={mine} />
      <section className="section"><div className="stats"><Stats list={mine} /></div></section>
      <section className="section home-goals">
        <Goals profile={user} entries={mine} isMe />
        <NextBadges userId={user.id} username={user.username} entries={mine} />
      </section>
      {active.length > 0 && (
        <section className="section">
          <div className="section-head"><h2>Devam ettiklerin</h2><Link href={`/u/${user.username}/library`}>Kütüphanem →</Link></div>
          <div className="strip">{active.map((e) => <EntryCard key={e.id} e={e} kind edit />)}</div>
        </section>
      )}
      {backlog.length > 0 && (
        <section className="section">
          <div className="section-head"><h2>Backlog&apos;un <span className="muted small">· {backlog.length} bekleyen</span></h2><Link href={`/u/${user.username}/library`}>Kütüphanem →</Link></div>
          <div className="strip">{backlog.map((e) => <EntryCard key={e.id} e={e} kind edit />)}</div>
        </section>
      )}
      {mine.length > 0 && (
        <section className="section">
          <div className="section-head"><h2>Son loglarım</h2><Link href={`/u/${user.username}`}>Hepsi →</Link></div>
          <div className="wall">{mine.slice(0, 24).map((e) => <EntryCard key={e.id} e={e} kind wall />)}</div>
        </section>
      )}
      <section className="section feed-col">
        <div className="section-head">
          <h2>Akış</h2>
          <div className="tabs" style={{ margin: 0 }}>
            <button className={`tab ${view === "friends" ? "active" : ""}`} onClick={() => setTab("friends")}>Arkadaşlar</button>
            <button className={`tab ${view === "all" ? "active" : ""}`} onClick={() => setTab("all")}>Herkes</button>
          </div>
        </div>
        {view === "friends" ? (
          <Feed list={friends} empty={
            <div className="empty">
              {followingIds.length ? "Takip ettiklerin henüz bir şey loglamadı." : "Henüz kimseyi takip etmiyorsun."}<br />
              <Link className="btn" href="/community">Topluluğa göz at</Link>
            </div>
          } />
        ) : <Feed list={community} />}
      </section>
    </>
  );
}

// Planladıklarından rastgele birini seç: "ne oynasam / izlesem?"
function Roulette({ list }: { list: Entry[] }) {
  const { openView } = useApp();
  return <button className="btn big" title="Planladıklarından rastgele birini seç" onClick={() => openView(list[Math.floor(Math.random() * list.length)])}>Ne yapsam?</button>;
}

function AddButton() {
  const { openForm } = useApp();
  return <button className="btn primary big" onClick={() => openForm(null)}>+ Yeni kayıt</button>;
}
