import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { useAuth } from '../hooks/useAuth';
import { createFromStarter, forkAgent, listPublicAgents, type PublicLuaAgent } from '../lib/agents';
import { STARTER_AGENTS } from '../lib/starter_agents';
import { AgentCard } from '../components/agents/AgentCard';
import { AgentFilters } from '../components/agents/AgentFilters';
import { AgentGalleryHeader } from '../components/agents/AgentGalleryHeader';
import { colors, fontSize, fontWeight, radius, space } from '../styles/tokens';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

export function AgentsGallery() {
  const t = useTranslations('agentsGallery');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<PublicLuaAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [forking, setForking] = useState<string | null>(null);
  const [forkError, setForkError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  useEffect(() => {
    listPublicAgents()
      .then(a => {
        setAgents(a);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleFork(agent: PublicLuaAgent) {
    if (!user) {
      navigate(`/login?next=/agents/gallery`);
      return;
    }
    setForking(agent.id);
    setForkError('');
    try {
      const newId = await forkAgent(agent);
      navigate(`/agents?edit=${newId}`);
    } catch (e) {
      setForkError(e instanceof Error ? e.message : 'fork failed');
    } finally {
      setForking(null);
    }
  }

  async function handleForkStarter(starterId: string) {
    const starter = STARTER_AGENTS.find(s => s.id === starterId);
    if (!starter) return;
    if (!user) {
      navigate(`/login?next=/agents/gallery`);
      return;
    }
    setForking(`starter:${starter.id}`);
    setForkError('');
    try {
      const newId = await createFromStarter(starter);
      navigate(`/agents?edit=${newId}`);
    } catch (e) {
      setForkError(e instanceof Error ? e.message : 'fork failed');
    } finally {
      setForking(null);
    }
  }

  const filteredStarters = useMemo(() => {
    const q = search.trim().toLowerCase();
    return STARTER_AGENTS.filter(
      s =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some(t => t.toLowerCase().includes(q))
    ).filter(
      s => category === 'all' || s.tags.some(tag => tag.toLowerCase() === category.toLowerCase())
    ).map(s => ({ ...s, kind: 'starter' as const }));
  }, [search, category]);

  const filteredAgents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return agents.filter(
      a =>
        a.name.toLowerCase().includes(q) ||
        (a.description ?? '').toLowerCase().includes(q) ||
        (a.tags ?? []).some(t => t.toLowerCase().includes(q))
    ).filter(
      a => category === 'all' || (a.tags ?? []).some(tag => tag.toLowerCase() === category.toLowerCase())
    );
  }, [agents, search, category]);

  const hasAny = filteredStarters.length > 0 || filteredAgents.length > 0;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
      <AgentGalleryHeader />

      <AgentFilters
        search={search}
        onSearchChange={setSearch}
        category={category}
        onCategoryChange={setCategory}
      />

      {forkError && (
        <div
          style={{
            marginBottom: space[6],
            padding: space[5],
            background: colors.dangerBg,
            border: `1px solid ${colors.danger}`,
            borderRadius: radius.lg,
            color: colors.danger,
            fontSize: fontSize.sm,
          }}
        >
          {t('forkError', { message: forkError })}
        </div>
      )}

      {!hasAny && !loading && (
        <EmptyState
          iconKey="agents"
          title={t('noMatchesTitle')}
          body={t('noMatchesBody')}
          actionLabel={t('clearFilters')}
          onAction={() => {
            setSearch('');
            setCategory('all');
          }}
        />
      )}

      {filteredStarters.length > 0 && (
        <section style={{ marginBottom: space[12] }}>
          <header
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: space[6],
              marginBottom: space[8],
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: fontSize['2xl'],
                fontWeight: fontWeight.semibold,
                color: colors.text.primary,
              }}
            >
              {t('starterLibrary')}
            </h2>
            <span style={{ color: colors.text.muted, fontSize: fontSize.sm }}>
              {t('templateCount', { count: filteredStarters.length })}
            </span>
          </header>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'grid',
              gap: space[6],
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            }}
          >
            {filteredStarters.map(s => (
              <li key={s.id}>
                <AgentCard
                  agent={s}
                  forking={forking === `starter:${s.id}`}
                  onFork={() => handleForkStarter(s.id)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <header
          style={{ display: 'flex', alignItems: 'baseline', gap: space[6], marginBottom: space[8] }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: fontSize['2xl'],
              fontWeight: fontWeight.semibold,
              color: colors.text.primary,
            }}
          >
            {t('community')}
          </h2>
          <span style={{ color: colors.text.muted, fontSize: fontSize.sm }}>
            {t('publicAgentsFromOther')}
          </span>
        </header>

        {loading ? (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <LoadingSpinner size="lg" />
          </div>
        ) : agents.length === 0 ? (
          <EmptyState
            iconKey="agents"
            title={t('noPublicAgentsYet')}
            body="Be the first — open one of your agents, toggle 'Public', and it'll show up here for others to fork."
            actionLabel={t('buildAnAgent')}
            actionTo="/agents"
          />
        ) : filteredAgents.length === 0 && hasAny ? null : (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'grid',
              gap: space[6],
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            }}
          >
            {filteredAgents.map(a => (
              <li key={a.id}>
                <AgentCard
                  agent={{ ...a, kind: 'community' }}
                  forking={forking === a.id}
                  onFork={() => handleFork(a)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
