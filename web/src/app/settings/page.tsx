"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Profile } from "@/lib/types";
import { today } from "@/lib/format";
import { fetchEntries } from "@/lib/data";
import { q, sb } from "@/lib/supabase";
import { useApp } from "@/components/AppProvider";
import { Avatar } from "@/components/ui";

export default function Settings() {
  const { me, setMe, ready, toast } = useApp();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!ready) return <div className="loading">Yükleniyor…</div>;
  if (!me) return <div className="empty">Bu sayfa için giriş yapmalısın. <br /><Link className="btn" href="/login">Giriş yap</Link></div>;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const avatar = String(f.get("avatar")).trim();
    if (avatar && !avatar.startsWith("https://")) return setError("Fotoğraf linki https:// ile başlamalı.");
    setBusy(true);
    try {
      const updated = await q<Profile>(sb().from("profiles").update({
        display_name: String(f.get("name")).trim() || null,
        bio: String(f.get("bio")).trim() || null,
        avatar_url: avatar || null,
      }).eq("id", me!.id).select().single());
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
    const data = await fetchEntries(me!.id);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = `ancalog-${me!.username}-${today()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <form className="auth settings" onSubmit={submit}>
      <h1>Profili düzenle</h1>
      <div className="view-user"><Avatar p={me} /> <span>@{me.username}</span></div>
      <div className="field"><label htmlFor="p-name">Görünen ad</label><input id="p-name" name="name" maxLength={40} defaultValue={me.display_name || ""} /></div>
      <div className="field"><label htmlFor="p-bio">Hakkımda</label><textarea id="p-bio" name="bio" rows={3} maxLength={300} defaultValue={me.bio || ""} /></div>
      <div className="field">
        <label htmlFor="p-avatar">Profil fotoğrafı (https:// ile başlayan resim linki)</label>
        <input id="p-avatar" name="avatar" type="url" defaultValue={me.avatar_url || ""} placeholder="https://…" />
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
