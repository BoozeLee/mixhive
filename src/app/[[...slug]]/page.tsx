'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { colors } from '@/styles/tokens';

const MixHiveClient = dynamic(() => import('../../MixHiveClient'), {
  ssr: false,
  loading: () => (
    <main className="hive-boot">
      <div className="hive-boot__mark">MIXHIVE</div>
      <div className="hive-boot__scan" />
    </main>
  ),
});

function AppLoader() {
  const [loadError, setLoadError] = useState<Error | null>(null);

  useEffect(() => {
    // Preload the main client chunk and surface any loading failure
    import('../../MixHiveClient').catch(err => {
      console.error('Failed to load MixHiveClient chunk:', err);
      setLoadError(err instanceof Error ? err : new Error(String(err)));
    });
  }, []);

  if (loadError) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
          color: '#f6c400',
          fontFamily: 'system-ui, sans-serif',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, marginBottom: 16 }}>MIXHIVE failed to load</h1>
          <p style={{ opacity: 0.8, marginBottom: 24, maxWidth: 420 }}>
            The main application chunk could not be loaded. This usually means a JavaScript error
            during initialization or a network issue fetching the app bundle.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: colors.accentBright,
              color: colors.bg,
              border: 'none',
              padding: '12px 24px',
              borderRadius: 6,
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 15,
            }}
          >
            Reload Page
          </button>
          <div style={{ marginTop: 32, fontSize: 12, opacity: 0.6 }}>
            If this persists, open the browser console (F12) and send us the red errors.
          </div>
        </div>
      </main>
    );
  }

  return <MixHiveClient />;
}

export default function Page() {
  return <AppLoader />;
}
