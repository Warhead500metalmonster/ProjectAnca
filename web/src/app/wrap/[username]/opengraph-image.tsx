import { OG_SIZE, ogImage, siteCard, wrapCard } from "@/lib/og";

export const alt = "Ancalog yıl özeti";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const p = await params;
  return ogImage((await wrapCard(p.username)) || siteCard);
}
