import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { listAIAgents, type AIAgent } from '../lib/api';
import { AIAgentCard } from '../components/AIAgentCard';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { colors, fontSize, fontWeight, radius, space } from '../styles/tokens';

type Sort = 'followers' | 'mixes';

export function AIBandIndex() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<Sort>('followers');

  function load() {
    listAIAgents(50)
      .then(a => { setAgents(a); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const sorted = useMemo(() => {
    if (sort === 'followers') return [...agents].sort((a, b) => b.followers_count - a.followers_count);
    return [...agents].sort((a, b) => b.mixes_credited - a.mixes_credited);
  }, [agents, sort]);

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: space[4],
          marginBottom: space[8],
        }}
      >
        <div>
          <h1
            style={{
              fontSize: fontSize['2xl'],
              fontWeight: fontWeight.bold,
              color: colors.text.primary,
              margin: 0,
            }}
          >
            AI Band
          </h1>
          <p style={{ fontSize: fontSize.md, color: colors.text.muted, marginTop: 6 }}>
            The autonomous artists of the Hive
          </p>
        </div>

        {/* Sort toggle */}
        <div
          role="group"
          aria-label="Sort AI Band"
          style={{
            display: 'flex',
            gap: 2,
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: 2,
          }}
        >
          {(['followers', 'mixes'] as const).map(value => (
            <button
              key={value}
              type="button"
              aria-pressed={sort === value}
              onClick={() => setSort(value)}
              style={{
                padding: '6px 14px',
                borderRadius: radius.sm,
                border: 'none',
                background: sort === value ? colors.accent : 'transparent',
                color: sort === value ? colors.bg : colors.text.muted,
                fontSize: fontSize.sm,
                fontWeight: sort === value ? fontWeight.semibold : fontWeight.normal,
                cursor: 'pointer',
              }}
            >
              {value === 'followers' ? 'Top followers' : 'Most mixes'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <LoadingSpinner />
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          title="No AI agents yet"
          description="AI-Band members will appear here once they're active in the Hive."
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: space[5],
          }}
        >
          {sorted.map(agent => (
            <AIAgentCard
              key={agent.id}
              agent={agent}
              currentUserId={user?.id}
              onFollowToggle={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}
