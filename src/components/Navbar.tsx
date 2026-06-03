import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { NotificationsBell } from './NotificationsBell';
import { SearchBar } from './SearchBar';
import { Button } from './ui/Button';
import { Logo } from './Logo';
import { colors, space } from '../styles/tokens';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/discover', label: 'Explore' },
  { to: '/search', label: 'Network' },
  { to: '/upload', label: 'Upload' },
  { to: '/opportunities', label: 'Events' },
];

const menuItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '9px 16px',
  color: colors.text.secondary,
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 600,
  background: 'none',
  border: 'none',
  textAlign: 'left',
  cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
  letterSpacing: 0.1,
};

export function Navbar() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [menuOpen]);

  return (
    <nav
      className="hive-panel"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: space[6],
        padding: `0 clamp(14px, 4vw, 48px)`,
        height: 64,
        background:
          'linear-gradient(90deg, rgba(3,3,3,0.96), rgba(13,10,2,0.88), rgba(3,3,3,0.96))',
        borderWidth: '0 0 1px',
        borderColor: 'rgba(240,192,64,0.14)',
        borderRadius: 0,
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Left: Logo + nav links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: space[8], minWidth: 0, flex: '0 0 auto' }}>
        <Link to="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
          <Logo size="medium" variant="business" showText={true} />
        </Link>
        {user && (
          <div
            className="desktop-only navbar-links"
            style={{ display: 'flex', gap: space[6], alignItems: 'center' }}
          >
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                style={{
                  color: colors.text.dim,
                  textDecoration: 'none',
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  padding: '4px 0',
                  borderBottom: '2px solid transparent',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = colors.accent;
                  e.currentTarget.style.borderBottomColor = colors.accent;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = colors.text.dim;
                  e.currentTarget.style.borderBottomColor = 'transparent';
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Centre: Search */}
      <div className="desktop-only" style={{ flex: '0 1 320px' }}>
        <SearchBar />
      </div>

      {/* Right: actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: space[3], flexShrink: 0 }}>
        {user ? (
          <>
            <NotificationsBell />

            <Link
              to="/feed?compose=1"
              className="navbar-buzz-pill"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: space[2],
                padding: `5px 14px`,
                background: colors.accent,
                color: colors.bg,
                borderRadius: 999,
                fontWeight: 900,
                fontSize: 12,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                letterSpacing: 0.3,
              }}
            >
              🐝 Buzz
            </Link>

            {/* Avatar — click to open dropdown */}
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuOpen(prev => !prev)}
                aria-label="User menu"
                aria-expanded={menuOpen}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    background: profile?.avatar_url
                      ? `url(${profile.avatar_url}) center/cover`
                      : colors.surface,
                    border: `2px solid ${menuOpen ? colors.accent : 'rgba(240,192,64,0.4)'}`,
                    boxShadow: menuOpen ? '0 0 0 3px rgba(240,192,64,0.18)' : 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                    flexShrink: 0,
                  }}
                />
              </button>

              {menuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 10px)',
                    background: '#0e0e0b',
                    border: `1px solid rgba(240,192,64,0.22)`,
                    borderRadius: 10,
                    minWidth: 172,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
                    overflow: 'hidden',
                    zIndex: 200,
                  }}
                >
                  <div
                    style={{
                      padding: '12px 16px 10px',
                      borderBottom: '1px solid rgba(240,192,64,0.12)',
                    }}
                  >
                    <div style={{ color: colors.accent, fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>
                      {profile?.display_name || profile?.username || 'DJ'}
                    </div>
                    <div style={{ color: colors.text.faint, fontSize: 11, marginTop: 2 }}>
                      @{profile?.username}
                    </div>
                  </div>

                  <Link
                    to={`/u/${profile?.username}`}
                    style={menuItemStyle}
                    onClick={() => setMenuOpen(false)}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(240,192,64,0.08)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                  >
                    View Profile
                  </Link>
                  <Link
                    to="/settings"
                    style={menuItemStyle}
                    onClick={() => setMenuOpen(false)}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(240,192,64,0.08)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                  >
                    Settings
                  </Link>
                  <Link
                    to="/upload"
                    style={menuItemStyle}
                    onClick={() => setMenuOpen(false)}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(240,192,64,0.08)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                  >
                    Upload Mix
                  </Link>

                  <div style={{ borderTop: '1px solid rgba(240,192,64,0.10)', marginTop: 2 }} />

                  <button
                    style={{ ...menuItemStyle, color: '#e05555' }}
                    onClick={() => { setMenuOpen(false); signOut(); navigate('/'); }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(224,85,85,0.10)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <Link
              to="/login"
              style={{
                color: colors.text.secondary,
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.3,
                whiteSpace: 'nowrap',
              }}
            >
              Sign in
            </Link>
            <Button
              size="sm"
              onClick={() => navigate('/register')}
              style={{
                background: colors.accent,
                color: colors.bg,
                fontWeight: 900,
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
            >
              Join the Hive
            </Button>
          </>
        )}
      </div>
    </nav>
  );
}
