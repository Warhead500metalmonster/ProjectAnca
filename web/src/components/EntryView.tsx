"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { Entry } from "@/lib/types";
import { TYPES, statusLabel } from "@/lib/constants";
import { cssUrl, fmtDate, fmtHours, safeUrl } from "@/lib/format";
import { Avatar, Stars, displayName } from "./ui";
import { useApp } from "./AppProvider";

// Bir kaydın ayrıntılarını gösteren pencere
export function EntryView({ entry: e, onClose, onEdit }: { entry: Entry; onClose: () => void; onEdit: (e: Entry) => void }) {
  const { me } = useApp();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);

  const t = TYPES[e.type];
  const p = e.profiles || {};
  const cover = safeUrl(e.cover);
  const details = [
    [t.where, e.platform],
    ["Mağaza", e.store],
    ["Başladı", e.started_on && fmtDate(e.started_on)],
    [e.status === "completed" ? "Bitirdi" : "Tarih", e.date && fmtDate(e.date)],
    ["Süre", e.hours && fmtHours(e.hours)],
    ["İlerleme", e.progress],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <dialog ref={ref} onClose={onClose} onClick={(ev) => ev.target === ref.current && ref.current?.close()}>
      <div className="view-body">
        <div className="view-cover" style={cover ? { backgroundImage: cssUrl(cover) } : { background: "linear-gradient(120deg,#3b1f7a,#db2777)" }}>
          <button type="button" className="icon-btn" aria-label="Kapat" onClick={() => ref.current?.close()}>✕</button>
        </div>
        <div className="view-content">
          <div><span className={`badge ${e.status}`}>{t.icon} {statusLabel(e.status, e.type)}</span></div>
          <h2>{e.title}</h2>
          {(e.creator || e.year) && <div className="muted">{[e.creator, e.year].filter(Boolean).join(" · ")}</div>}
          {e.rating ? <Stars r={e.rating} style={{ fontSize: 22 }} /> : null}
          {p.username && (
            <div className="view-user"><Avatar p={p} cls="sm" /> <Link href={`/u/${p.username}`}>{displayName(p)}</Link></div>
          )}
          {details.length > 0 && (
            <div className="view-details">{details.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div>
          )}
          {e.notes && <div className="view-notes">{e.notes}</div>}
          <div className="actions">
            {e.rawg_id && <Link className="btn" href={`/game/${e.rawg_id}`}>Oyun sayfası →</Link>}
            <span className="spacer" />
            {me?.id === e.user_id && <button type="button" className="btn primary" onClick={() => onEdit(e)}>Düzenle</button>}
          </div>
        </div>
      </div>
    </dialog>
  );
}
