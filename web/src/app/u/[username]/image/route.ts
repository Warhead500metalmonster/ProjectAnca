import { ogImage, profileCard, siteCard } from "@/lib/og";

// Profil görseli (indirip paylaşmak için): /u/ali/image
export async function GET(_: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const res = await ogImage((await profileCard(username)) || siteCard);
  res.headers.set("cache-control", "private, no-store");
  return res;
}
