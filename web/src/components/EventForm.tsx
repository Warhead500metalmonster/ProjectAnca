/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState } from "react";
import type { EntryType } from "@/lib/types";
import type { AncEvent, EventOption } from "@/lib/events";
import { TYPES, TYPE_KEYS } from "@/lib/constants";
import { safeUrl, today } from "@/lib/format";
import { type Found, findContent } from "@/lib/data";
import { q, sb } from "@/lib/supabase";
import { useApp } from "./AppProvider";

const newId = () => Math.random().toString(36).slice(2, 8);
const BADGE_ICONS = ["✦", "⚔", "♫", "★", "♛", "☄", "◈", "✿", "⚑", "☾", "🏆", "🎮", "🎬", "🔥", "👑", "🗡️"];
// Hazır süreler: başlangıçtan itibaren (0 = süresiz)
const DURATIONS: [number, string][] = [[7, "1 hafta"], [14, "2 hafta"], [30, "1 ay"], [60, "2 ay"], [0, "Süresiz"]];
function addDays(date: string, days: number) {
  const d = new Date(date + "T00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Yönetim: etkinlik aç ya da düzenle. Sürümler (ör. Orijinal / 3DS / Switch 2) isteğe bağlı; her birine oyun aranıp bağlanabilir.
export function EventForm({ ev, onDone }: { ev?: AncEvent; onDone: (id?: string) => void }) {
  const { toast } = useApp();
  const [title, setTitle] = useState(ev?.title || "");
  const [description, setDescription] = useState(ev?.description || "");
  const [cover, setCover] = useState(ev?.cover || "");
  const [kind, setKind] = useState<EntryType>(ev?.kind || "game");
  const [starts, setStarts] = useState(ev?.starts_on || today());
  const [ends, setEnds] = useState(ev?.ends_on || "");
  const [options, setOptions] = useState<EventOption[]>(ev?.options || []);
  const [badgeName, setBadgeName] = useState(ev?.badge_name || "");
  const [badgeIcon, setBadgeIcon] = useState(ev?.badge_icon || "✦");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const patch = (id: string, p: Partial<EventOption>) => setOptions((l) => l.map((o) => (o.id === id ? { ...o, ...p } : o)));

  async function save() {
    setError("");
    if (!title.trim()) return setError("Etkinliğe bir ad ver.");
    if (cover.trim() && !cover.trim().startsWith("https://")) return setError("Kapak linki https:// ile başlamalı.");
    if (ends && ends < starts) return setError("Bitiş tarihi başlangıçtan önce olamaz.");
    if (options.some((o) => !o.label.trim())) return setError("Her sürüme bir ad ver (ör. Orijinal, 3DS remake).");
    const row = {
      title: title.trim().slice(0, 120), description: description.trim() || null, cover: cover.trim() || null, kind,
      starts_on: starts, ends_on: ends || null,
      // Rozet alanları sadece doluysa gönderilir (veritabanı güncellenmeden de etkinlik açılabilsin)
      ...((badgeName.trim() || ev?.badge_name) && { badge_name: badgeName.trim().slice(0, 40) || null, badge_icon: badgeIcon.trim() || "✦" }),
      options: options.map((o) => ({ ...o, label: o.label.trim().slice(0, 40), sub: o.sub?.trim() || undefined })),
    };
    setBusy(true);
    try {
      if (ev) {
        await q(sb().from("events").update(row).eq("id", ev.id));
        toast("Etkinlik güncellendi");
        onDone(ev.id);
      } else {
        const id = crypto.randomUUID();
        await q(sb().from("events").insert({ id, ...row }));
        toast("Etkinlik açıldı!");
        onDone(id);
      }
    } catch (err) {
      setError(/events/.test((err as Error).message) ? "Etkinlikler birkaç dakika içinde açılacak (veritabanı güncelleniyor)." : "Kaydedilemedi: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section ev-form">
      <h2>{ev ? "Etkinliği düzenle" : "Yeni etkinlik"}</h2>
      <div className="field">
        <label htmlFor="ev-title">Ad</label>
        <input id="ev-title" className="input" maxLength={120} placeholder="ör. Hep birlikte Ocarina of Time" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="ev-desc">Açıklama <span className="muted">· ne yapacağız, nasıl katılınır</span></label>
        <textarea id="ev-desc" rows={4} maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="ev-badge-box">
        <b>Bu etkinliğin rozeti</b>
        <span className="muted small">İsteğe bağlı. Etkinliği bitiren herkes kazanır, profilinde görünür. Adını yaz, simgesini seç ya da kendi emojini yaz.</span>
        <div className="row ev-badge-row">
          <input className="input" maxLength={40} placeholder="Rozet adı (ör. Hyrule Kahramanı, Vice City Efsanesi)" value={badgeName} onChange={(e) => setBadgeName(e.target.value)} />
          <input className="input ev-emoji" maxLength={4} aria-label="Kendi emojin" placeholder="😀" value={badgeIcon} onChange={(e) => setBadgeIcon(e.target.value)} />
        </div>
        <div className="chips">
          {BADGE_ICONS.map((i) => <button type="button" key={i} className={`chip ${badgeIcon === i ? "active" : ""}`} onClick={() => setBadgeIcon(i)}>{i}</button>)}
        </div>
        {badgeName.trim() && <p className="muted small" style={{ margin: 0 }}>Önizleme: <span className="bdg event">{badgeIcon || "✦"} {badgeName.trim()}</span></p>}
      </div>
      <div className="row">
        <div className="field grow">
          <label>Etkinliğin türü <span className="muted">· sürümlere ayrı ayrı da seçebilirsin</span></label>
          <div className="type-picker">
            {TYPE_KEYS.map((k) => <button type="button" key={k} className={kind === k ? "active" : ""} onClick={() => setKind(k)}>{TYPES[k].label}</button>)}
          </div>
        </div>
      </div>
      <div className="row">
        <div className="field grow">
          <label htmlFor="ev-start">Başlangıç</label>
          <input id="ev-start" type="date" value={starts} onChange={(e) => setStarts(e.target.value)} />
        </div>
        <div className="field grow">
          <label htmlFor="ev-end">Bitiş <span className="muted">· boş bırakırsan süresiz</span></label>
          <input id="ev-end" type="date" value={ends} onChange={(e) => setEnds(e.target.value)} />
        </div>
      </div>
      <div className="chips ev-durations">
        <span className="muted small">Süre:</span>
        {DURATIONS.map(([days, name]) => {
          const end = days ? addDays(starts, days) : "";
          return <button type="button" key={name} className={`chip ${ends === end ? "active" : ""}`} onClick={() => setEnds(end)}>{name}</button>;
        })}
      </div>
      <div className="field">
        <label htmlFor="ev-cover">Kapak görseli <span className="muted">· boş kalırsa ilk sürümün kapağı kullanılır</span></label>
        <input id="ev-cover" className="input" type="url" placeholder="https://…" value={cover} onChange={(e) => setCover(e.target.value)} />
      </div>

      <h3 className="set-h">Sürümler <span className="muted small">· isteğe bağlı: katılan hangisini oynayacağını seçer</span></h3>
      {options.map((o) => (
        <div key={o.id} className="ev-form-opt">
          <div className="type-picker small">
            {TYPE_KEYS.map((k) => (
              <button type="button" key={k} className={(o.kind || kind) === k ? "active" : ""}
                onClick={() => patch(o.id, { kind: k === kind ? undefined : k, ...((o.kind || kind) !== k && { title: undefined, rawg_id: null, ext_id: null, cover: null, year: null }) })}>{TYPES[k].label}</button>
            ))}
          </div>
          <OptionSearch kind={o.kind || kind} option={o} onPick={(p) => patch(o.id, p)} />
          <div className="row">
            <input className="input" maxLength={40} placeholder="Görünen ad (ör. 3DS remake)" value={o.label} onChange={(e) => patch(o.id, { label: e.target.value })} />
            <input className="input" maxLength={60} placeholder="Alt yazı (ör. Nintendo 3DS · 2011)" value={o.sub || ""} onChange={(e) => patch(o.id, { sub: e.target.value })} />
            <input className="input" maxLength={40} placeholder="Platform" value={o.platform || ""} onChange={(e) => patch(o.id, { platform: e.target.value })} />
            <button type="button" className="icon-btn danger" aria-label="Sürümü kaldır" onClick={() => setOptions((l) => l.filter((x) => x.id !== o.id))}>✕</button>
          </div>
        </div>
      ))}
      <button type="button" className="btn" onClick={() => setOptions((l) => [...l, { id: newId(), label: "" }])}>+ Sürüm ekle</button>

      {error && <p className="form-error">{error}</p>}
      <div className="actions">
        <span className="spacer" />
        <button className="btn" onClick={() => onDone()}>Vazgeç</button>
        <button className="btn primary" disabled={busy} onClick={save}>{ev ? "Kaydet" : "Etkinliği aç"}</button>
      </div>
    </section>
  );
}

// Sürüme oyun / film bağla: aranıp seçilince ad, kapak, yıl ve kimlik dolar
function OptionSearch({ kind, option, onPick }: { kind: EntryType; option: EventOption; onPick: (p: Partial<EventOption>) => void }) {
  const [text, setText] = useState("");
  const [found, setFound] = useState<Found[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function onType(v: string) {
    setText(v);
    clearTimeout(timer.current);
    if (v.trim().length < 2) return setFound(null);
    timer.current = setTimeout(() => findContent(kind, v.trim()).then((l) => setFound(l.filter((f) => !f.custom).slice(0, 6))).catch(() => setFound([])), 300);
  }
  function pick(f: Found) {
    const g = f.raw;
    onPick({
      title: g?.name || f.title, rawg_id: g?.id ?? f.rawg_id ?? null, ext_id: g ? null : f.ext_id ?? null,
      cover: g?.background_image || f.cover || null, year: parseInt(g?.released || "") || f.year || null,
      ...(!option.label.trim() && { label: (g?.name || f.title).slice(0, 40) }),
      ...(!option.sub?.trim() && { sub: [g?.platforms?.map((p) => p.platform.name).slice(0, 1)[0], parseInt(g?.released || "") || f.year].filter(Boolean).join(" · ") }),
    });
    setText("");
    setFound(null);
  }

  return (
    <div className="ev-opt-search suggest-wrap">
      {safeUrl(option.cover) ? <img src={option.cover!} alt="" /> : <span className="noimg" />}
      <div className="grow">
        <b>{option.title || "Henüz bağlanmadı"}</b>
        <input className="input" placeholder={`${TYPES[kind].label} ara ve seç (kapak ve sayfası gelsin)`} value={text} onChange={(e) => onType(e.target.value)} />
        {found && (
          <div className="suggest">
            {found.map((f, i) => (
              <button type="button" key={i} onClick={() => pick(f)}>
                {f.thumb ? <img src={f.thumb} alt="" /> : <span className="noimg" />}
                <span className="name">{f.title}{f.sub && <small>{f.sub}</small>}</span>
                <span className="year">{f.year || ""}</span>
              </button>
            ))}
            {!found.length && <div className="note">Bulunamadı</div>}
          </div>
        )}
      </div>
    </div>
  );
}
