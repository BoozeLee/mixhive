import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../lib/notificationStore';
import { isPushSupported, registerSW, subscribeToPush } from '../lib/pushSubscription';
import { supabase } from '../lib/supabase';
import { Icon } from './ui/Icon';
import { colors } from '../styles/tokens';

const PUSH_DENIED_KEY = 'mixhive_push_denied';

export function NotificationsBell() {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const [showNudge, setShowNudge] = useState(false);
  const [pushState, setPushState] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const swRegRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!user || !isPushSupported()) return;
    if (localStorage.getItem(PUSH_DENIED_KEY)) return;
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      setShowNudge(true);
    }
  }, [user]);

  const handleEnablePush = async () => {
    if (pushState === 'requesting') return;
    setPushState('requesting');

    const reg = swRegRef.current ?? (await registerSW());
    swRegRef.current = reg;

    if (!reg) {
      setPushState('denied');
      return;
    }

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      setPushState('denied');
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setPushState('denied');
      return;
    }

    const ok = await subscribeToPush(reg, vapidKey, session.access_token);

    if (ok) {
      setPushState('granted');
      setShowNudge(false);
    } else {
      setPushState('denied');
      localStorage.setItem(PUSH_DENIED_KEY, '1');
      setShowNudge(false);
    }
  };

  if (!user) return null;

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <Link
        to="/notifications"
        aria-label="Notifications"
        style={{
          position: 'relative',
          color: colors.text.dimmed,
          textDecoration: 'none',
          lineHeight: 0,
          display: 'inline-flex',
        }}
      >
        <Icon name="notifications" size={19} color="currentColor" />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -6,
              right: -8,
              background: colors.accent,
              color: colors.bg,
              fontSize: 10,
              fontWeight: 700,
              width: 16,
              height: 16,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Link>

      {showNudge && pushState === 'idle' && (
        <button
          onClick={handleEnablePush}
          aria-label="Enable push notifications"
          title="Enable push notifications"
          style={{
            marginLeft: 6,
            background: 'rgba(240,192,64,0.12)',
            border: '1px solid rgba(240,192,64,0.3)',
            borderRadius: 6,
            color: colors.accent,
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 7px',
            cursor: 'pointer',
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
          }}
        >
          Enable push
        </button>
      )}

      {pushState === 'requesting' && (
        <span style={{ marginLeft: 6, fontSize: 10, color: colors.text.faint }}>…</span>
      )}

      {pushState === 'granted' && (
        <span style={{ marginLeft: 6, fontSize: 10, color: colors.successStrong }}>✓</span>
      )}
    </div>
  );
}
