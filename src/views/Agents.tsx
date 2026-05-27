import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Button, Input, Textarea } from '../components/ui'
import { EmptyState } from '../components/EmptyState'
import {
  listAgents,
  createAgent,
  updateAgent,
  deleteAgent,
  listRuns,
  listAgentKv,
  testRunAgent,
  type LuaAgent,
  type LuaAgentRun,
  type LuaAgentKvEntry,
  type LuaAgentTrigger,
} from '../lib/agents'
import { defaultTemplateFor } from '../lib/starter_agents'
import { colors, fontSize, radius, space, fontWeight } from '../styles/tokens'

const TRIGGER_OPTIONS: { value: LuaAgentTrigger; label: string; description: string }[] = [
  { value: 'on_follow',     label: 'On follow',     description: 'Someone follows you.' },
  { value: 'on_unfollow',   label: 'On unfollow',   description: 'Someone unfollows you.' },
  { value: 'on_mix_upload', label: 'On mix upload', description: 'A DJ you follow publishes a mix.' },
  { value: 'on_comment',    label: 'On comment',    description: 'Someone comments on your mix.' },
  { value: 'on_reply',      label: 'On reply',      description: 'Someone replies to your comment.' },
  { value: 'on_mention',    label: 'On mention',    description: 'You are @mentioned anywhere.' },
  { value: 'on_like',       label: 'On like',       description: 'Someone likes your mix.' },
  { value: 'on_repost',     label: 'On repost',     description: 'Someone reposts your mix.' },
  { value: 'on_schedule',   label: 'On schedule',   description: 'Runs on a cron schedule you configure.' },
  { value: 'manual',        label: 'Manual',        description: 'Only runs from the Test button.' },
]

const VALID_TRIGGERS: LuaAgentTrigger[] = TRIGGER_OPTIONS.map(o => o.value)

function parseTriggerParam(value: string | null): LuaAgentTrigger | null {
  if (!value) return null
  return (VALID_TRIGGERS as string[]).includes(value) ? (value as LuaAgentTrigger) : null
}

export function Agents() {
  const { user } = useAuth()
  const [agents, setAgents] = useState<LuaAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<LuaAgent | null>(null)
  const [creating, setCreating] = useState(false)
  const [presetTrigger, setPresetTrigger] = useState<LuaAgentTrigger | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    if (!user) return
    setLoading(true)
    listAgents().then(a => { setAgents(a); setLoading(false) }).catch(() => setLoading(false))
  }, [user])

  // Deep-link from MixDetail: /agents?new=1&trigger=on_comment
  useEffect(() => {
    const newFlag = searchParams.get('new')
    const trig = parseTriggerParam(searchParams.get('trigger'))
    const editId = searchParams.get('edit')
    if (newFlag === '1') {
      setPresetTrigger(trig)
      setCreating(true)
      // Strip the params so a refresh doesn't keep re-opening the form.
      setSearchParams({}, { replace: true })
    } else if (editId) {
      // Land on the editor for a freshly-forked agent.
      listAgents().then(list => {
        const found = list.find(a => a.id === editId)
        if (found) setEditing(found)
        setSearchParams({}, { replace: true })
      })
    }
  }, [searchParams, setSearchParams])

  if (!user) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 16px' }}>
        <EmptyState icon="🤖" title="Sign in to manage your agents" body="Lua agents automate your social-media reactions." actionLabel="Sign in" actionTo="/login" />
      </div>
    )
  }

  if (editing || creating) {
    return (
      <AgentEditor
        agent={editing}
        presetTrigger={presetTrigger}
        onCancel={() => { setEditing(null); setCreating(false); setPresetTrigger(null) }}
        onSaved={async () => {
          setEditing(null); setCreating(false); setPresetTrigger(null)
          setAgents(await listAgents())
        }}
      />
    )
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: space[10], flexWrap: 'wrap', gap: space[6] }}>
        <div>
          <h1 style={{ margin: 0, fontSize: fontSize['3xl'], fontWeight: fontWeight.bold }}>Lua agents</h1>
          <p style={{ margin: '4px 0 0', color: colors.text.muted, fontSize: fontSize.md }}>
            Tiny Lua scripts that react to events on your account.{' '}
            <a href="/agents/gallery" style={{ color: colors.accent }}>Browse the gallery →</a>
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>+ New agent</Button>
      </header>

      {loading ? (
        <div style={{ color: colors.text.muted }}>Loading…</div>
      ) : agents.length === 0 ? (
        <EmptyState
          icon="🤖"
          title="No agents yet"
          body="Write a small Lua script that fires when something happens — auto-welcome new followers, thank commenters, schedule a weekly digest."
          actionLabel="Create your first agent"
          onAction={() => setCreating(true)}
        />
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: space[6] }}>
          {agents.map(a => (
            <li key={a.id}>
              <AgentRow agent={a} onEdit={() => setEditing(a)} onChanged={async () => setAgents(await listAgents())} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AgentRow({ agent, onEdit, onChanged }: { agent: LuaAgent; onEdit: () => void; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const errorRatio = agent.run_count === 0 ? 0 : Math.round((agent.error_count / agent.run_count) * 100)
  return (
    <article style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.xl, padding: space[8] }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space[6] }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text.primary }}>
            {agent.name}{' '}
            <span style={{ color: agent.enabled ? colors.success : colors.text.dim, fontSize: fontSize.xs, marginLeft: 6 }}>
              {agent.enabled ? '● ON' : '○ OFF'}
            </span>
          </h3>
          <div style={{ marginTop: 4, color: colors.text.muted, fontSize: fontSize.sm }}>
            {agent.trigger_type ?? 'no trigger'} · {agent.run_count} runs · {errorRatio}% errors
          </div>
        </div>
        <div style={{ display: 'flex', gap: space[4] }}>
          <Button variant="ghost" size="sm" onClick={onEdit}>Edit</Button>
          <Button
            variant="secondary"
            size="sm"
            loading={busy}
            onClick={async () => {
              setBusy(true)
              try { await updateAgent(agent.id, { enabled: !agent.enabled }); await onChanged() }
              finally { setBusy(false) }
            }}
          >
            {agent.enabled ? 'Disable' : 'Enable'}
          </Button>
        </div>
      </header>
      {agent.description && (
        <p style={{ margin: `${space[6]}px 0 0`, color: colors.text.secondary, fontSize: fontSize.md }}>{agent.description}</p>
      )}
      {agent.last_error && (
        <p style={{ margin: `${space[6]}px 0 0`, color: colors.danger, fontSize: fontSize.sm }}>
          Last error: {agent.last_error}
        </p>
      )}
    </article>
  )
}

function AgentEditor({
  agent,
  presetTrigger,
  onCancel,
  onSaved,
}: {
  agent: LuaAgent | null
  presetTrigger?: LuaAgentTrigger | null
  onCancel: () => void
  onSaved: () => Promise<void>
}) {
  const initialTrigger: LuaAgentTrigger = agent?.trigger_type ?? presetTrigger ?? 'on_follow'
  const [name, setName] = useState(agent?.name ?? '')
  const [description, setDescription] = useState(agent?.description ?? '')
  const [trigger, setTrigger] = useState<LuaAgentTrigger>(initialTrigger)
  const [code, setCode] = useState(agent?.lua_code ?? defaultTemplateFor(initialTrigger))
  const [cronExpr, setCronExpr] = useState(agent?.cron_expr ?? '0 9 * * 1')
  const [isPublic, setIsPublic] = useState(agent?.is_public ?? false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [runs, setRuns] = useState<LuaAgentRun[]>([])
  const [kvEntries, setKvEntries] = useState<LuaAgentKvEntry[]>([])

  useEffect(() => {
    if (!agent) return
    listRuns(agent.id).then(setRuns).catch(() => {})
    listAgentKv(agent.id).then(setKvEntries).catch(() => {})
  }, [agent])

  function pickTrigger(next: LuaAgentTrigger) {
    setTrigger(next)
    // Only swap in a template if the user hasn't typed anything custom.
    const template = defaultTemplateFor(next)
    const current = code.trim()
    // A "starter-equivalent" body is one that matches any default template
    // for any trigger. If the user's body is one of those, it's safe to
    // overwrite when they pick a different trigger.
    const isAnyTemplate = VALID_TRIGGERS.some(t => defaultTemplateFor(t).trim() === current)
    if (!current || isAnyTemplate) setCode(template)
  }

  async function save() {
    setSaving(true)
    try {
      const cron = trigger === 'on_schedule' ? cronExpr : null
      if (agent) {
        await updateAgent(agent.id, { name, description, trigger_type: trigger, lua_code: code, cron_expr: cron, is_public: isPublic })
      } else {
        await createAgent({ name, description, trigger_type: trigger, lua_code: code, cron_expr: cron ?? undefined })
      }
      await onSaved()
    } finally { setSaving(false) }
  }

  async function runTest() {
    if (!agent) return
    setTesting(true)
    setTestResult(null)
    try {
      const r = await testRunAgent(agent.id, { actor_id: agent.owner_id, _test: true })
      setTestResult(`${r.status} in ${r.duration_ms}ms\n${(r.stdout || []).join('\n')}${r.error ? `\nERROR: ${r.error}` : ''}`)
      setRuns(await listRuns(agent.id))
    } catch (e) {
      setTestResult(`request failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally { setTesting(false) }
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: space[8] }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold }}>
          {agent ? `Edit agent — ${agent.name}` : 'New Lua agent'}
        </h1>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </header>

      <Input label="Name" value={name} onChange={e => setName(e.target.value)} placeholder="welcome-new-followers" required />
      <Textarea label="Description" rows={2} value={description ?? ''} onChange={e => setDescription(e.target.value)} placeholder="What this agent does, in plain English." />

      <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
        <legend style={{ color: colors.text.secondary, fontSize: fontSize.sm, fontWeight: fontWeight.medium, marginBottom: space[6] }}>
          Trigger
        </legend>
        <div style={{ display: 'grid', gap: space[5], gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {TRIGGER_OPTIONS.map(opt => (
            <label key={opt.value} style={{ cursor: 'pointer', padding: space[6], borderRadius: radius.lg, border: `1px solid ${trigger === opt.value ? colors.accent : colors.border}`, background: trigger === opt.value ? colors.surfaceHover : colors.bg }}>
              <input type="radio" name="trigger" value={opt.value} checked={trigger === opt.value} onChange={() => pickTrigger(opt.value)} style={{ marginRight: 6 }} />
              <span style={{ fontWeight: fontWeight.semibold }}>{opt.label}</span>
              <div style={{ marginTop: 4, color: colors.text.muted, fontSize: fontSize.xs }}>{opt.description}</div>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="lua-code" style={{ color: colors.text.secondary, fontSize: fontSize.sm, fontWeight: fontWeight.medium }}>
          Lua source
        </label>
        <textarea
          id="lua-code"
          value={code}
          onChange={e => setCode(e.target.value)}
          spellCheck={false}
          style={{
            display: 'block', width: '100%', minHeight: 280, marginTop: space[5],
            background: colors.bg, color: colors.text.primary, border: `1px solid ${colors.borderStrong}`,
            borderRadius: radius.md, padding: space[7], fontFamily: 'Menlo, Consolas, monospace', fontSize: fontSize.base,
            lineHeight: 1.55, resize: 'vertical',
          }}
        />
        <p style={{ margin: `${space[5]}px 0 0`, color: colors.text.dim, fontSize: fontSize.xs, lineHeight: 1.6 }}>
          <strong style={{ color: colors.text.secondary }}>Read:</strong>{' '}
          <code>mh.get_mix(id)</code> <code>mh.get_profile(id)</code> <code>mh.get_mixes_by_user(uid, limit?)</code>{' '}
          <code>mh.get_followers(uid, limit?)</code> <code>mh.get_following(uid, limit?)</code> <code>mh.fetch_recent_mixes(limit?)</code>
          {'  '}
          <strong style={{ color: colors.text.secondary }}>Write:</strong>{' '}
          <code>mh.comment(mix_id, body)</code> <code>mh.delete_comment(id)</code> <code>mh.post_buzz(text)</code>{' '}
          <code>mh.notify(msg)</code> <code>mh.follow(uid)</code> <code>mh.like(mix_id)</code> <code>mh.repost(mix_id)</code>
          {'  '}
          <strong style={{ color: colors.text.secondary }}>KV:</strong>{' '}
          <code>mh.kv_get(key)</code> <code>mh.kv_set(key, val, ttl?)</code> <code>mh.kv_del(key)</code> <code>mh.kv_list()</code>
          {'  '}
          <strong style={{ color: colors.text.secondary }}>Util:</strong>{' '}
          <code>mh.json_encode(t)</code> <code>mh.json_decode(s)</code> <code>mh.print(...)</code>
          {'  '}Plus <code>math</code> <code>string</code> <code>table</code>.{' '}
          <a href="/docs/LUA_AGENTS.md" target="_blank" rel="noopener noreferrer" style={{ color: colors.accent }}>Full docs →</a>
        </p>
      </div>

      {trigger === 'on_schedule' && (
        <Input
          label="Cron expression"
          value={cronExpr}
          onChange={e => setCronExpr(e.target.value)}
          help="5-field cron, evaluated in UTC. e.g. '0 9 * * 1' = Mondays 09:00, '*/15 * * * *' = every 15 minutes."
        />
      )}

      {agent && (
        <label style={{ display: 'flex', alignItems: 'center', gap: space[5], color: colors.text.secondary, fontSize: fontSize.sm, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={isPublic}
            onChange={e => setIsPublic(e.target.checked)}
            style={{ accentColor: colors.accent }}
          />
          Publish to the gallery so other DJs can fork this agent.
        </label>
      )}

      {agent && kvEntries.length > 0 && (
        <section style={{ background: colors.surfaceMuted, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: space[6] }}>
          <h3 style={{ margin: `0 0 ${space[4]}px`, color: colors.text.primary, fontSize: fontSize.md }}>Agent KV</h3>
          <div style={{ display: 'grid', gap: space[3] }}>
            {kvEntries.slice(0, 12).map(entry => (
              <div key={entry.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(80px, 0.45fr) minmax(0, 1fr)', gap: space[4], color: colors.text.muted, fontSize: fontSize.xs }}>
                <code style={{ color: colors.accent }}>{entry.key}</code>
                <code style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.value}</code>
              </div>
            ))}
          </div>
        </section>
      )}

      <div style={{ display: 'flex', gap: space[6], justifyContent: 'flex-end' }}>
        {agent && <Button variant="danger" onClick={async () => { if (confirm('Delete this agent?')) { await deleteAgent(agent.id); await onSaved() } }}>Delete</Button>}
        {agent && <Button variant="secondary" loading={testing} onClick={runTest}>Run test</Button>}
        <Button onClick={save} loading={saving} disabled={!name.trim() || !code.trim()}>
          {agent ? 'Save changes' : 'Create agent'}
        </Button>
      </div>

      {testResult && (
        <pre style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: space[7], color: colors.text.secondary, fontSize: fontSize.sm, whiteSpace: 'pre-wrap' }}>
          {testResult}
        </pre>
      )}

      {agent && runs.length > 0 && (
        <section>
          <h3 style={{ fontSize: fontSize.lg, color: colors.text.primary, margin: `0 0 ${space[6]}px` }}>Recent runs</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: space[4] }}>
            {runs.map(r => (
              <li key={r.id} style={{ background: colors.surfaceMuted, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: space[6], color: colors.text.secondary, fontSize: fontSize.sm }}>
                <strong style={{ color: r.status === 'ok' ? colors.success : colors.danger }}>{r.status}</strong>{' '}
                · {r.triggered_by} · {r.duration_ms}ms · {new Date(r.created_at).toLocaleString()}
                {r.error_message && <div style={{ color: colors.danger, marginTop: 4 }}>{r.error_message}</div>}
                {r.stdout && <pre style={{ marginTop: 4, color: colors.text.dim, whiteSpace: 'pre-wrap' }}>{r.stdout}</pre>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {agent && kvEntries.length > 0 && (
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: space[5], marginBottom: space[6] }}>
            <h3 style={{ fontSize: fontSize.lg, color: colors.text.primary, margin: 0 }}>KV store</h3>
            <button
              type="button"
              onClick={() => listAgentKv(agent.id).then(setKvEntries).catch(() => {})}
              style={{ fontSize: fontSize.xs, color: colors.text.dim, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              ↻ refresh
            </button>
          </div>
          <div style={{ overflow: 'auto', borderRadius: radius.md, border: `1px solid ${colors.border}` }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: fontSize.sm }}>
              <thead>
                <tr style={{ background: colors.surfaceMuted }}>
                  {['Key', 'Value', 'Expires'].map(h => (
                    <th key={h} style={{ padding: `${space[4]}px ${space[5]}px`, textAlign: 'left', color: colors.text.muted, fontWeight: fontWeight.semibold, borderBottom: `1px solid ${colors.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {kvEntries.map(entry => (
                  <tr key={entry.key} style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <td style={{ padding: `${space[4]}px ${space[5]}px`, color: colors.accent, fontFamily: 'monospace', wordBreak: 'break-all' }}>{entry.key}</td>
                    <td style={{ padding: `${space[4]}px ${space[5]}px`, color: colors.text.secondary, fontFamily: 'monospace', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.value ?? '—'}</td>
                    <td style={{ padding: `${space[4]}px ${space[5]}px`, color: colors.text.dim, whiteSpace: 'nowrap' }}>
                      {entry.expires_at ? new Date(entry.expires_at).toLocaleString() : '∞'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
