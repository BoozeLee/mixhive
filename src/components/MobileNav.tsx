import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { IconButton } from './ui/IconButton'
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

export function MobileNav() {
  const location = useLocation()
  const { user } = useAuth()
  
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
      {navItems.map((item) => {
        const isActive = location.pathname === item.path
        return (
          <Link
            key={item.path}
            to={item.path}
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