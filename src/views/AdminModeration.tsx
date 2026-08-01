import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from 'react-router-dom';
import { listModerationSignals, reviewModerationSignal } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import type { ModerationAction, ModerationSignal, ModerationSignalStatus } from '../lib/types';
import { Button } from '../components/ui/Button';
import { colors, radius, space } from '../styles/tokens';

const STATUS_FILTERS: { value: ModerationSignalStatus | ''; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'actioned', label: 'Actioned' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: '', label: 'All' },
];

const SEVERITY_COLOR: Record<string, string> = {
  low: colors.text.dim,
  medium: colors.accent,
  high: colors.accentAmber,
  critical: colors.danger,
};

export function AdminModeration() {
  const t = useTranslations('adminModeration');
  const { user, profile, loading: authLoading } = useAuth();
  const [signals, setSignals] = useState<ModerationSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ModerationSignalStatus | ''>('open');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setSignals(await listModerationSignals(statusFilter || undefined));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load moderation queue');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (profile?.is_admin) void load();
    else if (!authLoading) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.is_admin, authLoading, statusFilter]);

  async function act(signal: ModerationSignal, action: ModerationAction) {
    if (!user) return;
    setBusyId(signal.id);
    try {
      await reviewModerationSignal({
        signalId: signal.id,
        action,
        notes: notes.trim() || undefined,
      });
      setNotes('');
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (authLoading || loading) {
    return (
      <div style={{ padding: 32, color: colors.text.muted }}>{t('loadingModerationQueue')}</div>
    );
  }

  if (!profile?.is_admin) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 32, color: colors.text.muted }}>
        <h1 style={{ color: colors.text.primary }}>{t('moderation')}</h1>
        <p>{t('youDoNotHave')}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px 96px' }}>
      {error && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            marginBottom: 16,
            background: 'rgba(255,85,85,0.1)',
            border: '1px solid rgba(255,85,85,0.3)',
            borderRadius: radius.md,
            color: colors.danger,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <h1 style={{ color: colors.text.primary, fontSize: 24, margin: '0 0 8px' }}>
        {t('moderation')}
      </h1>
      <p style={{ color: colors.text.muted, margin: '0 0 24px' }}>
        Review flagged content and user reports. Hide removes the item; Ban suspends the owner.
      </p>

      <div style={{ display: 'flex', gap: space[3], flexWrap: 'wrap', marginBottom: space[6] }}>
        {STATUS_FILTERS.map(f => (
          <button
            key={f.label}
            onClick={() => setStatusFilter(f.value)}
            style={{
              background: statusFilter === f.value ? colors.accent : 'transparent',
              color: statusFilter === f.value ? colors.bg : colors.text.secondary,
              border: `1px solid ${statusFilter === f.value ? colors.accent : colors.border}`,
              borderRadius: radius.pill,
              padding: '4px 14px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <label
        style={{
          display: 'grid',
          gap: space[3],
          color: colors.text.secondary,
          fontSize: 13,
          marginBottom: space[8],
        }}
      >
        {t('resolutionNoteAppliedTo')}
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          style={{
            background: colors.bg,
            border: `1px solid ${colors.borderStrong}`,
            borderRadius: radius.md,
            color: colors.text.primary,
            padding: space[5],
            resize: 'vertical',
          }}
        />
      </label>

      {signals.length === 0 ? (
        <p style={{ color: colors.text.dim }}>{t('nothingInThisQueue')}</p>
      ) : (
        <div style={{ display: 'grid', gap: space[6] }}>
          {signals.map(signal => {
            const reason =
              typeof signal.payload?.reason === 'string'
                ? signal.payload.reason
                : typeof signal.payload?.text === 'string'
                  ? signal.payload.text
                  : '';
            return (
              <article
                key={signal.id}
                style={{
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.lg,
                  padding: space[8],
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: space[6],
                    flexWrap: 'wrap',
                    marginBottom: space[4],
                  }}
                >
                  <div>
                    <h2 style={{ color: colors.text.primary, fontSize: 15, margin: 0 }}>
                      {signal.signal_type} · {signal.source_table}
                    </h2>
                    <p style={{ color: colors.text.dim, fontSize: 12, margin: '4px 0 0' }}>
                      {new Date(signal.created_at).toLocaleString()} · by {signal.flagged_by}
                    </p>
                  </div>
                  <span
                    style={{
                      color: SEVERITY_COLOR[signal.severity] ?? colors.text.dim,
                      fontSize: 12,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  >
                    {signal.severity} · {signal.status}
                  </span>
                </div>

                {reason && (
                  <p style={{ color: colors.text.secondary, fontSize: 14, lineHeight: 1.5 }}>
                    {reason}
                  </p>
                )}
                {signal.source_id && (
                  <p style={{ color: colors.text.dim, fontSize: 12, margin: '0 0 12px' }}>
                    Target: {signal.source_table}/{signal.source_id}
                  </p>
                )}

                {signal.status !== 'actioned' && signal.status !== 'dismissed' ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[4] }}>
                    <Button
                      size="sm"
                      variant="danger"
                      loading={busyId === signal.id}
                      onClick={() => act(signal, 'hide')}
                    >
                      {t('hideContent')}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      loading={busyId === signal.id}
                      onClick={() => act(signal, 'ban')}
                    >
                      {t('banOwner')}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={busyId === signal.id}
                      onClick={() => act(signal, 'dismiss')}
                    >
                      {t('dismiss')}
                    </Button>
                  </div>
                ) : (
                  <p style={{ color: colors.text.dim, fontSize: 12, margin: 0 }}>
                    {signal.action_taken ? `Actioned: ${signal.action_taken}` : 'Resolved'}
                    {signal.resolution_notes ? ` — ${signal.resolution_notes}` : ''}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: space[10] }}>
        <Link to="/admin/verification" style={{ color: colors.accent, fontSize: 13 }}>
          → Verification queue
        </Link>
      </div>
    </div>
  );
}
