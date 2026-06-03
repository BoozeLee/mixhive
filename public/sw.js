// MixHive Service Worker — push notifications only, no caching
// Registered by src/lib/pushSubscription.ts on authenticated mount.

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch {}

  const title = data.title ?? 'MixHive';
  const options = {
    body: data.body ?? '',
    icon: '/mixhive.png',
    badge: '/mixhive.png',
    tag: data.tag ?? 'mixhive-notification',
    renotify: Boolean(data.tag),
    data: { url: data.url ?? '/notifications' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/notifications';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ('focus' in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
