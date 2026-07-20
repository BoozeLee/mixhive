'use client';

import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { colors, radius, space, fontSize, transition } from '@/styles/tokens';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

type EventStatus = 'draft' | 'published' | 'cancelled' | 'completed';

/**
 * Format an ISO-8601 instant for `<input type="datetime-local">`, which expects
 * local wall-clock time as `YYYY-MM-DDTHH:mm`.
 *
 * The tempting `new Date(iso).toISOString().slice(0, 16)` is wrong: it
 * re-serialises in UTC, so for any user not on UTC the field would show a time
 * shifted by their offset — and saving would write that shifted value back,
 * walking the event's start time a little further on every edit.
 */
function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '';
  const localMs = parsed.getTime() - parsed.getTimezoneOffset() * 60_000;
  return new Date(localMs).toISOString().slice(0, 16);
}

export function EditEvent() {
  const t = useTranslations('events');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [venueName, setVenueName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [isFree, setIsFree] = useState(true);
  const [ticketUrl, setTicketUrl] = useState('');
  const [status, setStatus] = useState<EventStatus>('draft');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      try {
        // Authenticated: a draft is only visible to its organizer, and editing
        // a draft is the main reason to be on this screen.
        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token;
        const res = await fetch(`/api/events/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (cancelled) return;

        if (!res.ok) {
          setError(t('eventNotFound'));
          return;
        }

        const event = await res.json();
        if (cancelled) return;

        // The server enforces organizer-only on PATCH; this is the affordance so
        // a non-organizer sees why rather than filling in a form that 403s.
        if (!user || event.organizer?.id !== user.id) {
          setError(t('notYourEvent'));
          return;
        }

        setTitle(event.title ?? '');
        setDescription(event.description ?? '');
        setVenueName(event.venue_name ?? '');
        setVenueAddress(event.venue_address ?? '');
        setStartsAt(toLocalInputValue(event.starts_at));
        setEndsAt(toLocalInputValue(event.ends_at));
        setIsFree(event.is_free ?? true);
        setTicketUrl(event.ticket_url ?? '');
        setStatus((event.status as EventStatus) ?? 'draft');
      } catch {
        if (!cancelled) setError(t('loadFailed'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id, user, t]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !startsAt) return;
    setSubmitting(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(`/api/events/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.session?.access_token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          venue_name: venueName.trim() || null,
          venue_address: venueAddress.trim() || null,
          starts_at: new Date(startsAt).toISOString(),
          ends_at: endsAt ? new Date(endsAt).toISOString() : null,
          is_free: isFree,
          ticket_url: ticketUrl.trim() || null,
          status,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || t('updateFailed'));
        return;
      }

      toast.success(t('eventUpdated'));
      navigate(`/events/${id}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelEvent() {
    if (!window.confirm(t('cancelEventConfirm'))) return;
    setCancelling(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(`/api/events/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.session?.access_token}` },
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || t('updateFailed'));
        return;
      }

      toast.success(t('eventCancelled'));
      navigate(`/events/${id}`);
    } finally {
      setCancelling(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    background: colors.bg,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    padding: `${space[3]} ${space[4]}`,
    color: colors.text.primary,
    fontSize: fontSize.base,
    width: '100%',
    outline: 'none',
    transition: transition.fast,
  };

  // Error before loading: an unauthorized or missing event resolves with
  // loading still true, and gating on loading first would spin forever.
  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: colors.danger }}>{error}</div>
    );
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 16px 96px' }}>
      <Link
        to={`/events/${id}`}
        style={{
          color: colors.text.muted,
          fontSize: fontSize.sm,
          textDecoration: 'none',
          marginBottom: space[5],
          display: 'block',
        }}
      >
        ← {t('backToEvents')}
      </Link>

      <h1 style={{ fontSize: fontSize['2xl'], fontWeight: 700, marginBottom: space[6] }}>
        {t('editEvent')}
      </h1>

      {status === 'cancelled' && (
        <p
          style={{
            color: colors.danger,
            fontSize: fontSize.sm,
            marginBottom: space[5],
          }}
        >
          {t('cancelled')}
        </p>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: space[5] }}>
        <div>
          <label
            htmlFor="event-title"
            style={{ fontSize: fontSize.sm, color: colors.text.muted, display: 'block', marginBottom: space[2] }}
          >
            {t('eventTitle')} *
          </label>
          <Input
            id="event-title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={t('eventTitlePlaceholder')}
            maxLength={200}
            required
            style={inputStyle}
          />
        </div>

        <div>
          <label
            htmlFor="event-description"
            style={{ fontSize: fontSize.sm, color: colors.text.muted, display: 'block', marginBottom: space[2] }}
          >
            {t('description')}
          </label>
          <Textarea
            id="event-description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={t('eventDescriptionPlaceholder')}
            maxLength={5000}
            rows={4}
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: space[4] }}>
          <div>
            <label
              htmlFor="event-venue-name"
              style={{ fontSize: fontSize.sm, color: colors.text.muted, display: 'block', marginBottom: space[2] }}
            >
              {t('venueName')}
            </label>
            <Input
              id="event-venue-name"
              value={venueName}
              onChange={e => setVenueName(e.target.value)}
              placeholder={t('venueNamePlaceholder')}
              maxLength={200}
              style={inputStyle}
            />
          </div>
          <div>
            <label
              htmlFor="event-venue-address"
              style={{ fontSize: fontSize.sm, color: colors.text.muted, display: 'block', marginBottom: space[2] }}
            >
              {t('venueAddress')}
            </label>
            <Input
              id="event-venue-address"
              value={venueAddress}
              onChange={e => setVenueAddress(e.target.value)}
              placeholder={t('venueAddressPlaceholder')}
              maxLength={500}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: space[4] }}>
          <div>
            <label
              htmlFor="event-starts-at"
              style={{ fontSize: fontSize.sm, color: colors.text.muted, display: 'block', marginBottom: space[2] }}
            >
              {t('startDate')} *
            </label>
            <input
              id="event-starts-at"
              type="datetime-local"
              value={startsAt}
              onChange={e => setStartsAt(e.target.value)}
              required
              style={{ ...inputStyle, colorScheme: 'dark' }}
            />
          </div>
          <div>
            <label
              htmlFor="event-ends-at"
              style={{ fontSize: fontSize.sm, color: colors.text.muted, display: 'block', marginBottom: space[2] }}
            >
              {t('endDate')}
            </label>
            <input
              id="event-ends-at"
              type="datetime-local"
              value={endsAt}
              onChange={e => setEndsAt(e.target.value)}
              style={{ ...inputStyle, colorScheme: 'dark' }}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="event-status"
            style={{ fontSize: fontSize.sm, color: colors.text.muted, display: 'block', marginBottom: space[2] }}
          >
            {t('statusLabel')}
          </label>
          <select
            id="event-status"
            value={status}
            onChange={e => setStatus(e.target.value as EventStatus)}
            style={{ ...inputStyle, colorScheme: 'dark' }}
          >
            <option value="draft">{t('statusDraft')}</option>
            <option value="published">{t('statusPublished')}</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: space[4], alignItems: 'center' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: space[2],
              cursor: 'pointer',
              color: colors.text.secondary,
              fontSize: fontSize.sm,
            }}
          >
            <input
              type="checkbox"
              checked={isFree}
              onChange={e => setIsFree(e.target.checked)}
              style={{ accentColor: colors.accent }}
            />
            {t('freeEvent')}
          </label>
        </div>

        {!isFree && (
          <div>
            <label
              htmlFor="event-ticket-url"
              style={{ fontSize: fontSize.sm, color: colors.text.muted, display: 'block', marginBottom: space[2] }}
            >
              {t('ticketUrl')}
            </label>
            <Input
              id="event-ticket-url"
              value={ticketUrl}
              onChange={e => setTicketUrl(e.target.value)}
              placeholder="https://..."
              type="url"
              style={inputStyle}
            />
          </div>
        )}

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: space[3],
            justifyContent: 'flex-end',
            marginTop: space[4],
          }}
        >
          {status !== 'cancelled' && (
            <Button
              type="button"
              variant="danger"
              loading={cancelling}
              onClick={handleCancelEvent}
              style={{ marginRight: 'auto' }}
            >
              {t('cancelEvent')}
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={() => navigate(`/events/${id}`)}>
            {t('cancel')}
          </Button>
          <Button type="submit" loading={submitting} disabled={!title.trim() || !startsAt}>
            {t('saveChanges')}
          </Button>
        </div>
      </form>
    </div>
  );
}
