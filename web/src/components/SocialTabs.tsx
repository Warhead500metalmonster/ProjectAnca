"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "./AppProvider";

// Sosyal bölümünün iki sekmesi: özel mesajlar ve herkese açık forum
export function SocialTabs() {
  const path = usePathname();
  const { unread } = useApp();
  return (
    <nav className="social-tabs">
      <Link href="/chat" className={path.startsWith("/chat") ? "active" : ""}>
        Mesajlar{unread > 0 && <b className="nav-badge">{unread > 9 ? "9+" : unread}</b>}
      </Link>
      <Link href="/forum" className={path.startsWith("/forum") ? "active" : ""}>Forum</Link>
    </nav>
  );
}
