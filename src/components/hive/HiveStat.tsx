import { colors } from '../../styles/tokens';
interface Props {
  label: string;
  value: string | number;
  /** Percentage change vs previous window. Renders ▲ / ▼ accent. */
  delta?: number;
  /** Tiny inline sparkline series (0..1 values). 8–24 points works well. */
  sparkline?: number[];
  icon?: string;
}

function format(value: string | number): string {
  if (typeof value === 'string') return value;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

/**
 * Big-numeric stat card. Used for the "12.7K MIXES" strip on landing.
 * Number renders in the mono font, label in UI font. Delta + sparkline
 * are decorative for now.
 */
export function HiveStat({ label, value, delta, sparkline, icon }: Props) {
  const deltaSign = delta == null ? null : delta >= 0 ? '▲' : '▼';
  const deltaColor =
    delta == null
      ? undefined
      : delta >= 0
        ? `var(--hive-success, ${colors.successBright})`
        : `var(--hive-danger, ${colors.danger})`;

  return (
    <div style={{ padding: '6px 12px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {icon && (
        <div
          aria-hidden="true"
          style={{
            color: `var(--hive-gold, ${colors.accentBright})`,
            fontSize: 22,
            lineHeight: 1,
            filter: 'drop-shadow(0 0 6px rgba(246,196,0,0.4))',
          }}
        >
          {icon}
        </div>
      )}
      <div
        style={{
          fontFamily: 'var(--font-mono, "JetBrains Mono"), ui-monospace, monospace',
          fontSize: 28,
          fontWeight: 700,
          color: `var(--hive-text, ${colors.hiveText})`,
          letterSpacing: '0.02em',
          lineHeight: 1,
        }}
      >
        {format(value)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            color: `var(--hive-muted, ${colors.text.dimmed})`,
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          {label}
        </span>
        {deltaSign && (
          <span style={{ color: deltaColor, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
            {deltaSign} {Math.abs(delta!).toFixed(1)}%
          </span>
        )}
      </div>
      {sparkline && sparkline.length > 1 && <Sparkline values={sparkline} />}
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const w = 100;
  const h = 24;
  const step = w / Math.max(1, values.length - 1);
  const path = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${h - (v / max) * h}`)
    .join(' ');

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: 18, marginTop: 4 }}
    >
      <path
        d={path}
        fill="none"
        stroke={`var(--hive-gold, ${colors.accentBright})`}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ filter: 'drop-shadow(0 0 3px rgba(246,196,0,0.5))' }}
      />
    </svg>
  );
}
