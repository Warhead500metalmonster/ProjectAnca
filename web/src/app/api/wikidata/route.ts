// Her dilde arama köprüsü: /api/wikidata?q=Örümcek Adam&kind=game
// Wikidata'da yazılan dildeki adla (Türkçe, Japonca, Rusça...) aranır; bulunan maddenin IGDB / TMDB / AniList / MyAnimeList numarası döner.
// Böylece "Yüzüklerin Efendisi", "ゼルダの伝説" ya da "Ведьмак" yazan da doğru oyunu, filmi bulur.
const DAY = 86400;
const PROPS: Record<string, string[]> = { game: ["P5794"], movie: ["P4947"], show: ["P4983"], anime: ["P8729", "P4086"] };
const UA = { "user-agent": "Ancalog/1.0 (https://ancalog.vercel.app)" };

function langOf(text: string) {
  if (/[぀-ヿ]/.test(text)) return "ja";
  if (/[가-힯]/.test(text)) return "ko";
  if (/[㐀-鿿]/.test(text)) return "zh";
  if (/[Ѐ-ӿ]/.test(text)) return "ru";
  if (/[Ͱ-Ͽ]/.test(text)) return "el";
  if (/[؀-ۿ]/.test(text)) return "ar";
  return "tr";
}

type Claim = { mainsnak?: { datavalue?: { value?: unknown } } };
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const q = (sp.get("q") || "").trim().slice(0, 100);
  const kind = sp.get("kind") || "";
  if (q.length < 2 || !PROPS[kind]) return Response.json({ error: "bad request" }, { status: 400 });
  const lang = langOf(q);
  const search = await fetch(`https://www.wikidata.org/w/api.php?${new URLSearchParams({
    action: "wbsearchentities", search: q, language: lang, uselang: lang, type: "item", limit: "12", format: "json", origin: "*" })}`,
    { headers: UA, next: { revalidate: DAY } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const ids: string[] = (search?.search || []).map((x: { id: string }) => x.id).slice(0, 12);
  if (!ids.length) return Response.json({ results: [], en: null });
  const ents = await fetch(`https://www.wikidata.org/w/api.php?${new URLSearchParams({
    action: "wbgetentities", ids: ids.join("|"), props: "claims|labels", languages: `en|${lang}`, format: "json", origin: "*" })}`,
    { headers: UA, next: { revalidate: DAY } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const results: { qid: string; label: string; local: string; ids: Record<string, string> }[] = [];
  // Kaynak numarası olmasa da yazılanın İngilizce adı ("Örümcek Adam" → "Spider-Man"): arama bununla da yapılır
  let en: string | null = null;
  for (const qid of ids.slice(0, 3)) {
    const e = ents?.entities?.[qid];
    if (!en && e?.labels?.en?.value && e.labels[lang]?.value) en = e.labels.en.value;
  }
  for (const qid of ids) {
    const e = ents?.entities?.[qid];
    if (!e) continue;
    const got: Record<string, string> = {};
    for (const p of PROPS[kind]) {
      const v = (e.claims?.[p] as Claim[] | undefined)?.[0]?.mainsnak?.datavalue?.value;
      if (typeof v === "string" && v) got[p] = v;
    }
    if (Object.keys(got).length) results.push({ qid, label: e.labels?.en?.value || "", local: e.labels?.[lang]?.value || "", ids: got });
  }
  return Response.json({ results: results.slice(0, 6), en }, { headers: { "Cache-Control": "public, s-maxage=86400" } });
}
