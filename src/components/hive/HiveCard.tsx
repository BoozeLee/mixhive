import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { colors } from '../../styles/tokens';

type Tone = 'panel' | 'glow' | 'flat';

interface Props extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  interactive?: boolean;
  children?: ReactNode;
}

const toneStyle: Record<Tone, React.CSSProperties> = {
  panel: {
    background: 'var(--hive-panel, rgba(7,7,5,0.78))',
    border: '1px solid var(--hive-line, rgba(246,196,0,0.28))',
    boxShadow:
      '0 12px 36px rgba(0,0,0,0.45), 0 0 0 1px var(--hive-line-soft, rgba(246,196,0,0.12)) inset',
  },
  glow: {
    background: 'linear-gradient(180deg, rgba(246,196,0,0.06) 0%, rgba(7,7,5,0.92) 100%)',
    border: `1px solid var(--hive-gold, ${colors.accentBright})`,
    boxShadow: 'var(--shadow-honey, 0 0 24px rgba(246,196,0,0.35))',
  },
  flat: {
    background: 'transparent',
    border: '1px solid var(--hive-line-soft, rgba(246,196,0,0.12))',
    boxShadow: 'none',
  },
};

/**
 * Brand panel — hex-edged glass surface with optional gold glow.
 * `interactive` enables a subtle scale + border-glow on hover.
 */
export const HiveCard = forwardRef<HTMLDivElement, Props>(function HiveCard(
  { tone = 'panel', interactive, style, children, ...rest },
  ref
) {
  const baseStyle: React.CSSProperties = {
    position: 'relative',
    borderRadius: 18,
    padding: 20,
    color: `var(--hive-text, ${colors.hiveText})`,
    transition: 'border-color 240ms ease, box-shadow 240ms ease, transform 240ms ease',
    ...toneStyle[tone],
    ...style,
  };

  if (!interactive) {
    return (
      <div ref={ref} style={baseStyle} {...rest}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      style={baseStyle}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = `var(--hive-gold, ${colors.accentBright})`;
        e.currentTarget.style.boxShadow =
          'var(--shadow-honey-strong, 0 0 36px rgba(246,196,0,0.35), 0 0 8px var(--hive-gold))';
      }}
      onMouseLeave={e => {
        Object.assign(e.currentTarget.style, toneStyle[tone]);
      }}
      {...(rest as React.ComponentProps<typeof motion.div>)}
    >
      {children}
    </motion.div>
  );
});
