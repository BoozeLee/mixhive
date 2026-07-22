import { Link, useLocation } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { useAuth } from '../hooks/useAuth';
import { useMessages } from '../lib/messagesStore';
import { LogoIcon } from './Logo';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Icon } from './ui/Icon';
import type { IconKey } from '../lib/icons';
import { colors, space, transition, fontSize, fontWeight } from '../styles/tokens';

interface NavItem {
  path: string;
  icon: IconKey;
  labelKey: string;
  ariaLabel: string;
}

const navItems: NavItem[] = [
  { path: '/dashboard', icon: 'dashboard', labelKey: 'growth', ariaLabel: 'Creator dashboard' },
  { path: '/feed', icon: 'feed', labelKey: 'feed', ariaLabel: 'Hive Feed' },
  { path: '/search', icon: 'network', labelKey: 'radar', ariaLabel: 'Hive Radar' },
  { path: '/messages', icon: 'messages', labelKey: 'dms', ariaLabel: 'Direct messages' },
  { path: '/profile', icon: 'profile', labelKey: 'cell', ariaLabel: 'Profile cell' },
];

// Logo item for mobile navigation
const _logoItem = {
  path: '/',
  label: 'MixHive',
  ariaLabel: 'MixHive Home',
};

export function MobileNav() {
  const location = useLocation();
  const t = useTranslations('nav');
  const { user, profile } = useAuth();
  const { unreadTotal } = useMessages();

  if (!user) return null;

  return (
    <nav
      className="mobile-nav"
      role="navigation"
      aria-label="Main navigation"
      style={{
        position: 'fixed',
        bottom: 'env(safe-area-inset-bottom, 0px)',
        left: 0,
        right: 0,
        background: 'linear-gradient(180deg, rgba(8,8,6,0.86), rgba(2,2,2,0.98))',
        borderTop: `1px solid ${colors.accentMuted}`,
        boxShadow: '0 -16px 42px rgba(0,0,0,0.66), 0 0 24px rgba(246,196,0,0.1)',
        backdropFilter: 'blur(18px)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: `${space[2]} 0`,
        zIndex: 100,
        height: 60,
        paddingBottom: space[2],
      }}
    >
      {/* Logo + language */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <Link
          to="/"
          style={{
            position: 'relative',
            textDecoration: 'none',
            color: location.pathname === '/' ? colors.accent : colors.text.muted,
            transition: transition.base,
          }}
          aria-current={location.pathname === '/' ? 'page' : undefined}
        >
          <div style={{ textAlign: 'center' }}>
            <LogoIcon variant="business" />
          </div>
        </Link>
        <LanguageSwitcher hideLabel />
      </div>

      {/* Compose Buzz — gold floating button in center */}
      <Link
        to="/feed?compose=1"
        aria-label="Post a Buzz"
        style={{
          position: 'relative',
          textDecoration: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 44,
            height: 44,
            display: 'grid',
            placeItems: 'center',
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${colors.accent}, ${colors.accentBrightest})`,
            color: colors.bg,
            fontSize: 20,
            fontWeight: 900,
            boxShadow: `0 4px 18px rgba(246,196,0,0.5)`,
            border: `2px solid ${colors.accent}`,
            marginTop: -14,
          }}
        >
          <Icon name="buzz" size={22} color={colors.bg} strokeWidth={2.4} />
        </span>
        <span
          style={{
            display: 'block',
            fontSize: fontSize.xs,
            marginTop: space[1],
            textAlign: 'center',
            color: colors.accent,
            fontWeight: fontWeight.bold,
          }}
        >
          Buzz
        </span>
      </Link>

      {/* Navigation Items */}
      {navItems.map(item => {
        const path =
          item.path === '/profile' && profile?.username ? `/u/${profile.username}` : item.path;
        const isActive =
          location.pathname === path ||
          (item.path === '/profile' && location.pathname.startsWith('/u/'));
        return (
          <Link
            key={item.path}
            to={path}
            style={{
              position: 'relative',
              textDecoration: 'none',
              color: isActive ? colors.accent : colors.text.muted,
              transition: transition.base,
            }}
            aria-current={isActive ? 'page' : undefined}
          >
            <span
              aria-hidden="true"
              style={{
                width: 32,
                height: 32,
                display: 'grid',
                placeItems: 'center',
                clipPath: 'polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0 50%)',
                background: isActive ? colors.accent : 'rgba(246,196,0,0.08)',
                color: isActive ? colors.bg : colors.accent,
                border: `1px solid ${isActive ? colors.accent : colors.accentMuted}`,
                position: 'relative',
              }}
            >
              <Icon name={item.icon} size={17} color="currentColor" />
              {item.path === '/messages' && unreadTotal > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    background: colors.accent,
                    color: colors.bg,
                    fontSize: 9,
                    fontWeight: 700,
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2,
                  }}
                >
                  {unreadTotal > 9 ? '9+' : unreadTotal}
                </span>
              )}
            </span>
            <span
              style={{
                display: 'block',
                fontSize: fontSize.xs,
                marginTop: space[1],
                textAlign: 'center',
                fontWeight: isActive ? fontWeight.semibold : fontWeight.normal,
              }}
            >
              {t(item.labelKey)}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
