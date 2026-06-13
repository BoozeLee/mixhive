import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { LoginSchema, formatZodError } from '../lib/schemas';
import { getPostAuthDestination } from '../lib/authRouting';
import { colors } from '../styles/tokens';

export function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState('');
  const { user, profile, loading, signInWithEmail, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  // Redirect already-authenticated users so they never see the login form
  useEffect(() => {
    if (!loading && user) navigate(getPostAuthDestination(profile), { replace: true });
  }, [user, profile, loading, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate with Zod
    const result = LoginSchema.safeParse(formData);
    if (!result.success) {
      setErrors(formatZodError(result.error));
      setGeneralError('');
      return;
    }

    setErrors({});
    setGeneralError('');

    const { error: err } = await signInWithEmail(formData.email, formData.password);
    if (err) {
      setGeneralError(err.message);
    }
  }

  async function handleGoogle() {
    const { error: err } = await signInWithGoogle();
    if (err) setGeneralError(err.message);
  }

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear field-specific error when user types
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

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
            marginBottom: 24,
            textAlign: 'center',
          }}
        >
          Sign in
        </h1>

        {generalError && (
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
            {generalError}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            type="email"
            autoComplete="email"
            placeholder="Email"
            value={formData.email}
            onChange={e => handleInputChange('email', e.target.value)}
            error={errors.email}
          />
          <Input
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={formData.password}
            onChange={e => handleInputChange('password', e.target.value)}
            error={errors.password}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -8 }}>
            <Link
              to="/auth/forgot-password"
              style={{ color: colors.text.muted, fontSize: 12, textDecoration: 'underline' }}
            >
              Forgot password?
            </Link>
          </div>
          <Button type="submit" variant="primary" style={{ width: '100%' }}>
            Sign in
          </Button>
        </form>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            margin: '24px 0',
            color: colors.text.faintest,
            fontSize: 13,
          }}
        >
          <div style={{ flex: 1, height: 1, background: colors.borderSubtle }} />
          or
          <div style={{ flex: 1, height: 1, background: colors.borderSubtle }} />
        </div>

        <Button
          onClick={handleGoogle}
          variant="secondary"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 18 }}>G</span> Sign in with Google
        </Button>

        <p
          style={{ textAlign: 'center', marginTop: 24, color: colors.text.faintest, fontSize: 13 }}
        >
          No account?{' '}
          <Link to="/register" style={{ color: colors.accent, textDecoration: 'underline' }}>
            Join Mix Hive
          </Link>
        </p>
      </div>
    </div>
  );
}
