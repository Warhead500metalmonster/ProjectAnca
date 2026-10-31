import type { MetadataRoute } from "next";

// Arama motorları herkese açık sayfaları gezsin; kişisel sayfalar dizine girmesin
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/settings", "/chat", "/notifications", "/reset-password", "/api/"] },
    sitemap: "https://ancalog.vercel.app/sitemap.xml",
  };
}
