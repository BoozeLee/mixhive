'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[MixHive] App error boundary caught:', error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: '100svh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
        padding: '0 24px',
      }}
    >
      <div
        style={{
          maxWidth: 440,
          width: '100%',
          textAlign: 'center',
          padding: '40px 32px',
          background: 'rgba(7,7,5,0.78)',
          border: '1px solid rgba(246,196,0,0.28)',
          borderRadius: 18,
          boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 72,
            height: 72,
            margin: '0 auto 20px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(255,82,82,0.18), rgba(10,10,10,0.9))',
            border: '1px solid rgba(255,82,82,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
          }}
        >
          ⚡
        </div>
        <h1
          style={{
            margin: '0 0 10px',
            fontSize: 22,
            fontWeight: 900,
            color: '#eee',
            textTransform: 'uppercase',
            letterSpacing: '-0.01em',
          }}
        >
          Something went wrong
        </h1>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: '#888', lineHeight: 1.6 }}>
          A disturbance in the hive. The bees are investigating.
        </p>

        {process.env.NODE_ENV === 'development' && error.message && (
          <details
            style={{
              marginBottom: 20,
              textAlign: 'left',
              background: '#1a1010',
              border: '1px solid #f5525244',
              borderRadius: 6,
              padding: '10px 14px',
            }}
          >
            <summary style={{ fontSize: 12, color: '#f55', cursor: 'pointer', fontWeight: 600 }}>
              Error details
            </summary>
            <pre
              style={{
                margin: '8px 0 0',
                fontSize: 11,
                color: '#f88',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                lineHeight: 1.5,
              }}
            >
              {error.message}
              {error.digest && `\nDigest: ${error.digest}`}
            </pre>
          </details>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={reset}
            className="hive-button"
            style={{ fontSize: 13, padding: '0 22px', minHeight: 40 }}
          >
            Try again
          </button>
          <Link
            href="/feed"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: 40,
              padding: '0 18px',
              borderRadius: 7,
              border: '1px solid rgba(246,196,0,0.28)',
              color: '#f0c040',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Back to feed
          </Link>
        </div>
      </div>
    </main>
  );
}
