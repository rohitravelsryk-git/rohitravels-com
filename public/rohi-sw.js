// Lightweight service worker to enable OS-level notifications for "Latest Updates"
// even when the tab is hidden or minimized. Full "browser closed" push requires
// a push server (VAPID) — this SW keeps notifications alive as long as the browser
// process is running.

self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(self.clients.claim()); });

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SHOW_NOTIFICATION") {
    self.registration.showNotification(data.title || "Rohi International Travels", {
      body: data.body || "",
      icon: data.icon || "/favicon.ico",
      badge: "/favicon.ico",
      tag: "rohi-latest-updates",
      renotify: true,
    });
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ("focus" in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow("/");
    })
  );
});
