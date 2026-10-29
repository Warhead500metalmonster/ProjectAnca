import { OG_SIZE, ogImage, siteCard } from "@/lib/og";

export const alt = "Ancalog: oyun, film, dizi, anime ve müzik günlüğün";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return ogImage(siteCard);
}
