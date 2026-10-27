"use client";

import { useState } from "react";
import Link from "next/link";
import { sb } from "@/lib/supabase";
import { authError } from "@/lib/auth";

export default function Login() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    const { error } = await sb().auth.signInWithPassword({ email: String(f.get("email")).trim(), password: String(f.get("password")) });
    setBusy(false);
    if (error) setError(authError(error.message)); // başarıda AppProvider yönlendirir
  }

  return (
    <form className="auth" onSubmit={submit}>
      <h1>Tekrar hoş geldin 👋</h1>
      <div className="field"><label htmlFor="l-email">E-posta</label><input id="l-email" name="email" type="email" required autoFocus autoComplete="email" /></div>
      <div className="field"><label htmlFor="l-pass">Şifre</label><input id="l-pass" name="password" type="password" required autoComplete="current-password" /></div>
      {error && <p className="form-error">{error}</p>}
      <button className="btn primary big" disabled={busy}>Giriş yap</button>
      <div className="alt">Hesabın yok mu? <Link href="/signup">Kayıt ol</Link></div>
    </form>
  );
}
