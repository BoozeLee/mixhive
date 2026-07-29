'use client';

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase';
import { colors, radius, space, fontSize, shadow, transition } from '@/styles/tokens';
import { Button } from '@/components/ui/Button';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface LiveRoom {
  id: string;
  title: string;
  description: string | null;
  status: 'waiting' | 'live' | 'ended';
  max_participants: number;
  is_public: boolean;
  participant_count: number;
  created_at: string;
  host: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null;
}

export function LiveRooms() {
  const t = useTranslations('liveRooms');
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'live' | 'waiting'>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ limit: '30' });
      if (filter !== 'all') params.set('status', filter);
      const { data, error: err } = await supabase.from('live_rooms')
        .select('*, host:profiles!live_rooms_host_id_fkey(id, username, display_name, avatar_url)')
        .in('status', filter === 'all' ? ['waiting', 'live'] : [filter])
        .order('created_at', { ascending: false })
        .limit(30);
      if (err) {
        if (!cancelled) { setError(err.message); setLoading(false); }
        return;
      }
      if (!cancelled && data) {
        // Get participant counts
        const ids = data.map(r => r.id);
        const counts: Record<string, number> = {};
        if (ids.length > 0) {
          const { data: parts } = await supabase
            .from('live_room_participants')
            .select('room_id')
            .in('room_id', ids)
            .is('left_at', null);
          if (parts) {
            for (const p of parts) {
              counts[p.room_id] = (counts[p.room_id] || 0) + 1;
            }
          }
        }
        setRooms(data.map(r => ({ ...r, participant_count: counts[r.id] || 0 })));
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [filter]);

  const cardStyle: React.CSSProperties = {
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.lg,
    padding: space[5],
    textDecoration: 'none',
    color: colors.text.primary,
    transition: transition.base,
    display: 'flex',
    flexDirection: 'column',
    gap: space[3],
  };

  if (error) {
    return (
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 16px 96px' }}>
        <SectionHeading
          as="h1"
          eyebrow="LIVE"
          title={t('title')}
        />
        <div style={{ padding: space[10], textAlign: 'center', color: colors.danger, background: colors.dangerBg, borderRadius: radius.md, border: `1px solid ${colors.danger}` }}>
          <p>{error}</p>
          <Button variant="primary" size="md" onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 16px 96px' }}>
      <SectionHeading
        as="h1"
        eyebrow="LIVE"
        title={t('title')}
        subtitle={t('subtitle')}
      />

      <div style={{ display: 'flex', gap: space[3], marginBottom: space[8], flexWrap: 'wrap' }}>
        {(['all', 'live', 'waiting'] as const).map(f => (
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
            {f === 'all' ? t('allRooms') : f === 'live' ? t('live') : t('waiting')}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: space[12] }}>
          <LoadingSpinner size="lg" />
        </div>
      ) : rooms.length === 0 ? (
        <div style={{ textAlign: 'center', padding: space[12], color: colors.text.faint }}>
          <p style={{ fontSize: fontSize.lg, marginBottom: space[4] }}>{t('emptyTitle')}</p>
          <p style={{ fontSize: fontSize.base }}>{t('emptyDescription')}</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: space[5],
        }}>
          {rooms.map(room => (
            <Link
              key={room.id}
              to={`/live-rooms/${room.id}`}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontSize: fontSize.xs,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: room.status === 'live' ? colors.successStrong : colors.warning,
                }}>
                  {room.status === 'live' ? `● ${t('live')}` : t('waiting')}
                </span>
                <span style={{ fontSize: fontSize.xs, color: colors.text.faint }}>
                  {room.participant_count}/{room.max_participants}
                </span>
              </div>

              <h3 style={{ fontSize: fontSize.lg, fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
                {room.title}
              </h3>

              {room.description && (
                <p style={{ fontSize: fontSize.sm, color: colors.text.muted, margin: 0, lineHeight: 1.4 }}>
                  {room.description.length > 100 ? room.description.slice(0, 100) + '...' : room.description}
                </p>
              )}

              {room.host && (
                <div style={{ display: 'flex', alignItems: 'center', gap: space[2], marginTop: 'auto' }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: radius.full,
                    background: colors.surfaceHover,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: fontSize.xs, color: colors.text.muted, overflow: 'hidden',
                  }}>
                    {room.host.avatar_url ? (
                      <img src={room.host.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      (room.host.display_name || room.host.username || '?')[0].toUpperCase()
                    )}
                  </div>
                  <span style={{ fontSize: fontSize.sm, color: colors.text.dimmed }}>
                    {room.host.display_name || room.host.username}
                  </span>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
