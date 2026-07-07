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
import { HiveButton } from './hive/HiveButton';
import { Avatar } from './ui/Avatar';

interface Props {
  sessionId: string;
  title: string;
  onEndSession?: () => void;
}

const STEM_BUCKET = 'mix-audio';

export function MythicSessionRoom({ sessionId, title, onEndSession }: Props) {
  const t = useTranslations('mythicSessionRoom');
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
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'collab_session_messages',
          filter: `session_id=eq.${sessionId}`,
        },
        () => void load()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'collab_session_state',
          filter: `session_id=eq.${sessionId}`,
        },
        () => void load()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'collab_session_votes',
          filter: `session_id=eq.${sessionId}`,
        },
        () => void load()
      )
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
    setMessage('');
    await load();
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

  const invokeAgent = async () => {
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
  };

  useEffect(() => {
    if (role !== 'owner' || !snapshot?.state.agent_enabled) return;
    const timer = window.setInterval(() => void invokeAgent(), 120_000);
    return () => window.clearInterval(timer);
  }, [role, snapshot?.state.agent_enabled, snapshot?.state.agent_budget_remaining]);

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

  const hideMessage = async (messageId: string) => {
    await ritualRequest(`/api/mythic/sessions/${sessionId}/moderation`, {
      method: 'POST',
      body: JSON.stringify({ action: 'hide_message', message_id: messageId }),
    });
    await load();
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
    return <div style={{ padding: 32, color: colors.text.muted }}>{t('enteringRitual')}</div>;

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
          <div style={{ fontWeight: fontWeight.bold, fontSize: fontSize.xl }}>{title}</div>
          <div style={{ color: colors.text.muted, fontSize: fontSize.sm }}>
            {snapshot.session.is_public ? 'Public creative ritual' : 'Private creator session'} ·{' '}
            {role}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {participants.slice(0, 6).map(person => (
            <Avatar key={person.id} src={person.avatar_url} name={person.username} size={30} />
          ))}
          {isCreator && (
            <HiveButton variant="glass" size="sm" onClick={() => void talkback.toggle()}>
              {talkback.enabled
                ? `Talkback on · ${talkback.connectedPeers} · ${talkback.relayAvailable ? 'relay ready' : 'direct only'}`
                : 'Enable talkback'}
            </HiveButton>
          )}
          {isCreator && snapshot.state.agent_enabled && (
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
              {t('openInBeehive')}
            </HiveButton>
          )}
          {role === 'owner' && (
            <HiveButton variant="danger" size="sm" onClick={() => void endSession()}>
              {t('endReview')}
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
            <strong>{t('sharedSound')}</strong>
            {isCreator && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="audio/*"
                  multiple
                  hidden
                  onChange={event => void uploadFiles(event.target.files)}
                />
                <HiveButton
                  variant="glass"
                  size="sm"
                  loading={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {t('addAudio')}
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
                  {t('invite')}
                </HiveButton>
              </div>
            )}
          </div>
          {currentAsset && <audio ref={audioRef} src={assetUrl(currentAsset)} preload="auto" />}
          <div
            style={{
              padding: space[6],
              background: colors.bg,
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            <div style={{ fontSize: fontSize.sm, color: colors.text.muted }}>{t('nowShaping')}</div>
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
                  {t('playForEveryone')}
                </HiveButton>
                <HiveButton
                  variant="glass"
                  size="sm"
                  onClick={() =>
                    void setPlayback(currentAsset, 'paused', audioRef.current?.currentTime ?? 0)
                  }
                >
                  {t('pause')}
                </HiveButton>
                <HiveButton variant="ghost" size="sm" onClick={() => setShowVote(true)}>
                  {t('openVote')}
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
              <div style={{ color: colors.text.muted }}>{t('creatorsHaveNotAdded')}</div>
            )}
          </div>
        </section>
        <section style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ padding: space[6], borderBottom: `1px solid ${colors.border}` }}>
            <strong>{t('audienceSignal')}</strong> ·{' '}
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
              <div style={{ color: colors.text.muted }}>{t('theRoomIsListening')}</div>
            )}
          </div>
          <div
            style={{
              padding: space[4],
              borderTop: `1px solid ${colors.border}`,
              display: 'flex',
              gap: 8,
            }}
          >
            <input
              value={message}
              maxLength={1000}
              onChange={event => setMessage(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') void sendMessage();
              }}
              placeholder={t('addToTheRitual')}
              style={{
                flex: 1,
                background: colors.bg,
                color: colors.text.primary,
                border: `1px solid ${colors.border}`,
                borderRadius: radius.md,
                padding: 10,
              }}
            />
            <HiveButton
              variant="glass"
              size="sm"
              disabled={!message.trim()}
              onClick={() => void sendMessage()}
            >
              {t('send')}
            </HiveButton>
          </div>
        </section>
      </div>
      {showVote && (
        <div
          role="dialog"
          aria-label={t('createAudienceVote')}
          style={{
            position: 'absolute',
            inset: '20% 25%',
            background: colors.surface,
            border: `1px solid ${colors.accent}`,
            borderRadius: radius.lg,
            padding: 24,
            zIndex: 20,
          }}
        >
          <h3>{t('openACreativeFork')}</h3>
          <p style={{ color: colors.text.muted }}>
            Audience members will choose between the first four shared assets.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <HiveButton onClick={() => void createVote()}>{t('openVote')}</HiveButton>
            <HiveButton variant="ghost" onClick={() => setShowVote(false)}>
              {t('cancel')}
            </HiveButton>
          </div>
        </div>
      )}
    </div>
  );
}
