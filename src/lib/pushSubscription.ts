export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export async function subscribeToPush(
  swReg: ServiceWorkerRegistration,
  vapidPublicKey: string,
  accessToken: string
): Promise<boolean> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const sub = await swReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    const { endpoint, keys } = sub.toJSON() as {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    };

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        user_agent: navigator.userAgent.slice(0, 200),
      }),
    });

    return res.ok;
  } catch {
    return false;
  }
}

export async function unsubscribeFromPush(
  swReg: ServiceWorkerRegistration,
  accessToken: string
): Promise<void> {
  try {
    const sub = await swReg.pushManager.getSubscription();
    if (!sub) return;
    const { endpoint } = sub.toJSON() as { endpoint: string };
    await sub.unsubscribe();
    await fetch('/api/push/subscribe', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ endpoint }),
    });
  } catch {
    // best-effort unsubscribe; ignore network/permission errors
  }
}
