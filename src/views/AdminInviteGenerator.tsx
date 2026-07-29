import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { isSupabaseConfigured } from '../lib/supabase';
import { colors, radius, space, fontSize, fontWeight } from '../styles/tokens';

const ADMIN_SECRET =
  typeof document !== 'undefined'
    ? document.cookie
        .split('; ')
        .find(r => r.startsWith('x-admin-secret='))
        ?.split('=')[1] || ''
    : '';

interface Invite {
  id: string;
  code: string;
  label: string | null;
  max_uses: number;
  uses_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export function AdminInviteGenerator() {
  const { profile, loading: authLoading } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [lastCreated, setLastCreated] = useState<Invite | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [label, setLabel] = useState('');
  const [maxUses, setMaxUses] = useState(5);
  const [expiresAt, setExpiresAt] = useState('');

  const loadInvites = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/invites/list?limit=100', {
        headers: { 'x-admin-secret': ADMIN_SECRET },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to load invites');
      setInvites(body.invites);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invites');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profile?.is_admin && isSupabaseConfigured) void loadInvites();
    else if (!authLoading) setLoading(false);
  }, [profile?.is_admin, authLoading, loadInvites]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    try {
      const res = await fetch('/api/invites/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': ADMIN_SECRET,
        },
        body: JSON.stringify({
          label: label.trim() || undefined,
          max_uses: maxUses,
          expires_at: expiresAt || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate invite');
      setLastCreated(data);
      setLabel('');
      setMaxUses(5);
      setExpiresAt('');
      await loadInvites();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate invite');
    } finally {
      setGenerating(false);
    }
  }

  function inviteUrl(code: string) {
    return `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${code}`;
  }

  async function copyLink(code: string) {
    try {
      await navigator.clipboard.writeText(inviteUrl(code));
      setCopiedId(code);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      /* fallback: prompt */
      prompt('Copy invite link:', inviteUrl(code));
    }
  }

  if (authLoading) {
    return <div style={{ padding: 32, color: colors.text.muted }}>Loading admin...</div>;
  }

  if (!profile?.is_admin) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <h1 style={{ color: colors.text.primary }}>Admin Access Required</h1>
        <p style={{ color: colors.text.muted }}>You need admin privileges to access this page.</p>
        <Link to="/feed" style={{ color: colors.accent }}>
          Back to Feed
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
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
            Invite Generator
          </h1>
          <p style={{ fontSize: fontSize.md, color: colors.text.muted, marginTop: 4 }}>
            Create and manage founding member invite codes.
          </p>
        </div>
        <div style={{ display: 'flex', gap: space[3] }}>
          <Link
            to="/admin/users"
            style={{
              padding: '6px 14px',
              borderRadius: radius.md,
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              color: colors.text.muted,
              fontSize: fontSize.sm,
              textDecoration: 'none',
            }}
          >
            Users
          </Link>
          <Link
            to="/admin/verification"
            style={{
              padding: '6px 14px',
              borderRadius: radius.md,
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              color: colors.text.muted,
              fontSize: fontSize.sm,
              textDecoration: 'none',
            }}
          >
            Verification
          </Link>
        </div>
      </div>

      {/* Generate form */}
      <div
        style={{
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.lg,
          padding: space[8],
          marginBottom: space[8],
        }}
      >
        <h2
          style={{
            margin: `0 0 ${space[6]}px`,
            fontSize: fontSize.lg,
            fontWeight: fontWeight.semibold,
            color: colors.text.primary,
          }}
        >
          Generate Invite Code
        </h2>
        <form onSubmit={handleGenerate}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: space[5],
              marginBottom: space[6],
            }}
          >
            <div>
              <label
                htmlFor="invite-label"
                style={{
                  display: 'block',
                  fontSize: fontSize.sm,
                  color: colors.text.muted,
                  marginBottom: 4,
                }}
              >
                Label (optional)
              </label>
              <input
                id="invite-label"
                type="text"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="e.g. Founding Member batch 1"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: radius.md,
                  border: `1px solid ${colors.border}`,
                  background: colors.bg,
                  color: colors.text.primary,
                  fontSize: fontSize.sm,
                  outline: 'none',
                }}
              />
            </div>
            <div>
              <label
                htmlFor="invite-max-uses"
                style={{
                  display: 'block',
                  fontSize: fontSize.sm,
                  color: colors.text.muted,
                  marginBottom: 4,
                }}
              >
                Max Uses
              </label>
              <input
                id="invite-max-uses"
                type="number"
                min={1}
                max={1000}
                value={maxUses}
                onChange={e => setMaxUses(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: radius.md,
                  border: `1px solid ${colors.border}`,
                  background: colors.bg,
                  color: colors.text.primary,
                  fontSize: fontSize.sm,
                  outline: 'none',
                }}
              />
            </div>
            <div>
              <label
                htmlFor="invite-expires"
                style={{
                  display: 'block',
                  fontSize: fontSize.sm,
                  color: colors.text.muted,
                  marginBottom: 4,
                }}
              >
                Expires (optional)
              </label>
              <input
                id="invite-expires"
                type="datetime-local"
                value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: radius.md,
                  border: `1px solid ${colors.border}`,
                  background: colors.bg,
                  color: colors.text.primary,
                  fontSize: fontSize.sm,
                  outline: 'none',
                }}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={generating}
            style={{
              padding: '8px 20px',
              borderRadius: radius.md,
              background: generating ? colors.surfaceMuted : colors.accent,
              color: generating ? colors.text.faint : colors.bg,
              border: 'none',
              fontWeight: fontWeight.semibold,
              fontSize: fontSize.sm,
              cursor: generating ? 'not-allowed' : 'pointer',
            }}
          >
            {generating ? 'Generating...' : 'Generate Code'}
          </button>
        </form>
      </div>

      {/* Last created banner */}
      {lastCreated && (
        <div
          style={{
            background: `${colors.accent}15`,
            border: `1px solid ${colors.accent}44`,
            borderRadius: radius.lg,
            padding: space[6],
            marginBottom: space[8],
          }}
        >
          <div
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              color: colors.accent,
              marginBottom: 4,
            }}
          >
            Invite created!
          </div>
          <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text.primary, fontFamily: 'monospace' }}>
            {lastCreated.code}
          </div>
          <div
            style={{
              display: 'flex',
              gap: space[3],
              marginTop: space[4],
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={() => copyLink(lastCreated.code)}
              style={{
                padding: '6px 14px',
                borderRadius: radius.md,
                background: colors.accent,
                color: colors.bg,
                border: 'none',
                fontWeight: fontWeight.semibold,
                fontSize: fontSize.sm,
                cursor: 'pointer',
              }}
            >
              {copiedId === lastCreated.code ? 'Copied!' : 'Copy Link'}
            </button>
            <button
              type="button"
              onClick={() => setLastCreated(null)}
              style={{
                padding: '6px 14px',
                borderRadius: radius.md,
                background: 'transparent',
                color: colors.text.muted,
                border: `1px solid ${colors.border}`,
                fontSize: fontSize.sm,
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            marginBottom: space[6],
            background: 'rgba(255,85,85,0.1)',
            border: '1px solid rgba(255,85,85,0.3)',
            borderRadius: radius.md,
            color: colors.danger,
            fontSize: fontSize.sm,
          }}
        >
          {error}
          <button
            onClick={() => setError(null)}
            style={{
              marginLeft: 12,
              background: 'transparent',
              border: 'none',
              color: colors.danger,
              cursor: 'pointer',
              fontSize: fontSize.sm,
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Invites list */}
      <div
        style={{
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.lg,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: `${space[5]}px ${space[6]}px`,
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: fontSize.lg,
              fontWeight: fontWeight.semibold,
              color: colors.text.primary,
            }}
          >
            Existing Invites ({invites.length})
          </h2>
        </div>

        {loading ? (
          <div style={{ padding: space[10], textAlign: 'center', color: colors.text.muted }}>
            Loading invites...
          </div>
        ) : invites.length === 0 ? (
          <div style={{ padding: space[10], textAlign: 'center', color: colors.text.muted }}>
            No invites generated yet.
          </div>
        ) : (
          <div>
            {invites.map(invite => {
              const usedPct = invite.max_uses > 0 ? (invite.uses_count / invite.max_uses) * 100 : 0;
              const isExhausted = invite.uses_count >= invite.max_uses;
              const isExpired = invite.expires_at ? new Date(invite.expires_at) < new Date() : false;
              const isDisabled = !invite.is_active || isExhausted || isExpired;

              return (
                <div
                  key={invite.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: space[5],
                    padding: `${space[4]}px ${space[6]}px`,
                    borderBottom: `1px solid ${colors.border}`,
                    opacity: isDisabled ? 0.5 : 1,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ minWidth: 140 }}>
                    <div
                      style={{
                        fontSize: fontSize.sm,
                        fontFamily: 'monospace',
                        fontWeight: fontWeight.bold,
                        color: colors.text.primary,
                      }}
                    >
                      {invite.code}
                    </div>
                    {invite.label && (
                      <div style={{ fontSize: fontSize.xs, color: colors.text.muted, marginTop: 2 }}>
                        {invite.label}
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 100 }}>
                    {/* Progress bar */}
                    <div
                      style={{
                        height: 6,
                        borderRadius: 3,
                        background: colors.bg,
                        overflow: 'hidden',
                        marginBottom: 4,
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(usedPct, 100)}%`,
                          borderRadius: 3,
                          background: isExhausted ? colors.danger : colors.accent,
                          transition: 'width 0.3s',
                        }}
                      />
                    </div>
                    <div style={{ fontSize: fontSize.xs, color: colors.text.muted }}>
                      {invite.uses_count}/{invite.max_uses} used
                      {invite.expires_at && (
                        <>
                          {' '}&middot;{' '}
                          {isExpired ? 'Expired' : `Expires ${new Date(invite.expires_at).toLocaleDateString()}`}
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: space[2], flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => copyLink(invite.code)}
                      disabled={isDisabled}
                      style={{
                        padding: '4px 10px',
                        borderRadius: radius.sm,
                        background: 'transparent',
                        border: `1px solid ${colors.border}`,
                        color: isDisabled ? colors.text.faint : colors.text.muted,
                        fontSize: fontSize.xs,
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {copiedId === invite.code ? 'Copied!' : 'Copy Link'}
                    </button>
                    {!invite.is_active && (
                      <span
                        style={{
                          padding: '4px 8px',
                          borderRadius: radius.sm,
                          background: 'rgba(255,85,85,0.15)',
                          color: colors.danger,
                          fontSize: fontSize.xs,
                        }}
                      >
                        Disabled
                      </span>
                    )}
                    {isExhausted && (
                      <span
                        style={{
                          padding: '4px 8px',
                          borderRadius: radius.sm,
                          background: `${colors.accent}20`,
                          color: colors.accent,
                          fontSize: fontSize.xs,
                        }}
                      >
                        Full
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
