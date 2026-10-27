import type { EntryType, Status } from "./types";

const WATCH = ["Netflix", "Disney+", "Prime Video", "HBO Max", "Apple TV+", "YouTube", "Mubi", "Tabii", "Exxen", "Sinema", "TV"];

export interface TypeInfo {
  label: string; icon: string; creator: string; active: string; done: string; doing: string;
  where: string; progress: string; places: string[]; square?: boolean;
}

export const TYPES: Record<EntryType, TypeInfo> = {
  game: { label: "Oyun", icon: "🎮", creator: "Geliştirici", active: "Oynuyorum", done: "bitirdi", doing: "oynuyor",
    where: "Platform", progress: "ör. Ana hikâye %60, 5. bölüm",
    places: ["PC", "PlayStation 5", "PlayStation 4", "Xbox Series X|S", "Xbox One", "Nintendo Switch", "Nintendo Switch 2", "Steam Deck", "iOS", "Android"] },
  movie: { label: "Film", icon: "🎬", creator: "Yönetmen", active: "İzliyorum", done: "izledi", doing: "izliyor",
    where: "Nerede izledin", progress: "ör. 1 saat 10 dakikada kaldım", places: WATCH },
  show: { label: "Dizi", icon: "📺", creator: "Yaratıcı / Kanal", active: "İzliyorum", done: "bitirdi", doing: "izliyor",
    where: "Nerede izledin", progress: "ör. 2. sezon 5. bölüm", places: WATCH },
  music: { label: "Müzik", icon: "🎵", creator: "Sanatçı", active: "Dinliyorum", done: "dinledi", doing: "dinliyor", square: true,
    where: "Nerede dinledin", progress: "ör. 7. şarkı", places: ["Spotify", "Apple Music", "YouTube Music", "Deezer", "Plak", "CD", "Konser"] },
  anime: { label: "Anime", icon: "🌸", creator: "Stüdyo", active: "İzliyorum", done: "bitirdi", doing: "izliyor",
    where: "Nerede izledin", progress: "ör. 12. bölüm", places: ["Crunchyroll", "Netflix", "Prime Video", "Disney+", "YouTube"] },
};

export const STORES = ["Steam", "Epic Games Store", "PlayStation Store", "Xbox Store", "Xbox Game Pass", "PC Game Pass", "Nintendo eShop", "GOG",
  "EA app", "Ubisoft Connect", "Battle.net", "itch.io", "App Store", "Google Play", "Fiziksel kopya"];

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

export const ENTRY_COLS = "*, profiles(username, display_name, avatar_url)";
export const LOCAL_KEY = "ancalog.v1"; // hesaplardan önceki, tarayıcıda tutulan kayıtlar
