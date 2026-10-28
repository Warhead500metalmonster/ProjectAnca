"use client";

import { useEffect, useState } from "react";
import { q, sb, supabaseConfigured } from "@/lib/supabase";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "./AppProvider";

// Yöneticinin yazdığı, herkesin sayfanın üstünde gördüğü duyuru. Kapatan bir daha görmez (yeni duyuru gelene kadar).
export interface Notice { text?: string; tone?: "info" | "party" | "warn"; link?: string }
export const NOTICE_TONES: [Notice["tone"], string][] = [["info", "Bilgi"], ["party", "Kutlama"], ["warn", "Uyarı"]];
const CLOSED = "ancalog.noticeClosed";

export const fetchNotice = () =>
  q<{ value: Notice; updated_at: string } | null>(sb().from("site_settings").select("value, updated_at").eq("key", "announcement").maybeSingle())
    .catch(() => null); // tablo yoksa (SQL çalışmadan) duyuru da yok

export function Announcement() {
  const { version } = useApp();
  const { data } = useLoad(fetchNotice, [version], supabaseConfigured());
  const [closed, setClosed] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- tarayıcı deposundan okunan veri
  useEffect(() => { try { setClosed(localStorage.getItem(CLOSED) || ""); } catch { setClosed(""); } }, []);

  if (!data?.value.text || closed === null || closed === data.updated_at) return null;
  const { text, tone = "info", link } = data.value;

  function close() {
    try { localStorage.setItem(CLOSED, data!.updated_at); } catch { /* yok say */ }
    setClosed(data!.updated_at);
  }

  return (
    <div className={`notice ${tone}`} role="status">
      <p>{text}{link && /^https?:\/\//.test(link) && <> <a href={link} target="_blank" rel="noopener">Bağlantı →</a></>}</p>
      <button className="icon-btn" aria-label="Duyuruyu kapat" onClick={close}>✕</button>
    </div>
  );
}
