import type { ReactNode } from 'react';
import { GlowText } from './GlowText';

interface Props {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: 'left' | 'center';
  titleVariant?: 'gradient' | 'neon' | 'plain';
  maxWidth?: number;
}

/**
 * Standard premium section header: small gold eyebrow label, big display
 * headline (GlowText), and optional muted subcopy. Used across all redesigned
 * sections for a consistent rhythm.
 */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = 'left',
  titleVariant = 'gradient',
  maxWidth,
}: Props) {
  return (
    <div
      style={{
        textAlign: align,
        marginLeft: align === 'center' ? 'auto' : undefined,
        marginRight: align === 'center' ? 'auto' : undefined,
        maxWidth: maxWidth ?? (align === 'center' ? 680 : undefined),
      }}
    >
      {eyebrow && (
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--hive-gold, #f6c400)',
            fontFamily: 'var(--font-mono, monospace)',
            marginBottom: 14,
          }}
        >
          {eyebrow}
        </div>
      )}
      <GlowText
        as="h2"
        variant={titleVariant}
        style={{
          display: 'block',
          fontFamily: 'var(--font-display, system-ui)',
          fontWeight: 800,
          fontSize: 'clamp(28px, 4.5vw, 52px)',
          lineHeight: 1.05,
          letterSpacing: '-0.02em',
          margin: 0,
        }}
      >
        {title}
      </GlowText>
      {subtitle && (
        <p
          style={{
            color: 'var(--hive-text-soft, #d4cdb0)',
            fontSize: 'clamp(15px, 1.6vw, 18px)',
            lineHeight: 1.6,
            margin: '18px 0 0',
            maxWidth: align === 'center' ? 620 : 560,
            marginLeft: align === 'center' ? 'auto' : undefined,
            marginRight: align === 'center' ? 'auto' : undefined,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
