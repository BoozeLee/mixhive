import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';
export { needsOnboarding } from '../lib/authRouting';

const missingConfigError = {
  message:
    'Supabase is not configured. Add Supabase public URL and anon key environment variables to enable authentication.',
};

function getAuthRedirectTo() {
  if (typeof window === 'undefined') return undefined;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
  return `${baseUrl}/auth/callback`;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  // Prevents setState on unmounted component — eliminates race conditions and memory leaks
  const isMounted = useRef(true);

  const resolveProfile = async (authUser: User): Promise<Profile | null> => {
    const { data: existing, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();
    if (error) {
      console.error('[useAuth] fetchProfile error', error);
      return null;
    }
    if (existing) return existing;

    const metadata = authUser.user_metadata ?? {};
    const newProfile = {
      id: authUser.id,
      username:
        metadata.preferred_username || metadata.user_name || `user_${authUser.id.slice(0, 8)}`,
      display_name: metadata.full_name || metadata.name || authUser.email?.split('@')[0] || 'User',
      avatar_url: metadata.avatar_url || metadata.picture || null,
    };
    const { data: upserted, error: upsertErr } = await supabase
      .from('profiles')
      .upsert(newProfile, { onConflict: 'id', ignoreDuplicates: false })
      .select()
      .single();
    if (upsertErr) {
      console.error('[useAuth] profile upsert error', upsertErr);
      return null;
    }
    return upserted;
  };

  useEffect(() => {
    isMounted.current = true;

    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Initial session check — guard against unmount before promise resolves
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted.current) return;
      setUser(session?.user ?? null);
      const resolvedProfile = session?.user ? await resolveProfile(session.user) : null;
      if (isMounted.current) {
        setProfile(resolvedProfile);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted.current) return;
      // getSession() above owns the initial load. Supabase warns against awaiting
      // other client calls inside this callback because it can deadlock auth.
      if (event === 'INITIAL_SESSION') return;
      setLoading(true);
      setUser(session?.user ?? null);

      if (!session?.user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const authUser = session.user;
      setTimeout(() => {
        resolveProfile(authUser).then(resolvedProfile => {
          if (!isMounted.current) return;
          setProfile(resolvedProfile);
          setLoading(false);
        });
      }, 0);
    });

    return () => {
      isMounted.current = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signInWithEmail(email: string, password: string) {
    if (!isSupabaseConfigured) return { error: missingConfigError };
    return supabase.auth.signInWithPassword({ email, password });
  }

  async function signUpWithEmail(
    email: string,
    password: string,
    metadata?: Record<string, string>
  ) {
    if (!isSupabaseConfigured) return { error: missingConfigError };
    return supabase.auth.signUp({
      email,
      password,
      options: {
        ...(metadata ? { data: metadata } : {}),
        ...(getAuthRedirectTo() ? { emailRedirectTo: getAuthRedirectTo()! } : {}),
      },
    });
  }

  async function signInWithGoogle() {
    if (!isSupabaseConfigured) return { error: missingConfigError };
    const redirectTo = getAuthRedirectTo();
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { ...(redirectTo ? { redirectTo } : {}) },
    });
  }

  async function resetPasswordForEmail(email: string) {
    if (!isSupabaseConfigured) return { error: missingConfigError };
    // Use getAuthRedirectTo() so dev/prod redirect URLs are always consistent
    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '')}/auth/reset-password`,
    });
  }

  async function updatePassword(newPassword: string) {
    if (!isSupabaseConfigured) return { error: missingConfigError };
    return supabase.auth.updateUser({ password: newPassword });
  }

  async function signOut() {
    if (!isSupabaseConfigured) return;
    await supabase.auth.signOut();
    if (isMounted.current) {
      setUser(null);
      setProfile(null);
    }
  }

  async function updateProfile(updates: Partial<Profile>): Promise<{ error: Error | null }> {
    if (!isSupabaseConfigured || !user) return { error: new Error('Not authenticated') };
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    if (!error && isMounted.current) {
      setProfile(prev => (prev ? { ...prev, ...updates } : null));
    }
    return { error: error ?? null };
  }

  return {
    user,
    profile,
    loading,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    resetPasswordForEmail,
    updatePassword,
    signOut,
    updateProfile,
  };
}
