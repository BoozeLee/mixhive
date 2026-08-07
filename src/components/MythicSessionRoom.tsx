'use client';
import { useTranslations } from 'next-intl';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { useCreatorTalkback } from '../hooks/useCreatorTalkback';
import {
  ritualRequest,
  synchronizedPosition,
  type RitualAsset,
  type RitualMessage,
  type RitualSnapshot,
  type RitualVote,
} from '../lib/rituals';
import { reportContent } from '../lib/api';
import { supabase } from '../lib/supabase';
import { colors, fontSize, fontWeight, radius, space } from '../styles/tokens';
import { FlowKeyTap } from './FlowKeyTap';
import { HiveButton } from './hive/HiveButton';
import { Avatar } from './ui/Avatar';

interface Props {
  sessionId: string;
  title: string;
  onEndSession?: () => void;
}

const STEM_BUCKET = 'mix-audio';

export function MythicSessionRoom({ sessionId, title, onEndSession }: MythicSessionRoomProps) {
  const { profile } = useAuth();
  const [snapshot, setSnapshot] = useState<RitualSnapshot | null>(null);
  const [messages, setMessages] = useState<RitualMessage[]>([]);
  const [votes, setVotes] = useState<RitualVote[]>([]);
  const [message, setMessage] = useState('');
  const [participants, setParticipants] = useState<
    Array<{ id: string; username: string; avatar_url: string | null }>
  >([]);
  const [uploading, setUploading] = useState(false);
  const [agentBusy, setAgentBusy] = useState(false);
  const [showVote, setShowVote] = useState(false);
  const [inviteUsername, setInviteUsername] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const role = snapshot?.role ?? 'audience';
  const isCreator = role !== 'audience';
  const talkback = useCreatorTalkback(sessionId, profile?.id, isCreator);

  const load = useCallback(async () => {
    const next = await ritualRequest<RitualSnapshot>(`/api/mythic/sessions/${sessionId}`);
    setSnapshot(next);
    setMessages(next.messages);
    setVotes(next.votes);
  }, [sessionId]);

  // Realtime state
  const [onlineUsers, setOnlineUsers] = useState<string[]>([currentUsername]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      user: 'ArtistX',
      text: 'Just dropped a new bassline idea',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [messageInput, setMessageInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const channelRef = useRef<any>(null);
  const supabaseRef = useRef<any>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Setup Supabase Realtime for presence + chat
  useEffect(() => {
    void load().catch(error => toast.error(error.message));
  }, [load]);

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase.channel(`collab-session:${sessionId}`, {
      config: { presence: { key: profile.id } },
    });
    channel
      .on('presence', { event: 'sync' }, () => {
        const next = Object.values(channel.presenceState())
          .flat()
          .map((entry: Record<string, unknown>) => ({
            id: entry.profile_id as string,
            username: (entry.username as string) || 'Anonymous',
            avatar_url: (entry.avatar_url as string | null) ?? null,
          }));
        setParticipants(Array.from(new Map(next.map(item => [item.id, item])).values()));
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined session:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
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
          await channel.track({
            profile_id: profile.id,
            username: profile.display_name || profile.username,
            avatar_url: profile.avatar_url,
            role,
          });
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [
    load,
    profile?.avatar_url,
    profile?.display_name,
    profile?.id,
    profile?.username,
    role,
    sessionId,
  ]);

  const currentAsset = useMemo(
    () => snapshot?.assets.find(asset => asset.id === snapshot.state.current_asset_id) ?? null,
    [snapshot]
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !snapshot) return;
    const desired = synchronizedPosition(snapshot.state);
    if (Math.abs(audio.currentTime - desired) > 0.75) audio.currentTime = desired;
    if (snapshot.state.playback_status === 'playing') void audio.play().catch(() => undefined);
    else audio.pause();
  }, [snapshot]);

  const assetUrl = (asset: RitualAsset) =>
    supabase.storage.from(STEM_BUCKET).getPublicUrl(asset.storage_path).data.publicUrl;

  const setPlayback = async (
    asset: RitualAsset | null,
    status: 'playing' | 'paused',
    position = 0
  ) => {
    if (!snapshot || !isCreator) return;
    const result = await ritualRequest<{ state: RitualSnapshot['state'] }>(
      `/api/mythic/sessions/${sessionId}/state`,
      {
        method: 'POST',
        body: JSON.stringify({
          current_asset_id: asset?.id ?? snapshot.state.current_asset_id,
          playback_status: status,
          anchor_position: position,
          revision: snapshot.state.revision,
        }),
      }
    );
    setSnapshot({ ...snapshot, state: result.state });
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files || !profile?.id || !snapshot) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const path = `${profile.id}/collab-sessions/${sessionId}/${crypto.randomUUID()}.${file.name.split('.').pop() || 'wav'}`;
        const { error } = await supabase.storage.from(STEM_BUCKET).upload(path, file);
        if (error) throw error;
        const { error: assetError } = await supabase.from('collab_session_assets').insert({
          session_id: sessionId,
          uploader_id: profile.id,
          name: file.name,
          storage_path: path,
          mime_type: file.type || 'audio/mpeg',
          asset_type: 'stem',
        });
        if (assetError) throw assetError;
      }
      await load();
      toast.success('Assets joined the ritual');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const sendMessage = async () => {
    if (!message.trim()) return;
    await ritualRequest(`/api/mythic/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body: message.trim(), channel: 'audience' }),
    });

    // Optimistically add to local list
    setMessages(prev => [...prev, msg]);
    setMessageInput('');

    // Stop typing indicator
    sendTypingStatus(false);
  };

  const respondVote = async (vote: RitualVote, option: string) => {
    await ritualRequest(`/api/mythic/sessions/${sessionId}/votes`, {
      method: 'POST',
      body: JSON.stringify({ action: 'respond', vote_id: vote.id, option }),
    });
    toast.success('Your signal reached the creators');
  };

  const createVote = async () => {
    if (!snapshot || snapshot.assets.length < 2)
      return toast.error('Add at least two assets first');
    await ritualRequest(`/api/mythic/sessions/${sessionId}/votes`, {
      method: 'POST',
      body: JSON.stringify({
        action: 'create',
        prompt: 'Which direction should the ritual explore next?',
        options: snapshot.assets.slice(0, 4).map(asset => asset.name),
      }),
    });
    setShowVote(false);
    await load();
  };

  const invokeAgent = useCallback(async () => {
    setAgentBusy(true);
    try {
      const result = await ritualRequest<{ action: { message: string } }>(
        `/api/mythic/sessions/${sessionId}/agent`,
        { method: 'POST', body: '{}' }
      );
      toast(result.action.message, { duration: 5000 });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Session Spirit unavailable');
    } finally {
      setAgentBusy(false);
    }
  }, [sessionId, load]);

  useEffect(() => {
    if (role !== 'owner' || !snapshot?.state.agent_enabled) return;
    const timer = window.setInterval(() => void invokeAgent(), 120_000);
    return () => window.clearInterval(timer);
  }, [role, snapshot?.state.agent_enabled, snapshot?.state.agent_budget_remaining, invokeAgent]);

  const toggleAgent = async () => {
    await ritualRequest(`/api/mythic/sessions/${sessionId}/agent`, {
      method: 'POST',
      body: JSON.stringify({ action: 'toggle' }),
    });
    await load();
  };

  const inviteCreator = async () => {
    const username = inviteUsername.trim().replace(/^@/, '');
    if (!username) return;
    const { data: invited } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    if (!invited) return toast.error('Artist not found');
    await ritualRequest(`/api/mythic/sessions/${sessionId}/invites`, {
      method: 'POST',
      body: JSON.stringify({ profile_id: invited.id, role: 'creator' }),
    });
    setInviteUsername('');
    toast.success(`Invited @${username} to the creator stage`);
  };

  const handleAddStem = async () => {
    // For demo: simulate adding a stem and record it to session metadata
    // In full version: file input + upload to Storage under `collab-sessions/${sessionId}/`
    const newStem = {
      id: `stem-${Date.now()}`,
      name: `new_stem_${Math.floor(Math.random() * 100)}.wav`,
    };
    setStems(prev => [...prev, newStem]);

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

  const moderateProfile = async (profileId: string, action: 'mute' | 'remove') => {
    await ritualRequest(`/api/mythic/sessions/${sessionId}/moderation`, {
      method: 'POST',
      body: JSON.stringify({ action, profile_id: profileId }),
    });
    toast.success(action === 'mute' ? 'Audience member muted' : 'Audience member removed');
    await load();
  };

  const reportMessage = async (messageId: string) => {
    const result = await reportContent({
      sourceTable: 'collab_session_messages',
      sourceId: messageId,
      reason: `Reported from live ritual ${sessionId}`,
    });
    if (!result.ok) return toast.error(result.error || 'Report failed');
    toast.success('Message reported for review');
  };

  const createHandoff = async () => {
    const result = await ritualRequest<{ deep_link: string }>(
      `/api/mythic/sessions/${sessionId}/handoff`,
      { method: 'POST', body: '{}' }
    );
    window.location.href = result.deep_link;
  };

  const endSession = async () => {
    await ritualRequest('/api/mythic/sessions', {
      method: 'PATCH',
      body: JSON.stringify({ sessionId }),
    });
    onEndSession?.();
  };

  if (!snapshot)
    return <div style={{ padding: 32, color: colors.text.muted }}>{t('enteringRitual')}</div>;

  const activeVote = votes.find(vote => vote.status === 'open');
  return (
    <div
      style={{
        height: '100%',
        minHeight: 620,
        background: colors.surface,
        border: `1px solid ${colors.borderStrong}`,
        borderRadius: radius.lg,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          padding: space[8],
          borderBottom: `1px solid ${colors.border}`,
          display: 'flex',
          gap: 12,
          justifyContent: 'space-between',
          flexWrap: 'wrap',
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
          {/* Placeholder participant avatars */}
          <div style={{ display: 'flex', marginRight: space[2] }}>
            {[1, 2, 3].map(i => (
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
              variant="glass"
              size="sm"
              loading={agentBusy}
              onClick={() => void invokeAgent()}
            >
              Ask Spirit · {snapshot.state.agent_budget_remaining}
            </HiveButton>
          )}
          {isCreator && (
            <HiveButton variant="ghost" size="sm" onClick={() => void toggleAgent()}>
              {snapshot.state.agent_enabled ? 'Pause Spirit' : 'Enable Spirit'}
            </HiveButton>
          )}
          {isCreator && (
            <HiveButton variant="ghost" size="sm" onClick={() => void createHandoff()}>
              {t('openInBeehive')}
            </HiveButton>
          )}
          {role === 'owner' && (
            <HiveButton variant="danger" size="sm" onClick={() => void endSession()}>
              {t('endReview')}
            </HiveButton>
          )}
        </div>
      </header>
      {talkback.error && (
        <div role="alert" style={{ padding: 8, color: colors.warning }}>
          {talkback.error}; synchronized previews still work.
        </div>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))',
          flex: 1,
          minHeight: 0,
        }}
      >
        <section
          style={{
            borderRight: `1px solid ${colors.border}`,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
          }}
        >
          <div
            style={{
              padding: space[6],
              display: 'flex',
              gap: 8,
              justifyContent: 'space-between',
              borderBottom: `1px solid ${colors.border}`,
              flexWrap: 'wrap',
            }}
          >
            <span>Stems & Assets</span>
            <HiveButton
              variant="secondary"
              onClick={handleAddStem}
              style={{ fontSize: 12, padding: '4px 10px' }}
            >
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
                  {t('addAudio')}
                </HiveButton>
              </>
            )}
            {role === 'owner' && (
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  aria-label={t('creatorUsername')}
                  value={inviteUsername}
                  onChange={event => setInviteUsername(event.target.value)}
                  placeholder={t('creator')}
                  style={{
                    width: 120,
                    background: colors.bg,
                    color: colors.text.primary,
                    border: `1px solid ${colors.border}`,
                    borderRadius: radius.md,
                    padding: 6,
                  }}
                />
                <HiveButton variant="ghost" size="sm" onClick={() => void inviteCreator()}>
                  {t('invite')}
                </HiveButton>
              </div>
            )}
          </div>
          {currentAsset && (
            <audio
              ref={audioRef}
              src={assetUrl(currentAsset)}
              preload="auto"
              aria-label="Audio player"
            >
              <track kind="captions" src="" label="No captions" />
            </audio>
          )}
          <div
            style={{
              padding: space[6],
              background: colors.bg,
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            <div style={{ fontSize: fontSize.sm, color: colors.text.muted }}>{t('nowShaping')}</div>
            <div style={{ margin: '6px 0 12px', fontWeight: fontWeight.bold }}>
              {currentAsset?.name ?? 'Select an asset'}
            </div>
            {isCreator && (
              <div style={{ display: 'flex', gap: 8 }}>
                <HiveButton
                  size="sm"
                  onClick={() =>
                    currentAsset &&
                    void setPlayback(currentAsset, 'playing', audioRef.current?.currentTime ?? 0)
                  }
                >
                  {t('playForEveryone')}
                </HiveButton>
                <HiveButton
                  variant="glass"
                  size="sm"
                  onClick={() =>
                    void setPlayback(currentAsset, 'paused', audioRef.current?.currentTime ?? 0)
                  }
                >
                  {t('pause')}
                </HiveButton>
                <HiveButton variant="ghost" size="sm" onClick={() => setShowVote(true)}>
                  {t('openVote')}
                </HiveButton>
              </div>
            )}
          </div>
          <div style={{ overflowY: 'auto', padding: space[4] }}>
            {snapshot.assets.map(asset => (
              <button
                key={asset.id}
                onClick={() => isCreator && void setPlayback(asset, 'paused', 0)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  color: colors.text.primary,
                  background:
                    asset.id === currentAsset?.id ? colors.accentFaint : colors.surfaceMuted,
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.md,
                  padding: 12,
                  marginBottom: 6,
                  cursor: isCreator ? 'pointer' : 'default',
                }}
              >
                {asset.name}
                <span style={{ float: 'right', color: colors.text.muted }}>{asset.asset_type}</span>
              </button>
            ))}
            {snapshot.assets.length === 0 && (
              <div style={{ color: colors.text.muted }}>{t('creatorsHaveNotAdded')}</div>
            )}
          </div>
        </section>
        <section style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ padding: space[6], borderBottom: `1px solid ${colors.border}` }}>
            <strong>{t('audienceSignal')}</strong> ·{' '}
            <span style={{ color: colors.text.muted }}>{participants.length} present</span>
          </div>
          {activeVote && (
            <div
              style={{
                padding: space[6],
                background: colors.accentFaint,
                borderBottom: `1px solid ${colors.accentMuted}`,
              }}
            >
              <strong>
                {activeVote.actor_type === 'agent' ? 'Session Spirit asks: ' : ''}
                {activeVote.prompt}
              </strong>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {activeVote.options.map(option => (
                  <HiveButton
                    key={option}
                    variant="glass"
                    size="sm"
                    onClick={() => void respondVote(activeVote, option)}
                  >
                    {option}
                  </HiveButton>
                ))}
              </div>
            </div>
          )}
          <div style={{ flex: 1, overflowY: 'auto', padding: space[6], background: colors.bg }}>
            {messages.map(item => (
              <div key={item.id} style={{ marginBottom: 10 }}>
                <strong style={{ color: colors.accent }}>
                  {item.profiles?.display_name || item.profiles?.username || 'Artist'}:
                </strong>{' '}
                {item.body}
                <span style={{ float: 'right', display: 'inline-flex', gap: 6 }}>
                  {item.sender_id !== profile?.id && (
                    <button
                      onClick={() => void reportMessage(item.id)}
                      aria-label={t('reportMessage')}
                      style={{
                        background: 'transparent',
                        border: 0,
                        color: colors.text.muted,
                        cursor: 'pointer',
                      }}
                    >
                      report
                    </button>
                  )}
                  {isCreator && item.sender_id !== profile?.id && (
                    <>
                      <button
                        onClick={() => void hideMessage(item.id)}
                        aria-label={t('hideMessage')}
                        style={{
                          background: 'transparent',
                          border: 0,
                          color: colors.text.muted,
                          cursor: 'pointer',
                        }}
                      >
                        hide
                      </button>
                      <button
                        onClick={() => void moderateProfile(item.sender_id, 'mute')}
                        aria-label={t('muteAudienceMember')}
                        style={{
                          background: 'transparent',
                          border: 0,
                          color: colors.text.muted,
                          cursor: 'pointer',
                        }}
                      >
                        mute
                      </button>
                      <button
                        onClick={() => void moderateProfile(item.sender_id, 'remove')}
                        aria-label={t('removeAudienceMember')}
                        style={{
                          background: 'transparent',
                          border: 0,
                          color: colors.danger,
                          cursor: 'pointer',
                        }}
                      >
                        remove
                      </button>
                    </>
                  )}
                </span>
              </div>
            ))}
            {messages.length === 0 && (
              <div style={{ color: colors.text.muted }}>{t('theRoomIsListening')}</div>
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
      )}
    </div>
  );
}
