import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { IconButton } from './ui/IconButton'
import { LogoIcon } from './Logo'
import { colors, space, bp, transition, fontSize, fontWeight } from '../styles/tokens'

interface NavItem {
  path: string
  icon: string
  label: string
  ariaLabel: string
}

const navItems: NavItem[] = [
  { path: '/feed', icon: '🎵', label: 'Feed', ariaLabel: 'Feed' },
  { path: '/discover', icon: '⭐', label: 'Discover', ariaLabel: 'Discover' },
  { path: '/search', icon: '🔍', label: 'Search', ariaLabel: 'Search' },
  { path: '/upload', icon: '⬆️', label: 'Upload', ariaLabel: 'Upload mix' },
  { path: '/notifications', icon: '🔔', label: 'Notifications', ariaLabel: 'Notifications' },
  { path: '/profile', icon: '👤', label: 'Profile', ariaLabel: 'Profile' },
]

// Logo item for mobile navigation
const logoItem: NavItem = {
  path: '/',
  icon: '',
  label: 'MixHive',
  ariaLabel: 'MixHive Home'
}

export function MobileNav() {
  const location = useLocation()
  const { user, profile } = useAuth()
  
  // Hide on desktop and when not authenticated
  if (typeof window !== 'undefined' && window.innerWidth >= bp.md) return null
  if (!user) return null

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: colors.surface,
        borderTop: `1px solid ${colors.border}`,
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: `${space[2]} 0`,
        zIndex: 100,
        height: 60,
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

      {/* Navigation Items */}
      {navItems.map((item) => {
        const path = item.path === '/profile' && profile?.username ? `/u/${profile.username}` : item.path
        const isActive = location.pathname === path || (item.path === '/profile' && location.pathname.startsWith('/u/'))
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
            <IconButton
              label={item.ariaLabel}
              active={isActive}
              size={24}
              style={{
                color: isActive ? colors.accent : colors.text.secondary,
                fontSize: 20,
              }}
            >
              {item.icon}
            </IconButton>
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
        )
      })}
    </nav>
  )
}
