import { colors, fontSize, fontWeight } from '../styles/tokens';

interface Props {
  size?: 'sm' | 'md';
}

export function FoundingMemberBadge({ size = 'md' }: Props) {
  const isSm = size === 'sm';
  return (
    <span
      title="Founding Member"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isSm ? 3 : 5,
        padding: isSm ? '2px 6px' : '3px 9px',
        borderRadius: 999,
        background: `linear-gradient(135deg, ${colors.accent}22, ${colors.accent}44)`,
        border: `1px solid ${colors.accent}66`,
        fontSize: isSm ? 10 : fontSize.xs,
        fontWeight: fontWeight.semibold,
        color: colors.accent,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: isSm ? 10 : 12 }}>
        ⬡
      </span>
      {!isSm && 'Founding Member'}
    </span>
  );
}
