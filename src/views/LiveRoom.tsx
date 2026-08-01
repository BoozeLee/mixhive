'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { colors, radius, space, fontSize } from '@/styles/tokens';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import toast from 'react-hot-toast';

interface Participant {
  id: string;
  user_id: string;
  role: 'host' | 'dj' | 'listener';
  joined_at: string;
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface Message {
  id: string;
  content: string;
  created_at: string;
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface Room {
  id: string;
  title: string;
  description: string | null;
  status: 'waiting' | 'live' | 'ended';
  max_participants: number;
  is_public: boolean;
  host_id: string;
  started_at: string | null;
  ended_at: string | null;
  host: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

const ROLE_LABELS: Record<string, string> = { host: 'HOST', dj: 'DJ', listener: 'LISTENER' };
const ROLE_COLORS: Record<string, string> = {
  host: colors.accent,
  dj: colors.accentCyan,
  listener: colors.text.muted,
};

export function LiveRoom() {
  const t = useTranslations('liveRooms');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const isParticipant = user && participants.some(p => p.user_id === user.id && !p.left_at);
  const isHost = user && room?.host_id === user.id;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Load room data
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoadError('');

    async function load() {
      try {
        const { data: roomData } = await supabase
          .from('live_rooms')
          .select(
            '*, host:profiles!live_rooms_host_id_fkey(id, username, display_name, avatar_url)'
          )
          .eq('id', id)
          .maybeSingle();

        if (cancelled || !roomData) {
          setLoading(false);
          return;
        }

        const { data: parts } = await supabase
          .from('live_room_participants')
          .select(
            '*, user:profiles!live_room_participants_user_id_fkey(id, username, display_name, avatar_url)'
          )
          .eq('room_id', id)
          .is('left_at', null)
          .order('joined_at', { ascending: true });

        const { data: msgs } = await supabase
          .from('live_room_messages')
          .select(
            '*, user:profiles!live_room_messages_user_id_fkey(id, username, display_name, avatar_url)'
          )
          .eq('room_id', id)
          .order('created_at', { ascending: true })
          .limit(100);

        if (!cancelled) {
          setRoom(roomData);
          setParticipants(parts || []);
          setMessages(msgs || []);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Failed to load room');
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Realtime subscriptions
  useEffect(() => {
    if (!id) return;

    const partChannel = supabase
      .channel(`room-parts-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_room_participants',
          filter: `room_id=eq.${id}`,
        },
        async () => {
          const { data } = await supabase
            .from('live_room_participants')
            .select(
              '*, user:profiles!live_room_participants_user_id_fkey(id, username, display_name, avatar_url)'
            )
            .eq('room_id', id!)
            .is('left_at', null)
            .order('joined_at', { ascending: true });
          setParticipants(data || []);
        }
      )
      .subscribe();

    const msgChannel = supabase
      .channel(`room-msgs-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_room_messages',
          filter: `room_id=eq.${id}`,
        },
        async payload => {
          const { data: msg } = await supabase
            .from('live_room_messages')
            .select(
              '*, user:profiles!live_room_messages_user_id_fkey(id, username, display_name, avatar_url)'
            )
            .eq('id', payload.new.id)
            .maybeSingle();
          if (msg) {
            setMessages(prev => [...prev, msg]);
            setTimeout(scrollToBottom, 100);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(partChannel);
      supabase.removeChannel(msgChannel);
    };
  }, [id, scrollToBottom]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  async function handleJoin() {
    if (!user || !id) return;
    setJoining(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(`/api/live-rooms/${id}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.session?.access_token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to join');
        return;
      }
      toast.success(t('joinedRoom'));
      // Reload participants
      const { data: parts } = await supabase
        .from('live_room_participants')
        .select(
          '*, user:profiles!live_room_participants_user_id_fkey(id, username, display_name, avatar_url)'
        )
        .eq('room_id', id)
        .is('left_at', null)
        .order('joined_at', { ascending: true });
      setParticipants(parts || []);
    } finally {
      setJoining(false);
    }
  }

  async function handleLeave() {
    if (!user || !id) return;
    const { data: session } = await supabase.auth.getSession();
    await fetch(`/api/live-rooms/${id}/leave`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.session?.access_token}` },
    });
    toast.success(t('leftRoom'));
    navigate('/live-rooms');
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !id || !newMessage.trim() || sending) return;
    setSending(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(`/api/live-rooms/${id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.session?.access_token}`,
        },
        body: JSON.stringify({ content: newMessage.trim() }),
      });
      if (res.ok) {
        setNewMessage('');
      }
    } finally {
      setSending(false);
    }
  }

  async function handleStartSession() {
    if (!user || !id || !isHost) return;
    const { data: session } = await supabase.auth.getSession();
    await fetch(`/api/live-rooms/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.session?.access_token}`,
      },
      body: JSON.stringify({ status: 'live' }),
    });
    setRoom(prev =>
      prev ? { ...prev, status: 'live', started_at: new Date().toISOString() } : prev
    );
    toast.success(t('sessionStarted'));
  }

  async function handleEndSession() {
    if (!user || !id || !isHost) return;
    const { data: session } = await supabase.auth.getSession();
    await fetch(`/api/live-rooms/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.session?.access_token}` },
    });
    setRoom(prev =>
      prev ? { ...prev, status: 'ended', ended_at: new Date().toISOString() } : prev
    );
    toast.success(t('sessionEnded'));
  }

  if (loadError) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '64px 16px', textAlign: 'center' }}>
        <p style={{ color: colors.danger, marginBottom: 16 }}>{loadError}</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}
      >
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!room) {
    return (
      <div
        style={{
          maxWidth: 600,
          margin: '0 auto',
          padding: '64px 16px',
          textAlign: 'center',
          color: colors.text.faint,
        }}
      >
        <p style={{ fontSize: fontSize.lg }}>{t('roomNotFound')}</p>
        <Button onClick={() => navigate('/live-rooms')} style={{ marginTop: space[5] }}>
          {t('backToRooms')}
        </Button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        maxWidth: 1000,
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${space[4]} ${space[5]}`,
          borderBottom: `1px solid ${colors.border}`,
          background: colors.surface,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: space[3] }}>
          <Button
            variant="ghost"
            aria-label="Back to live rooms"
            onClick={() => navigate('/live-rooms')}
          >
            ←
          </Button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: space[2] }}>
              <h1 style={{ fontSize: fontSize.lg, fontWeight: 700, margin: 0 }}>{room.title}</h1>
              <span
                style={{
                  fontSize: fontSize.xs,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color:
                    room.status === 'live'
                      ? colors.successStrong
                      : room.status === 'waiting'
                        ? colors.warning
                        : colors.text.faint,
                  background: room.status === 'live' ? colors.successBg : 'transparent',
                  padding: `${space[1]} ${space[2]}`,
                  borderRadius: radius.sm,
                }}
              >
                {room.status === 'live'
                  ? `● ${t('live')}`
                  : room.status === 'waiting'
                    ? t('waiting')
                    : t('ended')}
              </span>
            </div>
            <p style={{ fontSize: fontSize.sm, color: colors.text.muted, margin: 0 }}>
              {participants.length}/{room.max_participants} {t('participants')}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: space[2] }}>
          {isHost && room.status === 'waiting' && (
            <Button onClick={handleStartSession} size="sm">
              {t('startSession')}
            </Button>
          )}
          {isHost && room.status !== 'ended' && (
            <Button onClick={handleEndSession} variant="danger" size="sm">
              {t('endSession')}
            </Button>
          )}
          {!isParticipant && room.status !== 'ended' && user && (
            <Button onClick={handleJoin} loading={joining} size="sm">
              {t('joinRoom')}
            </Button>
          )}
          {isParticipant && !isHost && (
            <Button onClick={handleLeave} variant="ghost" size="sm">
              {t('leaveRoom')}
            </Button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Main area: Waveform placeholder + Participants */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Waveform placeholder */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: colors.surfaceMuted,
              margin: space[4],
              borderRadius: radius.lg,
              border: `1px solid ${colors.border}`,
            }}
          >
            <div style={{ textAlign: 'center', color: colors.text.faint }}>
              <div style={{ fontSize: 48, marginBottom: space[3] }}>🎧</div>
              <p style={{ fontSize: fontSize.md, fontWeight: 600 }}>{t('waveformPlaceholder')}</p>
              <p style={{ fontSize: fontSize.sm }}>{t('waveformDescription')}</p>
            </div>
          </div>
        </div>

        {/* Sidebar: Participants + Chat */}
        <div
          style={{
            width: 320,
            borderLeft: `1px solid ${colors.border}`,
            display: 'flex',
            flexDirection: 'column',
            background: colors.surface,
            flexShrink: 0,
          }}
        >
          {/* Participants */}
          <div style={{ padding: space[4], borderBottom: `1px solid ${colors.border}` }}>
            <h3
              style={{
                fontSize: fontSize.sm,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: colors.text.muted,
                marginBottom: space[3],
              }}
            >
              {t('participants')} ({participants.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
              {participants.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: space[2] }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: radius.full,
                      background: colors.surfaceHover,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      fontSize: fontSize.xs,
                      color: colors.text.muted,
                    }}
                  >
                    {p.user?.avatar_url ? (
                      <img
                        src={p.user.avatar_url}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      (p.user?.display_name || p.user?.username || '?')[0].toUpperCase()
                    )}
                  </div>
                  <span style={{ fontSize: fontSize.sm, color: colors.text.primary, flex: 1 }}>
                    {p.user?.display_name || p.user?.username}
                  </span>
                  <span
                    style={{
                      fontSize: fontSize.xs,
                      fontWeight: 600,
                      color: ROLE_COLORS[p.role] || colors.text.muted,
                      background: p.role === 'host' ? colors.accentFaint : 'transparent',
                      padding: `${space[0]} ${space[2]}`,
                      borderRadius: radius.sm,
                    }}
                  >
                    {ROLE_LABELS[p.role] || p.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Chat */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <h3
              style={{
                fontSize: fontSize.sm,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: colors.text.muted,
                padding: `${space[3]} ${space[4]} ${space[2]}`,
              }}
            >
              {t('chat')}
            </h3>
            <div
              ref={chatContainerRef}
              style={{ flex: 1, overflowY: 'auto', padding: `0 ${space[4]}` }}
            >
              {messages.map(msg => (
                <div key={msg.id} style={{ marginBottom: space[2] }}>
                  <span style={{ fontSize: fontSize.xs, fontWeight: 600, color: colors.accent }}>
                    {msg.user?.display_name || msg.user?.username || 'Anon'}
                  </span>
                  <span
                    style={{
                      fontSize: fontSize.xs,
                      color: colors.text.faint,
                      marginLeft: space[2],
                    }}
                  >
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <p
                    style={{
                      fontSize: fontSize.sm,
                      color: colors.text.secondary,
                      margin: 0,
                      marginTop: space[1],
                    }}
                  >
                    {msg.content}
                  </p>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {isParticipant && room.status !== 'ended' ? (
              <form
                onSubmit={handleSendMessage}
                style={{
                  display: 'flex',
                  gap: space[2],
                  padding: space[3],
                  borderTop: `1px solid ${colors.border}`,
                }}
              >
                <input
                  type="text"
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder={t('sendMessage')}
                  maxLength={2000}
                  style={{
                    flex: 1,
                    background: colors.bg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: radius.md,
                    padding: `${space[2]} ${space[3]}`,
                    color: colors.text.primary,
                    fontSize: fontSize.sm,
                    outline: 'none',
                  }}
                />
                <Button type="submit" size="sm" loading={sending} disabled={!newMessage.trim()}>
                  {t('send')}
                </Button>
              </form>
            ) : (
              <div
                style={{
                  padding: space[3],
                  textAlign: 'center',
                  color: colors.text.faint,
                  fontSize: fontSize.sm,
                }}
              >
                {t('joinToChat')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
