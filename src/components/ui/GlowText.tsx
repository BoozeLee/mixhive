import type { CSSProperties, ReactNode, ElementType } from 'react';

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
export function GlowText({ children, as: Tag = 'span', variant = 'gradient', className, style }: Props) {
  const variantStyle: CSSProperties =
    variant === 'gradient'
      ? {
          background: 'linear-gradient(120deg, #fff 18%, #ffd84a 55%, #f6c400 100%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          color: 'transparent',
        }
      : variant === 'neon'
        ? {
            color: '#ffd84a',
            textShadow:
              '0 0 8px rgba(246,196,0,0.55), 0 0 22px rgba(246,196,0,0.35), 0 0 48px rgba(246,196,0,0.18)',
          }
        : { color: 'var(--hive-gold, #f6c400)' };

  return (
    <Tag className={className} style={{ ...variantStyle, ...style }}>
      {children}
    </Tag>
  );
}
