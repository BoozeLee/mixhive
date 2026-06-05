import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const { updatePassword } = useAuth();
  const navigate = useNavigate();

  // Supabase sends the reset token either as ?code= (PKCE) or #access_token= (implicit)
  useEffect(() => {
    const hasCode = new URLSearchParams(window.location.search).has('code');
    const hasHash = window.location.hash.includes('access_token');
    setHasToken(hasCode || hasHash);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error: err } = await updatePassword(password);
    setLoading(false);

    if (err) {
      setError(err.message);
    } else {
      setDone(true);
    }
  }

  if (done) {
    return (
      <div
        className="container"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 'calc(100vh - 60px)',
          padding: '24px 16px',
        }}
      >
        <div style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#eee', marginBottom: 16 }}>
            Password updated
          </h1>
          <p style={{ color: '#888', fontSize: 14, marginBottom: 24 }}>
            Your password has been reset successfully.
          </p>
          <Button variant="primary" onClick={() => navigate('/login')}>
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  // Still detecting whether there's a valid token in the URL
  if (hasToken === null) return null;

  // No valid reset token — the link was expired, already used, or navigated to directly
  if (!hasToken) {
    return (
      <div
        className="container"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 'calc(100vh - 60px)',
          padding: '24px 16px',
        }}
      >
        <div style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#eee', marginBottom: 12 }}>
            Link expired
          </h1>
          <p style={{ color: '#888', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
            This reset link has expired or has already been used.
          </p>
          <Link
            to="/auth/forgot-password"
            style={{
              display: 'inline-block',
              background: '#f0c040',
              color: '#000',
              padding: '10px 24px',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 14,
              textDecoration: 'none',
            }}
          >
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="container"
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 'calc(100vh - 60px)',
        padding: '24px 16px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 380 }}>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: '#eee',
            marginBottom: 8,
            textAlign: 'center',
          }}
        >
          Set new password
        </h1>
        <p
          style={{
            textAlign: 'center',
            color: '#888',
            fontSize: 13,
            marginBottom: 24,
            lineHeight: 1.5,
          }}
        >
          Enter your new password below.
        </p>

        {error && (
          <div
            style={{
              background: '#2a1010',
              color: '#f55',
              padding: '10px 14px',
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="New password (6+ characters)"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="Confirm new password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
          />
          <Button type="submit" variant="primary" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </div>
    </div>
  );
}
