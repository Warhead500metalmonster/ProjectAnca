import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { contentCard, metaOf } from "@/lib/og";

// Link paylaşılınca çıkan başlık ve açıklama (sayfanın kendisi tarayıcıda yüklenir)
async function meta(p: { type: string; title: string }): Promise<Metadata> {
  "use cache";
  cacheLife("hours");
  return metaOf(await contentCard(p.type, p.title), `/c/${p.type}/${p.title}`, "İçerik");
}

export async function generateMetadata({ params }: { params: Promise<{ type: string; title: string }> }): Promise<Metadata> {
  return meta(await params);
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
