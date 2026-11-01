import { ogImage, siteCard, wrapCard } from "@/lib/og";

// Yıl özeti görseli (indirip paylaşmak için): /wrap/ali/image?y=2025
// Kendi özetini indirirken oturumu gönderilir; gizli profil de olsa kendi kayıtları görsele girer.
export async function GET(request: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const search = new URL(request.url).searchParams;
  const y = search.get("y") || "";
  const m = search.get("m") || "";
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : undefined; // aylık özet: ?m=2026-10
  const year = /^\d{4}$/.test(y) ? y : String(new Date().getFullYear());
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || undefined;
  const res = await ogImage((await wrapCard(username, year, token, month)) || siteCard);
  res.headers.set("cache-control", "private, no-store");
  return res;
}
