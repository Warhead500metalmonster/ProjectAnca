import { ogImage, siteCard, wrapCard } from "@/lib/og";

// Yıl özeti görseli (indirip paylaşmak için): /wrap/ali/image?y=2025
// Kendi özetini indirirken oturumu gönderilir; gizli profil de olsa kendi kayıtları görsele girer.
export async function GET(request: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const y = new URL(request.url).searchParams.get("y") || "";
  const year = /^\d{4}$/.test(y) ? y : String(new Date().getFullYear());
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || undefined;
  const res = await ogImage((await wrapCard(username, year, token)) || siteCard);
  res.headers.set("cache-control", "private, no-store");
  return res;
}
