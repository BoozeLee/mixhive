import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useMessages } from '../lib/messagesStore';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getMessages, sendMessage, markConversationRead, isBlocked, hasBlocked } from '../lib/api';
import type { DirectMessage, Profile } from '../lib/types';
import { colors, space, fontSize, fontWeight, radius } from '../styles/tokens';
import { HiveButton } from '../components/hive/HiveButton';
import toast from 'react-hot-toast';

export function MessageThreadPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { user } = useAuth();
  const { markRead } = useMessages();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [otherProfile, setOtherProfile] = useState<Profile | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  const loadHistory = useCallback(async (before?: string) => {
    if (!conversationId) return;
    const { messages: data, nextCursor: cursor } = await getMessages(conversationId, before);
    if (before) {
      setMessages(prev => [...data, ...prev]);
    } else {
      setMessages(data);
    }
    setNextCursor(cursor);
    setLoading(false);
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId || !user) return;

    async function checkBlockAndMember() {
      const { data: members } = await supabase
        .from('conversation_members')
        .select('profile_id, profile:profiles(*)')
        .eq('conversation_id', conversationId);

      const other = (members as any[])?.find(m => m.profile_id !== user!.id);
      if (other?.profile) setOtherProfile(other.profile);

      if (other) {
        const [b1, b2] = await Promise.all([
          hasBlocked(user!.id, other.profile_id),
          isBlocked(user!.id, other.profile_id),
        ]);
        setBlocked(b1 || b2);
      }
    }

    void checkBlockAndMember();
  }, [conversationId, user]);

  useEffect(() => {
    if (!conversationId) return;
    void loadHistory();
    void markRead(conversationId);
  }, [conversationId, loadHistory, markRead]);

  useEffect(() => {
    if (!conversationId || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.sender_id !== user?.id) {
      void markRead(conversationId);
    }
  }, [messages, conversationId, user, markRead]);

  useEffect(() => {
    if (!conversationId || !isSupabaseConfigured) return;

    const channel = supabase.channel(`dm:${conversationId}`, {
      config: { private: true },
    });

    channel
      .on('broadcast', { event: 'dm-message' }, payload => {
        const msg = payload.payload as DirectMessage;
        setMessages(prev => {
          if (prev.some(p => p.id === msg.id)) return prev;
          return [...prev, msg];
        });
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [conversationId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || !conversationId || !user || blocked) return;

    const id = crypto.randomUUID();
    const body = input.trim();

    const optimistic: DirectMessage = {
      id,
      conversation_id: conversationId,
      sender_id: user.id,
      body,
      attachment: null,
      created_at: new Date().toISOString(),
      status: 'pending',
    };

    setMessages(prev => [...prev, optimistic]);
    setInput('');
    setSending(true);

    if (channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'dm-message',
        payload: optimistic,
      });
    }

    const persisted = await sendMessage({ conversationId, id, body });
    setSending(false);

    if (persisted) {
      setMessages(prev =>
        prev.map(m => (m.id === id ? { ...persisted, status: 'sent' as const } : m))
      );
    } else {
      setMessages(prev =>
        prev.map(m => (m.id === id ? { ...m, status: 'failed' as const } : m))
      );
      toast.error('Failed to send message');
    }
  }

  if (!conversationId) return null;

  return (
    <div id="main-content" style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px 96px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--navbar-height, 73px))' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: space[4], marginBottom: space[6], borderBottom: `1px solid ${colors.border}`, paddingBottom: space[4] }}>
        <Link to="/messages" style={{ color: colors.text.muted, textDecoration: 'none' }}>
          ← Back
        </Link>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: fontWeight.semibold, color: colors.text.primary }}>
            {otherProfile?.display_name || otherProfile?.username || 'Loading…'}
          </div>
          <div style={{ fontSize: fontSize.sm, color: colors.text.dim }}>
            {otherProfile?.username ? `@${otherProfile.username}` : ''}
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: space[3] }}
      >
        {nextCursor && (
          <button
            onClick={() => loadHistory(nextCursor)}
            style={{ alignSelf: 'center', fontSize: fontSize.sm, color: colors.accent, background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            Load more
          </button>
        )}
        {loading && messages.length === 0 && (
          <p style={{ color: colors.text.dim, textAlign: 'center' }}>Loading…</p>
        )}
        {messages.map(msg => {
          const isMe = msg.sender_id === user?.id;
          return (
            <div
              key={msg.id}
              style={{
                alignSelf: isMe ? 'flex-end' : 'flex-start',
                maxWidth: '78%',
                padding: `${space[3]}px ${space[4]}px`,
                borderRadius: radius.lg,
                background: isMe ? colors.accentMuted : colors.surface,
                color: isMe ? colors.text.primary : colors.text.secondary,
                fontSize: fontSize.sm,
                lineHeight: 1.4,
                opacity: msg.status === 'pending' ? 0.7 : 1,
                border: msg.status === 'failed' ? `1px solid #f55` : 'none',
              }}
            >
              {msg.body}
              {msg.status === 'failed' && (
                <span style={{ color: '#f55', fontSize: 11, marginLeft: space[2] }}>Failed</span>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: space[2], paddingTop: space[4], borderTop: `1px solid ${colors.border}` }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={blocked ? 'You cannot message this user' : 'Type a message…'}
          disabled={blocked || sending}
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
          onClick={handleSend}
          disabled={!input.trim() || blocked || sending}
          style={{ padding: '8px 14px' }}
        >
          Send
        </HiveButton>
      </div>
    </div>
  );
}
