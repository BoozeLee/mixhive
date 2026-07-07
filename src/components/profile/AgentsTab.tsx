import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { EmptyState } from '../EmptyState';
import { listAgents, type LuaAgent } from '../../lib/agents';
import { colors, fontSize, fontWeight, radius, space, transition } from '../../styles/tokens';

interface AgentsTabProps {
  isOwn: boolean;
}

export function AgentsTab({ isOwn }: AgentsTabProps) {
  const t = useTranslations('profile');
  const [agents, setAgents] = useState<LuaAgent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!isOwn) {
      setLoading(false);
      return;
    }
    listAgents()
      .then(data => {
        if (!cancelled) setAgents(data);
      })
      .catch(() => {
        /* suppress */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOwn]);

  if (!isOwn) {
    return (
      <EmptyState iconKey="agents" title={t('noAgentsTitleOther')} body={t('noAgentsBodyOther')} />
    );
  }

  if (!loading && agents.length === 0) {
    return (
      <EmptyState
        iconKey="agents"
        title={t('noAgentsTitleOwn')}
        body={t('noAgentsBodyOwn')}
        actionLabel={t('noAgentsAction')}
        actionTo="/agents/gallery"
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
      {agents.map(agent => (
        <Link
          key={agent.id}
          to={`/agents/${agent.id}`}
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <div
            style={{
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: radius.lg,
              padding: space[6],
              transition: `border-color ${transition.fast}`,
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = colors.accentMuted)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = colors.border)}
          >
            <div
              style={{
                fontSize: fontSize.md,
                fontWeight: fontWeight.semibold,
                color: colors.text.primary,
              }}
            >
              {agent.name}
            </div>
            <div style={{ fontSize: fontSize.sm, color: colors.text.muted, marginTop: space[2] }}>
              {agent.trigger_type}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
