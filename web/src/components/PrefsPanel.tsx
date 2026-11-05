"use client";

import { useEffect, useRef, useState } from "react";
import type { EntryType, Prefs, TitleLang } from "@/lib/types";
import { TYPES } from "@/lib/constants";
import { TITLE_LANGS } from "@/lib/localize";
import { useApp } from "./AppProvider";

const COVER_LANGS: [TitleLang, string][] = [["default", "Kaydedildiği gibi"], ["tr", "Türkçe afiş"], ["en", "İngilizce afiş"], ["orig", "Orijinal afiş"]];
const LANG_TYPES: EntryType[] = ["movie", "show", "anime"];

// Dil ve içerik tercihleri: anında kaydedilir (Ayarlar'daki Kaydet'i beklemez)
export function PrefsPanel({ compact = false }: { compact?: boolean }) {
  const { prefs, savePrefs, toast } = useApp();
  async function save(p: Partial<Prefs>) {
    try { await savePrefs({ ...p, asked: true }); toast("Kaydedildi ✓"); } catch (err) { toast("Kaydedilemedi: " + (err as Error).message); }
  }
  const setTitle = (t: EntryType, v: TitleLang) => save({ titles: { ...prefs.titles, [t]: v } });
  const setCover = (t: EntryType, v: TitleLang) => save({ covers: { ...prefs.covers, [t]: v } });

  return (
    <div className="prefs-panel">
      <h3 className="set-h">Dizi ve anime</h3>
      <div className="vis-pick">
        <label className={`vis-opt ${!prefs.merge ? "on" : ""}`}>
          <input type="radio" name="merge" checked={!prefs.merge} onChange={() => save({ merge: false })} /> <b>Ayrı ayrı</b>
          <span className="muted small">Kütüphanede, Keşfet&apos;te ve eklerken Dizi ile Anime iki ayrı sekme</span>
        </label>
        <label className={`vis-opt ${prefs.merge ? "on" : ""}`}>
          <input type="radio" name="merge" checked={!!prefs.merge} onChange={() => save({ merge: true })} /> <b>Birlikte</b>
          <span className="muted small">Tek &quot;Dizi / Anime&quot; sekmesi; eklerken ikisi birden aranır (Türkçe, İngilizce ya da Japonca adıyla)</span>
        </label>
      </div>
      {!compact && (
        <>
          <h3 className="set-h">Açıklamaların dili <span className="muted small">· içerik sayfalarındaki konu ve özet</span></h3>
          <div className="chips">
            {([["tr", "Türkçe (yoksa İngilizce)"], ["en", "İngilizce"]] as const).map(([k, l]) => (
              <button type="button" key={k} className={`chip ${(prefs.lang || "tr") === k ? "active" : ""}`} onClick={() => save({ lang: k })}>{l}</button>
            ))}
          </div>
          <p className="muted small">Oyun açıklamaları kaynağında (IGDB) sadece İngilizce; film ve dizilerde Türkçesi yoksa İngilizcesi gösterilir.</p>
        </>
      )}
      <h3 className="set-h">İçerik adları ve kapaklar <span className="muted small">· her tür için ayrı seç</span></h3>
      <p className="muted small" style={{ marginTop: 0 }}>Ör. film ve dizileri İngilizce adı ve afişiyle, animeleri Japonca adıyla görebilirsin. Sadece senin ekranında değişir, kayıtların aynı kalır.</p>
      <div className="prefs-grid">
        {LANG_TYPES.map((t) => (
          <div key={t} className="prefs-row">
            <b>{TYPES[t].plural}</b>
            <label>Ad
              <select value={prefs.titles?.[t] || "default"} onChange={(e) => setTitle(t, e.target.value as TitleLang)}>
                {TITLE_LANGS[t].map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
            {t !== "anime" && (
              <label>Kapak
                <select value={prefs.covers?.[t] || "default"} onChange={(e) => setCover(t, e.target.value as TitleLang)}>
                  {COVER_LANGS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </label>
            )}
          </div>
        ))}
      </div>
      <p className="muted small">Oyun adları kaynağındaki (IGDB) gibi kalır. Müzikte ad zaten albümün kendi adıdır.</p>
    </div>
  );
}

// İlk girişte (ve şu an kayıtlı herkese) bir kez sorar: dizi ve anime ayrı mı birlikte mi, adlar hangi dilde. Ayarlardan her zaman değişir.
export function PrefsAsk() {
  const { me, prefs, savePrefs } = useApp();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  // Site açılır açılmaz değil, biraz sonra ve başka bir pencere açık değilken
  useEffect(() => {
    if (!me || me.prefs === undefined || prefs.asked) return; // veritabanında alan yoksa (035 çalışmadıysa) sorma
    const t = setInterval(() => { if (!document.querySelector("dialog[open]")) { clearInterval(t); setOpen(true); } }, 4000);
    return () => clearInterval(t);
  }, [me, prefs.asked]);
  useEffect(() => { if (open) ref.current?.showModal(); }, [open]);
  if (!me || prefs.asked || !open) return null;
  const close = () => { savePrefs({ asked: true }).catch(() => {}); ref.current?.close(); };
  return (
    <dialog ref={ref} className="notice-dialog prefs-ask" onClose={() => { setOpen(false); savePrefs({ asked: true }).catch(() => {}); }}>
      <div className="dialog-head">
        <h2>İçerikleri nasıl görmek istersin?</h2>
        <button type="button" className="icon-btn" aria-label="Kapat" onClick={close}>✕</button>
      </div>
      <p className="muted small" style={{ marginTop: 0 }}>Bir kez soruyoruz. Sonra <b>Ayarlar → Dil ve içerik</b>&apos;ten istediğin zaman değiştirebilirsin.</p>
      <PrefsPanel compact />
      <div className="actions"><span className="spacer" /><button className="btn primary" onClick={close}>Tamam</button></div>
    </dialog>
  );
}
