import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createVerificationRequest, getMyVerificationRequest } from '../lib/api';
import type { Profile, VerificationBadgeType, VerificationRequest } from '../lib/types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { colors, radius, space } from '../styles/tokens';

interface Props {
  profile: Profile;
}

export function VerificationRequestForm({ profile }: Props) {
  const t = useTranslations('verificationRequestForm');
  const [request, setRequest] = useState<VerificationRequest | null>(null);
  const [djName, setDjName] = useState(profile.display_name || profile.username);
  const [requestedBadge, setRequestedBadge] = useState<VerificationBadgeType>('verified');
  const [website, setWebsite] = useState(profile.website || '');
  const [social, setSocial] = useState('');
  const [proof, setProof] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getMyVerificationRequest(profile.id)
      .then(latest => {
        if (!cancelled) {
          setRequest(latest);
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [profile.id]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (proof.trim().length < 40) {
      setError('Add a short proof summary with at least 40 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const next = await createVerificationRequest({
        profileId: profile.id,
        djName,
        requestedBadge,
        proof,
        links: {
          ...(website.trim() ? { website: website.trim() } : {}),
          ...(social.trim() ? { social: social.trim() } : {}),
        },
      });
      setRequest(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit verification request.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;

  if (request) {
    return (
      <section
        style={{
          border: `1px solid ${colors.border}`,
          background: colors.surface,
          borderRadius: radius.lg,
          padding: space[8],
          marginBottom: space[10],
        }}
      >
        <h2 style={{ margin: 0, color: colors.text.primary, fontSize: 16 }}>
          {t('verificationRequest')}
        </h2>
        <p style={{ color: colors.text.muted, fontSize: 13, margin: '8px 0 0' }}>
          Status:{' '}
          <strong
            style={{
              color:
                request.status === 'rejected'
                  ? colors.danger
                  : request.status === 'approved'
                    ? colors.success
                    : colors.accent,
            }}
          >
            {request.status}
          </strong>
        </p>
        {request.rejection_reason && (
          <p style={{ color: colors.text.secondary, fontSize: 13, margin: '8px 0 0' }}>
            {request.rejection_reason}
          </p>
        )}
      </section>
    );
  }

  return (
    <section
      style={{
        border: `1px solid ${colors.border}`,
        background: colors.surface,
        borderRadius: radius.lg,
        padding: space[8],
        marginBottom: space[10],
      }}
    >
      <h2 style={{ margin: 0, color: colors.text.primary, fontSize: 16 }}>
        {t('requestVerification')}
      </h2>
      <form onSubmit={submit} style={{ display: 'grid', gap: space[6], marginTop: space[6] }}>
        <Input
          label={t('djOrArtistName')}
          value={djName}
          onChange={event => setDjName(event.target.value)}
          required
        />
        <label
          style={{ color: colors.text.secondary, fontSize: 13, display: 'grid', gap: space[3] }}
        >
          {t('badgeType')}
          <select
            value={requestedBadge}
            onChange={event => setRequestedBadge(event.target.value as VerificationBadgeType)}
            style={{
              background: colors.bg,
              color: colors.text.primary,
              border: `1px solid ${colors.borderStrong}`,
              borderRadius: radius.md,
              padding: '8px 10px',
            }}
          >
            <option value="verified">{t('verified')}</option>
            <option value="artist">{t('artist')}</option>
            <option value="official">{t('official')}</option>
          </select>
        </label>
        <Input
          label={t('website')}
          value={website}
          onChange={event => setWebsite(event.target.value)}
          placeholder={t('https')}
        />
        <Input
          label={t('socialOrMusicLink')}
          value={social}
          onChange={event => setSocial(event.target.value)}
          placeholder={t('soundcloudMixcloudInstagramPress')}
        />
        <Textarea
          label={t('proof')}
          value={proof}
          onChange={event => setProof(event.target.value)}
          rows={4}
          placeholder={t('tellUsHowListeners')}
          error={error || undefined}
        />
        <Button type="submit" loading={submitting}>
          {t('submitRequest')}
        </Button>
      </form>
    </section>
  );
}
