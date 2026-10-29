import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { wrapCard, metaOf } from "@/lib/og";

// Sayfa tarayıcıda yüklenir; başlık linkteki kimliğe göre sunucuda hazırlanır (anlık geçiş denetimi dışında)
export const instant = false;

// Link paylaşılınca çıkan başlık ve açıklama (sayfanın kendisi tarayıcıda yüklenir)
async function meta(p: { username: string }): Promise<Metadata> {
  "use cache";
  cacheLife("hours");
  return metaOf(await wrapCard(p.username), `/wrap/${p.username}`, "Yıl özeti");
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  return meta(await params);
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
