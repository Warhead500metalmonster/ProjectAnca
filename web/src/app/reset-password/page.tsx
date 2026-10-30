"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sb } from "@/lib/supabase";
import { authError } from "@/lib/auth";
import { useApp } from "@/components/AppProvider";
import { PasswordInput } from "@/components/PasswordInput";

// Yeni şifre: e-postadaki yenileme linki buraya getirir; giriş yapmış kişi de Ayarlar → Hesap'tan gelir
export default function ResetPassword() {
  const { me, ready, toast } = useApp();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!ready) return <div className="loading">Yükleniyor…</div>;
  if (!me) {
    return (
      <div className="auth">
        <h1>Bu linkin süresi dolmuş</h1>
        <p>Yenileme linkleri bir süre sonra geçersiz olur ya da bir kez kullanılabilir. Dert değil, yenisini saniyeler içinde alırsın.</p>
        <Link className="btn primary" href="/login">Yeni link al</Link>
      </div>
    );
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await sb().auth.updateUser({ password: String(new FormData(e.currentTarget).get("password")) });
    setBusy(false);
    if (error) return setError(authError(error.message));
    toast("Şifren değişti, artık yenisiyle girebilirsin");
    router.replace("/");
  }

  return (
    <form className="auth" onSubmit={submit}>
      <h1>Yeni şifreni belirle</h1>
      <div className="field">
        <label htmlFor="r-pass">Yeni şifre</label>
        <PasswordInput id="r-pass" name="password" required minLength={6} autoFocus autoComplete="new-password" />
        <span className="muted" style={{ fontSize: 12 }}>En az 6 karakter.</span>
      </div>
      {error && <p className="form-error">{error}</p>}
      <button className="btn primary big" disabled={busy}>{busy ? "Kaydediliyor…" : "Şifremi kaydet"}</button>
    </form>
  );
}
