import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';
import { colors, radius, fontWeight, transition, buttonSize } from '../../styles/tokens';

/**
 * Utility button — the sober tier. Use this for forms, dialogs, settings, and
 * app chrome: anything that is an action rather than a *moment*. Rectangular
 * (radius.md), solid fills, sentence-case labels, no motion. For primary brand
 * moments — the landing hero, a modal's headline CTA — reach for
 * `hive/HiveButton` instead, which shares this size scale but adds the honey
 * gradient, pill shape and animation.
 */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children?: ReactNode;
}

// Fixed height from the shared scale (see buttonSize in tokens).
const sizes: Record<Size, CSSProperties> = {
  sm: { ...buttonSize.sm },
  md: { ...buttonSize.md },
  lg: { ...buttonSize.lg },
};

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
  success: {
    background: colors.successStrong,
    color: colors.black,
    border: 'none',
    fontWeight: fontWeight.bold,
  },
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading,
    fullWidth,
    leftIcon,
    rightIcon,
    disabled,
    style,
    children,
    ...rest
  },
  ref
) {
  const isDisabled = disabled || loading;
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
        <span
          role="status"
          aria-label="Loading"
          style={{
            display: 'inline-block',
            width: 12,
            height: 12,
            border: `2px solid currentColor`,
            borderRightColor: 'transparent',
            borderRadius: '50%',
            animation: 'mixhive-spin 0.7s linear infinite',
          }}
        />
      ) : (
        leftIcon
      )}
      <span>{children}</span>
      {rightIcon}
      <style>{`@keyframes mixhive-spin { to { transform: rotate(360deg); } }`}</style>
    </button>
  );
});
