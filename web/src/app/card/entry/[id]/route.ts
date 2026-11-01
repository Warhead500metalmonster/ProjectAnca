import { entryCard, ogImage, siteCard } from "@/lib/og";

// Tek bir kaydın ya da incelemenin görseli: /card/entry/ID
// Kendi gizli kaydını paylaşırken oturum gönderilir; başkası sadece görebildiği kaydın kartını alır (veritabanı denetler).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || undefined;
  const res = await ogImage((await entryCard(id, token)) || siteCard);
  res.headers.set("cache-control", "private, no-store");
  return res;
}
