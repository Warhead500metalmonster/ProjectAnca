// Ancalog service worker: sadece bildirimlere tıklayınca doğru sayfayı açar. Hiçbir şeyi önbelleğe almaz, siteyi değiştirmez.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) return c.focus().then((w) => (w && "navigate" in w ? w.navigate(url) : w));
      }
      return self.clients.openWindow(url);
    }),
  );
});
