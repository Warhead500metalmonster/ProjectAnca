"use client";

import { useState } from "react";
import Link from "next/link";
import { sb, setRemember } from "@/lib/supabase";
import { authError } from "@/lib/auth";
import { PasswordInput } from "@/components/PasswordInput";

export default function Login() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(""); // "Şifremi unuttum"a geçince yazdığı e-posta kaybolmasın
  const [mode, setMode] = useState<"login" | "forgot" | "sent">("login");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    setRemember(f.get("remember") === "on"); // oturum nerede saklanacak, girişten önce belli olmalı
    const { error } = await sb().auth.signInWithPassword({ email: email.trim(), password: String(f.get("password")) });
    setBusy(false);
    if (error) setError(authError(error.message)); // başarıda AppProvider yönlendirir
  }

  async function forgot(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await sb().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/reset-password` });
    setBusy(false);
    if (error) setError(authError(error.message));
    else setMode("sent");
  }

  if (mode === "sent") {
    return (
      <div className="auth">
        <h1>Gelen kutuna bak</h1>
        <p><b>{email.trim()}</b> ile bir hesap varsa şifreni yenileme linkini gönderdik. Birkaç dakika içinde gelmezse spam klasörüne de bak.</p>
        <button type="button" className="btn" onClick={() => setMode("login")}>Girişe dön</button>
      </div>
    );
  }
  if (mode === "forgot") {
    return (
      <form className="auth" onSubmit={forgot}>
        <h1>Şifreni mi unuttun?</h1>
        <p className="muted" style={{ margin: 0 }}>Olur öyle şeyler. E-postanı yaz, yeni şifre belirlemen için sana bir link gönderelim. Kayıtların yerinde duruyor.</p>
        <div className="field"><label htmlFor="l-email">E-posta</label><input id="l-email" type="email" required autoFocus autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        {error && <p className="form-error">{error}</p>}
        <button className="btn primary big" disabled={busy}>{busy ? "Gönderiliyor…" : "Yenileme linki gönder"}</button>
        <div className="alt"><button type="button" className="link" onClick={() => { setError(""); setMode("login"); }}>Girişe dön</button></div>
      </form>
    );
  }
  return (
    <form className="auth" onSubmit={submit}>
      <h1>Tekrar hoş geldin </h1>
      <div className="field"><label htmlFor="l-email">E-posta</label><input id="l-email" name="email" type="email" required autoFocus autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div className="field">
        <div className="label-row"><label htmlFor="l-pass">Şifre</label><button type="button" className="link small" onClick={() => { setError(""); setMode("forgot"); }}>Şifremi unuttum</button></div>
        <PasswordInput id="l-pass" name="password" required autoComplete="current-password" />
      </div>
      <label className="check"><input type="checkbox" name="remember" defaultChecked /> Beni hatırla <span className="muted">(tarayıcıyı kapatınca çıkış yapma)</span></label>
      {error && <p className="form-error">{error}</p>}
      <button className="btn primary big" disabled={busy}>Giriş yap</button>
      <div className="alt">Hesabın yok mu? <Link href="/signup">Kayıt ol</Link></div>
    </form>
  );
}
