import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { BeeMark } from './brand/BeeMark';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading)
    return (
      <div
        id="main-content"
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
          Entering the hive…
        </div>
      </div>
    );

  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
