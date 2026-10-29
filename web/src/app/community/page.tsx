/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { List, Profile } from "@/lib/types";
import { PROFILE_COLS } from "@/lib/constants";
import { ListCard } from "@/components/ListCard";
import { safeUrl } from "@/lib/format";
import { fetchAll, fetchFeed } from "@/lib/data";
import { q, sb, supabaseConfigured } from "@/lib/supabase";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "@/components/AppProvider";
import { Cover, Feed, UserRow } from "@/components/ui";
import { ImportPromo } from "@/components/ImportPromo";
import { BestMatches } from "@/components/BestMatches";

interface Slim { rawg_id: number | null; title: string; cover: string | null; rating: number }

// En çok loglanan oyunlar: her oyunu kaç farklı kişinin loglandığına göre sırala (users verilirse sadece onların kayıtları)
async function popularGames(users?: string[]): Promise<(Slim & { n: number })[]> {
  if (users && !users.length) return [];
  // Önce sunucuda say (017); veritabanı henüz güncellenmediyse eski yola düş
  try {
    const top = await q<{ rawg_id: number; n: number; title: string; cover: string | null }[]>(
      sb().rpc("popular_games", { p_users: users ?? null, p_limit: 12 }));
    return top.map((g) => ({ ...g, n: Number(g.n), rating: 0 }));
  } catch { /* eski yol */ }
  const rows = await fetchAll<{ rawg_id: number; user_id: string }>((from, to) => {
    const req = sb().from("entries").select("rawg_id, user_id").eq("type", "game").not("rawg_id", "is", null);
    return (users ? req.in("user_id", users) : req).order("id").range(from, to);
  }, 30000);
  const people = new Map<number, Set<string>>();
  for (const r of rows) (people.get(r.rawg_id) || people.set(r.rawg_id, new Set()).get(r.rawg_id)!).add(r.user_id);
  const top = [...people].map(([id, s]) => [id, s.size] as const).sort((a, b) => b[1] - a[1]).slice(0, 12);
  if (!top.length) return [];
  const info = await q<Slim[]>(sb().from("entries").select("rawg_id, title, cover, rating").in("rawg_id", top.map(([id]) => id)).limit(500));
  return top.map(([id, n]) => {
    const all = info.filter((x) => x.rawg_id === id);
    const g = all.find((x) => x.cover) || all[0];
    return g ? { ...g, n } : null;
  }).filter(Boolean) as (Slim & { n: number })[];
}

export default function Community() {
  const { version, me, following } = useApp();
  const [popWho, setPopWho] = useState<"all" | "following">("all");
  const followIds = [...following].sort().join(",");
  // Takip ettiklerinin popüler oyunları: seçilince ayrıca yüklenir
  const { data: popFollowing } = useLoad(() => popularGames(followIds ? followIds.split(",") : []), [followIds, version, popWho],
    supabaseConfigured() && popWho === "following");
  const { data, error } = useLoad(async () => {
    const db = sb();
    const [feed, members, games, lists] = await Promise.all([
      fetchFeed({ limit: 40 }),
      q<Profile[]>(db.from("profiles").select("*").order("created_at", { ascending: false }).limit(30)),
      popularGames(),
      q<List[]>(db.from("lists").select(`*, profiles(${PROFILE_COLS}), list_items(id, type, title, cover, rawg_id, position)`)
        .eq("is_public", true).order("updated_at", { ascending: false }).limit(12)).catch(() => [] as List[]),
    ]);
    return { feed, members, games, lists: lists.filter((l) => l.list_items?.length) };
  }, [version], supabaseConfigured());

  const [found, setFound] = useState<Profile[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function search(text: string) {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const term = text.toLowerCase().replace(/[^a-z0-9_]/g, "");
      const req = sb().from("profiles").select("*").limit(30);
      setFound(await q<Profile[]>(term ? req.ilike("username", `%${term}%`) : req.order("created_at", { ascending: false })));
    }, 250);
  }

  if (!supabaseConfigured()) return <div className="empty">Supabase ayarları eksik.</div>;
  if (error) return <div className="empty">Bir şeyler ters gitti: {error}</div>;
  if (!data) return <div className="loading">Yükleniyor…</div>;
  const { feed, members, games, lists } = data;

  const popular = popWho === "following" ? popFollowing : games; // en çok loglanan oyunlar (kişi sayısına göre)

  const unique = [...new Set([...games, ...feed].map((e) => safeUrl(e.cover)).filter(Boolean))].slice(0, 30);
  const covers = unique.length ? Array.from({ length: 30 }, (_, i) => unique[i % unique.length]) : []; // az kapak varsa tekrarla
  const list = found ?? members;

  return (
    <>
      <section className="mosaic-head">
        <div className="mosaic">{covers.map((c, i) => <img key={i} src={c} alt="" loading="lazy" onError={(e) => e.currentTarget.remove()} />)}</div>
        <div className="mosaic-text"><h1>Topluluk</h1><p>Herkes neyi oynuyor, neyi izliyor? Keşfet, takip et.</p></div>
      </section>
      {!me && <ImportPromo signedIn={false} compact />}
      {games.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Popüler oyunlar</h2>
            {me ? (
              <div className="mini-tabs">
                <button className={popWho === "all" ? "active" : ""} onClick={() => setPopWho("all")}>Herkes</button>
                <button className={popWho === "following" ? "active" : ""} onClick={() => setPopWho("following")}>Takip ettiklerim</button>
              </div>
            ) : <span className="muted">en çok loglananlar</span>}
          </div>
          {!popular ? <div className="loading">Yükleniyor…</div>
            : !popular.length ? <div className="muted">{following.size ? "Takip ettiklerin henüz oyun loglamamış." : "Henüz kimseyi takip etmiyorsun. Üyeler kısmından birini takip et, onların popüler oyunları burada görünür."}</div>
            : <div className="strip">
            {popular.map((g) => (
              <Link className="card" href={`/game/${g.rawg_id}`} key={g.rawg_id}>
                <div className="poster"><div className="ph">Oyun</div><Cover src={g.cover} /><span className="rating" title="Bu oyunu loglayan kişi sayısı">{g.n} kişi</span></div>
                <div className="card-title">{g.title}</div>
              </Link>
            ))}
          </div>}
        </section>
      )}
      <section className="section">
        <div className="section-head"><h2>Ancalog sıralaması</h2><Link href="/top">En yüksek ve en düşük puanlılar →</Link></div>
        <p className="muted" style={{ margin: 0 }}>Üyelerin puanlarına göre en sevilen ve en sevilmeyen oyunlar, filmler, diziler, albümler ve animeler.</p>
      </section>
      <BestMatches />
      {lists.length > 0 && (
        <section className="section">
          <div className="section-head"><h2>Yeni listeler</h2></div>
          <div className="list-grid">{lists.slice(0, 8).map((l) => <ListCard key={l.id} l={l} owner />)}</div>
        </section>
      )}
      <div className="cols section">
        <section>
          <div className="section-head"><h2>Son hareketler</h2></div>
          <Feed list={feed} />
        </section>
        <section>
          <div className="section-head"><h2>Üyeler</h2></div>
          <input className="input" type="search" placeholder="Kullanıcı ara…" style={{ width: "100%", marginBottom: 12 }} autoComplete="off"
            onChange={(e) => search(e.target.value)} />
          <div className="user-list">
            {list.length ? list.map((p) => <UserRow key={p.id} p={p} />) : <div className="muted" style={{ padding: 12 }}>Kimse bulunamadı.</div>}
          </div>
        </section>
      </div>
    </>
  );
}
