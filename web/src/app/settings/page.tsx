"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Profile } from "@/lib/types";
import { ACCENTS, PROFILE_THEMES, SOCIALS } from "@/lib/constants";
import { cssUrl, today } from "@/lib/format";
import { fetchEntries } from "@/lib/data";
import { q, sb } from "@/lib/supabase";
import { useApp } from "@/components/AppProvider";
import { Avatar } from "@/components/ui";
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

const TABS = [["profil", "Profil"], ["gorunum", "Görünüm"], ["baglantilar", "Bağlantılar"], ["sarki", "Şarkı"], ["veri", "Hesap ve veri"]] as const;

function SettingsForm({ me }: { me: Profile }) {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("profil");
  const { setMe, toast } = useApp();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [accent, setAccent] = useState(me.accent || "");
  const [theme, setTheme] = useState(me.profile_theme && PROFILE_THEMES[me.profile_theme] ? me.profile_theme : "");
  const [bgUrl, setBgUrl] = useState(me.bg_url || "");
  const [scale, setScale] = useState<5 | 10>(me.rating_scale === 10 ? 10 : 5);
  const [siteColor, setSiteColor] = useState(me.site_color || "");
  const [song, setSong] = useState({ url: me.song_url || "", title: me.song_title || "", volume: me.song_volume || 15 });
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

  async function exportMine() {
    const data = await fetchEntries(me.id);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = `ancalog-${me.username}-${today()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="set-page">
      <header className="set-top">
        <h1>Ayarlar</h1>
        <Link className="set-me" href={`/u/${me.username}`}><Avatar p={me} /> <span>@{me.username}</span></Link>
      </header>
      <nav className="set-tabs" aria-label="Ayar bölümleri">
        {TABS.map(([k, label]) => <button key={k} type="button" className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{label}</button>)}
      </nav>

      <form onSubmit={submit}>
        {/* Bütün bölümler açık kalır (sadece gizlenir), kaydederken hepsi gönderilsin */}
        <section className="set-card" hidden={tab !== "profil"}>
          <h2>Profil</h2><p className="set-sub">Profilinde görünen bilgiler.</p>
          <Row title="Görünen ad" desc="Adının yanında @kullanıcı adın görünür."><input id="p-name" name="name" maxLength={40} defaultValue={me.display_name || ""} /></Row>
          <Row title="Hakkımda" desc="En fazla 300 karakter." wide><textarea id="p-bio" name="bio" rows={3} maxLength={300} defaultValue={me.bio || ""} /></Row>
          <Row title="Zamirler"><input id="p-pronouns" name="pronouns" maxLength={20} placeholder="ör. o/onun" defaultValue={me.pronouns || ""} /></Row>
          <Row title="Konum"><input id="p-location" name="location" maxLength={40} placeholder="ör. İstanbul" defaultValue={me.location || ""} /></Row>
          <Row title="Profil fotoğrafı" desc="https:// ile başlayan resim linki."><input id="p-avatar" name="avatar" type="url" defaultValue={me.avatar_url || ""} placeholder="https://…" /></Row>
          <Row title="Kapak görseli" desc="Profilinin üstündeki geniş resim. Boşsa kapaklarından şerit çıkar."><input id="p-banner" name="banner" type="url" defaultValue={me.banner_url || ""} placeholder="https://…" /></Row>
        </section>

        <section className="set-card" hidden={tab !== "gorunum"}>
          <h2>Görünüm</h2><p className="set-sub">Profilin ve sitenin nasıl görüneceği.</p>
          <Row title="Profil teması" desc="Profiline girenler görür." wide>
            <div className="theme-cards">
              <button type="button" className={`theme-card ${!theme && !accent ? "on" : ""}`} onClick={() => { setTheme(""); setAccent(""); }}
                style={{ "--t-tint": "var(--panel)", "--t-accent": "#58a98a" } as React.CSSProperties}>
                <span className="prev"><i /><i /></span>Varsayılan
              </button>
              {Object.entries(PROFILE_THEMES).map(([k, t]) => (
                <button type="button" key={k} className={`theme-card ${theme === k ? "on" : ""}`} onClick={() => { setTheme(k); setAccent(""); }}
                  style={{ "--t-tint": t.tint, "--t-accent": t.accent } as React.CSSProperties}>
                  <span className="prev"><i /><i /></span>{t.name}
                </button>
              ))}
              <label className={`theme-card ${!theme && accent ? "on" : ""}`}
                style={{ "--t-tint": `color-mix(in srgb, ${accent || "#8b5cf6"} 14%, rgba(10, 12, 14, .86))`, "--t-accent": accent || "#8b5cf6" } as React.CSSProperties}>
                <span className="prev"><i /><i /></span>Özel renk
                <input type="color" value={accent || "#8b5cf6"} onChange={(e) => { setTheme(""); setAccent(e.target.value); }} />
              </label>
            </div>
          </Row>
          <Row title="Arka plan resmi" desc="Profilinin arkasını kaplar: resim, GIF ya da .mp4 / .webm linki." wide>
            <input id="p-bg" type="url" placeholder="https://…" value={bgUrl} onChange={(e) => setBgUrl(e.target.value)} />
            {bgUrl.trim().startsWith("https://") && !/\.(mp4|webm)(\?|$)/i.test(bgUrl) && <div className="bg-preview" style={{ backgroundImage: cssUrl(bgUrl.trim()) }} />}
          </Row>
          <Row title="Site rengi" desc="Butonlar, bağlantılar ve ışık bu renge döner. Sadece sen görürsün.">
            <div className="swatches">
              <button type="button" className={`swatch ${!siteColor ? "on" : ""}`} style={{ background: DEFAULT_COLOR }} onClick={() => pickSiteColor("")} title="Varsayılan (yeşil)" />
              {ACCENTS.filter((c) => c !== DEFAULT_COLOR).map((c) => (
                <button type="button" key={c} className={`swatch ${siteColor === c ? "on" : ""}`} style={{ background: c }} onClick={() => pickSiteColor(c)} aria-label={c} />
              ))}
              <label className="swatch custom" title="Kendi rengini seç">
                <input type="color" value={siteColor || DEFAULT_COLOR} onChange={(e) => pickSiteColor(e.target.value)} />+
              </label>
            </div>
          </Row>
          <Row title="Puan ölçeği" desc="Herkesin puanı senin ölçeğinde görünür: 10'luk 7, 5'likte 3,5 yıldız olur.">
            <div className="set-seg">
              <button type="button" className={scale === 5 ? "on" : ""} onClick={() => setScale(5)}>5 üzerinden</button>
              <button type="button" className={scale === 10 ? "on" : ""} onClick={() => setScale(10)}>10 üzerinden</button>
            </div>
          </Row>
        </section>

        <section className="set-card" hidden={tab !== "baglantilar"}>
          <h2>Bağlantılar</h2><p className="set-sub">Profilinde rozet olarak görünür. Kullanıcı adını ya da https:// linkini yaz.</p>
          {SOCIALS.map((s) => (
            <Row key={s.key} title={s.label}><input id={`s-${s.key}`} name={`s-${s.key}`} maxLength={200} placeholder={s.hint} defaultValue={me.socials?.[s.key] || ""} /></Row>
          ))}
        </section>

        <section className="set-card" hidden={tab !== "sarki"}>
          <h2>Profil şarkısı</h2><p className="set-sub">Profiline girenler bu şarkıyı arkada kısık sesle duyar. Kaldırmak için linki silip kaydet.</p>
          <Row title="YouTube linki"><input id="p-song" type="url" placeholder="https://www.youtube.com/watch?v=…" value={song.url} onChange={(e) => songLink(e.target.value)} /></Row>
          <Row title="Köşede yazacak isim" desc="Link yapıştırınca kendiliğinden dolar."><input id="p-song-title" maxLength={120} placeholder="ör. Pink Floyd — Shine On You Crazy Diamond" value={song.title} onChange={(e) => setSong((x) => ({ ...x, title: e.target.value }))} /></Row>
          <Row title={`Ses: %${song.volume}`}><input id="p-song-vol" type="range" min={1} max={60} value={song.volume} onChange={(e) => setSong((x) => ({ ...x, volume: Number(e.target.value) }))} /></Row>
        </section>

        <section className="set-card" hidden={tab !== "veri"}>
          <h2>Hesap ve veri</h2><p className="set-sub">Kayıtların senin, istediğin zaman alıp gidebilirsin.</p>
          <Row title="İçe aktar" desc="Steam ya da Letterboxd'dan kayıtlarını getir."><Link className="btn" href="/import">İçe aktar</Link></Row>
          <Row title="Verilerimi indir" desc="Bütün kayıtların JSON dosyası olarak."><button type="button" className="btn" onClick={exportMine}>İndir (JSON)</button></Row>
          <Row title="Çıkış yap" desc="Bu cihazdaki oturumu kapatır."><button type="button" className="btn danger" onClick={() => sb().auth.signOut()}>Çıkış yap</button></Row>
          <DeleteAccount me={me} />
        </section>

        <div className="set-save">
          {error ? <p className="form-error">{error}</p> : <span className="muted small">Değişiklikler kaydedene kadar sadece bu sayfada durur.</span>}
          <span className="spacer" />
          <Link className="btn ghost" href={`/u/${me.username}`}>Profilime dön</Link>
          <button className="btn primary" disabled={busy}>Kaydet</button>
        </div>
      </form>
    </div>
  );
}

// Ayarlarda her satır: solda başlık ve açıklama, sağda kontrol (stack: altına tam genişlik)
function Row({ title, desc, wide = false, children }: { title: string; desc?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`set-row ${wide ? "wide" : ""}`}>
      <div className="set-txt"><b>{title}</b>{desc && <span>{desc}</span>}</div>
      <div className="set-ctl">{children}</div>
    </div>
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
