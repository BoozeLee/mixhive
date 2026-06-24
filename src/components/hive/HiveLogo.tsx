import { ImageWithFallback } from '../../lib/assetUrl';
import { colors } from '../../styles/tokens';

type Variant = 'horizontal' | 'stacked' | 'icon';
type Size = 'sm' | 'md' | 'lg' | 'hero';

const sizes: Record<Size, { mark: number; text: number; gap: number }> = {
  sm: { mark: 28, text: 14, gap: 8 },
  md: { mark: 40, text: 18, gap: 10 },
  lg: { mark: 64, text: 28, gap: 14 },
  hero: { mark: 128, text: 48, gap: 18 },
};

interface Props {
  variant?: Variant;
  size?: Size;
  className?: string;
}

/**
 * MIXHIVE crown-M wordmark. Uses the refined ComfyUI asset at
 * /art/logo-crown-m@2x.png when present, falls back to public/mixhive.png.
 * `variant="icon"` renders just the mark, no wordmark text.
 */
export function HiveLogo({ variant = 'horizontal', size = 'md', className }: Props) {
  const s = sizes[size];
  const showText = variant !== 'icon';
  const stacked = variant === 'stacked';

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        flexDirection: stacked ? 'column' : 'row',
        alignItems: 'center',
        gap: s.gap,
      }}
    >
      <ImageWithFallback
        asset="logo-crown-m"
        alt="MIXHIVE"
        width={s.mark}
        height={s.mark}
        style={{
          width: s.mark,
          height: s.mark,
          objectFit: 'contain',
          filter: 'drop-shadow(0 0 24px var(--hive-glow, rgba(246,196,0,0.35)))',
        }}
      />
      {showText && (
        <span
          aria-hidden="true"
          style={{
            fontFamily: 'var(--font-display, "Permanent Marker"), system-ui, sans-serif',
            fontSize: s.text,
            fontWeight: 400,
            letterSpacing: stacked ? '0.04em' : '0.02em',
            color: 'var(--hive-gold, ' + colors.accentBright + ')',
            textShadow: '0 0 18px rgba(246,196,0,0.4)',
            lineHeight: 1,
          }}
        >
          MIXHIVE
        </span>
      )}
    </div>
  );
}
