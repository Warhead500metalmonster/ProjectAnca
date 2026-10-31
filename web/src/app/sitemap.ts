import type { MetadataRoute } from "next";

const SITE = "https://ancalog.vercel.app";
const PAGES = ["", "/community", "/events", "/search", "/top", "/forum", "/games", "/import", "/about", "/help", "/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((p) => ({ url: `${SITE}${p}` }));
}
