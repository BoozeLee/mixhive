import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LogoIcon } from './Logo';
import { colors, space, transition, fontSize, fontWeight } from '../styles/tokens';

interface NavItem {
  path: string;
  icon: string;
  label: string;
  ariaLabel: string;
}

const navItems: NavItem[] = [
  { path: '/dashboard', icon: '▣', label: 'Growth', ariaLabel: 'Creator dashboard' },
  { path: '/feed', icon: '⌁', label: 'Feed', ariaLabel: 'Hive Feed' },
  { path: '/search', icon: '◇', label: 'Radar', ariaLabel: 'Hive Radar' },
  { path: '/profile', icon: '♕', label: 'Cell', ariaLabel: 'Profile cell' },
];

// Logo item for mobile navigation
const logoItem: NavItem = {
  path: '/',
  icon: '',
  label: 'MixHive',
  ariaLabel: 'MixHive Home',
};

export function MobileNav() {
  const location = useLocation();
  const { user, profile } = useAuth();

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
        boxShadow: '0 -16px 42px rgba(0,0,0,0.66), 0 0 24px rgba(240,192,64,0.1)',
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
      {/* Logo */}
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
        <div style={{ textAlign: 'center', marginBottom: space[1] }}>
          <LogoIcon variant="business" />
        </div>
        <span
          style={{
            display: 'block',
            fontSize: fontSize.xs,
            marginTop: space[1],
            textAlign: 'center',
            fontWeight: location.pathname === '/' ? fontWeight.semibold : fontWeight.normal,
          }}
        >
          {logoItem.label}
        </span>
      </Link>

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
            background: `linear-gradient(135deg, ${colors.accent}, #ffd84a)`,
            color: colors.bg,
            fontSize: 22,
            fontWeight: 900,
            boxShadow: `0 4px 18px rgba(240,192,64,0.5)`,
            border: `2px solid ${colors.accent}`,
            marginTop: -14,
          }}
        >
          🐝
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
                background: isActive ? colors.accent : 'rgba(240,192,64,0.08)',
                color: isActive ? colors.bg : colors.accent,
                border: `1px solid ${isActive ? colors.accent : colors.accentMuted}`,
                fontSize: 18,
                fontWeight: 900,
              }}
            >
              {item.icon}
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
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
