'use client';

import React, { useState, useEffect, useRef } from 'react';
import { colors, fontSize, space, fontWeight, radius } from '../styles/tokens';
import { HiveButton } from './hive/HiveButton';
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

export function MythicSessionRoom({
  sessionId,
  title,
  onEndSession,
}: MythicSessionRoomProps) {
  const { profile } = useAuth();
  const currentUsername = profile?.display_name || profile?.username || 'You';

  const [isEnding, setIsEnding] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [stems, setStems] = useState<Array<{ id: string; name: string }>>([
    { id: 'stem-1', name: 'kick_techno_128.wav' },
    { id: 'stem-2', name: 'bass_rumble.wav' },
  ]);

  // Realtime state
  const [onlineUsers, setOnlineUsers] = useState<string[]>([currentUsername]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { user: 'ArtistX', text: 'Just dropped a new bassline idea', timestamp: new Date().toISOString() },
  ]);
  const [messageInput, setMessageInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const channelRef = useRef<any>(null);
  const supabaseRef = useRef<any>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

    // Presence: track who is online (real usernames from profile)
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const remoteUsers = Object.values(state)
          .flat()
          .map((p: any) => p.username || 'Anonymous')
          .filter((u: string) => u !== currentUsername);
        // Dedup + put local user first for clarity
        const unique = Array.from(new Set([currentUsername, ...remoteUsers]));
        setOnlineUsers(unique);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined session:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left session:', leftPresences);
      })
      // Broadcast: simple chat
      .on('broadcast', { event: 'chat-message' }, (payload) => {
        const msg = payload.payload as ChatMessage;
        setMessages((prev) => [...prev, msg]);
      })
      // Typing indicators
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { username, isTyping } = payload.payload;
        if (username === currentUsername) return; // Ignore own typing

        setTypingUsers((prev) => {
          if (isTyping) {
            return prev.includes(username) ? prev : [...prev, username];
          } else {
            return prev.filter(u => u !== username);
          }
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);

          // Track current user presence with real username from profile
          await channel.track({
            username: currentUsername,
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
  }, [sessionId, currentUsername]);

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
    setMessages((prev) => [...prev, msg]);
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

  const handleAddStem = async () => {
    // For demo: simulate adding a stem and record it to session metadata
    // In full version: file input + upload to Storage under `collab-sessions/${sessionId}/`
    const newStem = {
      id: `stem-${Date.now()}`,
      name: `new_stem_${Math.floor(Math.random() * 100)}.wav`,
    };
    setStems((prev) => [...prev, newStem]);

    // Record to session metadata so the job processor can see it for inspired_by
    try {
      if (!isSupabaseConfigured) {
        console.warn('Supabase not configured — cannot record stem');
        return;
      }

      const { data: currentSession } = await supabase
        .from('collab_sessions')
        .select('metadata')
        .eq('id', sessionId)
        .single();

      const currentStems = currentSession?.metadata?.stems || [];
      const updatedStems = [...currentStems, newStem.name];

      await supabase
        .from('collab_sessions')
        .update({
          metadata: {
            ...(currentSession?.metadata || {}),
            stems: updatedStems,
          },
        })
        .eq('id', sessionId);

      toast.success('Stem added to session (will generate inspired_by on end)');
    } catch (e) {
      console.warn('Could not record stem to metadata', e);
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
          <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text.primary }}>
            {title}
          </div>
          <div style={{ fontSize: fontSize.sm, color: colors.text.muted }}>
            Mythic Session • {sessionId.slice(0, 8)}...
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: space[3] }}>
          {/* Placeholder participant avatars */}
          <div style={{ display: 'flex', marginRight: space[2] }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: colors.accentMuted,
                  border: `2px solid ${colors.surface}`,
                  marginLeft: i > 1 ? -8 : 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  color: colors.text.primary,
                }}
              >
                A{i}
              </div>
            ))}
          </div>

          {showEndConfirm ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: colors.text.secondary }}>
              End session and generate graph proposals?
              <HiveButton variant="danger" onClick={handleEndSession} disabled={isEnding} style={{ padding: '4px 10px', fontSize: 12 }}>
                Yes, End
              </HiveButton>
              <HiveButton variant="secondary" onClick={cancelEndConfirm} style={{ padding: '4px 10px', fontSize: 12 }}>
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
            <HiveButton variant="secondary" onClick={handleAddStem} style={{ fontSize: 12, padding: '4px 10px' }}>
              + Add Stem
            </HiveButton>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: space[3] }}>
            {stems.length === 0 ? (
              <div style={{ color: colors.text.muted, fontSize: fontSize.sm, padding: space[4] }}>
                No stems yet. Upload or drag files here.
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
                  <span>{stem.name}</span>
                  <span style={{ color: colors.text.faint, fontSize: 11 }}>Ready</span>
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
              {isConnected ? `${onlineUsers.length} online` : 'Connecting...'}
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
                <strong style={{ color: msg.user === 'You' ? colors.accent : '#a5b4fc' }}>
                  {msg.user}:
                </strong>{' '}
                {msg.text}
              </div>
            ))}
            {messages.length === 0 && (
              <div style={{ color: colors.text.faint }}>No messages yet. Say hello!</div>
            )}
          </div>

          <div style={{ padding: space[3], borderTop: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', gap: space[1] }}>
            {/* Typing indicator */}
            {typingUsers.length > 0 && (
              <div style={{ fontSize: fontSize.sm, color: colors.text.muted, paddingLeft: space[2] }}>
                {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </div>
            )}

            <div style={{ display: 'flex', gap: space[2] }}>
              <input
                type="text"
                value={messageInput}
                onChange={(e) => handleTyping(e.target.value)}
                onKeyDown={(e) => {
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