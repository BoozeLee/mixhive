'use client';

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { colors, radius, space, fontSize, shadow, transition } from '@/styles/tokens';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface Event {
  id: string;
  title: string;
  description: string | null;
  venue_name: string | null;
  venue_address: string | null;
  cover_image_url: string | null;
  starts_at: string;
  ends_at: string | null;
  is_free: boolean;
  ticket_url: string | null;
  rsvp_counts: { going: number; maybe: number };
  organizer: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

export function Events() {
  const t = useTranslations('events');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'upcoming' | 'all'>('upcoming');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ limit: '30' });
      if (filter === 'upcoming') params.set('upcoming', 'true');
      try {
        const res = await fetch(`/api/events?${params}`);
        if (!cancelled) {
          if (res.ok) {
            const data = await res.json();
            setEvents(data.events || []);
          } else {
            setError(`Failed to load events (${res.status})`);
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load events');
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [filter]);

  const cardStyle: React.CSSProperties = {
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.lg,
    overflow: 'hidden',
    textDecoration: 'none',
    color: colors.text.primary,
    transition: transition.base,
    display: 'flex',
    flexDirection: 'column',
  };

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }
  function formatTime(d: string) {
    return new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 16px 96px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: space[8],
        }}
      >
        <SectionHeading as="h1" eyebrow="EVENTS" title={t('title')} subtitle={t('subtitle')} />
        {user && (
          <Button onClick={() => navigate('/events/new')} size="sm">
            {t('createEvent')}
          </Button>
        )}
      </div>

      <div style={{ display: 'flex', gap: space[3], marginBottom: space[6], flexWrap: 'wrap' }}>
        {(['upcoming', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              background: filter === f ? colors.accent : 'transparent',
              color: filter === f ? colors.bg : colors.text.muted,
              border: `1px solid ${filter === f ? colors.accent : colors.border}`,
              borderRadius: radius.pill,
              padding: `${space[2]} ${space[5]}`,
              fontSize: fontSize.sm,
              fontWeight: 600,
              cursor: 'pointer',
              transition: transition.fast,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {f === 'upcoming' ? t('upcoming') : t('allEvents')}
          </button>
        ))}
      </div>

      {error && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: 16,
            background: 'rgba(255,85,85,0.1)',
            border: '1px solid rgba(255,85,85,0.3)',
            borderRadius: radius.md,
            color: colors.danger,
            fontSize: fontSize.sm,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: space[12] }}>
          <LoadingSpinner size="lg" />
        </div>
      ) : events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: space[12], color: colors.text.faint }}>
          <p style={{ fontSize: fontSize.lg, marginBottom: space[4] }}>{t('noEvents')}</p>
          <p style={{ fontSize: fontSize.base }}>{t('noEventsDescription')}</p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: space[5],
          }}
        >
          {events.map(event => (
            <Link
              key={event.id}
              to={`/events/${event.id}`}
              style={cardStyle}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = colors.accent;
                e.currentTarget.style.boxShadow = shadow.accent;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = colors.border;
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Cover image */}
              <div
                style={{
                  height: 160,
                  background: event.cover_image_url
                    ? `url(${event.cover_image_url}) center/cover`
                    : `linear-gradient(135deg, ${colors.surfaceHover}, ${colors.surface})`,
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                  padding: space[3],
                }}
              >
                <div
                  style={{
                    background: colors.bg,
                    borderRadius: radius.md,
                    padding: `${space[2]} ${space[3]}`,
                    textAlign: 'center',
                    minWidth: 52,
                  }}
                >
                  <div
                    style={{
                      fontSize: fontSize.xs,
                      color: colors.accent,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  >
                    {new Date(event.starts_at).toLocaleDateString(undefined, { month: 'short' })}
                  </div>
                  <div
                    style={{
                      fontSize: fontSize['2xl'],
                      fontWeight: 700,
                      color: colors.text.primary,
                      lineHeight: 1,
                    }}
                  >
                    {new Date(event.starts_at).getDate()}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: fontSize.xs,
                    fontWeight: 700,
                    color: event.is_free ? colors.successStrong : colors.warning,
                    background: event.is_free ? colors.successBg : colors.accentFaint,
                    padding: `${space[1]} ${space[3]}`,
                    borderRadius: radius.pill,
                  }}
                >
                  {event.is_free ? t('free') : t('ticketRequired')}
                </span>
              </div>

              <div
                style={{
                  padding: space[4],
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: space[2],
                }}
              >
                <h3 style={{ fontSize: fontSize.lg, fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
                  {event.title}
                </h3>
                <p style={{ fontSize: fontSize.sm, color: colors.text.muted, margin: 0 }}>
                  {formatDate(event.starts_at)} · {formatTime(event.starts_at)}
                  {event.ends_at && ` – ${formatTime(event.ends_at)}`}
                </p>
                {event.venue_name && (
                  <p style={{ fontSize: fontSize.sm, color: colors.text.dimmed, margin: 0 }}>
                    📍 {event.venue_name}
                  </p>
                )}
                <div
                  style={{
                    display: 'flex',
                    gap: space[4],
                    marginTop: 'auto',
                    paddingTop: space[3],
                  }}
                >
                  <span style={{ fontSize: fontSize.sm, color: colors.text.muted }}>
                    {event.rsvp_counts.going} {t('going')}
                  </span>
                  <span style={{ fontSize: fontSize.sm, color: colors.text.faint }}>
                    {event.rsvp_counts.maybe} {t('maybeLabel')}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
