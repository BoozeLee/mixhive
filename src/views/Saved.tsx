import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '../hooks/useAuth';
import { getLikedMixes } from '../lib/api';
import type { Mix } from '../lib/types';
import { colors, space } from '../styles/tokens';
import { SectionHeading } from '../components/ui/SectionHeading';
import { MixCard } from '../components/MixCard';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorComponent } from '../components/ErrorComponent';

export function SavedPage() {
  const t = useTranslations('saved');
  const { user } = useAuth();
  const [mixes, setMixes] = useState<Mix[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getLikedMixes(user.id).then(data => {
      setMixes(data);
      setLoading(false);
    }).catch(() => {
      setError('Failed to load saved mixes');
      setLoading(false);
    });
  }, [user]);

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: colors.text.dim }}>
        <p style={{ marginBottom: space[6] }}>{t('signInToSee')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px 96px' }}>
        <SectionHeading as="h1" eyebrow={t('eyebrow')} title={t('title')} />
        <ErrorComponent message={error} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px 96px' }}>
      <SectionHeading as="h1" eyebrow={t('eyebrow')} title={t('title')} />

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <LoadingSpinner size="lg" />
        </div>
      ) : mixes.length === 0 ? (
        <p style={{ color: colors.text.dim, textAlign: 'center', padding: 40 }}>
          {t('empty')}
        </p>
      ) : (
        <div style={{ display: 'grid', gap: space[4], marginTop: space[8] }}>
          {mixes.map(mix => (
            <MixCard key={mix.id} mix={mix} />
          ))}
        </div>
      )}
    </div>
  );
}
