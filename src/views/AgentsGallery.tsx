import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui';
import { EmptyState } from '../components/EmptyState';
import { useAuth } from '../hooks/useAuth';
import { createFromStarter, forkAgent, listPublicAgents, type PublicLuaAgent } from '../lib/agents';
import { STARTER_AGENTS, type StarterAgent } from '../lib/starter_agents';
import { colors, fontSize, fontWeight, radius, space } from '../styles/tokens';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

export function AgentsGallery() {
  const t = useTranslations('agentsGallery');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<PublicLuaAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forking, setForking] = useState<string | null>(null);

  const loadAgents = useCallback(() => {
    setLoading(true);
    setError(null);
    listPublicAgents()
      .then(a => {
        setAgents(a);
        setLoading(false);
      })
      .catch(e => {
        setError(e instanceof Error ? e.message : t('failedToLoad'));
        setLoading(false);
      });
  }, [t]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  async function handleFork(agent: PublicLuaAgent) {
    if (!user) {
      navigate(`/login?next=/agents/gallery`);
      return;
    }
    setForking(agent.id);
    try {
      const newId = await forkAgent(agent);
      navigate(`/agents?edit=${newId}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : t('forkFailed'));
    } finally {
      setForking(null);
    }
  }

  async function handleForkStarter(starter: StarterAgent) {
    if (!user) {
      navigate(`/login?next=/agents/gallery`);
      return;
    }
    setForking(`starter:${starter.id}`);
    try {
      const newId = await createFromStarter(starter);
      navigate(`/agents?edit=${newId}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : t('forkFailed'));
    } finally {
      setForking(null);
    }
  }

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 16px' }}>
      <header style={{ marginBottom: space[10] }}>
        <h1 style={{ margin: 0, fontSize: fontSize['3xl'], fontWeight: fontWeight.bold }}>
          {t('agentGallery')}
        </h1>
        <p style={{ margin: '4px 0 0', color: colors.text.muted, fontSize: fontSize.md }}>
          {t('description')}
        </p>
        <div style={{ marginTop: space[6] }}>
          <Link to="/agents" style={{ color: colors.accent, fontSize: fontSize.sm }}>
            ← Back to my agents
          </Link>
        </div>
      </header>

      <section style={{ marginBottom: space[12] }}>
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
            {t('starterLibrary')}
          </h2>
          <span style={{ color: colors.text.muted, fontSize: fontSize.sm }}>
            {t('templatesCount', { count: STARTER_AGENTS.length })}
          </span>
        </header>
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'grid',
            gap: space[6],
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          }}
        >
          {STARTER_AGENTS.map(s => (
            <li key={s.id}>
              <StarterCard
                starter={s}
                forkLabel={t('forkIntoMyAccount')}
                forking={forking === `starter:${s.id}`}
                onFork={() => handleForkStarter(s)}
              />
            </li>
          ))}
        </ul>
      </section>

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
            {t('community')}
          </h2>
          <span style={{ color: colors.text.muted, fontSize: fontSize.sm }}>
            {t('publicAgentsFromOther')}
          </span>
        </header>

        {loading ? (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <LoadingSpinner size="lg" />
          </div>
        ) : error ? (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <p style={{ color: colors.danger, marginBottom: 16 }}>{error}</p>
            <Button onClick={loadAgents}>{t('retry')}</Button>
          </div>
        ) : agents.length === 0 ? (
          <EmptyState
            icon="🌍"
            title={t('noPublicAgentsYet')}
            body={t('beTheFirst')}
            actionLabel={t('buildAnAgent')}
            actionTo="/agents"
          />
        ) : (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'grid',
              gap: space[6],
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            }}
          >
            {agents.map(a => (
              <li key={a.id}>
                <article
                  style={{
                    background: colors.surface,
                    border: `1px solid ${colors.border}`,
                    borderRadius: radius.xl,
                    padding: space[8],
                    display: 'flex',
                    flexDirection: 'column',
                    gap: space[6],
                    height: '100%',
                  }}
                >
                  <header>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: fontSize.lg,
                        fontWeight: fontWeight.semibold,
                        color: colors.text.primary,
                      }}
                    >
                      {a.name}
                    </h3>
                    <div style={{ marginTop: 4, color: colors.text.muted, fontSize: fontSize.sm }}>
                      by{' '}
                      <Link to={`/u/${a.owner_username}`} style={{ color: colors.text.secondary }}>
                        @{a.owner_username ?? '…'}
                      </Link>
                      {' · '}
                      {a.trigger_type ?? 'manual'}
                      {' · '}
                      {a.fork_count ?? 0} forks
                    </div>
                  </header>
                  {a.description && (
                    <p
                      style={{
                        margin: 0,
                        color: colors.text.secondary,
                        fontSize: fontSize.md,
                        flex: 1,
                      }}
                    >
                      {a.description}
                    </p>
                  )}
                  <pre
                    style={{
                      margin: 0,
                      background: colors.bg,
                      color: colors.text.muted,
                      padding: space[6],
                      borderRadius: radius.md,
                      fontSize: fontSize.xs,
                      maxHeight: 140,
                      overflow: 'auto',
                      fontFamily: 'Menlo, Consolas, monospace',
                    }}
                  >
                    {a.lua_code.slice(0, 320)}
                    {a.lua_code.length > 320 ? '…' : ''}
                  </pre>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button onClick={() => handleFork(a)} loading={forking === a.id} size="sm">
                      {t('forkIntoMyAccount')}
                    </Button>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StarterCard({
  starter,
  forkLabel,
  forking,
  onFork,
}: {
  starter: StarterAgent;
  forkLabel: string;
  forking: boolean;
  onFork: () => void;
}) {
  return (
    <article
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.xl,
        padding: space[8],
        display: 'flex',
        flexDirection: 'column',
        gap: space[6],
        height: '100%',
      }}
    >
      <header>
        <h3
          style={{
            margin: 0,
            fontSize: fontSize.lg,
            fontWeight: fontWeight.semibold,
            color: colors.text.primary,
          }}
        >
          {starter.name}
        </h3>
        <div style={{ marginTop: 4, color: colors.text.muted, fontSize: fontSize.sm }}>
          {starter.trigger_type}
          {starter.cron_expr && ` · ${starter.cron_expr}`}
          {starter.tags.length > 0 && ` · ${starter.tags.join(' · ')}`}
        </div>
      </header>
      <p style={{ margin: 0, color: colors.text.secondary, fontSize: fontSize.md, flex: 1 }}>
        {starter.description}
      </p>
      <pre
        style={{
          margin: 0,
          background: colors.bg,
          color: colors.text.muted,
          padding: space[6],
          borderRadius: radius.md,
          fontSize: fontSize.xs,
          maxHeight: 140,
          overflow: 'auto',
          fontFamily: 'Menlo, Consolas, monospace',
        }}
      >
        {starter.lua_code.slice(0, 320)}
        {starter.lua_code.length > 320 ? '…' : ''}
      </pre>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button onClick={onFork} loading={forking} size="sm">
          {forkLabel}
        </Button>
      </div>
    </article>
  );
}
