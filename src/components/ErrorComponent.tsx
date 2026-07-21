import React from 'react';
import { useTranslations } from 'next-intl';
import { colors, space, radius } from '../styles/tokens';
import { Icon } from './ui/Icon';

interface ErrorComponentProps {
  error?: string | Error | null;
  message?: string;
  onRetry?: () => void;
  retryText?: string;
  fullPage?: boolean;
  action?: React.ReactNode;
}

export function ErrorComponent({
  error,
  message,
  onRetry,
  retryText,
  fullPage = false,
  action,
}: ErrorComponentProps) {
  const t = useTranslations('errorComponent');
  const errorMessage = error instanceof Error ? error.message : error;

  const content = (
    <div
      style={{
        textAlign: 'center',
        padding: space[8],
        color: colors.text.muted,
      }}
    >
      {/* Registry icon rather than an emoji literal. The previous ⚠️ carried a
          VARIATION SELECTOR-16 (U+FE0F), which forces emoji presentation and
          renders as a blank box on any system without a colour-emoji font — in
          the shared error component, i.e. the fallback UI for every view. */}
      <div
        aria-hidden="true"
        style={{
          marginBottom: space[4],
          color: colors.danger,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Icon name="alert" size={48} strokeWidth={1.5} />
      </div>
      <h2
        style={{
          fontSize: 20,
          fontWeight: 600,
          color: colors.text.primary,
          marginBottom: space[3],
          lineHeight: 1.4,
        }}
      >
        {message || t('somethingWentWrong')}
      </h2>

      {errorMessage && process.env.NODE_ENV === 'development' && (
        <pre
          style={{
            textAlign: 'left',
            fontSize: 12,
            color: colors.text.secondary,
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: space[4],
            overflow: 'auto',
            maxHeight: 200,
            marginBottom: space[4],
            whiteSpace: 'pre-wrap',
          }}
        >
          {errorMessage}
        </pre>
      )}

      <div
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: space[3] }}
      >
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              padding: `${space[2]} ${space[4]}`,
              background: colors.accent,
              color: colors.bg,
              border: 'none',
              borderRadius: radius.pill,
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseOver={e => {
              e.currentTarget.style.background = colors.accentHover;
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = colors.accent;
            }}
            onFocus={e => {
              e.currentTarget.style.background = colors.accentHover;
            }}
            onBlur={e => {
              e.currentTarget.style.background = colors.accent;
            }}
          >
            {retryText || t('tryAgain')}
          </button>
        )}

        {action}
      </div>
    </div>
  );

  if (fullPage) {
    return (
      <div
        style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {content}
      </div>
    );
  }

  return content;
}

// Network Error Component
export function NetworkError({ onRetry }: { onRetry?: () => void }) {
  const t = useTranslations('errorComponent');
  return (
    <ErrorComponent
      error="Network Error"
      message={t('unableToConnect')}
      onRetry={onRetry}
      retryText={t('retry')}
      fullPage={true}
    />
  );
}

// Empty State Component
// NOTE: empty-state + 404 live in EmptyState.tsx (canonical: `EmptyState` +
// `NotFoundState`). The duplicate `EmptyState`/`NotFound` that used to live here
// were unused and were removed (P4 de-dup). This file keeps the error kit only.

// Permission Error Component
export function PermissionError({ onLogin }: { onLogin?: () => void }) {
  const t = useTranslations('errorComponent');
  return (
    <ErrorComponent
      error="Access Denied"
      message={t('accessDenied')}
      action={
        onLogin && (
          <button
            onClick={onLogin}
            style={{
              padding: `${space[2]} ${space[4]}`,
              background: colors.accent,
              color: colors.bg,
              border: 'none',
              borderRadius: radius.pill,
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {t('signIn')}
          </button>
        )
      }
      fullPage={true}
    />
  );
}
