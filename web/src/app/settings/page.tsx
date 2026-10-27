"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Profile } from "@/lib/types";
import { ACCENTS, SOCIALS } from "@/lib/constants";
import { today } from "@/lib/format";
import { fetchEntries } from "@/lib/data";
import { q, sb } from "@/lib/supabase";
import { useApp } from "@/components/AppProvider";
import { Avatar } from "@/components/ui";

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
  const [scale, setScale] = useState<5 | 10>(me.rating_scale === 10 ? 10 : 5);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const str = (k: string) => String(f.get(k) || "").trim();
    setError("");
    for (const k of ["avatar", "banner"]) {
      if (str(k) && !str(k).startsWith("https://")) return setError(`${k === "avatar" ? "Fotoğraf" : "Kapak"} linki https:// ile başlamalı.`);
    }
    const socials: Record<string, string> = {};
    for (const s of SOCIALS) {
      const v = cleanSocial(s.key, str(`s-${s.key}`));
      if (v === undefined) return setError(`${s.label} bağlantısı geçersiz. Kullanıcı adını ya da https:// ile başlayan linki yaz.`);
      if (v) socials[s.key] = v;
    }
    setBusy(true);
    try {
      const updated = await q<Profile>(sb().from("profiles").update({
        display_name: str("name") || null,
        bio: str("bio") || null,
        avatar_url: str("avatar") || null,
        banner_url: str("banner") || null,
        pronouns: str("pronouns") || null,
        location: str("location") || null,
        accent: /^#[0-9a-f]{6}$/i.test(accent) ? accent : null,
        rating_scale: scale,
        socials,
      }).eq("id", me.id).select().single());
      setMe(updated);
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
    <form className="auth settings" onSubmit={submit}>
      <h1>Profili düzenle</h1>
      <div className="view-user"><Avatar p={me} /> <span>@{me.username}</span></div>

      <h3 className="set-h">👤 Profil</h3>
      <div className="field"><label htmlFor="p-name">Görünen ad</label><input id="p-name" name="name" maxLength={40} defaultValue={me.display_name || ""} /></div>
      <div className="field"><label htmlFor="p-bio">Hakkımda</label><textarea id="p-bio" name="bio" rows={3} maxLength={300} defaultValue={me.bio || ""} /></div>
      <div className="row">
        <div className="field grow"><label htmlFor="p-pronouns">Zamirler</label><input id="p-pronouns" name="pronouns" maxLength={20} placeholder="ör. o/onun" defaultValue={me.pronouns || ""} /></div>
        <div className="field grow"><label htmlFor="p-location">Konum</label><input id="p-location" name="location" maxLength={40} placeholder="ör. İstanbul" defaultValue={me.location || ""} /></div>
      </div>
      <div className="field">
        <label htmlFor="p-avatar">Profil fotoğrafı (https:// ile başlayan resim linki)</label>
        <input id="p-avatar" name="avatar" type="url" defaultValue={me.avatar_url || ""} placeholder="https://…" />
      </div>
      <div className="field">
        <label htmlFor="p-banner">Kapak görseli (profilin üstündeki geniş resim, https://)</label>
        <input id="p-banner" name="banner" type="url" defaultValue={me.banner_url || ""} placeholder="https://…" />
      </div>

      <h3 className="set-h">🎨 Profil rengi</h3>
      <div className="swatches">
        <button type="button" className={`swatch none ${!accent ? "on" : ""}`} onClick={() => setAccent("")} title="Varsayılan">✕</button>
        {ACCENTS.map((c) => (
          <button type="button" key={c} className={`swatch ${accent === c ? "on" : ""}`} style={{ background: c }} onClick={() => setAccent(c)} aria-label={c} />
        ))}
        <label className="swatch custom" title="Kendi rengini seç">
          <input type="color" value={accent || "#58a98a"} onChange={(e) => setAccent(e.target.value)} />🎨
        </label>
      </div>

      <h3 className="set-h">⭐ Puan ölçeği</h3>
      <div className="scale-pick">
        <label className={scale === 5 ? "on" : ""}><input type="radio" name="scale" checked={scale === 5} onChange={() => setScale(5)} /> <b>5 üzerinden</b> <span>★★★½ gibi yarım yıldızlar</span></label>
        <label className={scale === 10 ? "on" : ""}><input type="radio" name="scale" checked={scale === 10} onChange={() => setScale(10)} /> <b>10 üzerinden</b> <span>7,5/10 gibi</span></label>
      </div>
      <p className="muted small">Herkesin puanı senin seçtiğin ölçekte görünür. Ör: biri 10&apos;luk ölçekte 7 verdiyse sen 5&apos;likte 3,5 yıldız görürsün; 5&apos;likte 2,75 verilen bir puanı 10&apos;lukta 5,5 görürsün.</p>

      <h3 className="set-h">🔗 Bağlantılar</h3>
      <div className="socials-form">
        {SOCIALS.map((s) => (
          <div className="field" key={s.key}>
            <label htmlFor={`s-${s.key}`}>{s.icon} {s.label}</label>
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
        <button type="button" className="btn" onClick={exportMine}>Verilerimi indir (JSON)</button>
        <span className="spacer" />
        <button type="button" className="btn danger" onClick={() => sb().auth.signOut()}>Çıkış yap</button>
      </div>
    </form>
  );
}
