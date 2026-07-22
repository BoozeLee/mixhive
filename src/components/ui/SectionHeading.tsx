import type { ReactNode } from 'react';
import { GlowText } from './GlowText';
import { colors } from '../../styles/tokens';

interface Props {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: 'left' | 'center';
  titleVariant?: 'gradient' | 'neon' | 'plain';
  maxWidth?: number;
  /**
   * Heading level. Defaults to h2 because this is usually a *section* heading.
   *
   * Pass `as="h1"` when it is the page's main heading — several routes rendered
   * no h1 at all because this was hard-coded, which costs both document outline
   * and assistive-tech navigation. A page should carry exactly one h1.
   */
  as?: 'h1' | 'h2' | 'h3';
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
  as = 'h2',
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
            color: `var(--hive-gold, ${colors.accentBright})`,
            fontFamily: 'var(--font-mono, monospace)',
            marginBottom: 14,
          }}
        >
          {eyebrow}
        </div>
      )}
      <GlowText
        as={as}
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
            color: `var(--hive-text-soft, ${colors.text.secondary})`,
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
