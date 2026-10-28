import type { EntryType, Status } from "./types";

const WATCH = ["Netflix", "Disney+", "Prime Video", "HBO Max", "Apple TV+", "YouTube", "Mubi", "Tabii", "Exxen", "Sinema", "TV"];

export interface TypeInfo {
  label: string; plural: string; icon: string; creator: string; active: string; done: string; doing: string;
  where: string; progress: string; time: string; places: string[]; square?: boolean;
}

export const TYPES: Record<EntryType, TypeInfo> = {
  game: { label: "Oyun", plural: "Oyunlar", icon: "🎮", creator: "Geliştirici", active: "Oynuyorum", done: "bitirdi", doing: "oynuyor",
    where: "Platform", progress: "ör. Ana hikâye %60, Malenia'da takıldım", time: "Oynama süresi",
    places: ["PC", "PlayStation 5", "PlayStation 4", "Xbox Series X|S", "Xbox One", "Nintendo Switch", "Nintendo Switch 2", "Steam Deck", "iOS", "Android"] },
  movie: { label: "Film", plural: "Filmler", icon: "🎬", creator: "Yönetmen", active: "İzliyorum", done: "izledi", doing: "izliyor",
    where: "Nerede izledin", progress: "ör. Sinemada izledim", time: "İzleme süresi", places: WATCH },
  show: { label: "Dizi", plural: "Diziler", icon: "📺", creator: "Yaratıcı / Kanal", active: "İzliyorum", done: "bitirdi", doing: "izliyor",
    where: "Nerede izledin", progress: "ör. 2. sezon 5. bölüm", time: "İzleme süresi", places: WATCH },
  music: { label: "Müzik", plural: "Müzikler", icon: "🎵", creator: "Sanatçı", active: "Dinliyorum", done: "dinledi", doing: "dinliyor", square: true,
    where: "Nerede dinledin", progress: "ör. 7. şarkı favorim", time: "Dinleme süresi",
    places: ["Spotify", "Apple Music", "YouTube Music", "Deezer", "Plak", "CD", "Konser"] },
  anime: { label: "Anime", plural: "Animeler", icon: "🌸", creator: "Stüdyo", active: "İzliyorum", done: "bitirdi", doing: "izliyor",
    where: "Nerede izledin", progress: "ör. 12. bölüm", time: "İzleme süresi", places: ["Crunchyroll", "Netflix", "Prime Video", "Disney+", "YouTube"] },
};
export const TYPE_KEYS = Object.keys(TYPES) as EntryType[];

export const STORES = ["Steam", "Epic Games Store", "PlayStation Store", "Xbox Store", "Xbox Game Pass", "PC Game Pass", "Nintendo eShop", "GOG",
  "EA app", "Ubisoft Connect", "Battle.net", "itch.io", "Direct Download", "App Store", "Google Play", "Fiziksel kopya"];

export const STATUSES: Status[] = ["completed", "active", "planned", "paused", "dropped"];

export const statusLabel = (s: Status, type?: EntryType | null) => ({
  completed: "Bitti",
  active: type ? TYPES[type].active : "Devam ediyor",
  planned: "Planlandı",
  paused: "Ara verdim",
  dropped: "Bıraktım",
})[s];

export const activityVerb = (e: { type: EntryType; status: Status }) => ({
  completed: TYPES[e.type].done,
  active: TYPES[e.type].doing,
  planned: "listesine ekledi",
  paused: "ara verdi",
  dropped: "bıraktı",
})[e.status];

export const PROFILE_COLS = "id, username, display_name, avatar_url";
// Beğeni/yorum tabloları da entries ile profiles arasında bağ kurduğu için hangi bağın kullanılacağını açıkça söylüyoruz
export const ENTRY_COLS = `*, profiles!entries_user_id_fkey(${PROFILE_COLS}), likes(count), comments(count)`;
export const LOCAL_KEY = "ancalog.v1"; // hesaplardan önceki, tarayıcıda tutulan kayıtlar

// Rozetler veritabanından verilir (user_badges). active: false olanlar henüz kendiliğinden verilmiyor,
// ama yöneticiler panelden elle verebilir; verilen rozet profilde görünür.
export const BADGES: Record<string, { icon: string; name: string; desc: string; tone: string; active: boolean }> = {
  owner: { icon: "👑", name: "Site Sahibi", desc: "Ancalog'un kurucusu ve sahibi", tone: "gold", active: true },
  admin: { icon: "🛡️", name: "Yönetici", desc: "Ancalog'un içeriklerini düzenleyen ekipten", tone: "blue", active: true },
  founder: { icon: "🌟", name: "Öncü", desc: "Ancalog'a ilk katılanlardan biri", tone: "violet", active: true },
  critic: { icon: "✍️", name: "Eleştirmen", desc: "10 inceleme yaz", tone: "", active: false },
  completionist: { icon: "🏆", name: "Tamamlayıcı", desc: "50 oyun bitir", tone: "", active: false },
  marathon: { icon: "⏱️", name: "Maratoncu", desc: "Toplam 1000 saat logla", tone: "", active: false },
  social: { icon: "🦋", name: "Sosyal Kelebek", desc: "10 arkadaş edin", tone: "", active: false },
  curator: { icon: "📚", name: "Küratör", desc: "5 açık liste oluştur", tone: "", active: false },
  cinephile: { icon: "🎬", name: "Sinefil", desc: "100 film izle", tone: "", active: false },
  otaku: { icon: "🌸", name: "Otaku", desc: "50 anime bitir", tone: "", active: false },
  melomane: { icon: "🎧", name: "Melomane", desc: "100 albüm dinle", tone: "", active: false },
};

// Profil bağlantıları: kullanıcı adı ya da tam https:// link kabul edilir
export const SOCIALS: { key: string; label: string; icon: string; hosts: string[]; url?: (v: string) => string; hint: string }[] = [
  { key: "discord", label: "Discord", icon: "💬", hosts: [], hint: "kullanıcı adın" },
  { key: "steam", label: "Steam", icon: "🎮", hosts: ["steamcommunity.com"], hint: "profil linki ya da özel adın",
    url: (v) => /^\d{17}$/.test(v) ? `https://steamcommunity.com/profiles/${v}` : `https://steamcommunity.com/id/${v}` },
  { key: "youtube", label: "YouTube", icon: "▶️", hosts: ["youtube.com"], hint: "@kanal", url: (v) => `https://www.youtube.com/@${v}` },
  { key: "twitter", label: "X / Twitter", icon: "𝕏", hosts: ["x.com", "twitter.com"], hint: "@kullanıcı", url: (v) => `https://x.com/${v}` },
  { key: "instagram", label: "Instagram", icon: "📷", hosts: ["instagram.com"], hint: "@kullanıcı", url: (v) => `https://instagram.com/${v}` },
  { key: "twitch", label: "Twitch", icon: "🟣", hosts: ["twitch.tv"], hint: "kanal adı", url: (v) => `https://twitch.tv/${v}` },
  { key: "letterboxd", label: "Letterboxd", icon: "🎞️", hosts: ["letterboxd.com"], hint: "kullanıcı adı", url: (v) => `https://letterboxd.com/${v}` },
  { key: "website", label: "Web sitesi", icon: "🌐", hosts: ["*"], hint: "https://…" },
];

export const ACCENTS = ["#58a98a", "#8b5cf6", "#ec4899", "#ef4444", "#f97316", "#f59e0b", "#22c55e", "#14b8a6", "#0ea5e9", "#3b82f6", "#64748b"];
