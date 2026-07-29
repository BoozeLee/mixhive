import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from 'react-router-dom';
import { listVerificationRequests, reviewVerificationRequest } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import type { VerificationBadgeType, VerificationRequest } from '../lib/types';
import { Button } from '../components/ui/Button';
import { colors, radius, space } from '../styles/tokens';

export function AdminVerification() {
  const t = useTranslations('adminVerification');
  const { user, profile, loading: authLoading } = useAuth();
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      setRequests(await listVerificationRequests());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load verification requests');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (profile?.is_admin) void load();
    else if (!authLoading) setLoading(false);
  }, [profile?.is_admin, authLoading]);

  async function review(
    request: VerificationRequest,
    status: 'approved' | 'rejected',
    badgeType?: VerificationBadgeType
  ) {
    if (!user) return;
    setBusyId(request.id);
    try {
      await reviewVerificationRequest({
        requestId: request.id,
        status,
        badgeType,
        reason: reason.trim() || undefined,
      });
      setReason('');
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function batchReview(status: 'approved' | 'rejected', badgeType?: VerificationBadgeType) {
    if (!user || selectedIds.size === 0) return;
    setBatchBusy(true);
    try {
      const selectedRequests = requests.filter(
        request => selectedIds.has(request.id) && request.status === 'pending'
      );
      for (const request of selectedRequests) {
        await reviewVerificationRequest({
          requestId: request.id,
          status,
          badgeType: badgeType || request.requested_badge,
          reason: reason.trim() || undefined,
        });
      }
      setSelectedIds(new Set());
      setReason('');
      await load();
    } finally {
      setBatchBusy(false);
    }
  }

  function toggleSelected(requestId: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(requestId)) next.delete(requestId);
      else next.add(requestId);
      return next;
    });
  }

  if (authLoading || loading) {
    return (
      <div style={{ padding: 32, color: colors.text.muted }}>{t('loadingVerificationQueue')}</div>
    );
  }

  if (!profile?.is_admin) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 32, color: colors.text.muted }}>
        <h1 style={{ color: colors.text.primary }}>{t('verificationAdmin')}</h1>
        <p>{t('youDoNotHave')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px 96px' }}>
        <h1 style={{ color: colors.text.primary, fontSize: 24, margin: '0 0 8px' }}>
          {t('verificationAdmin')}
        </h1>
        <div
          style={{
            background: colors.dangerBg,
            border: `1px solid ${colors.danger}`,
            borderRadius: radius.md,
            padding: 16,
            color: colors.danger,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
        <Button onClick={load}>Retry</Button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px 96px' }}>
      <h1 style={{ color: colors.text.primary, fontSize: 24, margin: '0 0 8px' }}>
        {t('verificationAdmin')}
      </h1>
      <p style={{ color: colors.text.muted, margin: '0 0 24px' }}>
        Review DJ verification requests and grant profile badges.
      </p>

      <label
        style={{
          display: 'grid',
          gap: space[3],
          color: colors.text.secondary,
          fontSize: 13,
          marginBottom: space[8],
        }}
      >
        {t('reviewNote')}
        <textarea
          value={reason}
          onChange={event => setReason(event.target.value)}
          rows={3}
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

      {requests.some(request => request.status === 'pending') && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: space[4],
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.lg,
            padding: space[6],
            marginBottom: space[8],
          }}
        >
          <span style={{ color: colors.text.secondary, fontSize: 13, marginRight: 'auto' }}>
            {selectedIds.size} selected
          </span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              setSelectedIds(new Set(requests.filter(r => r.status === 'pending').map(r => r.id)))
            }
          >
            {t('selectPending')}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setSelectedIds(new Set())}>
            {t('clear')}
          </Button>
          <Button
            size="sm"
            loading={batchBusy}
            disabled={selectedIds.size === 0}
            onClick={() => batchReview('approved')}
          >
            {t('batchApprove')}
          </Button>
          <Button
            size="sm"
            variant="danger"
            loading={batchBusy}
            disabled={selectedIds.size === 0}
            onClick={() => batchReview('rejected')}
          >
            {t('batchReject')}
          </Button>
        </div>
      )}

      {requests.length === 0 ? (
        <p style={{ color: colors.text.dim }}>{t('noVerificationRequestsYet')}</p>
      ) : (
        <div style={{ display: 'grid', gap: space[6] }}>
          {requests.map(request => (
            <article
              key={request.id}
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
                }}
              >
                <div style={{ display: 'flex', gap: space[4], alignItems: 'flex-start' }}>
                  {request.status === 'pending' && (
                    <input
                      aria-label={`Select ${request.dj_name}`}
                      type="checkbox"
                      checked={selectedIds.has(request.id)}
                      onChange={() => toggleSelected(request.id)}
                      style={{ width: 18, height: 18, marginTop: 2 }}
                    />
                  )}
                  <div>
                    <h2 style={{ color: colors.text.primary, fontSize: 16, margin: 0 }}>
                      {request.dj_name}
                    </h2>
                    <p style={{ color: colors.text.dim, fontSize: 13, margin: '4px 0 0' }}>
                      Requested {request.requested_badge} · {request.status}
                    </p>
                    {request.profile && (
                      <Link
                        to={`/u/${request.profile.username}`}
                        style={{ color: colors.accent, fontSize: 13 }}
                      >
                        @{request.profile.username}
                      </Link>
                    )}
                  </div>
                </div>
                <span
                  style={{
                    color:
                      request.status === 'pending'
                        ? colors.accent
                        : request.status === 'approved'
                          ? colors.success
                          : colors.danger,
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {request.status}
                </span>
              </div>
              <p style={{ color: colors.text.secondary, fontSize: 14, lineHeight: 1.5 }}>
                {request.proof}
              </p>
              {Object.keys(request.links || {}).length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: space[4],
                    marginBottom: space[6],
                  }}
                >
                  {Object.entries(request.links).map(([key, value]) => (
                    <a
                      key={key}
                      href={value}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: colors.accent, fontSize: 13 }}
                    >
                      {key}
                    </a>
                  ))}
                </div>
              )}
              {request.status === 'pending' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[4] }}>
                  <Button
                    size="sm"
                    loading={busyId === request.id}
                    onClick={() => review(request, 'approved', request.requested_badge)}
                  >
                    {t('approve')}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={busyId === request.id}
                    onClick={() => review(request, 'approved', 'artist')}
                  >
                    {t('grantArtist')}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={busyId === request.id}
                    onClick={() => review(request, 'approved', 'official')}
                  >
                    {t('grantOfficial')}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    loading={busyId === request.id}
                    onClick={() => review(request, 'rejected')}
                  >
                    {t('reject')}
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
