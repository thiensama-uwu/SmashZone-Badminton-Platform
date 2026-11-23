self.addEventListener("push", (event) => {
  let data = { title: "SmashZone", body: "Bạn có thông báo mới." };
  try {
    data = event.data.json();
  } catch {
    /* fallback to default */
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "SmashZone", {
      body: data.body || data.message || "",
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      data: data.url ? { url: data.url } : undefined,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});

