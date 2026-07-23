import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { colors, buttonSize } from '../../styles/tokens';

/**
 * Brand-CTA button — the flamboyant tier. Use this for primary *moments*: the
 * landing hero, a modal's headline action, a session's call to start. Honey
 * gradient, pill shape, uppercase, and a hover animation (three honey droplets;
 * respects prefers-reduced-motion). For ordinary actions — form submits, filter
 * toggles, list-row buttons — use the sober `ui/Button`, which shares this size
 * scale so the two tiers line up but stays rectangular and quiet.
 */
type Variant = 'primary' | 'ghost' | 'glass' | 'danger';
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

// Shared scale, applied as a min-height because the brand button may wrap on
// narrow screens; padding and label size come straight from the token.
const sizeStyle: Record<Size, React.CSSProperties> = {
  sm: { padding: buttonSize.sm.padding, fontSize: buttonSize.sm.fontSize, minHeight: buttonSize.sm.height },
  md: { padding: buttonSize.md.padding, fontSize: buttonSize.md.fontSize, minHeight: buttonSize.md.height },
  lg: { padding: buttonSize.lg.padding, fontSize: buttonSize.lg.fontSize, minHeight: buttonSize.lg.height },
};

const variantStyle: Record<Variant, React.CSSProperties> = {
  primary: {
    background: `linear-gradient(135deg, var(--hive-gold-hot, ${colors.accentBrightest}) 0%, var(--hive-gold, ${colors.accentBright}) 55%, var(--hive-amber, ${colors.accentAmber}) 100%)`,
    color: `var(--hive-black, ${colors.black})`,
    border: '1px solid transparent',
    boxShadow: '0 0 0 1px rgba(255,216,74,0.4) inset, 0 8px 24px rgba(246,196,0,0.25)',
  },
  ghost: {
    background: 'transparent',
    color: `var(--hive-gold, ${colors.accentBright})`,
    border: '1px solid var(--hive-line, rgba(246,196,0,0.28))',
  },
  glass: {
    background: 'var(--hive-panel, rgba(7,7,5,0.78))',
    color: `var(--hive-text, ${colors.hiveText})`,
    border: '1px solid var(--hive-line, rgba(246,196,0,0.28))',
    backdropFilter: 'blur(8px)',
  },
  danger: {
    background: 'rgba(255,82,82,0.12)',
    color: `var(--hive-danger, ${colors.danger})`,
    border: '1px solid rgba(255,82,82,0.5)',
  },
};

/**
 * MIXHIVE primary CTA. Honey-gradient fill, three honey droplets drop from the
 * bottom edge on hover via Framer Motion. Respects prefers-reduced-motion.
 */
export const HiveButton = forwardRef<HTMLButtonElement, Props>(function HiveButton(
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
      ) : (
        leftIcon
      )}
      <span style={{ position: 'relative', zIndex: 1 }}>{children}</span>
      {rightIcon}

      {/* Honey droplets — CSS keeps SVG attributes stable during route changes. */}
      {variant === 'primary' && !isDisabled && (
        <svg
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
            <circle
              key={cx}
              className="hive-button__droplet"
              cx={cx}
              cy="2"
              r={2}
              fill={`var(--hive-gold, ${colors.accentBright})`}
              style={{ animationDelay: `${i * 70}ms` }}
            />
          ))}
        </svg>
      )}

      <style>{`
        @keyframes mixhive-spin { to { transform: rotate(360deg); } }
        @keyframes mixhive-drip {
          0%, 100% { opacity: 0; transform: translateY(0); }
          28% { opacity: 0.85; }
          86% { opacity: 0; transform: translateY(10px); }
        }
        .hive-button__droplet { opacity: 0; transform-box: fill-box; transform-origin: center; }
        button:hover .hive-button__droplet,
        button:focus-visible .hive-button__droplet { animation: mixhive-drip 550ms ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          button:hover .hive-button__droplet,
          button:focus-visible .hive-button__droplet { animation: none; }
        }
      `}</style>
    </motion.button>
  );
});
