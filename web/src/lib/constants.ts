import type { Entry, EntryType, Status } from "./types";

const WATCH = ["Netflix", "Disney+", "Prime Video", "HBO Max", "Apple TV+", "YouTube", "Mubi", "Tabii", "Exxen", "Sinema", "TV"];

export interface TypeInfo {
  label: string; plural: string; creator: string; active: string; done: string; doing: string;
  where: string; progress: string; time: string; places: string[]; square?: boolean;
}

export const TYPES: Record<EntryType, TypeInfo> = {
  game: { label: "Oyun", plural: "Oyunlar", creator: "Geliştirici", active: "Oynuyorum", done: "oynadı", doing: "oynuyor",
    where: "Platform", progress: "ör. Ana hikâye %60, Malenia'da takıldım", time: "Oynama süresi",
    // Oyunun çıktığı platformlar formda önce gelir; bunlar da her zaman seçilebilir (ör. PSP'de emülatörle Super Mario Bros.)
    places: ["PC", "PlayStation 5", "PlayStation 4", "PlayStation 3", "PlayStation 2", "PlayStation", "PSP", "PS Vita",
      "Xbox Series X|S", "Xbox One", "Xbox 360", "Xbox", "Nintendo Switch 2", "Nintendo Switch", "Wii U", "Wii", "GameCube", "Nintendo 64",
      "SNES", "NES", "Nintendo 3DS", "Nintendo DS", "Game Boy Advance", "Game Boy Color", "Game Boy", "Steam Deck", "PC VR", "Meta Quest",
      "Sega Dreamcast", "Sega Saturn", "Sega Genesis", "Sega Master System", "Game Gear", "Neo Geo", "Atari 2600", "Arcade", "DOS",
      "macOS", "Linux", "iOS", "Android", "Tarayıcı"] },
  movie: { label: "Film", plural: "Filmler", creator: "Yönetmen", active: "İzliyorum", done: "izledi", doing: "izliyor",
    where: "Nerede izledin", progress: "ör. Sinemada izledim", time: "İzleme süresi", places: WATCH },
  show: { label: "Dizi", plural: "Diziler", creator: "Yaratıcı / Kanal", active: "İzliyorum", done: "bitirdi", doing: "izliyor",
    where: "Nerede izledin", progress: "ör. 2. sezon 5. bölüm", time: "İzleme süresi", places: WATCH },
  music: { label: "Müzik", plural: "Müzikler", creator: "Sanatçı", active: "Dinliyorum", done: "dinledi", doing: "dinliyor", square: true,
    where: "Nerede dinledin", progress: "ör. 7. şarkı favorim", time: "Dinleme süresi",
    places: ["Spotify", "Apple Music", "YouTube Music", "Deezer", "Plak", "CD", "Konser"] },
  anime: { label: "Anime", plural: "Animeler", creator: "Stüdyo", active: "İzliyorum", done: "bitirdi", doing: "izliyor",
    where: "Nerede izledin", progress: "ör. 12. bölüm", time: "İzleme süresi", places: ["Crunchyroll", "Netflix", "Prime Video", "Disney+", "YouTube"] },
};
export const TYPE_KEYS = Object.keys(TYPES) as EntryType[];

export const STORES = ["Steam", "Epic Games Store", "PlayStation Store", "Xbox Store", "Xbox Game Pass", "PC Game Pass", "Nintendo eShop", "GOG",
  "EA app", "Ubisoft Connect", "Battle.net", "itch.io", "Direct Download", "App Store", "Google Play", "Fiziksel kopya"];

export const STATUSES: Status[] = ["completed", "active", "planned", "paused", "dropped", "owned"];

// "Bitti" yerine türe göre: oyunda Oynandı, film / dizi / animede İzlendi, müzikte Dinlendi
const DONE_LABEL: Record<EntryType, string> = { game: "Oynandı", movie: "İzlendi", show: "İzlendi", anime: "İzlendi", music: "Dinlendi" };
export const statusLabel = (s: Status, type?: EntryType | null) => ({
  completed: type ? DONE_LABEL[type] : "Tamamlandı",
  active: type ? TYPES[type].active : "Devam ediyor",
  planned: "Planlandı",
  paused: "Ara verdim",
  dropped: "Bıraktım",
  owned: "Kategorisiz",
})[s];

export const activityVerb = (e: { type: EntryType; status: Status }) => ({
  completed: TYPES[e.type].done,
  active: TYPES[e.type].doing,
  planned: "listesine ekledi",
  paused: "ara verdi",
  dropped: "bıraktı",
  owned: "kütüphanesine ekledi",
})[e.status];

export const PROFILE_COLS = "id, username, display_name, avatar_url";
// Beğeni/yorum tabloları da entries ile profiles arasında bağ kurduğu için hangi bağın kullanılacağını açıkça söylüyoruz
export const ENTRY_COLS = `*, profiles!entries_user_id_fkey(${PROFILE_COLS}), likes(count), comments(count)`;
export const LOCAL_KEY = "ancalog.v1"; // hesaplardan önceki, tarayıcıda tutulan kayıtlar

// Rozetler veritabanından verilir (user_badges). earn: hedefe ulaşınca veritabanı kendiliğinden verir
// (supabase/migrations/009); progress, profildeki ilerleme çubuğu için kayıtlardan hesaplanır.
// Yöneticiler panelden elle de verebilir.
type Prog = (e: Entry[]) => number;
const doneOf = (type: EntryType): Prog => (e) => e.filter((x) => x.type === type && x.status === "completed").length;
const thisYear = () => String(new Date().getFullYear());
const secOf = (x: Entry) => x.playtime_sec ?? (x.hours ? Number(x.hours) * 3600 : 0);
const count = (f: (x: Entry) => unknown): Prog => (e) => e.filter(f).length;
const hoursOf: Prog = (e) => Math.floor(e.reduce((s, x) => s + (x.playtime_sec ?? (x.hours ? Number(x.hours) * 3600 : 0)), 0) / 3600);
// href: rozete tıklayınca gidilen yer (etkinlik rozetleri etkinliğe götürür; ?u= rozetin sahibini vurgular)
export const BADGES: Record<string, { icon: string; name: string; desc: string; tone: string; earn?: number; progress?: Prog; href?: string }> = {
  owner: { icon: "♛", name: "Kurucu", desc: "Ancalog'u kuran kişi", tone: "gold" },
  dev: { icon: "⚒", name: "Geliştirici", desc: "Ancalog'u yapan ve geliştiren ekipten", tone: "dev" },
  admin: { icon: "◆", name: "Yönetici", desc: "Ancalog'u yöneten ekipten", tone: "blue" },
  founder: { icon: "★", name: "Öncü", desc: "Ancalog'a ilk katılanlardan biri", tone: "violet" },
  event_join: { icon: "✧", name: "Etkinlikçi", desc: "Bir Ancalog etkinliğine katıl", tone: "event", earn: 1, href: "/events" },
  event: { icon: "✦", name: "Etkinlik ruhu", desc: "Bir Ancalog etkinliğini sonuna kadar götür", tone: "event", earn: 1, href: "/events" },
  event_first: { icon: "⚑", name: "İlk bitiren", desc: "Bir etkinliği herkesten önce bitir", tone: "gold", href: "/events" },
  event_regular: { icon: "❖", name: "Müdavim", desc: "3 etkinliğe katıl", tone: "event", earn: 3, href: "/events" },
  critic: { icon: "◆", name: "Eleştirmen", desc: "10 inceleme yaz", tone: "", earn: 10, progress: (e) => e.filter((x) => x.notes?.trim()).length },
  completionist: { icon: "◆", name: "Tamamlayıcı", desc: "50 oyun bitir", tone: "", earn: 50, progress: doneOf("game") },
  marathon: { icon: "◆", name: "Maratoncu", desc: "Toplam 1000 saat logla", tone: "", earn: 1000, progress: hoursOf },
  social: { icon: "◆", name: "Sosyal Kelebek", desc: "10 arkadaş edin (karşılıklı takip)", tone: "", earn: 10 },
  curator: { icon: "◆", name: "Küratör", desc: "5 açık liste oluştur", tone: "", earn: 5 },
  cinephile: { icon: "◆", name: "Sinefil", desc: "100 film izle", tone: "", earn: 100, progress: doneOf("movie") },
  otaku: { icon: "◆", name: "Otaku", desc: "50 anime bitir", tone: "", earn: 50, progress: doneOf("anime") },
  melomane: { icon: "◆", name: "Melomane", desc: "100 albüm / şarkı dinle", tone: "", earn: 100, progress: doneOf("music") },
  first_log: { icon: "◆", name: "İlk Adım", desc: "İlk kaydını ekle", tone: "", earn: 1, progress: (e) => e.length },
  collector: { icon: "◆", name: "Koleksiyoncu", desc: "Kütüphanende 100 kayıt olsun", tone: "", earn: 100, progress: (e) => e.length },
  archivist: { icon: "◆", name: "Arşivci", desc: "Kütüphanende 1000 kayıt olsun", tone: "", earn: 1000, progress: (e) => e.length },
  rater: { icon: "◆", name: "Puan Ustası", desc: "50 şeye puan ver", tone: "", earn: 50, progress: (e) => e.filter((x) => x.rating > 0).length },
  versatile: { icon: "◆", name: "Çok Yönlü", desc: "Oyun, film, dizi, müzik ve animenin hepsinden logla", tone: "", earn: 5, progress: (e) => new Set(e.map((x) => x.type)).size },
  binger: { icon: "◆", name: "Dizi Bağımlısı", desc: "25 dizi bitir", tone: "", earn: 25, progress: doneOf("show") },
  legend: { icon: "◆", name: "Efsane Oyuncu", desc: "200 oyun bitir", tone: "", earn: 200, progress: doneOf("game") },
  year_star: { icon: "◆", name: "Yılın Yıldızı", desc: "Bir yılda 25 şey bitir", tone: "", earn: 25,
    progress: (e) => e.filter((x) => x.status === "completed" && x.date?.startsWith(thisYear())).length },
  speedrun: { icon: "◆", name: "Hızlı Bitirici", desc: "Bir şeyi başladığın gün bitir", tone: "", earn: 1,
    progress: (e) => e.filter((x) => x.status === "completed" && x.started_on && x.started_on === x.date).length },
  steam: { icon: "◆", name: "Steam Bağlantısı", desc: "Steam kütüphaneni içe aktar", tone: "", earn: 1, progress: (e) => e.filter((x) => x.ext_id?.startsWith("steam:")).length },
  commenter: { icon: "◆", name: "Sohbetçi", desc: "25 yorum yaz", tone: "", earn: 25 },
  loved: { icon: "◆", name: "Sevilen", desc: "İncelemelerin toplam 25 beğeni alsın", tone: "", earn: 25,
    progress: (e) => e.reduce((s, x) => s + (x.likes?.[0]?.count || 0), 0) },
  popular: { icon: "◆", name: "Popüler", desc: "10 takipçin olsun", tone: "", earn: 10 },
  forum: { icon: "◆", name: "Forumcu", desc: "Forumda 10 mesaj yaz", tone: "", earn: 10 },
  pen: { icon: "◆", name: "Usta Kalem", desc: "50 inceleme yaz", tone: "", earn: 50, progress: count((x) => x.notes?.trim()) },
  perfect: { icon: "◆", name: "Mükemmeliyetçi", desc: "10 şeye tam puan ver", tone: "", earn: 10, progress: count((x) => x.rating === 10) },
  harsh: { icon: "◆", name: "Acımasız", desc: "10 şeye düşük puan ver (3/10 ya da altı)", tone: "", earn: 10, progress: count((x) => x.rating >= 1 && x.rating <= 3) },
  retro: { icon: "◆", name: "Retrocu", desc: "1995'ten eski 10 şey logla", tone: "", earn: 10, progress: count((x) => !!x.year && x.year < 1995) },
  fresh: { icon: "◆", name: "Güncel Takipçi", desc: "Çıktığı yıl içinde 10 şey bitir", tone: "", earn: 10,
    progress: count((x) => x.status === "completed" && !!x.year && !!x.date && x.date.startsWith(String(x.year))) },
  pc: { icon: "◆", name: "PC Ustası", desc: "50 PC oyunu logla", tone: "", earn: 50, progress: count((x) => x.type === "game" && (x.platform === "PC" || x.platform === "Steam Deck")) },
  console: { icon: "◆", name: "Konsolcu", desc: "PlayStation, Xbox ya da Nintendo'dan 25 oyun logla", tone: "", earn: 25,
    progress: count((x) => x.type === "game" && /^(PlayStation|Xbox|Nintendo)/.test(x.platform || "")) },
  backlog: { icon: "◆", name: "Backlog Canavarı", desc: "Planladıkların 100'ü geçsin", tone: "", earn: 100, progress: count((x) => x.status === "planned") },
  quitter: { icon: "◆", name: "Bırakmayı Bilen", desc: "10 şeyi yarıda bırak", tone: "", earn: 10, progress: count((x) => x.status === "dropped") },
  devoted: { icon: "◆", name: "Sadık Oyuncu", desc: "Tek bir şeye 100 saat ver", tone: "", earn: 100, progress: (e) => Math.floor(Math.max(0, ...e.map(secOf)) / 3600) },
  iron: { icon: "◆", name: "Demir İrade", desc: "Tek bir şeye 500 saat ver", tone: "", earn: 500, progress: (e) => Math.floor(Math.max(0, ...e.map(secOf)) / 3600) },
  tastemaker: { icon: "◆", name: "Zevk Sahibi", desc: "10 favori seç", tone: "", earn: 10, progress: count((x) => x.favorite) },
  film_buff: { icon: "◆", name: "Film Kurdu", desc: "500 film izle", tone: "", earn: 500, progress: doneOf("movie") },
  psn: { icon: "◆", name: "PlayStation Bağlantısı", desc: "PlayStation kütüphaneni içe aktar", tone: "", earn: 1, progress: count((x) => x.ext_id?.startsWith("psn:")) },
  xbox: { icon: "◆", name: "Xbox Bağlantısı", desc: "Xbox kütüphaneni içe aktar", tone: "", earn: 1, progress: count((x) => x.ext_id?.startsWith("xbox:")) },
  music_link: { icon: "◆", name: "Müzik Bağlantısı", desc: "Spotify ya da Last.fm'den müzik aktar", tone: "", earn: 1,
    progress: count((x) => x.ext_id?.startsWith("spotify:") || x.store === "Last.fm") },
  generous: { icon: "◆", name: "Cömert", desc: "50 beğeni ver", tone: "", earn: 50 },
  lister: { icon: "◆", name: "Liste Kralı", desc: "15 liste oluştur", tone: "", earn: 15 },
  starter: { icon: "◆", name: "Gündem Yaratıcı", desc: "Forumda 5 konu aç", tone: "", earn: 5 },
  veteran: { icon: "◆", name: "Emektar", desc: "1 yıldır Ancalog'dasın", tone: "", earn: 1 },
};

// Profil bağlantıları: kullanıcı adı ya da tam https:// link kabul edilir
export const SOCIALS: { key: string; label: string; hosts: string[]; url?: (v: string) => string; hint: string }[] = [
  { key: "discord", label: "Discord", hosts: [], hint: "kullanıcı adın" },
  { key: "steam", label: "Steam", hosts: ["steamcommunity.com"], hint: "profil linki ya da özel adın",
    url: (v) => /^\d{17}$/.test(v) ? `https://steamcommunity.com/profiles/${v}` : `https://steamcommunity.com/id/${v}` },
  { key: "youtube", label: "YouTube", hosts: ["youtube.com"], hint: "@kanal", url: (v) => `https://www.youtube.com/@${v}` },
  { key: "twitter", label: "X / Twitter", hosts: ["x.com", "twitter.com"], hint: "@kullanıcı", url: (v) => `https://x.com/${v}` },
  { key: "instagram", label: "Instagram", hosts: ["instagram.com"], hint: "@kullanıcı", url: (v) => `https://instagram.com/${v}` },
  { key: "twitch", label: "Twitch", hosts: ["twitch.tv"], hint: "kanal adı", url: (v) => `https://twitch.tv/${v}` },
  { key: "letterboxd", label: "Letterboxd", hosts: ["letterboxd.com"], hint: "kullanıcı adı", url: (v) => `https://letterboxd.com/${v}` },
  { key: "website", label: "Web sitesi", hosts: ["*"], hint: "https://…" },
];

// Steam'deki gibi hazır profil temaları: vurgu rengi + profil kutusunun zemini
export const PROFILE_THEMES: Record<string, { name: string; accent: string; tint: string }> = {
  summer: { name: "Yaz", accent: "#e8a33d", tint: "rgba(58, 36, 14, .82)" },
  midnight: { name: "Gece Yarısı", accent: "#6f8fe0", tint: "rgba(16, 22, 48, .84)" },
  steel: { name: "Çelik", accent: "#8fa6bb", tint: "rgba(34, 42, 52, .84)" },
  cosmic: { name: "Kozmik", accent: "#b46be0", tint: "rgba(38, 16, 58, .84)" },
  forest: { name: "Orman", accent: "#5fb06a", tint: "rgba(16, 40, 22, .84)" },
  rose: { name: "Gül", accent: "#e0607e", tint: "rgba(52, 14, 26, .84)" },
  dark: { name: "Karanlık", accent: "#c9ccd3", tint: "rgba(6, 6, 8, .88)" },
};

export const ACCENTS = ["#58a98a", "#8b5cf6", "#ec4899", "#ef4444", "#f97316", "#f59e0b", "#22c55e", "#14b8a6", "#0ea5e9", "#3b82f6", "#64748b"];

// Forum bölümleri
export const FORUM_CATS: Record<string, string> = {
  genel: "Genel", oyun: "Oyun", film: "Film", dizi: "Dizi", muzik: "Müzik", anime: "Anime", oneri: "Öneri isteği", destek: "Site hakkında",
};
