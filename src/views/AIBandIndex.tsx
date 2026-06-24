import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { listAIAgents, type AIAgent } from '../lib/api';
import { AIAgentCard } from '../components/AIAgentCard';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { colors, fontSize, fontWeight, space } from '../styles/tokens';

export function AIBandIndex() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    listAIAgents()
      .then(a => {
        setAgents(a);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ marginBottom: space[8] }}>
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

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <LoadingSpinner />
        </div>
      ) : agents.length === 0 ? (
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
          {agents.map(agent => (
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
