import { OG_SIZE, ogImage, siteCard, gameCard } from "@/lib/og";

export const alt = "Ancalog'da oyun";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const p = await params;
  return ogImage((await gameCard(p.id)) || siteCard);
}
