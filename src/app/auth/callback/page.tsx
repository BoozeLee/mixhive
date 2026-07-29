'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { colors } from '@/styles/tokens';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get('error');
    if (oauthError) {
      setError(params.get('error_description') ?? `OAuth error: ${oauthError}`);
      return;
    }

    const next = params.get('next') ?? '/feed';
    let redirected = false;
    const redirect = () => {
      if (!redirected) {
        redirected = true;
        router.replace(next);
      }
    };

    // Implicit flow: Google/Supabase returns tokens in the hash fragment.
    // The module-level supabase singleton may have been created during SSR
    // where window is unavailable, so detectSessionInUrl never fires.
    // Explicitly parse the hash and call setSession.
    const hash = window.location.hash;
    if (hash.includes('access_token=')) {
      const hp = new URLSearchParams(hash.replace(/^#/, ''));
      const accessToken = hp.get('access_token');
      const refreshToken = hp.get('refresh_token') ?? '';
      if (accessToken) {
        supabase.auth
          .setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(({ error: setErr }) => {
            if (setErr) setError(setErr.message);
            else redirect();
          });
        return;
      }
    }

    // PKCE / code flow: session may already be set by detectSessionInUrl.
    supabase.auth.getSession().then(({ data: { session }, error: sessionError }) => {
      if (sessionError) {
        setError(sessionError.message);
        return;
      }
      if (session) {
        redirect();
        return;
      }

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, newSession) => {
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && newSession) {
          subscription.unsubscribe();
          redirect();
        } else if (event === 'SIGNED_OUT') {
          subscription.unsubscribe();
          setError('Sign in failed. Please try again.');
        }
      });

      const timeout = setTimeout(() => {
        subscription.unsubscribe();
        setError('Sign in timed out. Please try again.');
      }, 10_000);

      return () => {
        clearTimeout(timeout);
        subscription.unsubscribe();
      };
    });
  }, [router]);

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          minHeight: '100svh',
          alignItems: 'center',
          justifyContent: 'center',
          background: colors.bg,
          color: colors.text.primary,
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 400, padding: '0 24px' }}>
          <p style={{ color: colors.danger, fontSize: 14, marginBottom: 16 }}>{error}</p>
          <a href="/login" style={{ color: colors.accent, fontSize: 14 }}>
            Back to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100svh',
        alignItems: 'center',
        justifyContent: 'center',
        background: colors.bg,
        color: colors.text.primary,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: colors.accent, marginBottom: 8 }}>
          MixHive
        </div>
        <p style={{ color: colors.text.muted, fontSize: 13 }}>Completing sign in…</p>
      </div>
    </div>
  );
}
