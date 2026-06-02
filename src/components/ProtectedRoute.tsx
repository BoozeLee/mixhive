import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading)
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '60vh',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ color: '#f0c040', fontSize: 18, fontWeight: 600 }}>MixHive</div>
        <div style={{ color: '#888', fontSize: 14 }}>Checking your session...</div>
      </div>
    );

  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
