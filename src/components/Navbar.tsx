import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { NotificationsBell } from './NotificationsBell'
import { SearchBar } from './SearchBar'
import { Button } from './ui/Button'
import { colors, space } from '../styles/tokens'

export function Navbar() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: `${space[3]} ${space[4]}`,
      background: colors.surface,
      borderBottom: `1px solid ${colors.border}`,
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: space[6] }}>
        <Link to="/" style={{
          fontSize: 20,
          fontWeight: 700,
          color: colors.accent,
          textDecoration: 'none',
          letterSpacing: -0.5
        }}>
          mixhive
        </Link>
        {user && (
          <div style={{ display: 'flex', gap: space[5] }}>
            <Link to="/feed" style={{ color: colors.text.muted, textDecoration: 'none', fontSize: 14 }}>Feed</Link>
            <Link to="/discover" style={{ color: colors.text.muted, textDecoration: 'none', fontSize: 14 }}>Discover</Link>
            <Link to="/trending" style={{ color: colors.text.muted, textDecoration: 'none', fontSize: 14 }}>Trending</Link>
            <Link to="/upload" style={{ color: colors.text.muted, textDecoration: 'none', fontSize: 14 }}>Upload</Link>
          </div>
        )}
      </div>

      <SearchBar />

      <div style={{ display: 'flex', alignItems: 'center', gap: space[3] }}>
        {user ? (
          <>
            <NotificationsBell />
            <Link to={`/u/${profile?.username}`} style={{
              display: 'flex',
              alignItems: 'center',
              gap: space[2],
              color: colors.text.secondary,
              textDecoration: 'none',
              fontSize: 14
            }}>
              <div style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: profile?.avatar_url ? `url(${profile.avatar_url}) center/cover` : colors.surface,
                border: `1px solid ${colors.border}`
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
            <Link to="/login" style={{ color: colors.text.muted, textDecoration: 'none', fontSize: 14 }}>Sign in</Link>
            <Button 
              size="sm"
              onClick={() => navigate('/register')}
            >
              Join Mix Hive
            </Button>
          </>
        )}
      </div>
    </nav>
  )
}
