/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { List, Profile } from "@/lib/types";
import { PROFILE_COLS } from "@/lib/constants";
import { ListCard } from "@/components/ListCard";
import { safeUrl } from "@/lib/format";
import { fetchFeed } from "@/lib/data";
import { q, sb, supabaseConfigured } from "@/lib/supabase";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "@/components/AppProvider";
import { Cover, Feed, UserRow } from "@/components/ui";

interface Slim { rawg_id: number | null; title: string; cover: string | null; rating: number }

export default function Community() {
  const { version } = useApp();
  const { data, error } = useLoad(async () => {
    const db = sb();
    const [feed, members, games, lists] = await Promise.all([
      fetchFeed({ limit: 40 }),
      q<Profile[]>(db.from("profiles").select("*").order("created_at", { ascending: false }).limit(30)),
      q<Slim[]>(db.from("entries").select("rawg_id, title, cover, rating").eq("type", "game").order("updated_at", { ascending: false }).limit(300)),
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

  // Son kayıtlarda en çok loglanan oyunlar
  const byGame = new Map<number, Slim & { n: number }>();
  for (const g of games.filter((g) => g.rawg_id)) {
    const s = byGame.get(g.rawg_id!) || { ...g, n: 0 };
    s.n++;
    byGame.set(g.rawg_id!, s);
  }
  const popular = [...byGame.values()].sort((a, b) => b.n - a.n).slice(0, 12);

  const unique = [...new Set([...games, ...feed].map((e) => safeUrl(e.cover)).filter(Boolean))].slice(0, 30);
  const covers = unique.length ? Array.from({ length: 30 }, (_, i) => unique[i % unique.length]) : []; // az kapak varsa tekrarla
  const list = found ?? members;

  return (
    <>
      <section className="mosaic-head">
        <div className="mosaic">{covers.map((c, i) => <img key={i} src={c} alt="" loading="lazy" onError={(e) => e.currentTarget.remove()} />)}</div>
        <div className="mosaic-text"><h1>Topluluk</h1><p>Herkes neyi oynuyor, neyi izliyor? Keşfet, takip et.</p></div>
      </section>
      {popular.length > 0 && (
        <section className="section">
          <div className="section-head"><h2>Popüler oyunlar</h2></div>
          <div className="strip">
            {popular.map((g) => (
              <Link className="card" href={`/game/${g.rawg_id}`} key={g.rawg_id}>
                <div className="poster"><div className="ph">Oyun</div><Cover src={g.cover} /><span className="rating">{g.n} kişi</span></div>
                <div className="card-title">{g.title}</div>
              </Link>
            ))}
          </div>
        </section>
      )}
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
