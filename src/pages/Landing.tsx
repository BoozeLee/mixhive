import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { LogoStacked } from '../components/Logo'

export function Landing() {
  const { user } = useAuth()

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)' }}>
      <section style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '80px 24px',
        minHeight: '70vh',
        background: 'radial-gradient(ellipse at center, #0a0a1a 0%, #050505 100%)'
      }}>
        <LogoStacked />
        <h1 style={{
          fontSize: 'clamp(40px, 8vw, 80px)',
          fontWeight: 800,
          color: '#f0c040',
          margin: 0,
          letterSpacing: -2,
          lineHeight: 1
        }}>
          mixhive
        </h1>
        <p style={{
          fontSize: 'clamp(16px, 3vw, 24px)',
          color: '#888',
          marginTop: 16,
          maxWidth: 500,
          lineHeight: 1.5
        }}>
          The social platform for DJs. Upload your mixes, build your following, connect with the scene.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
          {user ? (
            <Link to="/feed" style={{
              background: '#f0c040',
              color: '#0a0a0a',
              textDecoration: 'none',
              padding: '12px 28px',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 700
            }}>
              Go to Feed
            </Link>
          ) : (
            <>
              <Link to="/register" style={{
                background: '#f0c040',
                color: '#0a0a0a',
                textDecoration: 'none',
                padding: '12px 28px',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 700
              }}>
                Join Mix Hive
              </Link>
              <Link to="/login" style={{
                background: 'transparent',
                color: '#f0c040',
                textDecoration: 'none',
                padding: '12px 28px',
                borderRadius: 8,
                fontSize: 16,
                border: '1px solid #f0c04044'
              }}>
                Sign In
              </Link>
              <Link to="/dev-login" style={{
                background: '#8b5cf6',
                color: '#ffffff',
                textDecoration: 'none',
                padding: '12px 28px',
                borderRadius: 8,
                fontSize: 16,
                border: '1px solid #8b5cf6'
              }}>
                🎮 Demo Mode
              </Link>
            </>
          )}
        </div>
        {!user && (
          <div style={{ display: 'flex', gap: 24, marginTop: 48, color: '#555', fontSize: 12 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>🎧</div>
              Upload mixes
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>👥</div>
              Follow DJs
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>💬</div>
              Comment & connect
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>📡</div>
              Get discovered
            </div>
          </div>
        )}
      </section>

      <section style={{ padding: '60px 24px', maxWidth: 700, margin: '0 auto' }}>
        <p style={{ color: '#555', fontSize: 13, textAlign: 'center', lineHeight: 1.8 }}>
          Mix Hive is a community-owned platform for DJs. No algorithms deciding your reach.
          No corporate feed manipulation. Just real connections between DJs and their audience.
          <br /><br />
          Built for DJs. By DJs.
        </p>
      </section>
    </div>
  )
}
