import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { MixhiveWordmark } from '../components/brand/MixhiveWordmark';
import { RegisterSchema, formatZodError } from '../lib/schemas';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { isDisposableEmail } from '../lib/disposableEmail';
import { colors, space, radius, fontSize, fontWeight, display, gradient } from '../styles/tokens';
import { getPostAuthDestination } from '../lib/authRouting';

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.2C29.2 35 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.5l-6.5 5C9.6 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.6l6.3 5.2C41.4 36.1 44 30.6 44 24c0-1.3-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}

const valueProps = [
  'Publish your mixes and get heard',
  'Find collabs, quests and gigs',
  'Sell gear and AI agents, get paid',
];

export function Register() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    display_name: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const { user, profile, loading, signUpWithEmail, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const t = useTranslations('auth');
  const tc = useTranslations('common');

  useEffect(() => {
    if (!loading && user) navigate(getPostAuthDestination(profile), { replace: true });
  }, [user, profile, loading, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = RegisterSchema.safeParse(formData);
    if (!result.success) {
      setErrors(formatZodError(result.error));
      setGeneralError('');
      return;
    }
    setErrors({});
    setGeneralError('');
    if (isDisposableEmail(formData.email)) {
      setErrors({ email: 'Disposable email addresses are not allowed.' });
      return;
    }
    setSubmitting(true);
    try {
      if (isSupabaseConfigured) {
        const { data: existingProfile, error: usernameCheckError } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', formData.username)
          .maybeSingle();
        if (usernameCheckError) {
          setGeneralError(usernameCheckError.message);
          return;
        }
        if (existingProfile) {
          setGeneralError('Username already taken. Pick another username.');
          return;
        }
      }
      const { data, error: err } = await signUpWithEmail(formData.email, formData.password, {
        preferred_username: formData.username,
        username: formData.username,
        display_name: formData.display_name,
        full_name: formData.display_name,
      });
      if (err) {
        setGeneralError(
          (err as { code?: string }).code === '23505'
            ? 'Username already taken. Please choose a different one.'
            : err.message
        );
      } else if (data.session) {
        navigate('/setup');
      } else {
        setConfirmationEmail(formData.email);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    const { error: err } = await signInWithGoogle();
    if (err) setGeneralError(err.message);
  }

  const change = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  if (confirmationEmail) {
    return (
      <section
        aria-label="Registration confirmation"
        style={{
          minHeight: 'calc(100vh - 60px)',
          display: 'grid',
          placeItems: 'center',
          padding: space[8],
        }}
      >
        <div style={{ width: '100%', maxWidth: 440, textAlign: 'center' }}>
          <MixhiveWordmark height={26} color={colors.text.primary} />
          <h1 style={{ color: colors.text.primary, fontSize: display.sm, marginTop: space[10] }}>
            {t('checkEmailTitle')}
          </h1>
          <p style={{ color: colors.text.secondary, lineHeight: 1.6 }}>
            {t.rich('checkEmailBody', {
              email: confirmationEmail,
              bold: chunks => <strong>{chunks}</strong>,
            })}
          </p>
          <Link to="/login" style={{ color: colors.accent }}>
            {t('backToSignInPlain')}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="auth-shell" style={{ display: 'flex', minHeight: 'calc(100vh - 60px)' }}>
      <style>{`@media (max-width: 900px){ .auth-left{ display:none !important; } .auth-right{ flex: 1 1 100% !important; } }`}</style>

      {/* Left — brand / value */}
      <aside
        className="auth-left"
        style={{
          flex: '1 1 46%',
          padding: `${space[14]}px ${space[12]}px`,
          background: `${gradient.meshTop}, ${gradient.meshBottom}, ${colors.bg}`,
          borderRight: `1px solid ${colors.border}`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: space[10],
        }}
      >
        <MixhiveWordmark height={26} color={colors.text.primary} />
        <h1
          style={{
            fontFamily: 'var(--font-display, system-ui)',
            fontSize: display.md,
            lineHeight: 1.04,
            color: colors.text.primary,
            textTransform: 'uppercase',
            margin: 0,
          }}
        >
          Join the
          <br />
          underground.
        </h1>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: space[6] }}>
          {valueProps.map(v => (
            <li
              key={v}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: space[5],
                color: colors.text.secondary,
                fontSize: fontSize.md,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: colors.accent,
                  flex: 'none',
                }}
              />
              {v}
            </li>
          ))}
        </ul>
        <p style={{ color: colors.text.dim, fontSize: fontSize.sm, margin: 0 }}>
          Built for DJs, producers and the people who power culture from the underground up.
        </p>
      </aside>

      {/* Right — form */}
      <section
        aria-label="Create your account"
        className="auth-right"
        style={{
          flex: '1 1 54%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: `${space[11]}px ${space[8]}px`,
        }}
      >
        <div style={{ width: '100%', maxWidth: 400 }}>
          <h2
            style={{
              fontSize: fontSize['2xl'],
              fontWeight: fontWeight.bold,
              color: colors.text.primary,
              margin: 0,
            }}
          >
            {t('signUpTitle')}
          </h2>
          <p
            style={{
              fontSize: fontSize.sm,
              color: colors.text.dim,
              marginTop: space[2],
              marginBottom: space[9],
            }}
          >
            Free to join. No card required.
          </p>

          {generalError && (
            <div
              style={{
                background: colors.dangerBg,
                color: colors.danger,
                padding: `${space[5]}px ${space[7]}px`,
                borderRadius: radius.lg,
                fontSize: fontSize.base,
                marginBottom: space[8],
              }}
            >
              {generalError}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogle}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: space[5],
              padding: `${space[6]}px ${space[8]}px`,
              borderRadius: radius.lg,
              background: colors.text.primary,
              color: colors.surfaceRaised,
              border: 'none',
              fontSize: fontSize.md,
              fontWeight: fontWeight.semibold,
              cursor: 'pointer',
            }}
          >
            <GoogleMark /> Continue with Google
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: space[6],
              margin: `${space[8]}px 0`,
              color: colors.text.faint,
              fontSize: fontSize.sm,
            }}
          >
            <div style={{ flex: 1, height: 1, background: colors.border }} /> {tc('or')}{' '}
            <div style={{ flex: 1, height: 1, background: colors.border }} />
          </div>

          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: space[7] }}
          >
            <Input
              type="text"
              autoComplete="username"
              label={t('username')}
              hideLabel
              placeholder={t('username')}
              value={formData.username}
              onChange={e => change('username', e.target.value)}
              error={errors.username}
              help={t('usernameHelp')}
            />
            <Input
              type="email"
              autoComplete="email"
              label={t('email')}
              hideLabel
              placeholder={t('email')}
              value={formData.email}
              onChange={e => change('email', e.target.value)}
              error={errors.email}
            />
            <Input
              type="password"
              autoComplete="new-password"
              label={t('password')}
              hideLabel
              placeholder={t('password')}
              value={formData.password}
              onChange={e => change('password', e.target.value)}
              error={errors.password}
              help={t('passwordHelp')}
            />
            <Input
              type="text"
              autoComplete="name"
              label={t('displayName')}
              hideLabel
              placeholder={t('displayName')}
              value={formData.display_name}
              onChange={e => change('display_name', e.target.value)}
              error={errors.display_name}
            />
            <p style={{ color: colors.text.faint, fontSize: fontSize.xs, margin: 0 }}>
              {t.rich('termsAgree', {
                terms: chunks => (
                  <Link to="/terms" style={{ color: colors.text.dim }}>
                    {chunks}
                  </Link>
                ),
                privacy: chunks => (
                  <Link to="/privacy" style={{ color: colors.text.dim }}>
                    {chunks}
                  </Link>
                ),
              })}
            </p>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
              style={{ width: '100%', marginTop: space[2] }}
            >
              {submitting ? t('creatingAccount') : t('signUpButton')}
            </Button>
          </form>

          <p
            style={{
              textAlign: 'center',
              marginTop: space[10],
              color: colors.text.dim,
              fontSize: fontSize.base,
            }}
          >
            {t('haveAccount')}{' '}
            <Link
              to="/login"
              style={{
                color: colors.accent,
                textDecoration: 'none',
                fontWeight: fontWeight.semibold,
              }}
            >
              {t('signInButton')}
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
