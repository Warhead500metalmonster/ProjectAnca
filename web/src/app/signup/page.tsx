"use client";

import { useState } from "react";
import Link from "next/link";
import { q, sb, setRemember } from "@/lib/supabase";
import { authError } from "@/lib/auth";

export default function Signup() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const typed = String(f.get("username")).trim();
    const username = typed.toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(username)) return setError("Kullanıcı adı 3-20 karakter olmalı; sadece harf, rakam ve _ .");
    setBusy(true);
    setError("");
    try {
      const db = sb();
      const taken = await q(db.from("profiles").select("id").eq("username", username).maybeSingle());
      if (taken) return setError("Bu kullanıcı adı alınmış, başka bir tane dene.");
      setRemember(true);
      const { data, error } = await db.auth.signUp({
        email: String(f.get("email")).trim(),
        password: String(f.get("password")),
        options: { data: { username, display_name: typed }, emailRedirectTo: location.origin },
      });
      if (error) return setError(authError(error.message));
      if (!data.session) setSent(true); // e-posta onayı gerekiyor
    } catch (err) {
      setError(authError((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="auth">
        <h1>Neredeyse tamam 📬</h1>
        <p>E-postana bir onay linki gönderdik. Linke tıkladıktan sonra giriş yapabilirsin.</p>
        <Link className="btn primary" href="/login">Giriş sayfasına git</Link>
      </div>
    );
  }
  return (
    <form className="auth" onSubmit={submit}>
      <h1>Ancalog&apos;a katıl ✨</h1>
      <div className="field">
        <label htmlFor="s-user">Kullanıcı adı</label>
        <input id="s-user" name="username" required minLength={3} maxLength={20} pattern="[a-zA-Z0-9_]+" autoFocus autoComplete="username" placeholder="ornek_kullanici" />
        <span className="muted" style={{ fontSize: 12 }}>3-20 karakter: harf, rakam ve _ . Profil linkin bu olur.</span>
      </div>
      <div className="field"><label htmlFor="s-email">E-posta</label><input id="s-email" name="email" type="email" required autoComplete="email" /></div>
      <div className="field"><label htmlFor="s-pass">Şifre</label><input id="s-pass" name="password" type="password" required minLength={6} autoComplete="new-password" /></div>
      {error && <p className="form-error">{error}</p>}
      <button className="btn primary big" disabled={busy}>Hesap oluştur</button>
      <div className="alt">Zaten hesabın var mı? <Link href="/login">Giriş yap</Link></div>
    </form>
  );
}
