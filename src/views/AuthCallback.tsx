import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useNavigate } from 'react-router-dom';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { getPostAuthDestination } from '../lib/authRouting';
import type { Profile } from '../lib/types';
import { colors } from '../styles/tokens';

export function AuthCallback() {
  const t = useTranslations('authCallback');
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    if (!isSupabaseConfigured) {
      setError(
        'Supabase is not configured. Add Supabase public URL and anon key environment variables, then try signing in again.'
      );
      return;
    }

    async function completeAuth() {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const errorParam = params.get('error');
        const errorDescription = params.get('error_description');

        if (errorParam) {
          if (isMounted.current) setError(errorDescription || `Auth error: ${errorParam}`);
          return;
        }

        if (code) {
          // PKCE flow — exchange the code. The SDK stores the session immediately on success.
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error('[AuthCallback] code exchange error:', exchangeError);
            if (isMounted.current) setError(exchangeError.message);
            return;
          }
          // Session is guaranteed to be in storage after a successful exchange — no delay needed.
        }

        // Hash-fragment OAuth (#access_token=...) is handled automatically by detectSessionInUrl.
        // For both paths, getSession() now returns the active session immediately.
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('[AuthCallback] session error:', sessionError);
          if (isMounted.current) setError(sessionError.message);
          return;
        }

        if (session?.user) {
          // Defence-in-depth: ensure profile exists (the onAuthStateChange in useAuth handles
          // this too, but doing it here guarantees it for Google signups with slow DB triggers).
          let profile: Profile | null = null;
          try {
            const { data: existing } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle();

            if (existing) {
              profile = existing;
            } else {
              const metadata = session.user.user_metadata ?? {};
              const { data: created, error: createError } = await supabase
                .from('profiles')
                .upsert(
                  {
                    id: session.user.id,
                    username:
                      metadata.preferred_username ||
                      metadata.user_name ||
                      `user_${session.user.id.slice(0, 8)}`,
                    display_name:
                      metadata.full_name ||
                      metadata.name ||
                      session.user.email?.split('@')[0] ||
                      'User',
                    avatar_url: metadata.avatar_url || metadata.picture || null,
                  },
                  { onConflict: 'id', ignoreDuplicates: false }
                )
                .select()
                .single();
              if (createError) throw createError;
              profile = created;
            }
          } catch (profileErr) {
            // Profile creation is non-fatal — useAuth will retry on next render
            console.warn('[AuthCallback] profile upsert (non-fatal):', profileErr);
          }

          if (isMounted.current) navigate(getPostAuthDestination(profile), { replace: true });
          return;
        }

        // No code, no hash token, no session — the link was invalid or already used
        if (isMounted.current) {
          setError('This sign-in link has expired or is invalid. Please try signing in again.');
        }
      } catch (err: unknown) {
        console.error('[AuthCallback] unexpected error:', err);
        if (isMounted.current) {
          setError(
            err instanceof Error ? err.message : 'An unexpected error occurred during sign in.'
          );
        }
      }
    }

    completeAuth();

    return () => {
      isMounted.current = false;
    };
  }, [navigate]);

  if (error) {
    return (
      <div
        role="alert"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <p style={{ color: colors.danger, fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
          {error}
        </p>
        <a href="/login" style={{ color: colors.accent, fontSize: 14, textDecoration: 'none' }}>
          {t('backToSignIn')}
        </a>
      </div>
    );
  }

  return (
    <div
      style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: colors.accent, fontSize: 14, marginBottom: 8 }}>
          {t('completingSignIn')}
        </div>
        <div style={{ color: colors.text.faintest, fontSize: 12 }}>
          {t('preparingYourMixhiveProfile')}
        </div>
      </div>
    </div>
  );
}
