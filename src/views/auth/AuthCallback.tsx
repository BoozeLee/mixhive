'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth'; // Consolidated to main auth hook
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export function AuthCallback() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  useEffect(() => {
    // Handle OAuth callback and redirect
    const handleAuthCallback = async () => {
      // Extract token from URL if present
      const token = searchParams.get('access_token');
      const error = searchParams.get('error');

      if (error) {
        console.error('Auth error:', error);
        // Redirect to login with error message
        window.location.href = '/auth/login?error=auth_failed';
        return;
      }

      if (token) {
        // Store the token (this should be handled by Supabase auth automatically)
        localStorage.setItem('supabase_auth_token', token);
      }

      // Check if user needs to complete profile setup
      if (user && !user.user_metadata?.profile_complete) {
        window.location.href = '/profile/create';
      } else {
        window.location.href = '/feed';
      }
    };

    handleAuthCallback();
  }, [searchParams, user]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-400">Completing authentication...</p>
      </div>
    </div>
  );
}
