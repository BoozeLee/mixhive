import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
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
          setError(errorDescription || `OAuth error: ${errorParam}`);
          return;
        }

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error('Code exchange error:', exchangeError);
            setError(exchangeError.message);
            return;
          }
        }

        // Wait a moment for session to be established (especially important for Google OAuth)
        await new Promise(resolve => setTimeout(resolve, 300));

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Session error after OAuth:', sessionError);
          setError(sessionError.message);
          return;
        }

        if (session?.user) {
          // Ensure profile exists (defense in depth for Google signups)
          try {
            const { data: existingProfile } = await supabase
              .from('profiles')
              .select('id')
              .eq('id', session.user.id)
              .maybeSingle();

            if (!existingProfile) {
              // Create minimal profile for Google users if trigger missed
              const metadata = session.user.user_metadata || {};
              await supabase.from('profiles').insert({
                id: session.user.id,
                username: metadata.preferred_username || 
                         metadata.user_name || 
                         `user_${session.user.id.slice(0, 8)}`,
                display_name: metadata.full_name || metadata.name || session.user.email?.split('@')[0],
                avatar_url: metadata.avatar_url || metadata.picture,
              });
            }
          } catch (profileErr) {
            console.warn('Profile creation during OAuth callback (non-fatal):', profileErr);
          }

          navigate('/feed', { replace: true });
          return;
        }

        setError('Authentication failed. Try signing in again.');
      } catch (err: any) {
        console.error('Unexpected error in AuthCallback:', err);
        setError(err.message || 'An unexpected error occurred during sign in.');
      }
    }

    completeAuth();
  }, [navigate]);

  if (error) {
    return (
      <div
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
        <p style={{ color: '#f55', fontSize: 14, marginBottom: 16 }}>{error}</p>
        <a href="/login" style={{ color: '#f0c040', fontSize: 14 }}>
          Back to sign in
        </a>
      </div>
    );
  }

  return (
    <div
      style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#f0c040', fontSize: 14, marginBottom: 8 }}>Completing sign in...</div>
        <div style={{ color: '#555', fontSize: 12 }}>Redirecting you to the feed</div>
      </div>
    </div>
  );
}
