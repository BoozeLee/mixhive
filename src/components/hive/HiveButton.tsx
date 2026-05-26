import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { motion } from 'framer-motion'

type Variant = 'primary' | 'ghost' | 'glass' | 'danger'
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

const sizeStyle: Record<Size, React.CSSProperties> = {
  sm: { padding: '6px 14px', fontSize: 12, minHeight: 30 },
  md: { padding: '10px 20px', fontSize: 14, minHeight: 38 },
  lg: { padding: '14px 28px', fontSize: 16, minHeight: 48 },
}

const variantStyle: Record<Variant, React.CSSProperties> = {
  primary: {
    background:
      'linear-gradient(135deg, var(--hive-gold-hot, #ffd84a) 0%, var(--hive-gold, #f6c400) 55%, var(--hive-amber, #ff8c1a) 100%)',
    color: 'var(--hive-black, #030303)',
    border: '1px solid transparent',
    boxShadow:
      '0 0 0 1px rgba(255,216,74,0.4) inset, 0 8px 24px rgba(246,196,0,0.25)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--hive-gold, #f6c400)',
    border: '1px solid var(--hive-line, rgba(246,196,0,0.28))',
  },
  glass: {
    background: 'var(--hive-panel, rgba(7,7,5,0.78))',
    color: 'var(--hive-text, #f5f3e7)',
    border: '1px solid var(--hive-line, rgba(246,196,0,0.28))',
    backdropFilter: 'blur(8px)',
  },
  danger: {
    background: 'rgba(255,82,82,0.12)',
    color: 'var(--hive-danger, #ff5252)',
    border: '1px solid rgba(255,82,82,0.5)',
  },
}

/**
 * MIXHIVE primary CTA. Honey-gradient fill, three honey droplets drop from the
 * bottom edge on hover via Framer Motion. Respects prefers-reduced-motion.
 */
export const HiveButton = forwardRef<HTMLButtonElement, Props>(function HiveButton(
  { variant = 'primary', size = 'md', loading, fullWidth, leftIcon, rightIcon, disabled, style, children, ...rest },
  ref,
) {
  const isDisabled = disabled || loading

  return (
    <motion.button
      ref={ref}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      whileHover={!isDisabled ? { scale: 1.02 } : undefined}
      whileTap={!isDisabled ? { scale: 0.98 } : undefined}
      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
      initial="rest"
      animate="rest"
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        fontFamily: 'var(--font-ui, "Space Grotesk"), system-ui, sans-serif',
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        borderRadius: 999,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.55 : 1,
        width: fullWidth ? '100%' : undefined,
        overflow: 'visible',
        whiteSpace: 'nowrap',
        ...sizeStyle[size],
        ...variantStyle[variant],
        ...style,
      }}
      {...(rest as React.ComponentProps<typeof motion.button>)}
    >
      {loading ? (
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: 12,
            height: 12,
            border: '2px solid currentColor',
            borderRightColor: 'transparent',
            borderRadius: '50%',
            animation: 'mixhive-spin 0.7s linear infinite',
          }}
        />
      ) : leftIcon}
      <span style={{ position: 'relative', zIndex: 1 }}>{children}</span>
      {rightIcon}

      {/* Honey droplets — appear on hover, fall down ~12px, fade out */}
      {variant === 'primary' && !isDisabled && (
        <motion.svg
          aria-hidden="true"
          width="60"
          height="14"
          viewBox="0 0 60 14"
          style={{
            position: 'absolute',
            left: '50%',
            bottom: -4,
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
          }}
        >
          {[10, 30, 50].map((cx, i) => (
            <motion.circle
              key={cx}
              cx={cx}
              cy={0}
              r={2}
              fill="var(--hive-gold, #f6c400)"
              variants={{
                rest:  { cy: 0,  opacity: 0 },
                hover: { cy: 10, opacity: [0, 0.85, 0] },
              }}
              animate="rest"
              whileHover="hover"
              transition={{ duration: 0.55, delay: i * 0.07 }}
            />
          ))}
        </motion.svg>
      )}

      <style>{`@keyframes mixhive-spin { to { transform: rotate(360deg); } }`}</style>
    </motion.button>
  )
})
