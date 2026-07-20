'use client';

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { colors, radius, space, fontSize, transition } from '@/styles/tokens';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import toast from 'react-hot-toast';

export function NewEvent() {
  const t = useTranslations('events');
  const navigate = useNavigate();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [venueName, setVenueName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [isFree, setIsFree] = useState(true);
  const [ticketUrl, setTicketUrl] = useState('');
  const [publish, setPublish] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!user) {
    navigate('/login');
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !startsAt) return;
    setSubmitting(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.session?.access_token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          venue_name: venueName.trim() || undefined,
          venue_address: venueAddress.trim() || undefined,
          starts_at: new Date(startsAt).toISOString(),
          ends_at: endsAt ? new Date(endsAt).toISOString() : undefined,
          is_free: isFree,
          ticket_url: ticketUrl.trim() || undefined,
          status: publish ? 'published' : 'draft',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to create event');
        return;
      }

      const event = await res.json();
      toast.success(publish ? t('eventPublished') : t('eventSaved'));
      navigate(`/events/${event.id}`);
    } finally {
      setSubmitting(false);
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

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 16px 96px' }}>
      <Link
        to="/events"
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
        {t('createEvent')}
      </h1>

      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: space[5] }}
      >
        <div>
          <label
            style={{
              fontSize: fontSize.sm,
              color: colors.text.muted,
              display: 'block',
              marginBottom: space[2],
            }}
          >
            {t('eventTitle')} *
          </label>
          <Input
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
            style={{
              fontSize: fontSize.sm,
              color: colors.text.muted,
              display: 'block',
              marginBottom: space[2],
            }}
          >
            {t('description')}
          </label>
          <Textarea
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
              style={{
                fontSize: fontSize.sm,
                color: colors.text.muted,
                display: 'block',
                marginBottom: space[2],
              }}
            >
              {t('venueName')}
            </label>
            <Input
              value={venueName}
              onChange={e => setVenueName(e.target.value)}
              placeholder={t('venueNamePlaceholder')}
              maxLength={200}
              style={inputStyle}
            />
          </div>
          <div>
            <label
              style={{
                fontSize: fontSize.sm,
                color: colors.text.muted,
                display: 'block',
                marginBottom: space[2],
              }}
            >
              {t('venueAddress')}
            </label>
            <Input
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
              style={{
                fontSize: fontSize.sm,
                color: colors.text.muted,
                display: 'block',
                marginBottom: space[2],
              }}
            >
              {t('startDate')} *
            </label>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={e => setStartsAt(e.target.value)}
              required
              style={{ ...inputStyle, colorScheme: 'dark' }}
            />
          </div>
          <div>
            <label
              style={{
                fontSize: fontSize.sm,
                color: colors.text.muted,
                display: 'block',
                marginBottom: space[2],
              }}
            >
              {t('endDate')}
            </label>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={e => setEndsAt(e.target.value)}
              style={{ ...inputStyle, colorScheme: 'dark' }}
            />
          </div>
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
              checked={publish}
              onChange={e => setPublish(e.target.checked)}
              style={{ accentColor: colors.accent }}
            />
            {t('publishNow')}
          </label>
        </div>

        {!isFree && (
          <div>
            <label
              style={{
                fontSize: fontSize.sm,
                color: colors.text.muted,
                display: 'block',
                marginBottom: space[2],
              }}
            >
              {t('ticketUrl')}
            </label>
            <Input
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
            gap: space[3],
            justifyContent: 'flex-end',
            marginTop: space[4],
          }}
        >
          <Button type="button" variant="ghost" onClick={() => navigate('/events')}>
            {t('cancel')}
          </Button>
          <Button type="submit" loading={submitting} disabled={!title.trim() || !startsAt}>
            {publish ? t('publishEvent') : t('saveDraft')}
          </Button>
        </div>
      </form>
    </div>
  );
}
