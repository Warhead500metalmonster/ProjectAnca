import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { eventCard, metaOf } from "@/lib/og";

// Sayfa tarayıcıda yüklenir; başlık linkteki kimliğe göre sunucuda hazırlanır (anlık geçiş denetimi dışında)
export const instant = false;

// Link paylaşılınca çıkan başlık ve açıklama (sayfanın kendisi tarayıcıda yüklenir)
async function meta(p: { id: string }): Promise<Metadata> {
  "use cache";
  cacheLife("minutes");
  return metaOf(await eventCard(p.id), `/events/${p.id}`, "Etkinlik");
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  return meta(await params);
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
