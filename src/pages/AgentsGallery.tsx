import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui'
import { EmptyState } from '../components/EmptyState'
import { listPublicAgents, forkAgent, type PublicLuaAgent } from '../lib/agents'
import { colors, fontSize, fontWeight, radius, space } from '../styles/tokens'

export function AgentsGallery() {
  const [agents, setAgents] = useState<PublicLuaAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [forking, setForking] = useState<string | null>(null)
  const navigate = useNavigate()

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

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 16px' }}>
      <header style={{ marginBottom: space[10] }}>
        <h1 style={{ margin: 0, fontSize: fontSize['3xl'], fontWeight: fontWeight.bold }}>Agent gallery</h1>
        <p style={{ margin: '4px 0 0', color: colors.text.muted, fontSize: fontSize.md }}>
          Public Lua agents shared by other DJs. Fork any of them into your own account in one click.
        </p>
        <div style={{ marginTop: space[6] }}>
          <Link to="/agents" style={{ color: colors.accent, fontSize: fontSize.sm }}>← Back to my agents</Link>
        </div>
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
    </div>
  )
}
