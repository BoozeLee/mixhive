import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';

const missingConfigError = {
  message:
    'Supabase is not configured. Add Supabase public URL and anon key environment variables to enable authentication.',
};

function getAuthRedirectTo() {
  if (typeof window === 'undefined') return undefined;

  // Prefer explicit env var for production, fallback to current origin
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

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) setProfile(data);
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);

      if (session?.user) {
        // Fetch or create profile (important for Google OAuth users)
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profileData) {
          setProfile(profileData);
        } else {
          // Fallback profile creation for OAuth users
          const metadata = session.user.user_metadata || {};
          const newProfile = {
            id: session.user.id,
            username:
              metadata.preferred_username ||
              metadata.user_name ||
              `user_${session.user.id.slice(0, 8)}`,
            display_name:
              metadata.full_name || metadata.name || session.user.email?.split('@')[0] || 'User',
            avatar_url: metadata.avatar_url || metadata.picture,
          };

          const { data: created } = await supabase
            .from('profiles')
            .insert(newProfile)
            .select()
            .single();
          if (created) setProfile(created);
        }
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
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
        data: metadata,
        emailRedirectTo: getAuthRedirectTo(),
      },
    });
  }

  async function signInWithGoogle() {
    if (!isSupabaseConfigured) return { error: missingConfigError };
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getAuthRedirectTo() },
    });
  }

  async function resetPasswordForEmail(email: string) {
    if (!isSupabaseConfigured) return { error: missingConfigError };
    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
  }

  async function updatePassword(newPassword: string) {
    if (!isSupabaseConfigured) return { error: missingConfigError };
    return supabase.auth.updateUser({ password: newPassword });
  }

  async function signOut() {
    if (!isSupabaseConfigured) return;
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }

  async function updateProfile(updates: Partial<Profile>) {
    if (!isSupabaseConfigured || !user) return;
    await supabase.from('profiles').update(updates).eq('id', user.id);
    setProfile(prev => (prev ? { ...prev, ...updates } : null));
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
