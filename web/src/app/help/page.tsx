import Link from "next/link";
import { Faq } from "@/components/Faq";

export const metadata = { title: "Sıkça sorulan sorular · Ancalog" };

// Kısa ve sade kullanım rehberi: her soruya bir iki cümle
export default function HelpPage() {
  return (
    <div className="legal help">
      <h1>Sıkça sorulan sorular</h1>
      <p className="muted">Kısa cevaplar. Burada olmayan bir şey sormak istersen <Link className="grad" href="/chat/arno4436">site sahibine yaz</Link>.</p>
      <Faq />
    </div>
  );
}
