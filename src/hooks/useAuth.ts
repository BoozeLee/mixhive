import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';

const missingConfigError = {
  message:
    'Supabase is not configured. Add Supabase public URL and anon key environment variables to enable authentication.',
};

function getAuthRedirectTo() {
  if (typeof window === 'undefined') return undefined;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
  return `${baseUrl}/auth/callback`;
}

export function needsOnboarding(profile: Profile | null): boolean {
  return !!profile && profile.onboarding_complete === false;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  // Prevents setState on unmounted component — eliminates race conditions and memory leaks
  const isMounted = useRef(true);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    // PGRST116 = "no rows found" — expected for brand-new OAuth users, not an error
    if (error && error.code !== 'PGRST116') {
      console.error('[useAuth] fetchProfile error', error);
    }
    if (data && isMounted.current) setProfile(data);
  };

  useEffect(() => {
    isMounted.current = true;

    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Initial session check — guard against unmount before promise resolves
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted.current) return;
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted.current) return;
      setUser(session?.user ?? null);

      if (session?.user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profileData) {
          if (isMounted.current) setProfile(profileData);
        } else {
          // Upsert (not insert) to safely handle concurrent auth events from the same user
          const metadata = session.user.user_metadata ?? {};
          const newProfile = {
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
          };

          const { data: upserted, error: upsertErr } = await supabase
            .from('profiles')
            .upsert(newProfile, { onConflict: 'id', ignoreDuplicates: false })
            .select()
            .single();

          if (upsertErr) console.error('[useAuth] profile upsert error', upsertErr);
          if (upserted && isMounted.current) setProfile(upserted);
        }
      } else {
        if (isMounted.current) setProfile(null);
      }
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
      redirectTo: `${(process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : ''))}/auth/reset-password`,
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
