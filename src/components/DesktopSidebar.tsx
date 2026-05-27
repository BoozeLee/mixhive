import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Logo } from './Logo'
import { colors, space, transition, fontSize, fontWeight } from '../styles/tokens'

interface SidebarItem {
  path: string
  icon: string
  label: string
  ariaLabel: string
  highlight?: boolean
}

const topItems: SidebarItem[] = [
  { path: '/feed?compose=1', icon: '🐝', label: 'Buzz', ariaLabel: 'Post a Buzz', highlight: true },
  { path: '/dashboard', icon: '▣', label: 'Dashboard', ariaLabel: 'Creator dashboard' },
  { path: '/feed', icon: '⌁', label: 'Feed', ariaLabel: 'Hive Feed' },
  { path: '/discover', icon: '◈', label: 'Explore', ariaLabel: 'Explore MixHive' },
  { path: '/search', icon: '◇', label: 'Network', ariaLabel: 'Hive Radar' },
  { path: '/upload', icon: '+', label: 'Upload', ariaLabel: 'Nectar Upload' },
  { path: '/agents/inbox', icon: '✦', label: 'Inbox', ariaLabel: 'Agent Inbox' },
  { path: '/agents/gallery', icon: '⬡', label: 'BeeCast', ariaLabel: 'BeeCast agents' },
]

function isActive(itemPath: string, currentPath: string): boolean {
  const path = itemPath.split('?')[0]
  if (path === '/feed') return currentPath === '/feed' || currentPath === '/trending'
  if (path === '/feed?compose=1') return false
  return currentPath === path || currentPath.startsWith(path + '/')
}

export function DesktopSidebar() {
  const location = useLocation()
  const { user, profile } = useAuth()

  if (!user) return null

  const profilePath = profile?.username ? `/u/${profile.username}` : '/settings'

  return (
    <aside
      className="desktop-sidebar"
      aria-label="Main navigation"
      style={{
        position: 'fixed',
        top: 'var(--navbar-height, 73px)',
        left: 0,
        bottom: 0,
        width: 220,
        zIndex: 90,
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, rgba(8,8,6,0.94) 0%, rgba(2,2,2,0.99) 100%)',
        borderRight: `1px solid ${colors.accentMuted}`,
        backdropFilter: 'blur(18px)',
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: `${space[7]}px 0`,
      }}
    >
      {/* Logo (mobile doesn't have a persistent logo in nav) */}
      <div style={{ padding: `0 ${space[8]}px ${space[7]}px` }}>
        <Link to="/" style={{ textDecoration: 'none' }} aria-label="MixHive home">
          <Logo size="small" variant="business" showText={true} />
        </Link>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: space[1], padding: `0 ${space[5]}px` }}>
        {topItems.map((item) => {
          const active = isActive(item.path, location.pathname)
          if (item.highlight) {
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-label={item.ariaLabel}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: space[6],
                  padding: `${space[4]}px ${space[6]}px`,
                  borderRadius: 999,
                  background: `linear-gradient(135deg, ${colors.accent}, #ffd84a)`,
                  color: colors.bg,
                  textDecoration: 'none',
                  fontWeight: fontWeight.bold,
                  fontSize: fontSize.md,
                  marginBottom: space[4],
                  boxShadow: '0 4px 18px rgba(240,192,64,0.35)',
                  transition: transition.base,
                }}
              >
                <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>{item.icon}</span>
                {item.label}
              </Link>
            )
          }
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-label={item.ariaLabel}
              aria-current={active ? 'page' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: space[6],
                padding: `${space[4]}px ${space[6]}px`,
                borderRadius: 10,
                background: active ? colors.accentFaint : 'transparent',
                color: active ? colors.accent : colors.text.muted,
                textDecoration: 'none',
                fontWeight: active ? fontWeight.bold : fontWeight.normal,
                fontSize: fontSize.md,
                transition: transition.base,
              }}
              onMouseEnter={e => {
                if (!active) {
                  e.currentTarget.style.background = 'rgba(240,192,64,0.06)'
                  e.currentTarget.style.color = colors.text.secondary
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = colors.text.muted
                }
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 32,
                  height: 32,
                  display: 'grid',
                  placeItems: 'center',
                  clipPath: 'polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0 50%)',
                  background: active ? colors.accent : 'rgba(240,192,64,0.08)',
                  color: active ? colors.bg : colors.accent,
                  border: `1px solid ${active ? colors.accent : colors.accentMuted}`,
                  fontSize: 15,
                  fontWeight: 900,
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Profile at bottom */}
      <div style={{ padding: `${space[5]}px ${space[5]}px 0`, borderTop: `1px solid ${colors.border}`, marginTop: space[5] }}>
        <Link
          to={profilePath}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: space[5],
            padding: `${space[4]}px ${space[5]}px`,
            borderRadius: 10,
            textDecoration: 'none',
            transition: transition.base,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(240,192,64,0.06)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              flexShrink: 0,
              background: profile?.avatar_url ? `url(${profile.avatar_url}) center/cover` : colors.surface,
              border: `1px solid ${colors.accentMuted}`,
              backgroundSize: 'cover',
            }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.display_name || profile?.username || 'Profile'}
            </div>
            {profile?.username && (
              <div style={{ fontSize: fontSize.xs, color: colors.text.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                @{profile.username}
              </div>
            )}
          </div>
        </Link>
      </div>
    </aside>
  )
}
