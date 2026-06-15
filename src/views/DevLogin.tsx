import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { signInWithMock } from '../lib/mockAuth';

export function DevLogin() {
  const t = useTranslations('devLogin');
  const [loading, setLoading] = useState(false);

  const handleDevLogin = async () => {
    setLoading(true);
    try {
      const result = await signInWithMock();
      // Mock auth doesn't return error, just check if user exists
      if (result.user) {
        // Redirect to home or refresh the page
        window.location.href = '/';
      }
    } catch (err) {
      console.error('Login failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">{t('mixhive')}</h1>
          <p className="text-gray-300">{t('demoMode')}</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleDevLogin}
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold py-3 px-6 rounded-lg hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
          >
            {loading ? 'Loading...' : '🎮 Enter Demo Mode'}
          </button>

          <div className="text-center text-gray-400 text-sm">
            <p>🔧 This is a development mode for testing</p>
            <p className="mt-2">{t('noRealAuthenticationRequired')}</p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/20">
          <p className="text-gray-400 text-xs text-center">{t('forProductionUseConfigure')}</p>
        </div>
      </div>
    </div>
  );
}
