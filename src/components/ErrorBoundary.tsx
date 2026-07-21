import { Component, type ErrorInfo, type ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';
import { colors } from '../styles/tokens';

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

    // Technical details (raw message, stack, copy button) are dev-only — in
    // production users see a friendly message while Sentry receives the details.
    const showDetails = process.env.NODE_ENV === 'development';

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
            background: colors.surface,
            border: `1px solid ${colors.dangerBg}`,
            borderRadius: 10,
            padding: '32px 24px',
            color: colors.text.primary,
          }}
        >
          <div
            aria-hidden="true"
            style={{
              fontSize: 36,
              color: colors.danger,
              marginBottom: 8,
            }}
          >
            !
          </div>
          <h1 style={{ margin: '0 0 8px', fontSize: 20 }}>{t('somethingWentWrong')}</h1>
          <p
            style={{ color: colors.text.dimmed, fontSize: 14, lineHeight: 1.5, margin: '0 0 20px' }}
          >
            We hit an unexpected error rendering this part of the page. You can try again, or head
            back to the feed.
          </p>

          {showDetails && (
            <>
              <div
                style={{
                  textAlign: 'left',
                  fontSize: 12,
                  color: colors.danger,
                  background: colors.dangerBgDeep,
                  padding: 12,
                  borderRadius: 6,
                  margin: '0 0 16px',
                  border: `1px solid ${colors.dangerBg}`,
                  wordBreak: 'break-word',
                }}
              >
                <strong>{t('error')}</strong> {error.message}
              </div>

              {error.stack && (
                <details style={{ marginBottom: 16 }}>
                  <summary style={{ cursor: 'pointer', color: colors.text.muted, fontSize: 12 }}>
                    {t('showStackTraceClick')}
                  </summary>
                  <pre
                    style={{
                      textAlign: 'left',
                      fontSize: 10,
                      color: colors.text.muted,
                      background: colors.bg,
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
                  navigator.clipboard
                    ?.writeText(text)
                    .then(() => {
                      alert('Error details copied to clipboard');
                    })
                    .catch(() => {
                      // fallback
                      prompt('Copy this error:', text);
                    });
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: 4,
                  background: 'transparent',
                  color: colors.text.secondary,
                  border: `1px solid ${colors.borderStrong}`,
                  fontSize: 12,
                  cursor: 'pointer',
                  marginBottom: 16,
                }}
              >
                {t('copyErrorDetails')}
              </button>
            </>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button
              onClick={this.reset}
              style={{
                padding: '8px 18px',
                borderRadius: 6,
                background: colors.accent,
                color: colors.bg,
                border: 'none',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              {t('tryAgain')}
            </button>
            <a
              href="/feed"
              style={{
                padding: '8px 18px',
                borderRadius: 6,
                background: 'transparent',
                color: colors.text.secondary,
                border: `1px solid ${colors.borderStrong}`,
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              {t('backToFeed')}
            </a>
          </div>
        </div>
      </div>
    );
  }
}
