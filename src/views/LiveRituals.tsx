import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { ritualRequest } from '../lib/rituals';
import { supabase } from '../lib/supabase';
import { colors, fontSize, radius, space } from '../styles/tokens';
import { HiveButton } from '../components/hive/HiveButton';

interface Ritual {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
}

interface RitualInvite {
  id: string;
  session_id: string;
  role: 'creator' | 'moderator';
  collab_sessions: { title: string } | null;
}

export function LiveRituals() {
  const t = useTranslations('liveRituals');
  const { user } = useAuth();
  const [rituals, setRituals] = useState<Ritual[]>([]);
  const [invites, setInvites] = useState<RitualInvite[]>([]);
  useEffect(() => {
    void supabase
      .from('collab_sessions')
      .select('id,title,description,created_at')
      .eq('is_public', true)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => setRituals((data ?? []) as Ritual[]));
    if (user) {
      void supabase
        .from('collab_session_invites')
        .select('id,session_id,role,collab_sessions(title)')
        .eq('profile_id', user.id)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .then(({ data }) => setInvites((data ?? []) as unknown as RitualInvite[]));
    }
  }, [user]);

  const answerInvite = async (invite: RitualInvite, status: 'accepted' | 'declined') => {
    try {
      await ritualRequest(`/api/mythic/sessions/${invite.session_id}/invites`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setInvites(current => current.filter(item => item.id !== invite.id));
      toast.success(status === 'accepted' ? 'You joined the creator stage' : 'Invitation declined');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not answer invitation');
    }
  };

  return (
    <div
      style={{ maxWidth: 1000, margin: '0 auto', padding: `${space[12]}px ${space[8]}px 120px` }}
    >
      <h1 style={{ fontSize: fontSize['3xl'] }}>{t('liveCreativeRituals')}</h1>
      <p style={{ color: colors.text.muted }}>
        Enter the process, influence the direction, witness the provenance.
      </p>
      {invites.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2>{t('creatorInvitations')}</h2>
          {invites.map(invite => (
            <div
              key={invite.id}
              style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'space-between',
                alignItems: 'center',
                background: colors.accentFaint,
                border: `1px solid ${colors.accentMuted}`,
                borderRadius: radius.md,
                padding: 12,
                marginBottom: 8,
              }}
            >
              <span>
                <strong>{invite.collab_sessions?.title || 'Private ritual'}</strong> · {invite.role}
              </span>
              <span style={{ display: 'flex', gap: 6 }}>
                <HiveButton size="sm" onClick={() => void answerInvite(invite, 'accepted')}>
                  {t('joinStage')}
                </HiveButton>
                <HiveButton
                  variant="ghost"
                  size="sm"
                  onClick={() => void answerInvite(invite, 'declined')}
                >
                  {t('decline')}
                </HiveButton>
              </span>
            </div>
          ))}
        </section>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
          gap: 12,
          marginTop: 24,
        }}
      >
        {rituals.map(ritual => (
          <Link
            key={ritual.id}
            to={`/session/${ritual.id}`}
            style={{
              color: colors.text.primary,
              textDecoration: 'none',
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: radius.lg,
              padding: 20,
            }}
          >
            <strong>{ritual.title}</strong>
            <p style={{ color: colors.text.muted }}>
              {ritual.description || 'A live creative process is unfolding.'}
            </p>
            <span style={{ color: colors.accent }}>Enter ritual →</span>
          </Link>
        ))}
        {rituals.length === 0 && (
          <div style={{ color: colors.text.muted }}>{t('noPublicRitualsAre')}</div>
        )}
      </div>
    </div>
  );
}
