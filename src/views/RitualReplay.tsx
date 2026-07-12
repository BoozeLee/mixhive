import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useParams } from 'react-router-dom';
import { ritualRequest, type RitualSnapshot } from '../lib/rituals';
import { colors, fontSize, radius, space } from '../styles/tokens';

export function RitualReplay() {
  const t = useTranslations('ritualReplay');
  const { id } = useParams<{ id: string }>();
  const [snapshot, setSnapshot] = useState<RitualSnapshot | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    void ritualRequest<RitualSnapshot>(`/api/mythic/sessions/${id}`)
      .then(setSnapshot)
      .catch(cause => setError(cause instanceof Error ? cause.message : t('unavailable')));
  }, [id, t]);

  if (error) return <div style={{ padding: 40, color: colors.danger }}>{error}</div>;
  if (!snapshot)
    return <div style={{ padding: 40, color: colors.text.muted }}>{t('loading')}</div>;

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: `${space[12]}px ${space[8]}px 120px` }}>
      <Link to={`/session/${snapshot.session.id}`} style={{ color: colors.accent }}>
        ← {t('backToSession')}
      </Link>
      <h1 style={{ fontSize: fontSize['3xl'] }}>
        {t('titleSuffix', { title: snapshot.session.title })}
      </h1>
      <p style={{ color: colors.text.muted }}>{t('subtitle')}</p>
      <div style={{ marginTop: 24 }}>
        {snapshot.events.map(event => (
          <article
            key={event.id}
            style={{
              borderLeft: `2px solid ${event.actor_type === 'agent' ? colors.accent : colors.borderStrong}`,
              padding: 14,
              marginBottom: 8,
              background: colors.surface,
              borderRadius: radius.md,
            }}
          >
            <strong>{event.event_type.replaceAll('_', ' ')}</strong>
            <div style={{ color: colors.text.muted, fontSize: fontSize.sm }}>
              {new Date(event.created_at).toLocaleString()} · {event.actor_type}
            </div>
            {typeof event.payload.message === 'string' && <p>{event.payload.message}</p>}
          </article>
        ))}
        {snapshot.events.length === 0 && (
          <div style={{ color: colors.text.muted }}>{t('empty')}</div>
        )}
      </div>
    </div>
  );
}
