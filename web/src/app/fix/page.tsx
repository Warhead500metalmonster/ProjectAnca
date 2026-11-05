"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Entry } from "@/lib/types";
import { TYPES } from "@/lib/constants";
import { contentKey, safeUrl, smallImage } from "@/lib/format";
import type { Found } from "@/lib/data";
import { q, sb } from "@/lib/supabase";
import { useLoad } from "@/lib/useLoad";
import { setUnlinked, skip, skipped, unlinkedOf } from "@/lib/unlinked";
import { useApp } from "@/components/AppProvider";
import { Cover } from "@/components/ui";
import { LinkPicker } from "@/components/LinkPicker";

// Otomatik kapak kaynakları: kişinin elle koyduğu kapak bağlanınca da korunur, bunlar yenisiyle değişir
const AUTO = /(images\.igdb\.com|media\.rawg\.io|howlongtobeat\.com|steamstatic\.com|image\.tmdb\.org|anilist\.co|simkl\.in)/;

interface Group { key: string; list: Entry[]; e: Entry }

// Sayfasız kayıtlarım: her birini gerçek sayfasına bir dokunuşla bağla (ya da böyle kalsın de)
export default function FixPage() {
  const { me, ready, mine, mineLoaded, refresh, toast } = useApp();
  const [linking, setLinking] = useState<Group | null>(null);
  const [tab, setTab] = useState<"game" | "other">("game");
  const [v, setV] = useState(0);
  const { data } = useLoad(() => unlinkedOf(mine), [mine, v], !!me && mineLoaded);

  const groups = useMemo(() => {
    if (!data || !me) return null;
    const skip = skipped(me.id);
    const m = new Map<string, Group>();
    for (const e of data) {
      if (skip.has(e.id)) continue;
      const k = e.type === "game" ? `g|${e.rawg_id || ""}|${e.title.trim().toLocaleLowerCase("tr")}` : contentKey(e);
      const g = m.get(k);
      if (g) g.list.push(e); else m.set(k, { key: k, list: [e], e });
    }
    const all = [...m.values()];
    setUnlinked(me.id, all.length);
    return all;
  }, [data, me]);

  if (!ready || (me && !mineLoaded)) return <div className="loading">Yükleniyor…</div>;
  if (!me) return <div className="empty">Bunun için giriş yapmalısın.<br /><Link className="btn" href="/login">Giriş yap</Link></div>;

  const games = groups?.filter((g) => g.e.type === "game") || [];
  const others = groups?.filter((g) => g.e.type !== "game") || [];
  const shown = tab === "game" ? games : others;

  async function link(g: Group, f: Found) {
    const ids = g.list.map((e) => e.id);
    const base = g.e;
    const cover = !base.cover || AUTO.test(base.cover) ? f.cover || base.cover : base.cover;
    const patch = f.type === "game"
      ? { rawg_id: f.rawg_id, title: f.title.slice(0, 200), year: f.year ?? base.year, cover: cover ? smallImage(cover) : null, creator: base.creator || f.raw?.developers?.map((d) => d.name).join(", ") || null }
      : { type: f.type, title: f.title.slice(0, 200), year: f.year ?? base.year, creator: base.creator || f.creator, ext_id: f.ext_id ?? null, cover };
    for (let i = 0; i < ids.length; i += 150) await q(sb().from("entries").update(patch).in("id", ids.slice(i, i + 150)));
    toast(`${f.title} bağlandı ✓`);
    refresh();
    setV((x) => x + 1);
  }

  function leave(g: Group) {
    skip(me!.id, g.list.map((e) => e.id));
    setV((x) => x + 1);
    toast("Tamam, bu kayıt böyle kalacak");
  }

  return (
    <div className="fix-page">
      <section className="search-hero">
        <h1>Sayfasız kayıtlarım</h1>
        <p className="muted" style={{ margin: 0 }}>
          Oyun bilgilerimiz yeni kaynağa (IGDB) taşındı; bazı eski kayıtların ve başka sitelerden getirilen bazı oyunların, filmlerin sayfası eşleşmedi.
          Bunlar kütüphanende durur ama oyun sayfasına, puan ortalamasına ve uyum hesabına girmez. <b>Bağla</b>&apos;ya bas, doğrusunu seç; o kadar.
          Puanın, notun, tarihlerin ve elle koyduğun kapak olduğu gibi kalır.
        </p>
        <div className="tabs" style={{ marginBottom: 0 }}>
          <button className={`tab ${tab === "game" ? "active" : ""}`} onClick={() => setTab("game")}>Oyunlar <span className="count">{games.length}</span></button>
          <button className={`tab ${tab === "other" ? "active" : ""}`} onClick={() => setTab("other")}>Film, dizi, anime <span className="count">{others.length}</span></button>
        </div>
      </section>
      {!groups ? <div className="loading">Kayıtların taranıyor…</div>
        : !shown.length ? <div className="empty">{tab === "game" ? "Bütün oyunların bir sayfaya bağlı. Harika!" : "Bütün film, dizi ve animelerin bir sayfaya bağlı."}<br /><Link className="btn" href={`/u/${me.username}/library`}>Kütüphaneme dön</Link></div>
        : (
          <div className="admin-list fix-list">
            {shown.map((g) => (
              <div key={g.key} className="admin-item">
                <span className={`fix-cover ${TYPES[g.e.type].square ? "square" : ""}`}><Cover src={safeUrl(g.e.cover) || null} /></span>
                <div className="info">
                  <b>{g.e.title}</b>
                  <span>{[TYPES[g.e.type].label, g.e.year, g.list.length > 1 ? `${g.list.length} log` : ""].filter(Boolean).join(" · ")}</span>
                  <small>{g.e.type === "game" ? (g.e.rawg_id ? "Eski oyun numarası yeni kaynakta bulunamadı" : "Bir oyun sayfasına bağlı değil") : "Kaynağı yok: elle ya da içe aktarmayla adıyla geldi"}</small>
                </div>
                <div className="acts">
                  <button className="btn primary" onClick={() => setLinking(g)}>Bağla</button>
                  <button className="btn ghost" onClick={() => leave(g)} title="Bunu bir daha sorma">Böyle kalsın</button>
                </div>
              </div>
            ))}
          </div>
        )}
      {linking && (
        <LinkPicker type={linking.e.type} title={linking.e.title} switchable={linking.e.type !== "game"}
          heading={linking.e.type === "game" ? "Doğru oyunu seç" : "Doğru içeriği seç"}
          note={<>Kütüphanende <b>{linking.e.title}</b> diye duruyor. Doğrusunu seçince {linking.list.length > 1 ? `${linking.list.length} logun` : "kaydın"} o sayfaya bağlanır.</>}
          onPick={(f) => link(linking, f)} onClose={() => setLinking(null)} />
      )}
    </div>
  );
}
