"use client";

import { useState } from "react";
import { q, sb, supabaseConfigured } from "@/lib/supabase";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "./AppProvider";

interface Warning { id: string; body: string; created_at: string }

// Yönetimden gelen uyarı: kişi siteye girince üstte görür, "Anladım" deyince kapanır (okundu sayılır)
export function WarningBanner() {
  const { me, toast } = useApp();
  const [seen, setSeen] = useState<string[]>([]);
  const { data } = useLoad(() => q<Warning[]>(sb().from("warnings").select("id, body, created_at").eq("user_id", me!.id).is("read_at", null)
    .order("created_at").limit(5)).catch(() => [] as Warning[]), [me?.id], supabaseConfigured() && !!me);
  const w = data?.find((x) => !seen.includes(x.id));
  if (!me || !w) return null;

  async function ok() {
    setSeen((s) => [...s, w!.id]);
    try { await q(sb().from("warnings").update({ read_at: new Date().toISOString() }).eq("id", w!.id)); }
    catch { toast("Bağlantı sorunu, uyarı bir dahaki girişte yine görünebilir."); }
  }

  return (
    <div className="notice warn warning-banner" role="alert">
      <p><b>Yönetimden uyarı:</b> {w.body}</p>
      <button className="btn" onClick={ok}>Anladım</button>
    </div>
  );
}
