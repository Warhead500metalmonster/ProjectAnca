import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Bu iki değer herkese açık olabilir (güvenliği veritabanındaki RLS kuralları sağlar).
// Vercel'de ortam değişkeni girilmemişse de site çalışsın diye varsayılan olarak burada duruyor.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rsdhrnjycttihsduhasl.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_t6viNIZpme4lDpbaptmPpQ_aDZn31cU";

let client: SupabaseClient | null = null;

export const supabaseConfigured = () => !!URL && !!KEY;

// "Beni hatırla" kapalıysa oturum sekme kapanınca silinen sessionStorage'da tutulur
const REMEMBER_KEY = "ancalog.remember";
export function setRemember(on: boolean) {
  try { localStorage.setItem(REMEMBER_KEY, on ? "1" : "0"); } catch { /* sadece tercih */ }
}
const remember = () => { try { return localStorage.getItem(REMEMBER_KEY) !== "0"; } catch { return true; } };
const storage = {
  getItem: (k: string) => { try { return localStorage.getItem(k) ?? sessionStorage.getItem(k); } catch { return null; } },
  setItem: (k: string, v: string) => {
    try {
      const [keep, drop] = remember() ? [localStorage, sessionStorage] : [sessionStorage, localStorage];
      keep.setItem(k, v);
      drop.removeItem(k);
    } catch { /* depolama kapalıysa oturum sadece bellekte kalır */ }
  },
  removeItem: (k: string) => { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch { /* yok say */ } },
};

export function sb(): SupabaseClient {
  // Tüm sayfalar tarayıcıda çalışır; oturum eski siteyle aynı anahtarda durur, kimse tekrar giriş yapmak zorunda kalmaz
  client ??= createClient(URL, KEY, { auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return client;
}

// Supabase cevabını aç: hata varsa fırlat
export async function q<T>(req: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await req;
  if (error) throw new Error(error.message);
  return data as T;
}
export async function countOf(req: PromiseLike<{ count: number | null; error: { message: string } | null }>) {
  const { count, error } = await req;
  if (error) throw new Error(error.message);
  return count || 0;
}
