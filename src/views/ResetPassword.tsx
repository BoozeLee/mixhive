import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const { updatePassword } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters for security.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    // Basic strength check
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (!hasUpper || !hasLower || !hasNumber) {
      setError('Password should contain uppercase, lowercase, and a number for better security.');
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
            Back to sign in
          </Button>
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

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="New password"
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
            {loading ? 'Updating...' : 'Update password'}
          </Button>
        </form>
      </div>
    </div>
  );
}
