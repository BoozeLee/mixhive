import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { colors, radius, fontSize, fontWeight, transition } from '../../styles/tokens'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  help?: ReactNode
  error?: string | undefined
  /** Hide the label visually but keep it accessible to screen readers. */
  hideLabel?: boolean
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, help, error, hideLabel, id, style, disabled, ...rest },
  ref,
) {
  const reactId = useId()
  const inputId = id || reactId
  const helpId = help ? `${inputId}-help` : undefined
  const errorId = error ? `${inputId}-error` : undefined
  const describedBy = [errorId, helpId].filter(Boolean).join(' ') || undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label
          htmlFor={inputId}
          style={
            hideLabel
              ? { position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }
              : { color: colors.text.secondary, fontSize: fontSize.sm, fontWeight: fontWeight.medium }
          }
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        disabled={disabled}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy}
        style={{
          background: colors.bg,
          border: `1px solid ${error ? colors.danger : colors.borderStrong}`,
          borderRadius: radius.md,
          padding: '8px 12px',
          color: colors.text.primary,
          fontSize: fontSize.md,
          fontFamily: 'inherit',
          outline: 'none',
          transition: `border-color ${transition.base}, box-shadow ${transition.base}`,
          opacity: disabled ? 0.55 : 1,
          ...style,
        }}
        onFocus={e => {
          e.currentTarget.style.borderColor = error ? colors.danger : colors.accent
          e.currentTarget.style.boxShadow = `0 0 0 3px ${error ? colors.dangerBg : colors.accentFaint}`
          rest.onFocus?.(e)
        }}
        onBlur={e => {
          e.currentTarget.style.borderColor = error ? colors.danger : colors.borderStrong
          e.currentTarget.style.boxShadow = 'none'
          rest.onBlur?.(e)
        }}
        {...rest}
      />
      {help && !error && (
        <span id={helpId} style={{ color: colors.text.dim, fontSize: fontSize.xs }}>
          {help}
        </span>
      )}
      {error && (
        <span id={errorId} role="alert" style={{ color: colors.danger, fontSize: fontSize.xs }}>
          {error}
        </span>
      )}
    </div>
  )
})
