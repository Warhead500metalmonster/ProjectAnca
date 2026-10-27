import { ProfileShell } from "@/components/ProfileShell";

// Profil verisi tarayıcıda yükleniyor; sekmeler profil gelince çizilir
export const instant = false;

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <ProfileShell>{children}</ProfileShell>;
}
