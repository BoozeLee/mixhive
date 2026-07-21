'use client';
import { useTranslations } from 'next-intl';

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { colors, fontSize, space, fontWeight, radius, withAlpha } from '../styles/tokens';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { HiveButton } from '../components/hive/HiveButton';
import { MythicSessionRoom } from '../components/MythicSessionRoom';
import { PostSessionReview } from '../components/PostSessionReview';
import { useAuth } from '../hooks/useAuth';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import toast from 'react-hot-toast';

interface SessionMeta {
  id: string;
  title: string;
  status: string;
  owner_id: string;
}

type PageMode = 'loading' | 'room' | 'review' | 'ended' | 'error';

export function CollabSessionRoom() {
  const t = useTranslations('collabSessionRoom');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [session, setSession] = useState<SessionMeta | null>(null);
  const [mode, setMode] = useState<PageMode>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!id || !user) return;
    fetchSession();
  }, [id, user]);

  const fetchSession = async () => {
    if (!isSupabaseConfigured || !id) {
      setErrorMsg('Supabase not configured');
      setMode('error');
      return;
    }

    const { data, error } = await supabase
      .from('collab_sessions')
      .select('id, title, status, owner_id')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      setErrorMsg(error?.message || 'Session not found');
      setMode('error');
      return;
    }

    setSession(data as SessionMeta);

    if (data.status === 'ended') {
      setMode('ended');
    } else {
      setMode('room');
    }
  };

  const handleEndSession = () => {
    setMode('review');
  };

  const handleReviewComplete = () => {
    toast.success('Session outcomes written to your Mythic graph.');
    setMode('ended');
  };

  if (mode === 'loading') {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '60vh',
        }}
      >
        <LoadingSpinner />
      </div>
    );
  }

  if (mode === 'error') {
    return (
      <div
        style={{
          maxWidth: 560,
          margin: '0 auto',
          padding: `${space[10]}px ${space[4]}px`,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 40, marginBottom: space[4] }}>⚡</div>
        <h1 style={{ fontSize: fontSize.xl, fontWeight: fontWeight.bold, marginBottom: space[2] }}>
          {t('sessionUnavailable')}
        </h1>
        <p style={{ color: colors.text.muted, fontSize: fontSize.sm, marginBottom: space[6] }}>
          {errorMsg}
        </p>
        <HiveButton variant="secondary" onClick={() => navigate('/dashboard')}>
          {t('backToDashboard')}
        </HiveButton>
      </div>
    );
  }

  if (mode === 'ended') {
    return (
      <div
        style={{
          maxWidth: 560,
          margin: '0 auto',
          padding: `${space[10]}px ${space[4]}px`,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 40, marginBottom: space[4] }}>🎛️</div>
        <h1 style={{ fontSize: fontSize.xl, fontWeight: fontWeight.bold, marginBottom: space[2] }}>
          {t('sessionEnded')}
        </h1>
        <p style={{ color: colors.text.muted, fontSize: fontSize.sm, marginBottom: space[6] }}>
          {session?.title} — this session has been closed and its provenance written to the graph.
        </p>
        <div style={{ display: 'flex', gap: space[3], justifyContent: 'center' }}>
          <HiveButton variant="secondary" onClick={() => navigate('/dashboard')}>
            {t('dashboard')}
          </HiveButton>
          <HiveButton variant="primary" onClick={() => navigate('/quests')}>
            {t('viewQuests')}
          </HiveButton>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: colors.bg }}
    >
      {/* Session header bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: `${space[3]}px ${space[5]}px`,
          borderBottom: `1px solid ${colors.border}`,
          background: colors.surface,
        }}
      >
        <div>
          <span
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              color: colors.text.primary,
            }}
          >
            {session?.title ?? 'Mythic Session'}
          </span>
          <span
            style={{
              marginLeft: space[2],
              fontSize: 11,
              fontWeight: fontWeight.bold,
              textTransform: 'uppercase',
              padding: '2px 6px',
              borderRadius: 4,
              background: withAlpha(colors.successStrong, 0.15),
              color: colors.successStrong,
            }}
          >
            {t('live')}
          </span>
        </div>
        <div style={{ display: 'flex', gap: space[2] }}>
          <HiveButton
            variant="secondary"
            onClick={() => {
              navigator.clipboard
                .writeText(window.location.href)
                .then(() => toast.success('Session link copied'));
            }}
            style={{ fontSize: fontSize.xs, padding: '6px 12px' }}
          >
            {t('copyInviteLink')}
          </HiveButton>
          <HiveButton
            variant="secondary"
            onClick={() => navigate('/dashboard')}
            style={{ fontSize: fontSize.xs, padding: '6px 12px' }}
          >
            ← Leave
          </HiveButton>
        </div>
      </div>

      {/* Session room */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {mode === 'room' && session && (
          <MythicSessionRoom
            sessionId={session.id}
            title={session.title}
            onEndSession={handleEndSession}
          />
        )}

        {mode === 'review' && session && (
          <div
            style={{
              maxWidth: 640,
              margin: '0 auto',
              padding: `${space[8]}px ${space[4]}px`,
            }}
          >
            <h2
              style={{
                fontSize: fontSize.lg,
                fontWeight: fontWeight.bold,
                marginBottom: space[4],
                color: colors.text.primary,
              }}
            >
              {t('sessionReview')}
            </h2>
            <div
              style={{
                background: colors.surface,
                border: `1px solid ${colors.borderStrong}`,
                borderRadius: radius.lg,
                padding: space[5],
              }}
            >
              <PostSessionReview
                sessionId={session.id}
                sessionTitle={session.title}
                onClose={() => navigate('/dashboard')}
                onApproved={handleReviewComplete}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
