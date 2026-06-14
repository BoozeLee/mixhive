import type { CSSProperties, ReactNode, ElementType } from 'react';
import { colors } from '../../styles/tokens';

interface Props {
  children: ReactNode;
  as?: ElementType;
  /** Visual treatment. */
  variant?: 'gradient' | 'neon' | 'plain';
  className?: string;
  style?: CSSProperties;
}

/**
 * Headline text with a premium gold treatment:
 *  - gradient: gold→white clipped gradient fill (cinematic headlines)
 *  - neon: solid gold with layered text-shadow glow
 *  - plain: brand gold, no glow
 */
export function GlowText({
  children,
  as: Tag = 'span',
  variant = 'gradient',
  className,
  style,
}: Props) {
  const variantStyle: CSSProperties =
    variant === 'gradient'
      ? {
          background: `linear-gradient(120deg, ${colors.white} 18%, ${colors.accentBrightest} 55%, ${colors.accentBright} 100%)`,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          color: 'transparent',
        }
      : variant === 'neon'
        ? {
            color: colors.accentBrightest,
            textShadow:
              '0 0 8px rgba(246,196,0,0.55), 0 0 22px rgba(246,196,0,0.35), 0 0 48px rgba(246,196,0,0.18)',
          }
        : { color: `var(--hive-gold, ${colors.accentBright})` };

  return (
    <Tag className={className} style={{ ...variantStyle, ...style }}>
      {children}
    </Tag>
  );
}
