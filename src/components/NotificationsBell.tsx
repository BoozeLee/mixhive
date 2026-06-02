import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../lib/notificationStore';

export function NotificationsBell() {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();

  if (!user) return null;

  return (
    <Link
      to="/notifications"
      style={{
        position: 'relative',
        color: '#888',
        textDecoration: 'none',
        fontSize: 18,
        lineHeight: 1,
      }}
    >
      🔔
      {unreadCount > 0 && (
        <span
          style={{
            position: 'absolute',
            top: -6,
            right: -8,
            background: '#f0c040',
            color: '#0a0a0a',
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
  );
}
