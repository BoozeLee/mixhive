import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useAuth } from '../hooks/useAuth';
import { BeeMark } from './brand/BeeMark';
import { needsOnboarding } from '../lib/authRouting';

export function ProtectedRoute({
  children,
  allowIncompleteProfile = false,
}: {
  children: React.ReactNode;
  allowIncompleteProfile?: boolean;
}) {
  const { user, profile, loading } = useAuth();
  const t = useTranslations('protectedRoute');

  if (loading)
    return (
      <div
        role="status"
        aria-label={t('loadingLabel')}
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '70vh',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <motion.div
          animate={{
            filter: [
              'drop-shadow(0 0 6px rgba(246,196,0,0.25))',
              'drop-shadow(0 0 20px rgba(246,196,0,0.6))',
              'drop-shadow(0 0 6px rgba(246,196,0,0.25))',
            ],
            scale: [1, 1.06, 1],
          }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <BeeMark size={48} color="#f6c400" />
        </motion.div>
        <div
          style={{
            color: 'var(--hive-muted, #a9a390)',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          {t('enteringTheHive')}
        </div>
      </div>
    );

  if (!user) return <Navigate to="/login" replace />;
  if (!allowIncompleteProfile && needsOnboarding(profile)) {
    return <Navigate to="/setup" replace />;
  }

  return <>{children}</>;
}
