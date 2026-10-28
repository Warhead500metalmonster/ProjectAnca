import { LibraryTab } from "@/components/profile/LibraryTab";

// Profil verisi tarayıcıda yükleniyor; anında gezinme denetimi bu sekmede kapalı
export const instant = false;

export default function Page() {
  return <LibraryTab />;
}
