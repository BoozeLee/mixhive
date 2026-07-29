import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { colors, fontSize, fontWeight, radius, space, transition } from '../../styles/tokens';
import { SkeletonBar } from '../Skeleton';

interface DiscoverLaneProps {
  title: string;
  subtitle?: string;
  href?: string;
  hrefLabel?: string;
  loading?: boolean;
  error?: boolean;
  skeletonCount?: number;
  skeletonWidth?: number;
  children: React.ReactNode;
}

export function DiscoverLane({
  title,
  subtitle,
  href,
  hrefLabel,
  loading,
  error,
  skeletonCount = 4,
  skeletonWidth = 200,
  children,
}: DiscoverLaneProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scroll(direction: 'left' | 'right') {
    const el = scrollRef.current;
    if (!el) return;
    const amount = direction === 'left' ? -el.clientWidth * 0.75 : el.clientWidth * 0.75;
    el.scrollBy({ left: amount, behavior: 'smooth' });
  }

  return (
    <section style={{ marginBottom: space[12] }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: space[4],
          marginBottom: space[6],
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h2
            style={{
              fontSize: fontSize.xl,
              fontWeight: fontWeight.bold,
              color: colors.text.primary,
              margin: 0,
              fontFamily: 'var(--font-display, system-ui)',
              letterSpacing: '0.01em',
            }}
          >
            {title}
          </h2>
          {subtitle && (
            <p
              style={{
                fontSize: fontSize.sm,
                color: colors.text.dim,
                margin: `${space[1]}px 0 0`,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: space[3], flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: space[2] }}>
            <ScrollButton direction="left" onClick={() => scroll('left')} />
            <ScrollButton direction="right" onClick={() => scroll('right')} />
          </div>
          {href && hrefLabel && (
            <Link
              to={href}
              style={{
                fontSize: fontSize.sm,
                color: colors.accentMuted,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                fontWeight: fontWeight.semibold,
              }}
            >
              {hrefLabel} →
            </Link>
          )}
        </div>
      </div>

      {loading ? (
        <div
          style={{
            display: 'flex',
            gap: space[5],
            overflowX: 'auto',
            paddingBottom: space[2],
          }}
        >
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <SkeletonBar
              key={i}
              width={skeletonWidth}
              height={skeletonWidth}
              style={{ flexShrink: 0, borderRadius: radius.lg }}
            />
          ))}
        </div>
      ) : error ? (
        <p
          style={{
            color: colors.text.faint,
            fontSize: fontSize.sm,
            padding: `${space[6]}px 0`,
            textAlign: 'center',
          }}
        >
          This section is temporarily unavailable.
        </p>
      ) : !children || (Array.isArray(children) && children.length === 0) ? null : (
        <div
          ref={scrollRef}
          style={{
            display: 'flex',
            gap: space[5],
            overflowX: 'auto',
            paddingBottom: space[2],
            scrollSnapType: 'x mandatory',
            scrollbarWidth: 'thin',
            msOverflowStyle: 'auto',
          }}
        >
          {children}
        </div>
      )}
    </section>
  );
}

function ScrollButton({
  direction,
  onClick,
}: {
  direction: 'left' | 'right';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === 'left' ? 'Scroll left' : 'Scroll right'}
      style={{
        width: 28,
        height: 28,
        borderRadius: radius.full,
        border: `1px solid ${colors.borderStrong}`,
        background: colors.surface,
        color: colors.text.muted,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: `border-color ${transition.fast}, color ${transition.fast}`,
        lineHeight: 0,
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = colors.accentMuted;
        e.currentTarget.style.color = colors.accent;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = colors.borderStrong;
        e.currentTarget.style.color = colors.text.muted;
      }}
    >
      {direction === 'left' ? '‹' : '›'}
    </button>
  );
}
