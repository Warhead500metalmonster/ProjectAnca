import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { gameCard, metaOf } from "@/lib/og";

// Link paylaşılınca çıkan başlık ve açıklama (sayfanın kendisi tarayıcıda yüklenir)
async function meta(p: { id: string }): Promise<Metadata> {
  "use cache";
  cacheLife("hours");
  return metaOf(await gameCard(p.id), `/game/${p.id}`, "Oyun");
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  return meta(await params);
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
