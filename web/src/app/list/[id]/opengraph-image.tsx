import { OG_SIZE, ogImage, siteCard, listCard } from "@/lib/og";

export const alt = "Ancalog listesi";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const p = await params;
  return ogImage((await listCard(p.id)) || siteCard);
}
