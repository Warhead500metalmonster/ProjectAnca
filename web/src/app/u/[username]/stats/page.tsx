import { StatsTab } from "@/components/profile/StatsTab";

// Profil verisi tarayıcıda yükleniyor; anında gezinme denetimi bu sekmede kapalı
export const instant = false;

export default function Page() {
  return <StatsTab />;
}
