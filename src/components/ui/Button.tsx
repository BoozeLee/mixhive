import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react'
import { colors, radius, fontSize, fontWeight, transition } from '../../styles/tokens'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: Variant
  size?: Size
  loading?: boolean
  fullWidth?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  children?: ReactNode
}

const sizes: Record<Size, CSSProperties> = {
  sm: { padding: '6px 12px', fontSize: fontSize.sm, height: 28 },
  md: { padding: '8px 18px', fontSize: fontSize.md, height: 36 },
  lg: { padding: '12px 22px', fontSize: fontSize.lg, height: 44 },
}

const variants: Record<Variant, CSSProperties> = {
  primary: {
    background: colors.accent,
    color: colors.bg,
    border: 'none',
    fontWeight: fontWeight.bold,
  },
  secondary: {
    background: colors.surface,
    color: colors.text.primary,
    border: `1px solid ${colors.borderStrong}`,
    fontWeight: fontWeight.semibold,
  },
  ghost: {
    background: 'transparent',
    color: colors.text.secondary,
    border: '1px solid transparent',
    fontWeight: fontWeight.medium,
  },
  danger: {
    background: colors.dangerBg,
    color: colors.danger,
    border: `1px solid ${colors.danger}`,
    fontWeight: fontWeight.semibold,
  },
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', loading, fullWidth, leftIcon, rightIcon, disabled, style, children, ...rest },
  ref,
) {
  const isDisabled = disabled || loading
  return (
    <button
      ref={ref}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: radius.md,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.55 : 1,
        transition: `background ${transition.base}, opacity ${transition.fast}, border-color ${transition.base}`,
        width: fullWidth ? '100%' : undefined,
        whiteSpace: 'nowrap',
        ...sizes[size],
        ...variants[variant],
        ...style,
      }}
      {...rest}
    >
      {loading ? (
        <span aria-hidden="true" style={{ display: 'inline-block', width: 12, height: 12, border: `2px solid currentColor`, borderRightColor: 'transparent', borderRadius: '50%', animation: 'mixhive-spin 0.7s linear infinite' }} />
      ) : leftIcon}
      <span>{children}</span>
      {rightIcon}
      <style>{`@keyframes mixhive-spin { to { transform: rotate(360deg); } }`}</style>
    </button>
  )
})
