'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { useSupabase } from './supabase-provider';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { supabase, user, loading } = useSupabase();
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    setAuthLoading(loading);
  }, [loading]);

  const signIn = async (email: string, password: string) => {
    if (!supabase) return;
    setAuthLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    setAuthLoading(false);
  };

  const signUp = async (email: string, password: string) => {
    if (!supabase) return;
    setAuthLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    setAuthLoading(false);
  };

  const signOut = async () => {
    if (!supabase) return;
    setAuthLoading(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    setAuthLoading(false);
  };

  const isAuthenticated = !!user && !authLoading;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading: authLoading,
        signIn,
        signUp,
        signOut,
        isAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
