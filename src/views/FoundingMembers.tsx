import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  getFoundingMemberCount,
  getFoundingMembers,
  FOUNDING_CAP,
  type FoundingMember,
} from '../lib/api';
import { LevelBadge } from '../components/LevelBadge';
import { FoundingMemberBadge } from '../components/FoundingMemberBadge';
import { EmptyState } from '../components/EmptyState';
import { SkeletonBar } from '../components/Skeleton';
import { colors, gradient, radius, space, fontSize, fontWeight } from '../styles/tokens';

/** The fixed founding bonus granted by the redeem_invite RPC (migration 105). */
const FOUNDING_XP = 500;

/**
 * The First-50 "adoption ritual" surface. Turns the silent invite redemption
 * into a visible moment of scarcity + belonging: a live "N of 50 claimed" meter,
 * the founding cohort, and a celebratory welcome banner right after a redeem
 * (reached via /founding?welcome=1).
 */
export function FoundingMembers() {
  const [searchParams] = useSearchParams();
  const showWelcome = searchParams.get('welcome') === '1';

  const [count, setCount] = useState<number | null>(null);
  const [members, setMembers] = useState<FoundingMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getFoundingMemberCount(), getFoundingMembers(FOUNDING_CAP)])
      .then(([c, rows]) => {
        if (!cancelled) {
          setCount(c);
          setMembers(rows);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const claimed = count ?? 0;
  const remaining = Math.max(0, FOUNDING_CAP - claimed);
  const full = claimed >= FOUNDING_CAP;
  const pct = useMemo(
    () => Math.min(100, Math.round((claimed / FOUNDING_CAP) * 100)),
    [claimed]
  );

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px 12px 96px' }}>
      {showWelcome && (
        <div
          role="status"
          style={{
            marginBottom: space[8],
            padding: space[8],
            borderRadius: radius.lg,
            background: colors.accentFaint,
            border: `1px solid ${colors.accentMuted}`,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 4 }} aria-hidden="true">
            ⬡
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: fontWeight.bold,
              backgroundImage: gradient.goldText,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Welcome to the Hive
          </h2>
          <p style={{ color: colors.text.secondary, fontSize: fontSize.md, margin: '8px 0 0' }}>
            {claimed > 0 && !full
              ? `You're founding member #${claimed} of ${FOUNDING_CAP}.`
              : `You're one of the founding ${FOUNDING_CAP}.`}{' '}
            <span style={{ color: colors.accent, fontWeight: fontWeight.semibold }}>
              +{FOUNDING_XP} XP
            </span>{' '}
            and a permanent Founding Member badge are yours.
          </p>
          <div style={{ marginTop: space[6] }}>
            <Link
              to="/feed"
              style={{
                display: 'inline-block',
                padding: '9px 22px',
                borderRadius: radius.md,
                background: colors.accent,
                color: colors.bg,
                textDecoration: 'none',
                fontWeight: fontWeight.bold,
                fontSize: fontSize.md,
              }}
            >
              Enter the feed →
            </Link>
          </div>
        </div>
      )}

      <header style={{ marginBottom: space[9], textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', marginBottom: 8 }}>
          <FoundingMemberBadge />
        </div>
        <h1 style={{ margin: 0, fontSize: 26, color: colors.text.primary }}>The Founding 50</h1>
        <p style={{ color: colors.text.dim, fontSize: 13, margin: '6px 0 0' }}>
          The first fifty builders shaping MixHive. Founding spots are permanent and never
          reissued.
        </p>
      </header>

      {/* Scarcity meter */}
      <section
        aria-label="Founding spots claimed"
        style={{
          marginBottom: space[9],
          padding: space[8],
          background: colors.surface,
          border: `1px solid ${colors.accentMuted}`,
          borderRadius: radius.lg,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: space[5],
            marginBottom: space[5],
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{ fontSize: 18, fontWeight: fontWeight.bold, color: colors.text.primary }}
          >
            {loading ? '—' : `${claimed} of ${FOUNDING_CAP} claimed`}
          </span>
          <span style={{ fontSize: fontSize.sm, color: full ? colors.text.dim : colors.accent }}>
            {loading ? '' : full ? 'Founding cohort closed' : `${remaining} spots left`}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={`${claimed} of ${FOUNDING_CAP} founding spots claimed`}
          aria-valuenow={claimed}
          aria-valuemin={0}
          aria-valuemax={FOUNDING_CAP}
          style={{
            height: 10,
            borderRadius: 999,
            background: colors.surfaceHover,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: gradient.honey,
              transition: 'width 600ms cubic-bezier(0.22,1,0.36,1)',
            }}
          />
        </div>
      </section>

      {/* Cohort showcase */}
      {loading ? (
        <div style={{ display: 'grid', gap: space[5] }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonBar key={i} height={56} />
          ))}
        </div>
      ) : members.length === 0 ? (
        <EmptyState
          iconKey="network"
          title="No founding members yet"
          body="The first fifty spots are open. Redeem a founding invite to claim yours."
        />
      ) : (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: space[5] }}>
          {members.map((m) => {
            const name = m.display_name || m.username;
            return (
              <li key={m.id}>
                <Link
                  to={`/u/${m.username}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: space[6],
                    padding: space[6],
                    background: colors.surface,
                    border: `1px solid ${colors.border}`,
                    borderRadius: radius.lg,
                    textDecoration: 'none',
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      flexShrink: 0,
                      background: m.avatar_url
                        ? `url(${m.avatar_url}) center/cover`
                        : colors.surfaceHover,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        color: colors.text.primary,
                        fontWeight: 700,
                        fontSize: 14,
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {name}
                      </span>
                      <FoundingMemberBadge size="sm" />
                    </div>
                    <div style={{ color: colors.text.dim, fontSize: 12 }}>@{m.username}</div>
                  </div>
                  <LevelBadge level={m.level} size={40} />
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export default FoundingMembers;
