'use client';

import React, { useState, useEffect, useRef } from 'react';
import { colors, fontSize, space, fontWeight, radius } from '../styles/tokens';
import { HiveButton } from './hive/HiveButton';
import { Avatar } from './ui/Avatar';
import toast from 'react-hot-toast';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface MythicSessionRoomProps {
  sessionId: string;
  title: string;
  onEndSession?: () => void;
}

interface ChatMessage {
  user: string;
  text: string;
  timestamp: string;
}

interface Participant {
  username: string;
  avatar_url: string | null;
}

interface Stem {
  id: string;
  name: string;
  path?: string;
}

// Stems are audio — reuse the public, owner-scoped audio bucket. Migration 091
// storage RLS requires the object name's first path segment to equal auth.uid().
const STEM_BUCKET = 'mix-audio';

export function MythicSessionRoom({ sessionId, title, onEndSession }: MythicSessionRoomProps) {
  const { profile } = useAuth();
  const currentUsername = profile?.display_name || profile?.username || 'You';

  const [isEnding, setIsEnding] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [stems, setStems] = useState<Stem[]>([]);
  const [uploadingStems, setUploadingStems] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Realtime state
  const [participants, setParticipants] = useState<Participant[]>([
    { username: currentUsername, avatar_url: profile?.avatar_url ?? null },
  ]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const channelRef = useRef<any>(null);
  const supabaseRef = useRef<any>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load any stems already attached to the session so re-joiners and the host
  // converge on the same list.
  useEffect(() => {
    if (!sessionId || !isSupabaseConfigured) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('collab_sessions')
        .select('metadata')
        .eq('id', sessionId)
        .single();
      if (cancelled) return;
      const stored = (data?.metadata?.stems ?? []) as Array<
        { name: string; path?: string } | string
      >;
      const loaded: Stem[] = stored.map((s, i) =>
        typeof s === 'string'
          ? { id: `stem-${i}`, name: s }
          : { id: `stem-${i}`, name: s.name, path: s.path }
      );
      setStems(loaded);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Setup Supabase Realtime for presence + chat
  useEffect(() => {
    if (!sessionId) return;

    if (!isSupabaseConfigured) {
      console.error('Supabase is not configured — realtime session will not work.');
      setIsConnected(false);
      return;
    }

    // Reuse the project's centralized Supabase client (handles env fallbacks robustly)
    supabaseRef.current = supabase;

    const channelName = `collab-session:${sessionId}`;
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: 'user-presence',
        },
      },
    });

    // Presence: track who is online (real usernames + avatars from profile)
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const present = Object.values(state)
          .flat()
          .map((p: any) => ({
            username: p.username || 'Anonymous',
            avatar_url: p.avatar_url ?? null,
          })) as Participant[];
        // Dedup by username, keep the local user first for clarity
        const byName = new Map<string, Participant>();
        byName.set(currentUsername, {
          username: currentUsername,
          avatar_url: profile?.avatar_url ?? null,
        });
        for (const p of present) {
          if (!byName.has(p.username)) byName.set(p.username, p);
        }
        setParticipants(Array.from(byName.values()));
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('User joined session:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        console.log('User left session:', leftPresences);
      })
      // Broadcast: simple chat
      .on('broadcast', { event: 'chat-message' }, payload => {
        const msg = payload.payload as ChatMessage;
        setMessages(prev => [...prev, msg]);
      })
      // Typing indicators
      .on('broadcast', { event: 'typing' }, payload => {
        const { username, isTyping } = payload.payload;
        if (username === currentUsername) return; // Ignore own typing

        setTypingUsers(prev => {
          if (isTyping) {
            return prev.includes(username) ? prev : [...prev, username];
          } else {
            return prev.filter(u => u !== username);
          }
        });
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);

          // Track current user presence with real username + avatar from profile
          await channel.track({
            username: currentUsername,
            avatar_url: profile?.avatar_url ?? null,
            online_at: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      setIsConnected(false);
      setTypingUsers([]);
    };
  }, [sessionId, currentUsername, profile?.avatar_url]);

  const sendMessage = async () => {
    if (!messageInput.trim() || !channelRef.current) return;

    const msg: ChatMessage = {
      user: currentUsername,
      text: messageInput.trim(),
      timestamp: new Date().toISOString(),
    };

    // Broadcast to others
    await channelRef.current.send({
      type: 'broadcast',
      event: 'chat-message',
      payload: msg,
    });

    // Optimistically add to local list
    setMessages(prev => [...prev, msg]);
    setMessageInput('');

    // Stop typing indicator
    sendTypingStatus(false);
  };

  const sendTypingStatus = async (isTyping: boolean) => {
    if (!channelRef.current) return;

    await channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { username: currentUsername, isTyping },
    });
  };

  const handleTyping = (value: string) => {
    setMessageInput(value);

    // Send typing start
    if (value.length > 0) {
      sendTypingStatus(true);

      // Clear previous timeout
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      // Auto stop typing after 2s of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        sendTypingStatus(false);
      }, 2000);
    } else {
      sendTypingStatus(false);
    }
  };

  const handleEndSession = async () => {
    setShowEndConfirm(false);
    setIsEnding(true);

    try {
      const res = await fetch('/api/mythic/sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      if (!res.ok) {
        throw new Error('Failed to end session');
      }

      toast.success('Session ended. Review proposed edges in your legend.');
      onEndSession?.();
    } catch (error) {
      console.error(error);
      toast.error('Failed to end session');
    } finally {
      setIsEnding(false);
    }
  };

  const cancelEndConfirm = () => {
    setShowEndConfirm(false);
    toast('Session not ended', { duration: 1200 });
  };

  const openFilePicker = () => fileInputRef.current?.click();

  // Upload real audio stems to owner-scoped storage and record them on the session.
  const handleStemFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    if (!isSupabaseConfigured) {
      toast.error('Supabase not configured — cannot upload stems');
      return;
    }
    if (!profile?.id) {
      toast.error('You must be signed in to upload stems');
      return;
    }

    const fileArr = Array.from(files);
    setUploadingStems(n => n + fileArr.length);
    const uploaded: Stem[] = [];

    for (const file of fileArr) {
      try {
        const ext = file.name.split('.').pop() || 'wav';
        // Owner-scoped path: migration 091 storage RLS requires the object name's
        // first path segment to equal auth.uid() (profile.id == auth.uid).
        const path = `${profile.id}/collab-sessions/${sessionId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from(STEM_BUCKET).upload(path, file);
        if (uploadErr) throw uploadErr;
        uploaded.push({ id: path, name: file.name, path });
      } catch (e) {
        console.error('Stem upload failed', e);
        toast.error(`Failed to upload ${file.name}`);
      } finally {
        setUploadingStems(n => Math.max(0, n - 1));
      }
    }

    if (uploaded.length === 0) return;

    setStems(prev => [...prev, ...uploaded]);

    // Persist real stem records to session metadata so the job processor can
    // generate inspired_by edges, and so re-joiners load the same list.
    try {
      const { data: currentSession } = await supabase
        .from('collab_sessions')
        .select('metadata')
        .eq('id', sessionId)
        .single();

      const existing = (currentSession?.metadata?.stems ?? []) as Array<{
        name: string;
        path?: string;
      }>;
      const merged = [...existing, ...uploaded.map(s => ({ name: s.name, path: s.path }))];

      await supabase
        .from('collab_sessions')
        .update({
          metadata: {
            ...(currentSession?.metadata || {}),
            stems: merged,
          },
        })
        .eq('id', sessionId);

      toast.success(`Added ${uploaded.length} stem${uploaded.length > 1 ? 's' : ''}`);
    } catch (e) {
      console.warn('Could not record stems to metadata', e);
    }
  };

  return (
    <div
      style={{
        background: colors.surface,
        border: `1px solid ${colors.borderStrong}`,
        borderRadius: radius.lg,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '600px',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: `${space[4]}px ${space[6]}px`,
          borderBottom: `1px solid ${colors.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: colors.bg,
        }}
      >
        <div>
          <div
            style={{
              fontSize: fontSize.lg,
              fontWeight: fontWeight.bold,
              color: colors.text.primary,
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: fontSize.sm, color: colors.text.muted }}>
            Mythic Session • {sessionId.slice(0, 8)}...
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: space[3] }}>
          {/* Live participant avatars (from realtime presence) */}
          <div style={{ display: 'flex', alignItems: 'center', marginRight: space[2] }}>
            {participants.slice(0, 5).map((p, i) => (
              <div
                key={p.username}
                title={p.username}
                style={{
                  marginLeft: i > 0 ? -8 : 0,
                  borderRadius: '50%',
                  border: `2px solid ${colors.surface}`,
                  display: 'flex',
                }}
              >
                <Avatar src={p.avatar_url} name={p.username} size={28} />
              </div>
            ))}
            {participants.length > 5 && (
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: colors.accentMuted,
                  border: `2px solid ${colors.surface}`,
                  marginLeft: -8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  color: colors.text.primary,
                }}
              >
                +{participants.length - 5}
              </div>
            )}
          </div>

          {showEndConfirm ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                color: colors.text.secondary,
              }}
            >
              End session and generate graph proposals?
              <HiveButton
                variant="danger"
                onClick={handleEndSession}
                disabled={isEnding}
                style={{ padding: '4px 10px', fontSize: 12 }}
              >
                Yes, End
              </HiveButton>
              <HiveButton
                variant="secondary"
                onClick={cancelEndConfirm}
                style={{ padding: '4px 10px', fontSize: 12 }}
              >
                Cancel
              </HiveButton>
            </div>
          ) : (
            <HiveButton
              variant="danger"
              onClick={() => setShowEndConfirm(true)}
              disabled={isEnding}
              style={{ minWidth: 140 }}
            >
              {isEnding ? 'Ending Session...' : 'End Session & Review'}
            </HiveButton>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Stems / Assets Panel */}
        <div
          style={{
            width: '45%',
            borderRight: `1px solid ${colors.border}`,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: `${space[3]}px ${space[4]}px`,
              borderBottom: `1px solid ${colors.border}`,
              fontSize: fontSize.sm,
              fontWeight: fontWeight.medium,
              color: colors.text.secondary,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>Stems & Assets</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              multiple
              style={{ display: 'none' }}
              onChange={e => {
                handleStemFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <HiveButton
              variant="secondary"
              onClick={openFilePicker}
              disabled={uploadingStems > 0}
              style={{ fontSize: 12, padding: '4px 10px' }}
            >
              {uploadingStems > 0 ? `Uploading… (${uploadingStems})` : '+ Add Stem'}
            </HiveButton>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: space[3] }}>
            {stems.length === 0 && uploadingStems === 0 ? (
              <div style={{ color: colors.text.muted, fontSize: fontSize.sm, padding: space[4] }}>
                No stems yet. Add audio files to share them with the session.
              </div>
            ) : (
              stems.map((stem, index) => (
                <div
                  key={stem.id}
                  style={{
                    padding: `${space[2]}px ${space[3]}px`,
                    background: index % 2 === 0 ? colors.surfaceMuted : 'transparent',
                    borderRadius: radius.sm,
                    marginBottom: space[1],
                    fontSize: fontSize.sm,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginRight: space[2],
                    }}
                  >
                    {stem.name}
                  </span>
                  <span style={{ color: colors.text.faint, fontSize: 11, flexShrink: 0 }}>
                    Ready
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat / Activity Panel - Now with Realtime */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              padding: `${space[3]}px ${space[4]}px`,
              borderBottom: `1px solid ${colors.border}`,
              fontSize: fontSize.sm,
              fontWeight: fontWeight.medium,
              color: colors.text.secondary,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>Session Chat & Activity</span>
            <span style={{ color: isConnected ? colors.success : colors.text.muted, fontSize: 11 }}>
              {isConnected ? `${participants.length} online` : 'Connecting...'}
            </span>
          </div>

          <div
            style={{
              flex: 1,
              padding: space[4],
              color: colors.text.primary,
              fontSize: fontSize.sm,
              overflowY: 'auto',
              background: colors.bg,
              display: 'flex',
              flexDirection: 'column',
              gap: space[3],
            }}
          >
            {messages.map((msg, index) => (
              <div key={index}>
                <strong style={{ color: msg.user === currentUsername ? colors.accent : '#a5b4fc' }}>
                  {msg.user}:
                </strong>{' '}
                {msg.text}
              </div>
            ))}
            {messages.length === 0 && (
              <div style={{ color: colors.text.faint }}>No messages yet. Say hello!</div>
            )}
          </div>

          <div
            style={{
              padding: space[3],
              borderTop: `1px solid ${colors.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: space[1],
            }}
          >
            {/* Typing indicator */}
            {typingUsers.length > 0 && (
              <div
                style={{ fontSize: fontSize.sm, color: colors.text.muted, paddingLeft: space[2] }}
              >
                {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </div>
            )}

            <div style={{ display: 'flex', gap: space[2] }}>
              <input
                type="text"
                value={messageInput}
                onChange={e => handleTyping(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Type a message..."
                style={{
                  flex: 1,
                  padding: `${space[2]}px ${space[3]}px`,
                  background: colors.bg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.sm,
                  color: colors.text.primary,
                  fontSize: fontSize.sm,
                }}
              />
              <HiveButton
                variant="secondary"
                onClick={sendMessage}
                disabled={!messageInput.trim()}
                style={{ padding: '8px 14px' }}
              >
                Send
              </HiveButton>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div
        style={{
          padding: `${space[2]}px ${space[4]}px`,
          background: colors.bg,
          fontSize: 11,
          color: colors.text.faint,
          borderTop: `1px solid ${colors.border}`,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>Changes are saved automatically to the graph on End Session</span>
        <span>Session ID: {sessionId.slice(0, 12)}...</span>
      </div>
    </div>
  );
}
