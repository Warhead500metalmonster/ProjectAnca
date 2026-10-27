import type { Entry } from "./types";
import { ENTRY_COLS } from "./constants";
import { q, sb } from "./supabase";

export function fetchFeed({ users, limit = 20 }: { users?: string[]; limit?: number } = {}) {
  let req = sb().from("entries").select(ENTRY_COLS).order("updated_at", { ascending: false }).limit(limit);
  if (users) req = req.in("user_id", users);
  return q<Entry[]>(req);
}

export const fetchEntries = (userId: string) =>
  q<Entry[]>(sb().from("entries").select("*").eq("user_id", userId).order("updated_at", { ascending: false }).limit(2000));
