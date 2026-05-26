import React from 'react'
import { colors, space } from '../styles/tokens'

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large'
  message?: string
  overlay?: boolean
  className?: string
}

export function LoadingSpinner({ 
  size = 'medium', 
  message = 'Loading...', 
  overlay = false,
  className = ''
}: LoadingSpinnerProps) {
  const sizeStyles = {
    small: { width: 16, height: 16, strokeWidth: 2 },
    medium: { width: 24, height: 24, strokeWidth: 3 },
    large: { width: 40, height: 40, strokeWidth: 4 }
  }

  const currentSize = sizeStyles[size]
  
  const spinner = (
    <svg
      className={className}
      width={currentSize.width}
      height={currentSize.height}
      viewBox="0 0 24 24"
      fill="none"
      style={{
        animation: 'spin 1s linear infinite',
      }}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke={colors.border}
        strokeWidth="2"
        fill="none"
        opacity="0.3"
      />
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke={colors.accent}
        strokeWidth={currentSize.strokeWidth}
        fill="none"
        strokeDasharray="31.416"
        strokeDashoffset="31.416"
        strokeLinecap="round"
      >
        <animate
          attributeName="stroke-dashoffset"
          values="31.416;0;31.416"
          dur="1.5s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  )

  if (overlay) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(10, 10, 10, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          {spinner}
          {message && (
            <p style={{ 
              marginTop: space[4], 
              color: colors.text.muted, 
              fontSize: 14 
            }}>
              {message}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: space[6],
      minHeight: 200,
    }}>
      {spinner}
      {message && (
        <p style={{ 
          marginTop: space[3], 
          color: colors.text.muted, 
          fontSize: 14 
        }}>
          {message}
        </p>
      )}
    </div>
  )
}

// Page level loading component
export function PageLoading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <LoadingSpinner size="large" message={message} />
    </div>
  )
}

// Button loading component
interface ButtonLoadingProps {
  loading: boolean
  children: React.ReactNode
  disabled?: boolean
}

export function ButtonLoading({ loading, children, disabled }: ButtonLoadingProps) {
  return (
    <button
      disabled={loading || disabled}
      style={{
        position: 'relative',
        minWidth: 120,
        padding: '10px 20px',
        background: loading || disabled ? colors.surface : colors.accent,
        color: loading || disabled ? colors.text.muted : colors.bg,
        border: 'none',
        borderRadius: 8,
        fontWeight: 600,
        fontSize: 14,
        cursor: loading || disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space[2],
        transition: 'all 0.2s',
      }}
    >
      {loading && (
        <LoadingSpinner size="small" />
      )}
      {children}
    </button>
  )
}

// Content loading state
interface ContentLoadingProps {
  count?: number
  skeleton?: React.ReactNode
  message?: string
}

export function ContentLoading({ count = 3, skeleton, message }: ContentLoadingProps) {
  const defaultSkeleton = (
    <div style={{
      display: 'flex',
      gap: space[4],
      padding: space[4],
      background: colors.surface,
      borderRadius: 10,
      border: `1px solid ${colors.border}`,
    }}>
      <div style={{
        width: 80,
        height: 80,
        background: colors.surfaceHover,
        borderRadius: 8,
        flexShrink: 0,
        animation: 'pulse 2s infinite',
      }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: space[2] }}>
        <div style={{
          height: 16,
          background: colors.surfaceHover,
          borderRadius: 4,
          animation: 'pulse 2s infinite',
        }} />
        <div style={{
          height: 14,
          width: '70%',
          background: colors.surfaceHover,
          borderRadius: 4,
          animation: 'pulse 2s infinite',
        }} />
        <div style={{
          height: 12,
          width: '50%',
          background: colors.surfaceHover,
          borderRadius: 4,
          animation: 'pulse 2s infinite',
        }} />
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          {skeleton || defaultSkeleton}
        </div>
      ))}
      {message && (
        <p style={{ 
          textAlign: 'center', 
          color: colors.text.muted, 
          fontSize: 14,
          marginTop: space[4]
        }}>
          {message}
        </p>
      )}
    </div>
  )
}

// Add the spin animation to global CSS
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `
  document.head.appendChild(style)
}