import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { LogoStacked } from '../components/Logo'
import heroImage from '../assets/hero.png'

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
        minHeight: '72vh',
        position: 'relative',
        overflow: 'hidden',
        background: `linear-gradient(180deg, rgba(5,5,5,0.28), rgba(5,5,5,0.9)), url(${heroImage}) center/cover no-repeat`,
      }}>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at center, rgba(240,192,64,0.14), rgba(5,5,5,0.66) 58%, #050505 100%)' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <LogoStacked />
        <h1 style={{
          fontSize: 64,
          fontWeight: 800,
          color: '#f0c040',
          margin: 0,
          letterSpacing: 0,
          lineHeight: 1
        }}>
          mixhive
        </h1>
        <p style={{
          fontSize: 20,
          color: '#ccc',
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
        </div>
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
