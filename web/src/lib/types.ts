export type EntryType = "game" | "movie" | "show" | "music" | "anime";
export type Status = "completed" | "active" | "planned" | "paused" | "dropped";

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
}

export type ProfileLite = Pick<Profile, "username" | "display_name" | "avatar_url">;

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
  rating: number;
  cover: string | null;
  notes: string | null;
  rawg_id: number | null;
  platform: string | null;
  store: string | null;
  hours: number | null;
  progress: string | null;
  created_at: string;
  updated_at: string;
  profiles?: Partial<Profile> | null;
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
  esrb_rating?: { name: string } | null;
  developers?: { name: string }[];
  publishers?: { name: string }[];
  genres?: { name: string }[];
  platforms?: { platform: { name: string } }[];
  stores?: { store: { name: string } }[];
}

export interface FormGame {
  rawg_id: number;
  title: string;
  year: number | null;
  cover: string | null;
  creator: string | null;
  platforms?: string[];
  stores?: string[];
}
