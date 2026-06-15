import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { colors } from '../styles/tokens';

export function ResetPassword() {
  const t = useTranslations('auth');
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
          <h1
            style={{ fontSize: 24, fontWeight: 700, color: colors.text.primary, marginBottom: 16 }}
          >
            Password updated
          </h1>
          <p style={{ color: colors.text.muted, fontSize: 14, marginBottom: 24 }}>
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
          <h1
            style={{ fontSize: 24, fontWeight: 700, color: colors.text.primary, marginBottom: 12 }}
          >
            Link expired
          </h1>
          <p style={{ color: colors.text.muted, fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
            This reset link has expired or has already been used.
          </p>
          <Link
            to="/auth/forgot-password"
            style={{
              display: 'inline-block',
              background: colors.accent,
              color: colors.black,
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
            color: colors.text.primary,
            marginBottom: 8,
            textAlign: 'center',
          }}
        >
          {t('resetTitle')}
        </h1>
        <p
          style={{
            textAlign: 'center',
            color: colors.text.muted,
            fontSize: 13,
            marginBottom: 24,
            lineHeight: 1.5,
          }}
        >
          {t('resetSubtitle')}
        </p>

        {error && (
          <div
            style={{
              background: colors.dangerBg,
              color: colors.danger,
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
            placeholder={t('newPasswordPlaceholder')}
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <Input
            type="password"
            autoComplete="new-password"
            placeholder={t('confirmPasswordPlaceholder')}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
          />
          <Button type="submit" variant="primary" disabled={loading} style={{ width: '100%' }}>
            {loading ? t('updating') : t('updatePassword')}
          </Button>
        </form>
      </div>
    </div>
  );
}
