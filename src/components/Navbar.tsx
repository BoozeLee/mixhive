import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { NotificationsBell } from './NotificationsBell'
import { SearchBar } from './SearchBar'

export function Navbar() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 24px',
      background: '#0a0a0a',
      borderBottom: '1px solid #1a1a2e',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <Link to="/" style={{
          fontSize: 20,
          fontWeight: 700,
          color: '#f0c040',
          textDecoration: 'none',
          letterSpacing: -0.5
        }}>
          mixhive
        </Link>
        {user && (
          <div style={{ display: 'flex', gap: 20 }}>
            <Link to="/feed" style={{ color: '#888', textDecoration: 'none', fontSize: 14 }}>Feed</Link>
            <Link to="/trending" style={{ color: '#888', textDecoration: 'none', fontSize: 14 }}>Trending</Link>
            <Link to="/upload" style={{ color: '#888', textDecoration: 'none', fontSize: 14 }}>Upload</Link>
          </div>
        )}
      </div>

      <SearchBar />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {user ? (
          <>
            <NotificationsBell />
            <Link to={`/u/${profile?.username}`} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: '#ccc',
              textDecoration: 'none',
              fontSize: 14
            }}>
              <div style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: profile?.avatar_url ? `url(${profile.avatar_url}) center/cover` : '#333',
                border: '1px solid #333'
              }} />
              {profile?.display_name || profile?.username}
            </Link>
            <button onClick={() => { signOut(); navigate('/') }} style={{
              background: 'transparent',
              border: '1px solid #333',
              color: '#888',
              padding: '6px 14px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13
            }}>
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link to="/login" style={{ color: '#888', textDecoration: 'none', fontSize: 14 }}>Sign in</Link>
            <Link to="/register" style={{
              background: '#f0c040',
              color: '#0a0a0a',
              textDecoration: 'none',
              padding: '6px 16px',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600
            }}>
              Join Mix Hive
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
