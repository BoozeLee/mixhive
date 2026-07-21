import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMixAgentCredits } from '../lib/api';
import type { MixAgentCredit } from '../lib/types';
import { colors, gradient, radius, shadow, space } from '../styles/tokens';

interface Props {
  mixId: string;
}

// "AI Band" panel for a mix: shows each AI agent that co-produced the track as a
// band-member card, linking to that agent's tracks. Renders nothing when empty.
export function AgentBandCredits({ mixId }: Props) {
  const [credits, setCredits] = useState<MixAgentCredit[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMixAgentCredits(mixId)
      .then(rows => {
        if (!cancelled) setCredits(rows);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [mixId]);

  if (!loaded || credits.length === 0) return null;

  return (
    <section style={{ marginTop: space[11] }}>
      <h3
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: colors.text.secondary,
          marginBottom: space[6],
          display: 'flex',
          alignItems: 'center',
          gap: space[4],
        }}
      >
        <span aria-hidden="true" style={{ color: colors.accent }}>
          ✦
        </span>
        AI Band — co-produced by agents
      </h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))',
          gap: space[6],
        }}
      >
        {credits.map(c => (
          <Link
            key={c.id}
            to={`/ai-band/agent/${c.agent_slug}`}
            style={{
              display: 'flex',
              gap: space[6],
              padding: space[6],
              background: colors.surface,
              border: `1px solid ${colors.accentMuted}`,
              borderRadius: radius.lg,
              textDecoration: 'none',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: 44,
                height: 44,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: gradient.honey,
                clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                boxShadow: shadow.honey,
                color: colors.black,
                fontWeight: 900,
                fontSize: 18,
              }}
            >
              {(c.agent_name[0] || '?').toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  color: colors.text.primary,
                  fontWeight: 700,
                  fontSize: 14,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {c.agent_name}
              </div>
              {c.agent_role && (
                <span
                  style={{
                    display: 'inline-block',
                    marginTop: 3,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: radius.pill,
                    background: colors.accentFaint,
                    color: colors.accent,
                  }}
                >
                  {c.agent_role}
                </span>
              )}
              {c.contribution && (
                <div
                  style={{ color: colors.text.dim, fontSize: 12, marginTop: 5, lineHeight: 1.4 }}
                >
                  {c.contribution}
                </div>
              )}
              {c.model && (
                <div style={{ color: colors.text.faint, fontSize: 11, marginTop: 4 }}>
                  {c.model}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
