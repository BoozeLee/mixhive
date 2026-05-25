import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui'
import { EmptyState } from '../components/EmptyState'
import { useAuth } from '../hooks/useAuth'
import {
  createFromStarter,
  forkAgent,
  listPublicAgents,
  type PublicLuaAgent,
} from '../lib/agents'
import { STARTER_AGENTS, type StarterAgent } from '../lib/starter_agents'
import { colors, fontSize, fontWeight, radius, space } from '../styles/tokens'

export function AgentsGallery() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [agents, setAgents] = useState<PublicLuaAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [forking, setForking] = useState<string | null>(null)

  useEffect(() => {
    listPublicAgents().then(a => { setAgents(a); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  async function handleFork(agent: PublicLuaAgent) {
    setForking(agent.id)
    try {
      const newId = await forkAgent(agent.id)
      navigate(`/agents?edit=${newId}`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'fork failed')
    } finally {
      setForking(null)
    }
  }

  async function handleForkStarter(starter: StarterAgent) {
    if (!user) {
      navigate(`/login?next=/agents/gallery`)
      return
    }
    setForking(`starter:${starter.id}`)
    try {
      const newId = await createFromStarter(starter)
      navigate(`/agents?edit=${newId}`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'fork failed')
    } finally {
      setForking(null)
    }
  }

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 16px' }}>
      <header style={{ marginBottom: space[10] }}>
        <h1 style={{ margin: 0, fontSize: fontSize['3xl'], fontWeight: fontWeight.bold }}>Agent gallery</h1>
        <p style={{ margin: '4px 0 0', color: colors.text.muted, fontSize: fontSize.md }}>
          Browse Lua agents and fork them into your account in one click — starter templates ship with MixHive, public agents are shared by the community.
        </p>
        <div style={{ marginTop: space[6] }}>
          <Link to="/agents" style={{ color: colors.accent, fontSize: fontSize.sm }}>← Back to my agents</Link>
        </div>
      </header>

      <section style={{ marginBottom: space[12] }}>
        <header style={{ display: 'flex', alignItems: 'baseline', gap: space[6], marginBottom: space[8] }}>
          <h2 style={{ margin: 0, fontSize: fontSize['2xl'], fontWeight: fontWeight.semibold, color: colors.text.primary }}>
            Starter library
          </h2>
          <span style={{ color: colors.text.muted, fontSize: fontSize.sm }}>
            {STARTER_AGENTS.length} templates · ships with MixHive
          </span>
        </header>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: space[6], gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {STARTER_AGENTS.map(s => (
            <li key={s.id}>
              <StarterCard
                starter={s}
                forking={forking === `starter:${s.id}`}
                onFork={() => handleForkStarter(s)}
              />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <header style={{ display: 'flex', alignItems: 'baseline', gap: space[6], marginBottom: space[8] }}>
          <h2 style={{ margin: 0, fontSize: fontSize['2xl'], fontWeight: fontWeight.semibold, color: colors.text.primary }}>
            Community
          </h2>
          <span style={{ color: colors.text.muted, fontSize: fontSize.sm }}>
            Public agents from other DJs
          </span>
        </header>

        {loading ? (
          <div style={{ color: colors.text.muted }}>Loading…</div>
        ) : agents.length === 0 ? (
          <EmptyState
            icon="🌍"
            title="No public agents yet"
            body="Be the first — open one of your agents, toggle 'Public', and it'll show up here for others to fork."
            actionLabel="Build an agent"
            actionTo="/agents"
          />
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: space[6], gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
            {agents.map(a => (
              <li key={a.id}>
                <article style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.xl, padding: space[8], display: 'flex', flexDirection: 'column', gap: space[6], height: '100%' }}>
                  <header>
                    <h3 style={{ margin: 0, fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text.primary }}>
                      {a.name}
                    </h3>
                    <div style={{ marginTop: 4, color: colors.text.muted, fontSize: fontSize.sm }}>
                      by{' '}
                      <Link to={`/u/${a.owner_username}`} style={{ color: colors.text.secondary }}>
                        @{a.owner_username ?? '…'}
                      </Link>
                      {' · '}{a.trigger_type ?? 'manual'}
                      {' · '}{a.fork_count ?? 0} forks
                    </div>
                  </header>
                  {a.description && (
                    <p style={{ margin: 0, color: colors.text.secondary, fontSize: fontSize.md, flex: 1 }}>{a.description}</p>
                  )}
                  <pre style={{ margin: 0, background: colors.bg, color: colors.text.muted, padding: space[6], borderRadius: radius.md, fontSize: fontSize.xs, maxHeight: 140, overflow: 'auto', fontFamily: 'Menlo, Consolas, monospace' }}>
                    {a.lua_code.slice(0, 320)}{a.lua_code.length > 320 ? '…' : ''}
                  </pre>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button onClick={() => handleFork(a)} loading={forking === a.id} size="sm">
                      Fork into my account
                    </Button>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function StarterCard({ starter, forking, onFork }: { starter: StarterAgent; forking: boolean; onFork: () => void }) {
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
        <h3 style={{ margin: 0, fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text.primary }}>
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
          Fork into my account
        </Button>
      </div>
    </article>
  )
}
