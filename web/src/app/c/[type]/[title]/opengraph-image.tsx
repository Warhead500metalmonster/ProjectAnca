import { OG_SIZE, ogImage, siteCard, contentCard } from "@/lib/og";

export const alt = "Ancalog'da içerik";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ type: string; title: string }> }) {
  const p = await params;
  return ogImage((await contentCard(p.type, p.title)) || siteCard);
}
