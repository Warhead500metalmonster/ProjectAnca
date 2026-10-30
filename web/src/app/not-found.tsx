import Link from "next/link";

export const metadata = { title: "Sayfa bulunamadı · Ancalog" };

// Yanlış ya da eski bir link: suç kullanıcıda değil, gidecek bir yer gösterelim
export default function NotFound() {
  return (
    <div className="empty page-oops">
      <h1>Bu sayfa burada değil</h1>
      <p>Link eski olabilir ya da sayfa taşınmış olabilir. Merak etme, kayıtların yerinde duruyor.</p>
      <div className="hero-actions">
        <Link className="btn primary" href="/">Ana sayfaya dön</Link>
        <Link className="btn" href="/search">Keşfet&apos;te ara</Link>
      </div>
    </div>
  );
}
