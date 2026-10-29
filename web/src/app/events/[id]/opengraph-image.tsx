import { OG_SIZE, eventCard, ogImage, siteCard } from "@/lib/og";

export const alt = "Ancalog etkinliği";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const p = await params;
  return ogImage((await eventCard(p.id)) || siteCard);
}
