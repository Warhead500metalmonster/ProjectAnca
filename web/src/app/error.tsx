"use client";

import Link from "next/link";

// Beklenmedik hata: teknik yazı göstermeden özür dile, tekrar deneme ve yazma yolu sun
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty page-oops">
      <h1>Bir şeyler ters gitti</h1>
      <p>Bu bizim hatamız, senin değil. Kayıtların güvende. Tekrar dener misin? Düzelmezse bize yaz, hemen bakalım.</p>
      <div className="hero-actions">
        <button className="btn primary" onClick={reset}>Tekrar dene</button>
        <Link className="btn" href="/">Ana sayfaya dön</Link>
        <Link className="btn ghost" href="/chat/arno4436">Bize yaz</Link>
      </div>
    </div>
  );
}
