import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export const supabaseConfigured = () =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function sb(): SupabaseClient {
  client ??= createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
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
