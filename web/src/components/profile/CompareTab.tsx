"use client";

import Link from "next/link";
import type { Entry } from "@/lib/types";
import { TYPES } from "@/lib/constants";
import { contentHref, itemOf, scoreShort } from "@/lib/format";
import { compat, type Pair } from "@/lib/compat";
import { useApp } from "@/components/AppProvider";
import { Cover, displayName } from "@/components/ui";
import { useProfile } from "@/components/ProfileShell";

// Arkadaşla uyum: ikinizin zevkleri ne kadar uyuşuyor, ortak sevdikleriniz, ayrıştıklarınız ve ondan öneriler
export function CompareTab() {
  const { entries, profile, isMe } = useProfile();
  const { me, mine, scale, openForm } = useApp();

  if (!me) return <div className="empty">Uyumunuzu görmek için giriş yap.<br /><Link className="btn" href="/login">Giriş yap</Link></div>;
  if (isMe) return <div className="empty">Burası başkasının profilinde açılır: arkadaşının profiline gir, &quot;Uyum&quot;a bas.</div>;

  const c = compat(mine, entries);
  const name = displayName(profile);
  const word = c.score === null ? "" : c.score >= 80 ? "Ruh ikizi" : c.score >= 60 ? "Çok uyumlu" : c.score >= 40 ? "Uyumlu" : c.score >= 20 ? "Biraz farklı" : "Bambaşka zevkler";

  const card = (e: Entry, sub: React.ReactNode, key: string) => (
    <Link key={key} className="card" href={contentHref(e)}>
      <div className={`poster ${TYPES[e.type].square ? "square" : ""}`}><div className="ph">{TYPES[e.type].label}</div><Cover src={e.cover} /></div>
      <div className="card-title">{e.title}</div>
      <div className="card-meta">{sub}</div>
    </Link>
  );
  const both = (p: Pair) => <>Sen ★ {scoreShort(Number(p.mine.rating) || 0, scale)} · O ★ {scoreShort(Number(p.theirs.rating) || 0, scale)}</>;

  return (
    <section className="section compare-page">
      <div className="match-hero">
        <div className="match-score">{c.score === null ? "–" : `%${c.score}`}</div>
        <div>
          <h2>{c.score === null ? "Henüz ortak bir şeyiniz yok" : word}</h2>
          <p className="muted">{c.common.length} ortak içerik · {c.loved.length} tanesini ikiniz de sevdiniz</p>
        </div>
      </div>

      {c.loved.length > 0 && (
        <>
          <div className="section-head"><h2>İkinizin de sevdikleri</h2></div>
          <div className="strip">{c.loved.slice(0, 20).map((p) => card(p.theirs, both(p), p.theirs.id))}</div>
        </>
      )}

      {c.suggest.length > 0 && (
        <>
          <div className="section-head"><h2>{name} sevdi, sen henüz denemedin</h2></div>
          <div className="strip">
            {c.suggest.slice(0, 20).map((e) => (
              <div key={e.id} className="suggest-card">
                {card(e, <>O ★ {scoreShort(Number(e.rating) || 0, scale)}</>, e.id)}
                <button className="btn" onClick={() => openForm(null, { item: itemOf(e) })}>+ Ekle</button>
              </div>
            ))}
          </div>
        </>
      )}

      {c.split.length > 0 && (
        <>
          <div className="section-head"><h2>En çok ayrıştığınız</h2></div>
          <div className="strip">{c.split.slice(0, 20).map((p) => card(p.theirs, both(p), p.theirs.id))}</div>
        </>
      )}

      {c.score === null && <div className="empty">İkiniz de bir şeyler logladıkça burası dolacak.</div>}
    </section>
  );
}
