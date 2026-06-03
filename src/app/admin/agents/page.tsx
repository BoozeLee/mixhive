'use client';

import { useEffect, useState, useCallback } from 'react';

interface Agent {
  id: string;
  display_name: string;
  description: string;
  tier: string;
  approval_policy: string;
  timeout_ms: number;
  enabled: boolean;
  lua_script_version: number;
  updated_at: string;
}

interface Version {
  id: number;
  version: number;
  notes: string | null;
  author: string | null;
  promoted_at: string | null;
  rolled_back_at: string | null;
  created_at: string;
}

const ADMIN_SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? '';

function adminFetch(path: string, opts: RequestInit = {}) {
  return fetch(path, {
    ...opts,
    headers: {
      'x-admin-secret': ADMIN_SECRET,
      'Content-Type': 'application/json',
      ...opts.headers,
    },
  });
}

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selected, setSelected] = useState<Agent | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [newScript, setNewScript] = useState('');
  const [newNotes, setNewNotes] = useState('');

  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/agents');
      const { agents: list } = await res.json();
      setAgents(list ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadVersions = useCallback(async (agentId: string) => {
    const res = await adminFetch(`/api/admin/agents/${agentId}/versions`);
    const { versions: list } = await res.json();
    setVersions(list ?? []);
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  async function selectAgent(agent: Agent) {
    setSelected(agent);
    setNewScript('');
    setNewNotes('');
    setStatus('');
    await loadVersions(agent.id);
  }

  async function handlePromote(version: number) {
    if (!selected) return;
    setStatus('Promoting…');
    const res = await adminFetch(`/api/admin/agents/${selected.id}/promote`, {
      method: 'POST',
      body: JSON.stringify({ version }),
    });
    const data = await res.json();
    setStatus(res.ok ? `Promoted version ${data.promoted_version}` : `Error: ${data.error}`);
    await loadVersions(selected.id);
    await loadAgents();
  }

  async function handleRollback() {
    if (!selected) return;
    setStatus('Rolling back…');
    const res = await adminFetch(`/api/admin/agents/${selected.id}/rollback`, { method: 'POST' });
    const data = await res.json();
    setStatus(res.ok ? `Rolled back to v${data.rolled_back_to}` : `Error: ${data.error}`);
    await loadVersions(selected.id);
    await loadAgents();
  }

  async function handleCreateVersion() {
    if (!selected || !newScript.trim()) return;
    setStatus('Saving new version…');
    const res = await adminFetch(`/api/admin/agents/${selected.id}/versions`, {
      method: 'POST',
      body: JSON.stringify({ lua_script: newScript, notes: newNotes, author: 'admin' }),
    });
    const data = await res.json();
    setStatus(res.ok ? `Created v${data.version?.version}` : `Error: ${data.error}`);
    setNewScript('');
    setNewNotes('');
    await loadVersions(selected.id);
    await loadAgents();
  }

  const tierColor: Record<string, string> = {
    free: '#4caf50',
    pro: '#ff9800',
    partner: '#e91e63',
  };

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        fontFamily: 'monospace',
        background: '#0a0a0a',
        color: '#e0e0e0',
      }}
    >
      {/* Sidebar */}
      <aside style={{ width: 280, borderRight: '1px solid #222', overflowY: 'auto', padding: 12 }}>
        <h2 style={{ color: '#ffd700', margin: '0 0 12px' }}>Agent Registry</h2>
        {loading && <p style={{ color: '#888' }}>Loading…</p>}
        {agents.map(a => (
          <button
            key={a.id}
            onClick={() => selectAgent(a)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '8px 10px',
              marginBottom: 4,
              cursor: 'pointer',
              background: selected?.id === a.id ? '#1a1a1a' : 'transparent',
              border: selected?.id === a.id ? '1px solid #ffd700' : '1px solid #333',
              borderRadius: 4,
              color: '#e0e0e0',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 13 }}>{a.display_name}</div>
            <div style={{ fontSize: 11, color: tierColor[a.tier] ?? '#888' }}>
              {a.tier} · v{a.lua_script_version} · {a.approval_policy}
              {!a.enabled && <span style={{ color: '#f44336', marginLeft: 6 }}>DISABLED</span>}
            </div>
          </button>
        ))}
      </aside>

      {/* Main panel */}
      <main style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {!selected ? (
          <div style={{ color: '#555', marginTop: 60, textAlign: 'center' }}>
            Select an agent to manage its versions.
          </div>
        ) : (
          <>
            <h2 style={{ color: '#ffd700', margin: '0 0 4px' }}>{selected.display_name}</h2>
            <p style={{ color: '#888', margin: '0 0 16px', fontSize: 13 }}>
              {selected.description}
            </p>

            {status && (
              <div
                style={{
                  padding: '8px 12px',
                  marginBottom: 16,
                  borderRadius: 4,
                  background: status.startsWith('Error') ? '#2d0000' : '#002d00',
                  border: `1px solid ${status.startsWith('Error') ? '#f44336' : '#4caf50'}`,
                  color: status.startsWith('Error') ? '#f44336' : '#4caf50',
                  fontSize: 13,
                }}
              >
                {status}
              </div>
            )}

            {/* Version history */}
            <h3 style={{ color: '#ccc', borderBottom: '1px solid #222', paddingBottom: 8 }}>
              Version History
            </h3>
            <div style={{ marginBottom: 20 }}>
              {versions.length === 0 && <p style={{ color: '#555' }}>No versions yet.</p>}
              {versions.map(v => {
                const isLive = v.version === selected.lua_script_version && !v.rolled_back_at;
                const isRolledBack = Boolean(v.rolled_back_at);
                return (
                  <div
                    key={v.id}
                    style={{
                      padding: '10px 14px',
                      marginBottom: 8,
                      borderRadius: 4,
                      background: '#111',
                      border: `1px solid ${isLive ? '#ffd700' : isRolledBack ? '#333' : '#222'}`,
                      opacity: isRolledBack ? 0.5 : 1,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontWeight: 700, color: isLive ? '#ffd700' : '#aaa' }}>
                        v{v.version}
                      </span>
                      {isLive && (
                        <span
                          style={{
                            background: '#ffd700',
                            color: '#000',
                            padding: '1px 6px',
                            borderRadius: 3,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          LIVE
                        </span>
                      )}
                      {isRolledBack && (
                        <span
                          style={{
                            background: '#333',
                            color: '#888',
                            padding: '1px 6px',
                            borderRadius: 3,
                            fontSize: 11,
                          }}
                        >
                          ROLLED BACK
                        </span>
                      )}
                      {v.promoted_at && !isRolledBack && (
                        <span style={{ color: '#4caf50', fontSize: 11 }}>promoted</span>
                      )}
                      <span style={{ color: '#555', fontSize: 11, marginLeft: 'auto' }}>
                        {v.author ?? 'unknown'} · {new Date(v.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {v.notes && (
                      <div style={{ color: '#aaa', fontSize: 12, marginTop: 4 }}>{v.notes}</div>
                    )}
                    {!isLive && !isRolledBack && (
                      <button
                        onClick={() => handlePromote(v.version)}
                        style={{
                          marginTop: 8,
                          padding: '4px 10px',
                          background: '#1a3a00',
                          border: '1px solid #4caf50',
                          color: '#4caf50',
                          borderRadius: 3,
                          cursor: 'pointer',
                          fontSize: 12,
                        }}
                      >
                        Promote to live
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Rollback */}
            {selected.lua_script_version > 1 && (
              <button
                onClick={handleRollback}
                style={{
                  padding: '6px 14px',
                  background: '#2d0000',
                  border: '1px solid #f44336',
                  color: '#f44336',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 13,
                  marginBottom: 24,
                }}
              >
                Roll back live version
              </button>
            )}

            {/* Create new version */}
            <h3 style={{ color: '#ccc', borderBottom: '1px solid #222', paddingBottom: 8 }}>
              Create Draft Version
            </h3>
            <input
              type="text"
              placeholder="Version notes (optional)"
              value={newNotes}
              onChange={e => setNewNotes(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                marginBottom: 8,
                background: '#111',
                border: '1px solid #333',
                color: '#e0e0e0',
                borderRadius: 4,
                boxSizing: 'border-box',
                fontFamily: 'monospace',
                fontSize: 13,
              }}
            />
            <textarea
              placeholder="Paste Lua script here…"
              value={newScript}
              onChange={e => setNewScript(e.target.value)}
              rows={18}
              style={{
                width: '100%',
                padding: '8px 10px',
                marginBottom: 10,
                background: '#111',
                border: '1px solid #333',
                color: '#e0e0e0',
                borderRadius: 4,
                boxSizing: 'border-box',
                fontFamily: 'monospace',
                fontSize: 12,
                resize: 'vertical',
              }}
            />
            <button
              onClick={handleCreateVersion}
              disabled={!newScript.trim()}
              style={{
                padding: '8px 18px',
                background: newScript.trim() ? '#1a1a3a' : '#111',
                border: `1px solid ${newScript.trim() ? '#ffd700' : '#333'}`,
                color: newScript.trim() ? '#ffd700' : '#555',
                borderRadius: 4,
                cursor: newScript.trim() ? 'pointer' : 'not-allowed',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Save as new draft version
            </button>
          </>
        )}
      </main>
    </div>
  );
}
