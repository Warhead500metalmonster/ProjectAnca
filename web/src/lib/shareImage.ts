import { sb } from "./supabase";

// Sunucuda çizilen kartı alır: telefonda paylaşım penceresi (Instagram, WhatsApp...), bilgisayarda indirme.
// Kendi gizli kaydını da paylaşabilsin diye oturum gönderilir.
export async function shareImage(url: string, name: string, title: string, toast: (m: string) => void) {
  toast("Görsel hazırlanıyor…");
  try {
    const token = (await sb().auth.getSession()).data.session?.access_token;
    const r = await fetch(url, { headers: token ? { authorization: `Bearer ${token}` } : {} });
    if (!r.ok) throw new Error(String(r.status));
    const file = new File([await r.blob()], name, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title }).catch(() => {});
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast("Görsel indirildi ✓");
  } catch {
    toast("Görsel hazırlanamadı, biraz sonra tekrar dene.");
  }
}
