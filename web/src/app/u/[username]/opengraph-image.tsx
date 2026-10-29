import { OG_SIZE, ogImage, siteCard, profileCard } from "@/lib/og";

export const alt = "Ancalog profili";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const p = await params;
  return ogImage((await profileCard(p.username)) || siteCard);
}
