import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { colors } from '../styles/tokens';
import { signInWithMock } from '../lib/mockAuth';

export function DevLogin() {
  const t = useTranslations('devLogin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDevLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithMock();
      if (result.user) {
        window.location.href = '/';
      }
    } catch (err) {
      setError(t('loginFailed'));
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
          {error && (
            <div
              style={{
                background: colors.dangerBg,
                color: colors.danger,
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          <button
            onClick={handleDevLogin}
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold py-3 px-6 rounded-lg hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
          >
            {loading ? t('loading') : t('enterDemoMode')}
          </button>

          <div className="text-center text-gray-400 text-sm">
            <p>{t('devModeTesting')}</p>
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
