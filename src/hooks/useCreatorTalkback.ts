import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

interface TalkbackState {
  enabled: boolean;
  connectedPeers: number;
  error: string | null;
  toggle: () => Promise<void>;
}

export function useCreatorTalkback(
  sessionId: string,
  profileId: string | undefined,
  allowed: boolean
): TalkbackState {
  const [enabled, setEnabled] = useState(false);
  const [connectedPeers, setConnectedPeers] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const peersRef = useRef(new Map<string, RTCPeerConnection>());
  const audioRef = useRef(new Map<string, HTMLAudioElement>());

  const closeAll = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    peersRef.current.forEach(peer => peer.close());
    peersRef.current.clear();
    audioRef.current.forEach(audio => audio.remove());
    audioRef.current.clear();
    if (channelRef.current) void supabase.removeChannel(channelRef.current);
    channelRef.current = null;
    setConnectedPeers(0);
    setEnabled(false);
  }, []);

  useEffect(() => closeAll, [closeAll]);

  const toggle = useCallback(async () => {
    if (!allowed || !profileId) return;
    if (enabled) {
      closeAll();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      const channel = supabase.channel(`ritual-talkback:${sessionId}`, {
        config: { private: true, presence: { key: profileId } },
      });
      channelRef.current = channel;

      const peerFor = (remoteId: string) => {
        const existing = peersRef.current.get(remoteId);
        if (existing) return existing;
        const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
        const peer = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            ...(turnUrl
              ? [
                  {
                    urls: turnUrl,
                    username: process.env.NEXT_PUBLIC_TURN_USERNAME,
                    credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
                  },
                ]
              : []),
          ],
        });
        for (const track of stream.getTracks()) peer.addTrack(track, stream);
        peer.onicecandidate = event => {
          if (event.candidate) {
            void channel.send({
              type: 'broadcast',
              event: 'signal',
              payload: { from: profileId, to: remoteId, kind: 'ice', data: event.candidate },
            });
          }
        };
        peer.ontrack = event => {
          let audio = audioRef.current.get(remoteId);
          if (!audio) {
            audio = new Audio();
            audio.autoplay = true;
            audioRef.current.set(remoteId, audio);
          }
          audio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
        };
        peer.onconnectionstatechange = () => {
          setConnectedPeers(
            [...peersRef.current.values()].filter(p => p.connectionState === 'connected').length
          );
        };
        peersRef.current.set(remoteId, peer);
        return peer;
      };

      channel.on('broadcast', { event: 'signal' }, async ({ payload }) => {
        if (payload.to !== profileId || payload.from === profileId) return;
        const peer = peerFor(payload.from);
        if (payload.kind === 'offer') {
          await peer.setRemoteDescription(payload.data);
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          await channel.send({
            type: 'broadcast',
            event: 'signal',
            payload: { from: profileId, to: payload.from, kind: 'answer', data: answer },
          });
        } else if (payload.kind === 'answer') {
          await peer.setRemoteDescription(payload.data);
        } else if (payload.kind === 'ice') {
          await peer.addIceCandidate(payload.data).catch(() => undefined);
        }
      });
      channel.on('presence', { event: 'sync' }, async () => {
        for (const remoteId of Object.keys(channel.presenceState())) {
          if (remoteId === profileId || profileId > remoteId) continue;
          const peer = peerFor(remoteId);
          if (peer.signalingState !== 'stable') continue;
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          await channel.send({
            type: 'broadcast',
            event: 'signal',
            payload: { from: profileId, to: remoteId, kind: 'offer', data: offer },
          });
        }
      });
      channel.subscribe(async status => {
        if (status === 'SUBSCRIBED') await channel.track({ profile_id: profileId });
      });
      setEnabled(true);
      setError(null);
    } catch (cause) {
      closeAll();
      setError(cause instanceof Error ? cause.message : 'Microphone unavailable');
    }
  }, [allowed, closeAll, enabled, profileId, sessionId]);

  return { enabled, connectedPeers, error, toggle };
}
