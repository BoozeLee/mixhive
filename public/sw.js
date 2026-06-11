// MixHive Service Worker — push notifications only, no caching
// Registered by src/lib/pushSubscription.ts on authenticated mount.

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch {}

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const focused = list.find(client => client.visibilityState === 'visible' && client.focused);
      if (focused) {
        focused.postMessage({ type: 'mixhive-notification-refresh' });
        return;
      }
      const title = data.title ?? 'MixHive';
      const options = {
        body: data.body ?? '',
        icon: '/mixhive.png',
        badge: '/mixhive.png',
        tag: data.tag ?? 'mixhive-notification',
        renotify: Boolean(data.tag),
        data: { url: safePath(data.url) },
      };
      return self.registration.showNotification(title, options);
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = safePath(event.notification.data?.url);

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

function safePath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return '/notifications';
  }
  try {
    const url = new URL(value, self.location.origin);
    return url.origin === self.location.origin
      ? `${url.pathname}${url.search}${url.hash}`
      : '/notifications';
  } catch {
    return '/notifications';
  }
}
