import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { LoginSchema } from '../lib/schemas';
import { colors } from '../styles/tokens';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { resetPasswordForEmail } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Validate email format before hitting the network
    const emailCheck = LoginSchema.shape.email.safeParse(email);
    if (!emailCheck.success) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);

    const { error: err } = await resetPasswordForEmail(email);
    setLoading(false);

    if (err) {
      setError(err.message);
    } else {
      setSent(true);
    }
  }

  if (sent) {
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
            Check your email
          </h1>
          <p style={{ color: colors.text.muted, fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
            If an account with <strong>{email}</strong> exists, we sent a password reset link.
          </p>
          <Link
            to="/login"
            style={{ color: colors.accent, fontSize: 14, textDecoration: 'underline' }}
          >
            Back to sign in
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
          Reset password
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
          Enter your email and we'll send you a reset link.
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
            type="email"
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <Button type="submit" variant="primary" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Sending...' : 'Send reset link'}
          </Button>
        </form>

        <p
          style={{ textAlign: 'center', marginTop: 24, color: colors.text.faintest, fontSize: 13 }}
        >
          <Link to="/login" style={{ color: colors.accent, textDecoration: 'underline' }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
