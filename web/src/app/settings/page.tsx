"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AvatarCrop, EntryType, Profile } from "@/lib/types";
import { ACCENTS, PROFILE_THEMES, SOCIALS, TYPES, TYPE_KEYS, statusLabel } from "@/lib/constants";
import { cssUrl, safeUrl, today } from "@/lib/format";
import { fetchEntries } from "@/lib/data";
import { q, sb } from "@/lib/supabase";
import { useApp } from "@/components/AppProvider";
import { Avatar } from "@/components/ui";
import { AvatarCropper } from "@/components/AvatarCropper";
import { youtubeId } from "@/components/ProfileSong";
import { DEFAULT_COLOR, applyTheme } from "@/lib/theme";

// Bağlantı: kullanıcı adı ya da o sitenin https:// linki. undefined = geçersiz
function cleanSocial(key: string, raw: string): string | null | undefined {
  const v = raw.trim();
  if (!v) return null;
  if (key === "discord") return v.slice(0, 40);
  const s = SOCIALS.find((x) => x.key === key)!;
  if (/^https:\/\//i.test(v)) {
    try {
      const u = new URL(v);
      if (key === "website" || s.hosts.some((h) => u.hostname === h || u.hostname.endsWith("." + h))) return u.href.slice(0, 200);
    } catch { /* geçersiz link */ }
    return undefined;
  }
  if (key === "website") return undefined;
  const handle = v.replace(/^@/, "");
  return /^[\w.-]{1,50}$/.test(handle) ? handle : undefined;
}

export default function Settings() {
  const { me, ready } = useApp();
  if (!ready) return <div className="loading">Yükleniyor…</div>;
  if (!me) return <div className="empty">Bu sayfa için giriş yapmalısın. <br /><Link className="btn" href="/login">Giriş yap</Link></div>;
  return <SettingsForm key={me.id} me={me} />;
}

function SettingsForm({ me }: { me: Profile }) {
  const { setMe, toast } = useApp();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [accent, setAccent] = useState(me.accent || "");
  const [theme, setTheme] = useState(me.profile_theme && (PROFILE_THEMES[me.profile_theme] || me.profile_theme === "glass") ? me.profile_theme : "");
  const [bgUrl, setBgUrl] = useState(me.bg_url || "");
  const [scale, setScale] = useState<5 | 10>(me.rating_scale === 10 ? 10 : 5);
  const [siteColor, setSiteColor] = useState(me.site_color || "");
  const [song, setSong] = useState({ url: me.song_url || "", title: me.song_title || "", volume: me.song_volume || 15 });
  const [avatar, setAvatar] = useState(me.avatar_url || "");
  const [crop, setCrop] = useState<AvatarCrop>(me.avatar_crop || { x: 50, y: 50, z: 1 });
  const [hiddenTypes, setHiddenTypes] = useState<EntryType[]>(me.hidden_types || []);
  const [privacy, setPrivacy] = useState(me.privacy || "public");
  // Renk seçilince site hemen o renge döner; kaydetmeden çıkarsa eskisine
  const pickSiteColor = (c: string) => { setSiteColor(c); applyTheme(c); };
  const saved = useRef(me.site_color);
  useEffect(() => () => applyTheme(saved.current), []);

  // Link yapıştırılınca şarkı adını kendiliğinden doldur
  async function songLink(url: string) {
    setSong((s) => ({ ...s, url }));
    if (!youtubeId(url) || song.title) return;
    const r = await fetch(`/api/oembed?url=${encodeURIComponent(url)}`).catch(() => null);
    if (r?.ok) { const d = await r.json(); setSong((s) => (s.title ? s : { ...s, title: `${d.author.replace(/\s*-\s*Topic$/i, "")} — ${d.title}`.slice(0, 120) })); }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const str = (k: string) => String(f.get(k) || "").trim();
    setError("");
    if (bgUrl.trim() && !bgUrl.trim().startsWith("https://")) return setError("Arka plan linki https:// ile başlamalı.");
    for (const k of ["avatar", "banner"]) {
      if (str(k) && !str(k).startsWith("https://")) return setError(`${k === "avatar" ? "Fotoğraf" : "Kapak"} linki https:// ile başlamalı.`);
    }
    const socials: Record<string, string> = {};
    for (const s of SOCIALS) {
      const v = cleanSocial(s.key, str(`s-${s.key}`));
      if (v === undefined) return setError(`${s.label} bağlantısı geçersiz. Kullanıcı adını ya da https:// ile başlayan linki yaz.`);
      if (v) socials[s.key] = v;
    }
    if (song.url && !youtubeId(song.url)) return setError("Profil şarkısı için bir YouTube linki yapıştır.");
    setBusy(true);
    try {
      const updated = await q<Profile>(sb().from("profiles").update({
        display_name: str("name") || null,
        bio: str("bio") || null,
        avatar_url: str("avatar") || null,
        banner_url: str("banner") || null,
        pronouns: str("pronouns") || null,
        location: str("location") || null,
        accent: !theme && /^#[0-9a-f]{6}$/i.test(accent) ? accent : null,
        profile_theme: theme || null,
        bg_url: bgUrl.trim() || null,
        rating_scale: scale,
        socials,
        site_color: /^#[0-9a-f]{6}$/i.test(siteColor) && siteColor.toLowerCase() !== DEFAULT_COLOR ? siteColor : null,
        song_url: song.url.trim() || null,
        song_title: song.title.trim() || null,
        song_volume: song.volume,
        // Yeni alanlar yalnızca kullanıldığında gönderilir (veritabanı güncellenmeden de profil kaydedilebilsin)
        ...((me.avatar_crop || crop.z > 1 || crop.x !== 50 || crop.y !== 50) && { avatar_crop: crop }),
        ...((me.hidden_types?.length || hiddenTypes.length) && { hidden_types: hiddenTypes }),
        ...(privacy !== (me.privacy || "public") && { privacy }), // yalnızca değişince (veritabanı güncellenmeden de kaydedilebilsin)
      }).eq("id", me.id).select().single());
      setMe(updated);
      saved.current = updated.site_color;
      toast("Profil kaydedildi ✓");
      router.push(`/u/${updated.username}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth settings" onSubmit={submit}>
      <h1>Profili düzenle</h1>
      <div className="view-user"><Avatar p={me} /> <span>@{me.username}</span></div>

      <h3 className="set-h">Profil</h3>
      <div className="field"><label htmlFor="p-name">Görünen ad</label><input id="p-name" name="name" maxLength={40} defaultValue={me.display_name || ""} /></div>
      <div className="field"><label htmlFor="p-bio">Hakkımda</label><textarea id="p-bio" name="bio" rows={3} maxLength={300} defaultValue={me.bio || ""} /></div>
      <div className="row">
        <div className="field grow"><label htmlFor="p-pronouns">Zamirler</label><input id="p-pronouns" name="pronouns" maxLength={20} placeholder="ör. o/onun" defaultValue={me.pronouns || ""} /></div>
        <div className="field grow"><label htmlFor="p-location">Konum</label><input id="p-location" name="location" maxLength={40} placeholder="ör. İstanbul" defaultValue={me.location || ""} /></div>
      </div>
      <div className="field">
        <label htmlFor="p-avatar">Profil fotoğrafı (https:// ile başlayan resim linki)</label>
        <input id="p-avatar" name="avatar" type="url" value={avatar} onChange={(e) => { setAvatar(e.target.value); setCrop({ x: 50, y: 50, z: 1 }); }} placeholder="https://…" />
      </div>
      {safeUrl(avatar) && <AvatarCropper url={avatar} crop={crop} onChange={setCrop} />}
      <div className="field">
        <label htmlFor="p-banner">Kapak görseli (profilin üstündeki geniş resim, https://)</label>
        <input id="p-banner" name="banner" type="url" defaultValue={me.banner_url || ""} placeholder="https://…" />
      </div>

      <h3 className="set-h">Profilimi kimler görebilir?</h3>
      <div className="vis-pick" style={{ marginBottom: 8 }}>
        {([["public", "Herkese açık", "Herkes kütüphaneni, listelerini ve istatistiklerini görür"],
          ["friends", "Sadece arkadaşlar", "Karşılıklı takipleştiğin kişiler görür, diğerleri sadece adını ve fotoğrafını görür"],
          ["private", "Gizli", "Kütüphanen sadece sana görünür. Adın, fotoğrafın, kapağın ve arka planın yine görünür"]] as const).map(([k, name, hint]) => (
          <label key={k} className={`vis-opt ${privacy === k ? "on" : ""}`}>
            <input type="radio" name="privacy" checked={privacy === k} onChange={() => setPrivacy(k)} /> <b>{name}</b><span className="muted small">{hint}</span>
          </label>
        ))}
      </div>
      <p className="muted small" style={{ margin: "0 0 4px" }}>Profilin gizli olsa da insanlar seni takip edebilir; arkadaşların sana yazmaya devam eder.</p>

      <h3 className="set-h">Profilimde gösterilecek türler <span className="muted small">· işaretini kaldırdığın türü başkaları profilinde göremez</span></h3>
      <div className="chips" style={{ marginBottom: 8 }}>
        {TYPE_KEYS.map((t) => {
          const shown = !hiddenTypes.includes(t);
          return (
            <label key={t} className={`chip ${shown ? "active" : ""}`}>
              <input type="checkbox" hidden checked={shown} onChange={() => setHiddenTypes((h) => (shown ? [...h, t] : h.filter((x) => x !== t)))} />
              {shown ? "✓ " : ""}{TYPES[t].plural}
            </label>
          );
        })}
      </div>

      <h3 className="set-h">Profil teması <span className="muted small">· profiline girenler görür</span></h3>
      <div className="theme-cards">
        <button type="button" className={`theme-card ${!theme && !accent ? "on" : ""}`} onClick={() => { setTheme(""); setAccent(""); }}
          style={{ "--t-tint": "var(--panel)", "--t-accent": "#58a98a" } as React.CSSProperties}>
          <span className="prev"><i /><i /></span>Varsayılan
        </button>
        <button type="button" className={`theme-card glass-card ${theme === "glass" ? "on" : ""}`} onClick={() => setTheme("glass")}
          style={{ "--t-tint": "rgba(0, 0, 0, .25)", "--t-accent": accent || "#58a98a", ...(bgUrl.trim().startsWith("https://") && { backgroundImage: cssUrl(bgUrl.trim()) }) } as React.CSSProperties}>
          <span className="prev"><i /><i /></span>Şeffaf
        </button>
        {Object.entries(PROFILE_THEMES).map(([k, t]) => (
          <button type="button" key={k} className={`theme-card ${theme === k ? "on" : ""}`} onClick={() => { setTheme(k); setAccent(""); }}
            style={{ "--t-tint": t.tint, "--t-accent": t.accent } as React.CSSProperties}>
            <span className="prev"><i /><i /></span>{t.name}
          </button>
        ))}
        <label className={`theme-card ${(!theme || theme === "glass") && accent ? "on" : ""}`}
          style={{ "--t-tint": `color-mix(in srgb, ${accent || "#8b5cf6"} 14%, rgba(10, 12, 14, .86))`, "--t-accent": accent || "#8b5cf6" } as React.CSSProperties}>
          <span className="prev"><i /><i /></span>Özel renk
          <input type="color" value={accent || "#8b5cf6"} onChange={(e) => { if (theme !== "glass") setTheme(""); setAccent(e.target.value); }} />
        </label>
      </div>

      {theme === "glass" && (
        <p className="muted small">Şeffaf profilde arka plan resmin Steam&apos;deki gibi bütün profilde görünür, kutular yarı saydam olur.
          {!bgUrl.trim().startsWith("https://") && <b> Bunun için aşağıya bir arka plan resmi linki koy.</b>} Renk için &quot;Özel renk&quot;i de seçebilirsin.</p>
      )}
      <div className="field">
        <label htmlFor="p-bg">Arka plan resmi <span className="muted">· Steam&apos;deki gibi profilinin arkasını kaplar (resim, GIF ya da .mp4 / .webm linki)</span></label>
        <input id="p-bg" type="url" placeholder="https://…" value={bgUrl} onChange={(e) => setBgUrl(e.target.value)} />
      </div>
      {bgUrl.trim().startsWith("https://") && !/\.(mp4|webm)(\?|$)/i.test(bgUrl) && <div className="bg-preview" style={{ backgroundImage: cssUrl(bgUrl.trim()) }} />}

      <h3 className="set-h">Site rengi <span className="muted small">· sadece sen görürsün</span></h3>
      <div className="swatches">
        <button type="button" className={`swatch ${!siteColor ? "on" : ""}`} style={{ background: DEFAULT_COLOR }} onClick={() => pickSiteColor("")} title="Varsayılan (yeşil)" />
        {ACCENTS.filter((c) => c !== DEFAULT_COLOR).map((c) => (
          <button type="button" key={c} className={`swatch ${siteColor === c ? "on" : ""}`} style={{ background: c }} onClick={() => pickSiteColor(c)} aria-label={c} />
        ))}
        <label className="swatch custom" title="Kendi rengini seç">
          <input type="color" value={siteColor || DEFAULT_COLOR} onChange={(e) => pickSiteColor(e.target.value)} />+
        </label>
      </div>
      <p className="muted small">Butonlar, bağlantılar ve arka plandaki ışık bu renge döner. Seçince hemen görürsün; kalıcı olması için aşağıdan kaydet.</p>

      <h3 className="set-h">Profil şarkısı</h3>
      <div className="field">
        <label htmlFor="p-song">YouTube linki</label>
        <input id="p-song" type="url" placeholder="https://www.youtube.com/watch?v=…" value={song.url} onChange={(e) => songLink(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="p-song-title">Köşede yazacak isim</label>
        <input id="p-song-title" maxLength={120} placeholder="ör. Pink Floyd — Shine On You Crazy Diamond" value={song.title} onChange={(e) => setSong((s) => ({ ...s, title: e.target.value }))} />
      </div>
      <div className="field">
        <label htmlFor="p-song-vol">Ses: %{song.volume}</label>
        <input id="p-song-vol" type="range" min={1} max={60} value={song.volume} onChange={(e) => setSong((s) => ({ ...s, volume: Number(e.target.value) }))} />
      </div>
      <p className="muted small">Profiline girenler bu şarkıyı arkada kısık sesle duyar, köşede adı yazar. Kaldırmak için linki silip kaydet.</p>

      <h3 className="set-h">Puan ölçeği</h3>
      <div className="scale-pick">
        <label className={scale === 5 ? "on" : ""}><input type="radio" name="scale" checked={scale === 5} onChange={() => setScale(5)} /> <b>5 üzerinden</b> <span>★★★½ gibi yarım yıldızlar</span></label>
        <label className={scale === 10 ? "on" : ""}><input type="radio" name="scale" checked={scale === 10} onChange={() => setScale(10)} /> <b>10 üzerinden</b> <span>7,5/10 gibi</span></label>
      </div>
      <p className="muted small">Herkesin puanı senin seçtiğin ölçekte görünür. Ör: biri 10&apos;luk ölçekte 7 verdiyse sen 5&apos;likte 3,5 yıldız görürsün; 5&apos;likte 2,75 verilen bir puanı 10&apos;lukta 5,5 görürsün.</p>

      <h3 className="set-h">Bağlantılar</h3>
      <div className="socials-form">
        {SOCIALS.map((s) => (
          <div className="field" key={s.key}>
            <label htmlFor={`s-${s.key}`}>{s.label}</label>
            <input id={`s-${s.key}`} name={`s-${s.key}`} maxLength={200} placeholder={s.hint} defaultValue={me.socials?.[s.key] || ""} />
          </div>
        ))}
      </div>

      {error && <p className="form-error">{error}</p>}
      <div className="actions">
        <button className="btn primary" disabled={busy}>Kaydet</button>
        <Link className="btn ghost" href={`/u/${me.username}`}>Profilime dön</Link>
      </div>
      <hr style={{ border: 0, borderTop: "1px solid var(--border)", width: "100%" }} />
      <div className="actions">
        <Link className="btn" href="/import">Başka siteden içe aktar</Link>
        <span className="spacer" />
        <button type="button" className="btn danger" onClick={() => sb().auth.signOut()}>Çıkış yap</button>
      </div>
      <ExportData me={me} />
      <DeleteAllLogs me={me} />
      <DeleteAccount me={me} />
    </form>
  );
}

function download(name: string, text: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
// Excel Türkçe karakterleri doğru göstersin diye başta BOM var
const toCsv = (head: string[], rows: unknown[][]) => "\ufeff" + [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");

// Verilerini istediğin an, istediğin biçimde indir: siteden ayrılan da her şeyini yanında götürür
function ExportData({ me }: { me: Profile }) {
  const { toast } = useApp();
  const [busy, setBusy] = useState("");
  const name = (ext: string, part = "") => `ancalog-${me.username}${part}-${today()}.${ext}`;

  async function run(kind: "csv" | "json" | "letterboxd") {
    setBusy(kind);
    try {
      const entries = await fetchEntries(me.id);
      if (kind === "csv") {
        download(name("csv"), toCsv(
          ["Tür", "Ad", "Yıl", "Yapımcı / Sanatçı", "Durum", "Puan (10 üzerinden)", "Bitirme tarihi", "Başlama tarihi", "Süre (saat)", "Platform", "Nerede", "İlerleme", "Favori", "İnceleme"],
          entries.map((e) => [TYPES[e.type].label, e.title, e.year, e.creator, statusLabel(e.status, e.type), e.rating || "", e.date, e.started_on,
            e.playtime_sec ? Math.round(e.playtime_sec / 360) / 10 : e.hours, e.platform, e.store, e.progress, e.favorite ? "Evet" : "", e.notes]),
        ), "text/csv;charset=utf-8");
      } else if (kind === "letterboxd") {
        // Letterboxd'un içe aktarma biçimi: letterboxd.com/import
        const movies = entries.filter((e) => e.type === "movie" && e.status !== "planned");
        if (!movies.length) return toast("Kütüphanende izlenmiş film yok.");
        download(name("csv", "-letterboxd"), toCsv(["Title", "Year", "Rating10", "WatchedDate", "Review"],
          movies.map((e) => [e.title, e.year, e.rating || "", e.date, e.notes])), "text/csv;charset=utf-8");
      } else {
        const [profile, lists, follows] = await Promise.all([
          q(sb().from("profiles").select("*").eq("id", me.id).single()),
          q(sb().from("lists").select("*, list_items(*)").eq("user_id", me.id)).catch(() => []),
          q(sb().from("follows").select("following_id, created_at").eq("follower_id", me.id)).catch(() => []),
        ]);
        download(name("json"), JSON.stringify({ exported_at: new Date().toISOString(), profile, entries, lists, follows }, null, 2), "application/json");
      }
      toast("İndirildi");
    } catch (err) {
      toast("İndirilemedi: " + (err as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="export-box">
      <h3 className="set-h">Verilerimi indir</h3>
      <p className="muted small">Kayıtların her zaman senin. İstediğin an indirip başka bir yere taşıyabilirsin.</p>
      <div className="actions">
        <button type="button" className="btn" disabled={!!busy} onClick={() => run("csv")}>{busy === "csv" ? "Hazırlanıyor…" : "Excel / CSV"}</button>
        <button type="button" className="btn" disabled={!!busy} onClick={() => run("json")}>{busy === "json" ? "Hazırlanıyor…" : "Tam yedek (JSON)"}</button>
        <button type="button" className="btn" disabled={!!busy} onClick={() => run("letterboxd")}>{busy === "letterboxd" ? "Hazırlanıyor…" : "Filmlerim (Letterboxd için)"}</button>
      </div>
    </div>
  );
}

// Sıfırdan başlamak isteyenler için: hesap kalır, bütün kayıtlar silinir. İki kez sorulur.
function DeleteAllLogs({ me }: { me: Profile }) {
  const { mine, toast, refresh } = useApp();
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<EntryType | "all">("all"); // hepsi ya da sadece bir tür (oyun, film, dizi...)
  const target = kind === "all" ? mine : mine.filter((e) => e.type === kind);
  const what = kind === "all" ? "kaydın" : `${TYPES[kind].label.toLocaleLowerCase("tr")} kaydının`;

  async function wipe() {
    if (!target.length) return toast("Silinecek kaydın yok.");
    if (!confirm(`Kütüphanendeki ${target.length} ${what} tamamı silinecek (puanlar, incelemeler, süreler, favoriler ve bunlara gelen beğeni ve yorumlar dahil). Emin misin?`)) return;
    if (!confirm(`Gerçekten emin misin? Bu işlem geri alınamaz. ${kind === "all" ? "Hesabın, listelerin ve takiplerin kalır, kayıtların tamamen silinir." : "Diğer türlerdeki kayıtların, hesabın ve listelerin kalır."}`)) return;
    setBusy(true);
    try {
      let req = sb().from("entries").delete().eq("user_id", me.id);
      if (kind !== "all") req = req.eq("type", kind);
      await q(req);
      toast(kind === "all" ? "Bütün kayıtların silindi. Sıfırdan başlayabilirsin." : `${TYPES[kind].plural} kayıtların silindi.`);
      refresh();
    } catch (err) {
      toast("Silinemedi: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="danger-zone">
      <summary>Kayıtlarımı sil (hepsini ya da sadece bir türü)</summary>
      <p>Hesabın açık kalır. İstersen bütün kayıtlarını, istersen sadece oyun, film, dizi, müzik ya da anime kayıtlarını silebilirsin.
        Önce yukarıdaki <b>Verilerimi indir</b> ile yedek almanı öneririz.</p>
      <div className="chips" style={{ marginBottom: 10 }}>
        <button type="button" className={`chip ${kind === "all" ? "active" : ""}`} onClick={() => setKind("all")}>Hepsi ({mine.length})</button>
        {TYPE_KEYS.filter((t) => mine.some((e) => e.type === t)).map((t) => (
          <button type="button" key={t} className={`chip ${kind === t ? "active" : ""}`} onClick={() => setKind(t)}>
            Sadece {TYPES[t].plural.toLocaleLowerCase("tr")} ({mine.filter((e) => e.type === t).length})
          </button>
        ))}
      </div>
      <button type="button" className="btn danger" disabled={busy || !target.length} onClick={wipe}>
        {busy ? "Siliniyor…" : kind === "all" ? `Bütün kayıtlarımı sil (${target.length})` : `${TYPES[kind].plural} kayıtlarımı sil (${target.length})`}
      </button>
    </details>
  );
}

// Hesabı kalıcı olarak silme: yanlışlıkla basılmasın diye kullanıcı adını yazmak gerekir
function DeleteAccount({ me }: { me: Profile }) {
  const { toast, isOwner } = useApp();
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (text.trim().toLowerCase() !== me.username) return;
    setBusy(true);
    const { error } = await sb().rpc("delete_account");
    if (error) { setBusy(false); return setError("Silinemedi: " + error.message); }
    await sb().auth.signOut().catch(() => {});
    toast("Hesabın silindi. Görüşmek üzere.");
    router.replace("/");
  }

  return (
    <details className="danger-zone">
      <summary>Hesabımı sil</summary>
      {isOwner ? <p className="muted">Site sahibinin hesabı silinemez.</p> : (
        <>
          <p>Hesabın; kayıtların, listelerin, beğenilerin, yorumların, mesajların ve takiplerinle birlikte <b>kalıcı olarak</b> silinir. Bu geri alınamaz.
            İstersen önce yukarıdaki <b>Verilerimi indir</b> ile kayıtlarını bilgisayarına kaydet.</p>
          <div className="field">
            <label htmlFor="del-confirm">Onaylamak için kullanıcı adını yaz: <b>{me.username}</b></label>
            <input id="del-confirm" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          {error && <p className="form-error">{error}</p>}
          <button type="button" className="btn danger" disabled={busy || text.trim().toLowerCase() !== me.username} onClick={remove}>
            {busy ? "Siliniyor…" : "Hesabımı kalıcı olarak sil"}
          </button>
        </>
      )}
    </details>
  );
}
