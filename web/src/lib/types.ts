export type EntryType = "game" | "movie" | "show" | "music" | "anime";
export type Status = "completed" | "active" | "planned" | "paused" | "dropped";

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  banner_url?: string | null;
  accent?: string | null;
  rating_scale?: 5 | 10;
  socials?: Record<string, string>;
  location?: string | null;
  pronouns?: string | null;
  site_color?: string | null;   // sitenin rengi, sadece kendisi görür
  song_url?: string | null;     // profilde arkada çalan şarkı (şimdilik sadece site sahibi)
  song_title?: string | null;
  song_volume?: number | null;
  created_at: string;
}

export type ProfileLite = Pick<Profile, "id" | "username" | "display_name" | "avatar_url">;

export interface Entry {
  id: string;
  user_id: string;
  type: EntryType;
  title: string;
  year: number | null;
  creator: string | null;
  status: Status;
  date: string | null;
  started_on: string | null;
  rating: number; // 0-10, yarım adımlı (5'lik ölçekte yarım yıldız = 1)
  cover: string | null;
  notes: string | null;     // inceleme
  rawg_id: number | null;
  ext_id?: string | null;
  platform: string | null;
  store: string | null;
  hours?: number | null;    // eski alan; yerini playtime_sec aldı
  playtime_sec?: number | null;
  progress_sec?: number | null;
  progress: string | null;  // kısa not
  emulated?: boolean;
  favorite?: boolean;
  created_at: string;
  updated_at: string;
  profiles?: Partial<Profile> | null;
  likes?: { count: number }[];
  comments?: { count: number }[];
}

// Bir içeriği (oyun, film...) kayıttan bağımsız tarif eder: listelerde ve "ekle" kısayollarında kullanılır
export interface Item {
  type: EntryType;
  title: string;
  year: number | null;
  creator: string | null;
  cover: string | null;
  rawg_id: number | null;
  ext_id?: string | null; // tmdb:movie:123, tmdb:tv:456, anilist:789
}

export interface List {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  profiles?: Partial<Profile> | null;
  list_items?: ListItem[];
}

export interface ListItem extends Item {
  id: string;
  list_id: string;
  position: number;
  created_at: string;
}

export interface Comment {
  id: string;
  entry_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles?: Partial<Profile> | null;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

// Aramada çıkmayıp kullanıcıların eklediği, herkesin ortak kullandığı içerik
export interface CatalogItem extends Item {
  id: string;
  ext_id: string;
  created_by: string | null;
  created_at: string;
}

// Yöneticinin bir içerik sayfasında değiştirdiği bilgiler (boş olanlar kaynaktan gelir)
export interface PageEdit {
  title?: string;
  creator?: string;
  year?: number;
  cover?: string;
  backdrop?: string;
  description?: string;
  genres?: string[];
}

// RAWG cevabından kullandığımız alanlar
export interface RawgGame {
  id: number;
  name: string;
  slug?: string;
  released?: string | null;
  background_image?: string | null;
  description_raw?: string;
  playtime?: number;
  metacritic?: number | null;
  rating?: number;
  added?: number;
  esrb_rating?: { name: string } | null;
  developers?: RawgRef[];
  publishers?: RawgRef[];
  genres?: RawgRef[];
  platforms?: { platform: RawgRef }[];
  stores?: { store: RawgRef }[];
}

export interface RawgRef { id: number; name: string; slug: string }

export interface FormGame {
  rawg_id: number;
  title: string;
  year: number | null;
  cover: string | null;
  creator: string | null;
  platforms?: string[];
  stores?: string[];
}
