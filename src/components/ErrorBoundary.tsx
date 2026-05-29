import { Component, type ErrorInfo, type ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

function reportToObservability(error: Error, info: ErrorInfo) {
  if (process.env.NODE_ENV === 'development') {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }
  Sentry.captureException(error, {
    contexts: { react: { componentStack: info.componentStack } },
  });
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportToObservability(error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div
        role="alert"
        style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 480,
            textAlign: 'center',
            background: '#111',
            border: '1px solid #2a1010',
            borderRadius: 10,
            padding: '32px 24px',
            color: '#eee',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              fontSize: 36,
              color: '#f55',
              marginBottom: 8,
            }}
          >
            !
          </div>
          <h1 style={{ margin: '0 0 8px', fontSize: 20 }}>Something went wrong</h1>
          <p style={{ color: '#999', fontSize: 14, lineHeight: 1.5, margin: '0 0 20px' }}>
            We hit an unexpected error rendering this part of the page. You can try again, or head
            back to the feed.
          </p>

          {/* Always show the actual error in production for remote debugging */}
          <div
            style={{
              textAlign: 'left',
              fontSize: 12,
              color: '#ff9999',
              background: '#1a0a0a',
              padding: 12,
              borderRadius: 6,
              margin: '0 0 16px',
              border: '1px solid #3a1010',
              wordBreak: 'break-word',
            }}
          >
            <strong>Error:</strong> {error.message}
          </div>

          {error.stack && (
            <details style={{ marginBottom: 16 }}>
              <summary style={{ cursor: 'pointer', color: '#888', fontSize: 12 }}>
                Show stack trace (click to expand)
              </summary>
              <pre
                style={{
                  textAlign: 'left',
                  fontSize: 10,
                  color: '#888',
                  background: '#0a0a0a',
                  padding: 8,
                  borderRadius: 4,
                  overflow: 'auto',
                  maxHeight: 160,
                  marginTop: 8,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {error.stack}
              </pre>
            </details>
          )}

          <button
            onClick={() => {
              const text = `Error: ${error.message}\n\n${error.stack || ''}`;
              navigator.clipboard?.writeText(text).then(() => {
                alert('Error details copied to clipboard');
              }).catch(() => {
                // fallback
                prompt('Copy this error:', text);
              });
            }}
            style={{
              padding: '6px 12px',
              borderRadius: 4,
              background: 'transparent',
              color: '#ccc',
              border: '1px solid #444',
              fontSize: 12,
              cursor: 'pointer',
              marginBottom: 16,
            }}
          >
            Copy error details
          </button>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button
              onClick={this.reset}
              style={{
                padding: '8px 18px',
                borderRadius: 6,
                background: '#f0c040',
                color: '#0a0a0a',
                border: 'none',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <a
              href="/feed"
              style={{
                padding: '8px 18px',
                borderRadius: 6,
                background: 'transparent',
                color: '#ccc',
                border: '1px solid #333',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Back to feed
            </a>
          </div>
        </div>
      </div>
    );
  }
}
