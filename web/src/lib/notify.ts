// Bildirimler ve ana ekrana ekleme: telefonda/bilgisayarda Ancalog'u uygulama gibi kurmak ve sistem bildirimi göstermek.
// Bildirimler cihazın kendisinde gösterilir; hiçbir sunucuya abonelik ya da veri gönderilmez.
// İsteyen Ayarlar'dan kapatır (tarayıcı izni kalsa da Ancalog bildirim göstermez).

const OFF = "ancalog.notify.off";

export const notifySupported = () => typeof window !== "undefined" && "Notification" in window;
export const notifyOn = () => {
  if (!notifySupported() || Notification.permission !== "granted") return false;
  try { return localStorage.getItem(OFF) !== "1"; } catch { return true; }
};

export async function enableNotify(): Promise<boolean> {
  if (!notifySupported()) return false;
  try { localStorage.removeItem(OFF); } catch { /* yok say */ }
  const p = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  return p === "granted";
}

export function disableNotify() {
  try { localStorage.setItem(OFF, "1"); } catch { /* yok say */ }
}

// Telefonlarda bildirim sadece service worker üzerinden gösterilebiliyor
export async function notify(title: string, body: string, url = "/") {
  if (!notifyOn()) return;
  const opts = { body, icon: "/icon-192.png", badge: "/icon-192.png", tag: url, data: { url } };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) return void (await reg.showNotification(title, opts));
    new Notification(title, opts);
  } catch { /* gösterilemezse sessizce geç */ }
}

// Ana ekrana ekle: tarayıcı izin verdiğinde gelen istek saklanır, Ayarlar'daki düğme onu açar
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let installEvent: InstallEvent | null = null;
const listeners = new Set<() => void>();
export const canInstall = () => !!installEvent;
export const onInstallChange = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const isStandalone = () => typeof window !== "undefined" && (matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true);
export const isIos = () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

export async function install(): Promise<boolean> {
  if (!installEvent) return false;
  await installEvent.prompt();
  const ok = (await installEvent.userChoice).outcome === "accepted";
  installEvent = null;
  listeners.forEach((f) => f());
  return ok;
}

// Site açılınca bir kez: service worker'ı kaydet, kurulum isteğini yakala
export function setupApp() {
  if (typeof window === "undefined") return;
  navigator.serviceWorker?.register("/sw.js").catch(() => {});
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installEvent = e as InstallEvent;
    listeners.forEach((f) => f());
  });
}
