'use client';

import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { colors, radius, space, fontSize } from '@/styles/tokens';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

interface EventDetail {
  id: string;
  title: string;
  description: string | null;
  venue_name: string | null;
  venue_address: string | null;
  cover_image_url: string | null;
  starts_at: string;
  ends_at: string | null;
  max_attendees: number | null;
  is_free: boolean;
  ticket_url: string | null;
  status: string;
  organizer: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null;
  rsvp_counts: { going: number; maybe: number };
  attendees: { id: string; username: string; display_name: string | null; avatar_url: string | null }[];
}

export function EventDetail() {
  const t = useTranslations('events');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [rsvpStatus, setRsvpStatus] = useState<string | null>(null);
  const [rsvping, setRsvping] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      const res = await fetch(`/api/events/${id}`);
      if (!cancelled && res.ok) {
        const data = await res.json();
        setEvent(data);
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  // Check current user RSVP
  useEffect(() => {
    if (!id || !user || !event) return;
    async function check() {
      const { data } = await supabase
        .from('event_rsvps')
        .select('status')
        .eq('event_id', id!)
        .eq('user_id', user!.id)
        .maybeSingle();
      setRsvpStatus(data?.status || null);
    }
    check();
  }, [id, user, event]);

  async function handleRsvp(status: 'going' | 'maybe') {
    if (!user || !id) return;
    setRsvping(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(`/api/events/${id}/rsvp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.session?.access_token}`,
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setRsvpStatus(status);
        toast.success(status === 'going' ? t('rsvpGoing') : t('rsvpMaybe'));
        // Reload counts
        const detailRes = await fetch(`/api/events/${id}`);
        if (detailRes.ok) setEvent(await detailRes.json());
      }
    } finally {
      setRsvping(false);
    }
  }

  async function handleCancelRsvp() {
    if (!user || !id) return;
    const { data: session } = await supabase.auth.getSession();
    await fetch(`/api/events/${id}/rsvp`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.session?.access_token}` },
    });
    setRsvpStatus(null);
    toast.success(t('rsvpCancelled'));
    const detailRes = await fetch(`/api/events/${id}`);
    if (detailRes.ok) setEvent(await detailRes.json());
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }
  function formatTime(d: string) {
    return new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!event) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '64px 16px', textAlign: 'center', color: colors.text.faint }}>
        <p style={{ fontSize: fontSize.lg }}>{t('eventNotFound')}</p>
        <Button onClick={() => navigate('/events')} style={{ marginTop: space[5] }}>{t('backToEvents')}</Button>
      </div>
    );
  }

  const isPast = new Date(event.starts_at) < new Date();
  const spotsLeft = event.max_attendees ? event.max_attendees - event.rsvp_counts.going : null;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 16px 96px' }}>
      {/* Back link */}
      <Link to="/events" style={{ color: colors.text.muted, fontSize: fontSize.sm, textDecoration: 'none', marginBottom: space[5], display: 'block' }}>
        ← {t('backToEvents')}
      </Link>

      {/* Cover */}
      {event.cover_image_url && (
        <div style={{
          width: '100%', height: 280, borderRadius: radius.lg, overflow: 'hidden',
          marginBottom: space[6],
          background: `url(${event.cover_image_url}) center/cover`,
        }} />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: space[4], marginBottom: space[6] }}>
        <div>
          <h1 style={{ fontSize: fontSize['3xl'], fontWeight: 700, margin: 0, marginBottom: space[2] }}>{event.title}</h1>
          <p style={{ fontSize: fontSize.sm, color: colors.text.muted, margin: 0 }}>
            {t('byOrganizer', { name: event.organizer?.display_name || event.organizer?.username || '' })}
          </p>
        </div>

        <div style={{ display: 'flex', gap: space[2] }}>
          {/* Outside the status chain below so the organizer can still reach the
              editor for a cancelled or past event. */}
          {user && event.organizer?.id === user.id && (
            <Link to={`/events/${event.id}/edit`} style={{ textDecoration: 'none' }}>
              <Button variant="ghost" size="sm">{t('editEvent')}</Button>
            </Link>
          )}
          {event.status === 'cancelled' ? (
            <span style={{ color: colors.dangerStrong, fontWeight: 600 }}>{t('cancelled')}</span>
          ) : isPast ? (
            <span style={{ color: colors.text.faint, fontWeight: 600 }}>{t('pastEvent')}</span>
          ) : user ? (
            <>
              {rsvpStatus === 'going' ? (
                <Button onClick={handleCancelRsvp} variant="ghost" size="sm">{t('rsvpCancel')}</Button>
              ) : rsvpStatus === 'maybe' ? (
                <Button onClick={() => handleRsvp('going')} size="sm">{t('rsvpGoing')}</Button>
              ) : (
                <>
                  <Button onClick={() => handleRsvp('going')} loading={rsvping} size="sm">{t('rsvpGoing')}</Button>
                  <Button onClick={() => handleRsvp('maybe')} loading={rsvping} variant="ghost" size="sm">{t('rsvpMaybe')}</Button>
                </>
              )}
            </>
          ) : (
            <Button onClick={() => navigate('/login')} size="sm">{t('rsvpGoing')}</Button>
          )}
        </div>
      </div>

      {/* Meta */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: space[4], marginBottom: space[6],
        padding: space[4], background: colors.surface, borderRadius: radius.lg,
        border: `1px solid ${colors.border}`,
      }}>
        <div>
          <p style={{ fontSize: fontSize.xs, color: colors.text.faint, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{t('date')}</p>
          <p style={{ fontSize: fontSize.md, color: colors.text.primary, margin: 0, marginTop: space[1] }}>{formatDate(event.starts_at)}</p>
        </div>
        <div>
          <p style={{ fontSize: fontSize.xs, color: colors.text.faint, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{t('time')}</p>
          <p style={{ fontSize: fontSize.md, color: colors.text.primary, margin: 0, marginTop: space[1] }}>
            {formatTime(event.starts_at)}{event.ends_at ? ` – ${formatTime(event.ends_at)}` : ''}
          </p>
        </div>
        {event.venue_name && (
          <div>
            <p style={{ fontSize: fontSize.xs, color: colors.text.faint, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{t('venue')}</p>
            <p style={{ fontSize: fontSize.md, color: colors.text.primary, margin: 0, marginTop: space[1] }}>{event.venue_name}</p>
            {event.venue_address && <p style={{ fontSize: fontSize.sm, color: colors.text.muted, margin: 0 }}>{event.venue_address}</p>}
          </div>
        )}
        <div>
          <p style={{ fontSize: fontSize.xs, color: colors.text.faint, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{t('price')}</p>
          <p style={{ fontSize: fontSize.md, color: event.is_free ? colors.successStrong : colors.warning, fontWeight: 600, margin: 0, marginTop: space[1] }}>
            {event.is_free ? t('free') : t('ticketRequired')}
          </p>
        </div>
        {spotsLeft !== null && (
          <div>
            <p style={{ fontSize: fontSize.xs, color: colors.text.faint, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{t('spotsLeft')}</p>
            <p style={{ fontSize: fontSize.md, color: spotsLeft < 10 ? colors.warning : colors.text.primary, fontWeight: 600, margin: 0, marginTop: space[1] }}>
              {spotsLeft}
            </p>
          </div>
        )}
      </div>

      {/* Description */}
      {event.description && (
        <div style={{ marginBottom: space[6] }}>
          <h2 style={{ fontSize: fontSize.md, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: colors.text.muted, marginBottom: space[3] }}>
            {t('about')}
          </h2>
          <p style={{ fontSize: fontSize.base, color: colors.text.secondary, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {event.description}
          </p>
        </div>
      )}

      {/* Attendees */}
      {event.attendees && event.attendees.length > 0 && (
        <div>
          <h2 style={{ fontSize: fontSize.md, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: colors.text.muted, marginBottom: space[3] }}>
            {t('attendees')} ({event.attendees.length})
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[3] }}>
            {event.attendees.slice(0, 20).map(a => (
              <Link
                key={a.id}
                to={`/profile/${a.username}`}
                style={{ display: 'flex', alignItems: 'center', gap: space[2], textDecoration: 'none' }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: radius.full,
                  background: colors.surfaceHover, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                  border: `1px solid ${colors.border}`,
                }}>
                  {a.avatar_url ? (
                    <img src={a.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: fontSize.sm, color: colors.text.muted }}>
                      {(a.display_name || a.username || '?')[0].toUpperCase()}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: fontSize.sm, color: colors.text.secondary }}>
                  {a.display_name || a.username}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Ticket link */}
      {event.ticket_url && (
        <div style={{ marginTop: space[6] }}>
          <Button onClick={() => window.open(event.ticket_url!, '_blank')} size="lg">{t('getTickets')}</Button>
        </div>
      )}
    </div>
  );
}
