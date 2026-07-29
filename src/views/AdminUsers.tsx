import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { isSupabaseConfigured } from '../lib/supabase';
import { colors, radius, space, fontSize } from '../styles/tokens';
import type { Profile } from '../lib/types';

const ADMIN_SECRET =
  typeof document !== 'undefined'
    ? document.cookie
        .split('; ')
        .find(r => r.startsWith('x-admin-secret='))
        ?.split('=')[1] || ''
    : '';

interface AuditEntry {
  id: string;
  created_at: string;
  signal_type: string;
  action_taken: string | null;
  severity: string;
  payload: Record<string, unknown>;
}

export function AdminUsers() {
  const t = useTranslations('adminUsers');
  const { profile, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [showBanned, setShowBanned] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [auditTarget, setAuditTarget] = useState<Profile | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [banReason, setBanReason] = useState('');

  const PAGE_SIZE = 20;

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (query) params.set('q', query);
      if (showBanned) params.set('banned', 'true');

      const res = await fetch(`/api/admin/users?${params}`, {
        headers: { 'x-admin-secret': ADMIN_SECRET },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to load users');
      setUsers(body.users);
      setTotal(body.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [query, page, showBanned]);

  useEffect(() => {
    if (profile?.is_admin && isSupabaseConfigured) void loadUsers();
    else if (!authLoading) setLoading(false);
  }, [profile?.is_admin, authLoading, loadUsers]);

  async function handleBan(userId: string) {
    setBusyId(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': ADMIN_SECRET,
        },
        body: JSON.stringify({ userId, action: 'ban', reason: banReason || undefined }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Ban failed');
      setBanReason('');
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ban failed');
    } finally {
      setBusyId(null);
    }
  }

  async function handleUnban(userId: string) {
    setBusyId(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': ADMIN_SECRET,
        },
        body: JSON.stringify({ userId, action: 'unban' }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Unban failed');
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unban failed');
    } finally {
      setBusyId(null);
    }
  }

  async function loadAudit(user: Profile) {
    setAuditTarget(user);
    setAuditLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/audit`, {
        headers: { 'x-admin-secret': ADMIN_SECRET },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to load audit log');
      setAuditLog(body.entries || []);
    } catch (_err) {
      setAuditLog([]);
    } finally {
      setAuditLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setQuery(searchInput.trim());
    setPage(1);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (authLoading) {
    return <div style={{ padding: 32, color: colors.text.muted }}>Loading admin...</div>;
  }

  if (!profile?.is_admin) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 32, color: colors.text.muted }}>
        <h1 style={{ color: colors.text.primary }}>User Management</h1>
        <p>You do not have access to this dashboard.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px 96px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h1 style={{ color: colors.text.primary, fontSize: 24, margin: 0 }}>
          {t('title')}
        </h1>
        <div style={{ display: 'flex', gap: space[3] }}>
          <Link to="/admin/verification" style={{ color: colors.accent, fontSize: 13 }}>
            Verification
          </Link>
          <Link to="/admin/moderation" style={{ color: colors.accent, fontSize: 13 }}>
            Moderation
          </Link>
          <Link to="/admin/invites" style={{ color: colors.accent, fontSize: 13 }}>
            Invites
          </Link>
        </div>
      </div>
      <p style={{ color: colors.text.muted, margin: '0 0 24px' }}>
        {t('subtitle')}
      </p>

      {/* Search + filter */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: space[3], marginBottom: space[5], flexWrap: 'wrap' }}>
        <input
          type="text"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder={t('searchPlaceholder')}
          style={{
            flex: 1,
            minWidth: 200,
            padding: '8px 12px',
            borderRadius: radius.md,
            border: `1px solid ${colors.border}`,
            background: colors.surface,
            color: colors.text.primary,
            fontSize: fontSize.sm,
          }}
        />
        <button
          type="submit"
          style={{
            padding: '8px 16px',
            borderRadius: radius.md,
            border: `1px solid ${colors.accent}`,
            background: colors.accent,
            color: colors.bg,
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: fontSize.sm,
          }}
        >
          {t('search')}
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: space[2], color: colors.text.muted, fontSize: fontSize.sm, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showBanned}
            onChange={e => { setShowBanned(e.target.checked); setPage(1); }}
          />
          {t('bannedOnly')}
        </label>
      </form>

      {error && (
        <div role="alert" style={{ padding: 12, marginBottom: 16, borderRadius: radius.md, background: colors.dangerBg, border: `1px solid ${colors.dangerStrong}`, color: colors.danger }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: colors.text.muted }}>{t('loading')}</p>
      ) : users.length === 0 ? (
        <p style={{ color: colors.text.dim, padding: 24, textAlign: 'center' }}>
          {query ? t('noResults') : t('noUsers')}
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: fontSize.sm }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${colors.border}`, color: colors.text.dim, textAlign: 'left' }}>
                <th style={{ padding: '8px 12px' }}>{t('colUser')}</th>
                <th style={{ padding: '8px 12px' }}>{t('colStatus')}</th>
                <th style={{ padding: '8px 12px' }}>{t('colMixes')}</th>
                <th style={{ padding: '8px 12px' }}>{t('colFollowers')}</th>
                <th style={{ padding: '8px 12px' }}>{t('colJoined')}</th>
                <th style={{ padding: '8px 12px' }}>{t('colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const isBanned = u.moderation_status === 'banned';
                return (
                  <tr key={u.id} style={{ borderBottom: `1px solid ${colors.borderSubtle}`, color: colors.text.primary }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: space[3] }}>
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: colors.surfaceMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.text.dim, fontSize: 12 }}>
                            {(u.username || '?')[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <Link to={`/profile/${u.username}`} style={{ color: colors.text.primary, textDecoration: 'none', fontWeight: 600 }}>
                            {u.display_name || u.username}
                          </Link>
                          <div style={{ color: colors.text.dim, fontSize: 11 }}>@{u.username}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {isBanned ? (
                        <span style={{ color: colors.danger, fontWeight: 600 }}>{t('banned')}</span>
                      ) : u.verified ? (
                        <span style={{ color: colors.accent }}>{t('verified')}</span>
                      ) : (
                        <span style={{ color: colors.text.dim }}>{t('active')}</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', color: colors.text.dim }}>{u.mix_count ?? 0}</td>
                    <td style={{ padding: '10px 12px', color: colors.text.dim }}>{u.followers_count ?? 0}</td>
                    <td style={{ padding: '10px 12px', color: colors.text.dim, fontSize: 11 }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: space[2], flexWrap: 'wrap' }}>
                        {isBanned ? (
                          <button
                            onClick={() => handleUnban(u.id)}
                            disabled={busyId === u.id}
                            style={{
                              padding: '4px 10px',
                              borderRadius: radius.md,
                              border: `1px solid ${colors.accent}`,
                              background: 'transparent',
                              color: colors.accent,
                              cursor: busyId === u.id ? 'default' : 'pointer',
                              fontSize: 11,
                            }}
                          >
                            {busyId === u.id ? '...' : t('unban')}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleBan(u.id)}
                            disabled={busyId === u.id}
                            style={{
                              padding: '4px 10px',
                              borderRadius: radius.md,
                              border: `1px solid ${colors.dangerStrong}`,
                              background: 'transparent',
                              color: colors.dangerStrong,
                              cursor: busyId === u.id ? 'default' : 'pointer',
                              fontSize: 11,
                            }}
                          >
                            {busyId === u.id ? '...' : t('ban')}
                          </button>
                        )}
                        <button
                          onClick={() => loadAudit(u)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: radius.md,
                            border: `1px solid ${colors.border}`,
                            background: 'transparent',
                            color: colors.text.muted,
                            cursor: 'pointer',
                            fontSize: 11,
                          }}
                        >
                          {t('audit')}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: space[3], marginTop: space[6] }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{
              padding: '6px 14px',
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              background: colors.surface,
              color: page <= 1 ? colors.text.faint : colors.text.muted,
              cursor: page <= 1 ? 'default' : 'pointer',
              fontSize: fontSize.sm,
            }}
          >
            {t('prev')}
          </button>
          <span style={{ color: colors.text.dim, padding: '6px 8px', fontSize: fontSize.sm }}>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{
              padding: '6px 14px',
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              background: colors.surface,
              color: page >= totalPages ? colors.text.faint : colors.text.muted,
              cursor: page >= totalPages ? 'default' : 'pointer',
              fontSize: fontSize.sm,
            }}
          >
            {t('next')}
          </button>
        </div>
      )}

      {/* Ban reason input */}
      {banReason && (
        <div style={{ marginTop: space[4] }}>
          <input
            type="text"
            value={banReason}
            onChange={e => setBanReason(e.target.value)}
            placeholder="Ban reason..."
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              background: colors.surface,
              color: colors.text.primary,
              fontSize: fontSize.sm,
            }}
          />
        </div>
      )}

      {/* Audit log modal */}
      {auditTarget && (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
          }}
          onClick={() => setAuditTarget(null)}
          onKeyDown={e => { if (e.key === 'Escape') setAuditTarget(null); }}
        >
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- Dialog dismissal via backdrop click; keyboard users Escape through the outer backdrop handler. */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-dialog-title"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: 600,
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto',
              background: colors.surface,
              borderRadius: radius.lg,
              border: `1px solid ${colors.border}`,
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 id="audit-dialog-title" style={{ margin: 0, color: colors.text.primary }}>
                {t('auditTitle')} — @{auditTarget.username}
              </h3>
              <button
                aria-label="Close audit log"
                onClick={() => setAuditTarget(null)}
                style={{ background: 'none', border: 'none', color: colors.text.dim, cursor: 'pointer', fontSize: 18 }}
              >
                ✕
              </button>
            </div>
            {auditLoading ? (
              <p style={{ color: colors.text.muted }}>{t('auditLoading')}</p>
            ) : auditLog.length === 0 ? (
              <p style={{ color: colors.text.dim }}>{t('auditEmpty')}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
                {auditLog.map(entry => (
                  <div
                    key={entry.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: radius.md,
                      background: 'rgba(0,0,0,0.15)',
                      border: `1px solid ${colors.borderSubtle}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{
                        color: entry.signal_type.includes('ban') ? colors.dangerStrong : colors.accent,
                        fontWeight: 600,
                        fontSize: 12,
                      }}>
                        {entry.signal_type === 'admin_ban' ? 'Ban' : entry.signal_type === 'admin_unban' ? 'Unban' : entry.signal_type}
                      </span>
                      <span style={{ color: colors.text.dim, fontSize: 11 }}>
                        {new Date(entry.created_at).toLocaleString()}
                      </span>
                    </div>
                    {entry.action_taken && (
                      <div style={{ color: colors.text.muted, fontSize: 12 }}>
                        Action: {entry.action_taken}
                      </div>
                    )}
                    {entry.payload?.reason && (
                      <div style={{ color: colors.text.dim, fontSize: 12, fontStyle: 'italic' }}>
                        Reason: {entry.payload.reason as string}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}