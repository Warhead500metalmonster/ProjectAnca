import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { ProfileShell } from "@/components/ProfileShell";
import { metaOf, profileCard } from "@/lib/og";

// Profil verisi tarayıcıda yükleniyor; sekmeler profil gelince çizilir
export const instant = false;

// Link paylaşılınca çıkan başlık ve açıklama
async function meta(username: string): Promise<Metadata> {
  "use cache";
  cacheLife("hours");
  return metaOf(await profileCard(username), `/u/${username}`, "Profil");
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  return meta((await params).username);
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <ProfileShell>{children}</ProfileShell>;
}
