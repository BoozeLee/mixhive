import React from 'react'
import { colors, space, radius } from '../styles/tokens'

interface ErrorComponentProps {
  error?: string | Error | null
  message?: string
  onRetry?: () => void
  retryText?: string
  fullPage?: boolean
  action?: React.ReactNode
}

export function ErrorComponent({
  error,
  message = 'Something went wrong',
  onRetry,
  retryText = 'Try Again',
  fullPage = false,
  action
}: ErrorComponentProps) {
  const errorMessage = error instanceof Error ? error.message : error

  const content = (
    <div style={{
      textAlign: 'center',
      padding: space[8],
      color: colors.text.muted,
    }}>
      <div
        aria-hidden="true"
        style={{
          fontSize: 48,
          marginBottom: space[4],
          color: '#f55',
        }}
      >
        ⚠️
      </div>
      <h2 style={{ 
        fontSize: 20, 
        fontWeight: 600, 
        color: colors.text.primary,
        marginBottom: space[3],
        lineHeight: 1.4 
      }}>
        {message}
      </h2>
      
      {errorMessage && import.meta.env.DEV && (
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

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: space[3] }}>
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
            onMouseOver={(e) => {
              e.currentTarget.style.background = colors.accentHover
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = colors.accent
            }}
            onFocus={(e) => {
              e.currentTarget.style.background = colors.accentHover
            }}
            onBlur={(e) => {
              e.currentTarget.style.background = colors.accent
            }}
          >
            {retryText}
          </button>
        )}
        
        {action && action}
      </div>
    </div>
  )

  if (fullPage) {
    return (
      <div style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {content}
      </div>
    )
  }

  return content
}

// Network Error Component
export function NetworkError({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorComponent
      error="Network Error"
      message="Unable to connect to the server. Please check your internet connection."
      onRetry={onRetry}
      retryText="Retry"
      fullPage={true}
    />
  )
}

// Empty State Component
interface EmptyStateProps {
  title: string
  description?: string
  action?: React.ReactNode
  icon?: React.ReactNode
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div style={{
      textAlign: 'center',
      padding: space[8],
      color: colors.text.muted,
    }}>
      {icon && (
        <div style={{ marginBottom: space[4], fontSize: 48 }}>
          {icon}
        </div>
      )}
      <h3 style={{ 
        fontSize: 18, 
        fontWeight: 600, 
        color: colors.text.primary,
        marginBottom: space[2],
      }}>
        {title}
      </h3>
      {description && (
        <p style={{ 
          fontSize: 14, 
          lineHeight: 1.5, 
          marginBottom: space[4],
          color: colors.text.secondary,
        }}>
          {description}
        </p>
      )}
      {action && action}
    </div>
  )
}

// 404 Component
export function NotFound({ onHome }: { onHome?: () => void }) {
  return (
    <ErrorComponent
      error="404 - Not Found"
      message="The page you're looking for doesn't exist."
      action={onHome && (
        <button
          onClick={onHome}
          style={{
            padding: `${space[2]} ${space[4]}`,
            background: colors.surface,
            color: colors.text.primary,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.pill,
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            textDecoration: 'none',
          }}
        >
          Go Home
        </button>
      )}
      fullPage={true}
    />
  )
}

// Permission Error Component
export function PermissionError({ onLogin }: { onLogin?: () => void }) {
  return (
    <ErrorComponent
      error="Access Denied"
      message="You need to be logged in to access this content."
      action={onLogin && (
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
          Sign In
        </button>
      )}
      fullPage={true}
    />
  )
}
