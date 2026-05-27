import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { NotificationsBell } from './NotificationsBell'
import { SearchBar } from './SearchBar'
import { Button } from './ui/Button'
import { Logo } from './Logo'
import { colors, space } from '../styles/tokens'

const navLinks = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/feed', label: 'Feed' },
  { to: '/discover', label: 'Explore' },
  { to: '/search', label: 'Network' },
  { to: '/upload', label: 'Nectar Upload' },
  { to: '/agents/gallery', label: 'BeeCast' },
]

export function Navbar() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <nav
      className="hive-panel"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: space[8],
        padding: `12px clamp(14px, 4vw, 48px)`,
        background: 'linear-gradient(90deg, rgba(3,3,3,0.92), rgba(13,10,2,0.82), rgba(3,3,3,0.92))',
        borderWidth: '0 0 1px',
        borderRadius: 0,
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: space[10], minWidth: 0 }}>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <Logo size="large" variant="business" showText={true} />
        </Link>
        {user && (
          <div className="desktop-only" style={{ display: 'flex', gap: space[8], alignItems: 'center' }}>
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                style={{
                  color: colors.text.secondary,
                  textDecoration: 'none',
                  fontSize: 12,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: 0,
                  padding: '10px 0',
                  borderBottom: '2px solid transparent',
                }}
                onMouseEnter={event => {
                  event.currentTarget.style.color = colors.accent
                  event.currentTarget.style.borderBottomColor = colors.accent
                }}
                onMouseLeave={event => {
                  event.currentTarget.style.color = colors.text.secondary
                  event.currentTarget.style.borderBottomColor = 'transparent'
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="desktop-only" style={{ flex: '0 1 340px' }}>
        <SearchBar />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: space[3] }}>
        {user ? (
          <>
            <NotificationsBell />
            <Link
              to="/feed?compose=1"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: space[2],
                padding: `6px ${space[5]}px`,
                background: colors.accent,
                color: colors.bg,
                borderRadius: 999,
                fontWeight: 900,
                fontSize: 13,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                letterSpacing: 0.2,
              }}
            >
              🐝 Buzz
            </Link>
            <Link to={`/u/${profile?.username}`} style={{
              display: 'flex',
              alignItems: 'center',
              gap: space[2],
              color: colors.text.secondary,
              textDecoration: 'none',
              fontSize: 13,
              textTransform: 'uppercase',
              fontWeight: 800,
            }}>
              <div style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: profile?.avatar_url ? `url(${profile.avatar_url}) center/cover` : colors.surface,
                border: `1px solid ${colors.accent}`,
                boxShadow: '0 0 18px rgba(240,192,64,0.2)',
              }} />
              {profile?.display_name || profile?.username}
            </Link>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => { signOut(); navigate('/') }}
            >
              Sign out
            </Button>
          </>
        ) : (
          <>
            <Link to="/login" style={{ color: colors.text.secondary, textDecoration: 'none', fontSize: 13, fontWeight: 800, textTransform: 'uppercase' }}>Sign in</Link>
            <Button 
              size="sm"
              onClick={() => navigate('/register')}
              style={{ background: colors.accent, color: colors.bg, fontWeight: 900, textTransform: 'uppercase' }}
            >
              Join the Hive
            </Button>
          </>
        )}
      </div>
    </nav>
  )
}
