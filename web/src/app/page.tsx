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
import { Cover, EntryCard, Feed, Stats, displayName } from "@/components/ui";

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

function Landing({ version }: { version: number }) {
  const { data, error } = useLoad(() => fetchFeed({ limit: 10 }), [version]);
  if (error) return <div className="empty">Bir şeyler ters gitti: {error}</div>;
  return (
    <>
      <section className="hero">
        <div>
          <h1>Oynadığın, izlediğin, dinlediğin <span className="grad">her şey</span> tek yerde.</h1>
          <p>Oyunlarını, filmlerini, dizilerini, müziklerini ve animelerini logla. Puanla, not al, arkadaşlarının neyle uğraştığını gör.</p>
          <div className="hero-actions">
            <Link className="btn primary big" href="/signup">Ücretsiz katıl</Link>
            <Link className="btn big ghost" href="/login">Giriş yap</Link>
          </div>
        </div>
        <div className="hero-art">
          {Object.values(TYPES).map((t, i) => <div className="tile" key={t.label}>{t.icon}<Cover src={data?.find((e, j) => j % 5 === i && e.cover)?.cover} /></div>)}
        </div>
      </section>
      <div className="features">
        <div className="feature"><span className="ico">📒</span><b>Her şeyi logla</b><span>Oyun, film, dizi, müzik ve anime tek kütüphanede. Durum, puan ve notlarınla.</span></div>
        <div className="feature"><span className="ico">⭐</span><b>Puanla ve hatırla</b><span>Yarım yıldızlı puanlar, tarihler ve kısa incelemelerle neyi ne zaman sevdiğini unutma.</span></div>
        <div className="feature"><span className="ico">👥</span><b>Arkadaşlarını takip et</b><span>Kimin ne oynadığını, ne izlediğini gör; oyun sayfalarında topluluğun puanlarına bak.</span></div>
      </div>
      <section className="section">
        <div className="section-head"><h2>Toplulukta son hareketler</h2><Link href="/community">Tümü →</Link></div>
        {data ? <Feed list={data} /> : <div className="loading">Yükleniyor…</div>}
      </section>
    </>
  );
}

function Dashboard({ version, followingIds }: { version: number; followingIds: string[] }) {
  const { me, toast, refresh } = useApp();
  const user = me!;
  const [localCount, setLocalCount] = useState(() => localEntries().length);
  const [importing, setImporting] = useState(false);

  const { data, error } = useLoad(async () => {
    const [mine, friends, community] = await Promise.all([
      fetchEntries(user.id),
      followingIds.length ? fetchFeed({ users: followingIds, limit: 15 }) : Promise.resolve([] as Entry[]),
      fetchFeed({ limit: 10 }),
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
  const active = mine.filter((e) => e.status === "active");
  const hour = new Date().getHours();
  const hello = hour < 6 ? "İyi geceler" : hour < 12 ? "Günaydın" : hour < 18 ? "Selam" : "İyi akşamlar";

  return (
    <>
      <section className="welcome">
        <div>
          <h1>{hello}, <span className="grad">{displayName(user)}</span> 👋</h1>
          <p>{mine.length ? `Kütüphanende ${mine.length} kayıt var.` : "Kütüphanen boş, ilk kaydını ekleyerek başla."}</p>
        </div>
        <AddButton />
      </section>
      {localCount > 0 && (
        <div className="banner">
          <span>📦 Bu tarayıcıda hesap öncesinden kalan <b>{localCount}</b> kayıt var.</span>
          <button className="btn primary" disabled={importing} onClick={importLocal}>{importing ? "Aktarılıyor…" : "Hesabıma aktar"}</button>
          <button className="btn ghost" onClick={dismissLocal}>Yoksay</button>
        </div>
      )}
      <section className="section"><div className="stats"><Stats list={mine} /></div></section>
      {active.length > 0 && (
        <section className="section">
          <div className="section-head"><h2>Devam ettiklerin</h2><Link href={`/u/${user.username}`}>Kütüphanem →</Link></div>
          <div className="strip">{active.map((e) => <EntryCard key={e.id} e={e} kind edit />)}</div>
        </section>
      )}
      {mine.length > 0 && (
        <section className="section">
          <div className="section-head"><h2>Son loglarım</h2><Link href={`/u/${user.username}`}>Hepsi →</Link></div>
          <div className="wall">{mine.slice(0, 24).map((e) => <EntryCard key={e.id} e={e} kind wall />)}</div>
        </section>
      )}
      <div className="cols section">
        <section>
          <div className="section-head"><h2>Arkadaşlarından</h2></div>
          <Feed list={friends} empty={
            <div className="empty">
              {followingIds.length ? "Takip ettiklerin henüz bir şey loglamadı." : "Henüz kimseyi takip etmiyorsun."}<br />
              <Link className="btn" href="/community">Topluluğa göz at</Link>
            </div>
          } />
        </section>
        <section>
          <div className="section-head"><h2>Toplulukta</h2><Link href="/community">Tümü →</Link></div>
          <Feed list={community} />
        </section>
      </div>
    </>
  );
}

function AddButton() {
  const { openForm } = useApp();
  return <button className="btn primary big" onClick={() => openForm(null)}>+ Yeni kayıt</button>;
}
