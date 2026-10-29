export type EntryType = "game" | "movie" | "show" | "music" | "anime";
export type Status = "completed" | "active" | "planned" | "paused" | "dropped" | "owned"; // owned: kategorisiz (ör. Steam'den gelen)

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
  site_color?: string | null;
  bg_url?: string | null;        // profilin arkasını kaplayan resim / video (Steam'deki gibi)
  profile_theme?: string | null; // PROFILE_THEMES anahtarı
  goals?: Record<string, Partial<Record<EntryType, number>>>; // yıllık hedefler: {"2026": {"game": 30}}   // sitenin rengi, sadece kendisi görür
  song_url?: string | null;     // profilde arkada çalan şarkı (YouTube linki)
  song_title?: string | null;
  song_volume?: number | null;
  home_layout?: HomeLayout | null; // profil ana sayfasının düzeni
  muted_until?: string | null;
  avatar_crop?: AvatarCrop | null; // profil fotoğrafının görünen kısmı
  hidden_types?: EntryType[] | null; // başkalarına profilde gösterilmeyen türler     // yönetici susturduysa bu zamana kadar yazı yazamaz
  created_at: string;
}

// Profil ana sayfası: sahibinin seçtiği bölümler (sırasıyla) ve üstte duran serbest yazı
export interface HomeLayout { sections: string[]; text?: string }

// x, y: odak noktası (yüzde), z: yakınlaştırma (1 = hiç)
export interface AvatarCrop { x: number; y: number; z: number }

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
  dlc?: boolean;            // DLC'siyle birlikte bitirdi
  drop_note?: string | null; // bıraktıysa neden bıraktı
  favorite?: boolean;
  fav_pos?: number | null;  // favoriler şeridindeki sıra (sahibi sürükleyerek ayarlar)
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
  unlisted?: boolean; // liste dışı: listelerde görünmez, linki olan açar
  created_at: string;
  updated_at: string;
  profiles?: Partial<Profile> | null;
  list_items?: ListItem[];
}

export interface ListItem extends Item {
  id: string;
  list_id: string;
  position: number;
  note?: string | null; // listeye özel not
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

// Forum: oyun / film tartışmaları
export interface ForumThread {
  id: string;
  user_id: string;
  title: string;
  body: string;
  category: string;
  item: Item | null;        // tartışılan içerik (varsa)
  content_key: string | null;
  pinned: boolean;
  locked: boolean;
  reply_count: number;
  last_post_at: string;
  created_at: string;
  profiles?: Partial<Profile> | null;
}

export interface ForumPost {
  id: string;
  thread_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles?: Partial<Profile> | null;
}
