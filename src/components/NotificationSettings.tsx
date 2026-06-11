import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  isPushSupported,
  registerSW,
  subscribeToPush,
  unsubscribeFromPush,
} from '../lib/pushSubscription';
import { Button } from './ui/Button';
import { colors, fontSize, space } from '../styles/tokens';

type Preferences = {
  push_enabled: boolean;
  messages_enabled: boolean;
  social_enabled: boolean;
  uploads_enabled: boolean;
  account_enabled: boolean;
};

const CATEGORIES: Array<{ key: keyof Preferences; label: string; description: string }> = [
  { key: 'messages_enabled', label: 'Messages', description: 'Direct messages arrive quickly.' },
  { key: 'social_enabled', label: 'Social activity', description: 'Comments are quick; likes and follows are grouped.' },
  { key: 'uploads_enabled', label: 'New mixes', description: 'Hourly updates from artists you follow.' },
  { key: 'account_enabled', label: 'Account and marketplace', description: 'Verification, purchases, sales, and payouts.' },
];

async function accessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export function NotificationSettings() {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const supported = isPushSupported();

  useEffect(() => {
    void (async () => {
      const token = await accessToken();
      if (!token) return;
      const res = await fetch('/api/push/preferences', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const body = await res.json();
      setPreferences(body.preferences);
      setSubscribed(Boolean(body.subscribed));
    })();
  }, []);

  async function save(updates: Partial<Preferences>) {
    const token = await accessToken();
    if (!token) throw new Error('Sign in again to update notification settings.');
    const res = await fetch('/api/push/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Could not save notification settings.');
    const body = await res.json();
    setPreferences(body.preferences);
  }

  async function togglePush() {
    if (!preferences || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const token = await accessToken();
      if (!token) throw new Error('Sign in again to update notification settings.');
      const registration = await registerSW();
      if (!registration) throw new Error('Push notifications are not supported in this browser.');

      if (preferences.push_enabled && subscribed) {
        await unsubscribeFromPush(registration, token);
        await save({ push_enabled: false });
        setSubscribed(false);
        setMessage('Browser push disabled on this device.');
      } else {
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) throw new Error('Push notifications are not configured.');
        const ok = await subscribeToPush(registration, vapidKey, token);
        if (!ok) throw new Error('Browser permission was not granted.');
        setSubscribed(true);
        setPreferences(current => current ? { ...current, push_enabled: true } : current);
        setMessage('Browser push enabled.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update browser push.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleCategory(key: keyof Preferences, enabled: boolean) {
    if (!preferences || key === 'push_enabled') return;
    setPreferences({ ...preferences, [key]: enabled });
    try {
      await save({ [key]: enabled });
    } catch (error) {
      setPreferences(preferences);
      setMessage(error instanceof Error ? error.message : 'Could not save notification settings.');
    }
  }

  if (!preferences) {
    return <p style={{ color: colors.text.dim, fontSize: fontSize.sm }}>Loading notification settings…</p>;
  }

  return (
    <div style={{ display: 'grid', gap: space[5] }}>
      <div>
        <Button type="button" variant="secondary" onClick={togglePush} disabled={busy || !supported}>
          {busy
            ? 'Updating…'
            : preferences.push_enabled && subscribed
              ? 'Disable browser push'
              : 'Enable browser push'}
        </Button>
        {!supported && (
          <p style={{ color: colors.text.dim, fontSize: fontSize.sm }}>
            This browser does not support web push.
          </p>
        )}
        {message && <p style={{ color: colors.text.muted, fontSize: fontSize.sm }}>{message}</p>}
      </div>

      {CATEGORIES.map(category => (
        <label
          key={category.key}
          style={{ display: 'flex', alignItems: 'flex-start', gap: space[4], cursor: 'pointer' }}
        >
          <input
            type="checkbox"
            checked={preferences[category.key]}
            onChange={event => void toggleCategory(category.key, event.target.checked)}
            style={{ accentColor: colors.accent, width: 18, height: 18, marginTop: 2 }}
          />
          <span>
            <strong style={{ display: 'block', color: colors.text.primary, fontSize: fontSize.sm }}>
              {category.label}
            </strong>
            <span style={{ color: colors.text.dim, fontSize: fontSize.sm }}>
              {category.description}
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}
