import { useEffect, useState } from 'react';
import { colors } from '../styles/tokens';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Icon } from '../components/ui/Icon';
import type { IconKey } from '../lib/icons';

interface Role {
  id: string;
  role_type: string;
  title: string;
  skill_tags: string[];
  experience_level: string;
  is_paid: boolean;
  compensation_notes?: string;
  status: string;
  filled_by_profile_id?: string;
}

interface Quest {
  id: string;
  creator_profile_id: string;
  title: string;
  narrative?: string;
  goals: string[];
  phase: string;
  genre_tags: string[];
  discipline_tags: string[];
  region?: string;
  timeline_days?: number;
  xp_reward: number;
  created_at: string;
  collab_roles?: Role[];
}

const ROLE_ICONS: Record<string, IconKey> = {
  dj: 'headphones',
  producer: 'producer',
  musician: 'music',
  visual_artist: 'visual',
  animator: 'edit',
  photographer: 'camera',
  videographer: 'video',
  writer: 'epk',
  business: 'gear',
  actor: 'vocalist',
  designer: 'visual',
  developer: 'composer',
  other: 'sparkles',
};

const PHASE_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: colors.text.faintest },
  recruiting: { label: 'Recruiting', color: 'var(--hive-gold)' },
  in_progress: { label: 'In Progress', color: colors.successStrong },
  complete: { label: 'Complete', color: colors.text.muted },
  cancelled: { label: 'Cancelled', color: colors.dangerStrong },
};

export function CollabQuestDetail() {
  const { id } = useParams<{ id: string }>();
  const [quest, setQuest] = useState<Quest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [applyMessage, setApplyMessage] = useState('');
  const [advancing, setAdvancing] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`/api/collab-quests/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Not found');
        setQuest(data.quest);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleAdvancePhase = async (toPhase: string) => {
    setAdvancing(true);
    setError('');
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Sign in required');
      const res = await fetch(`/api/collab-quests/${id}/phase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ to_phase: toPhase }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setQuest(prev => (prev ? { ...prev, phase: data.quest.phase } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to advance phase');
    } finally {
      setAdvancing(false);
    }
  };

  const handleApply = async (role: Role) => {
    if (!userId) {
      setError('Sign in to apply');
      return;
    }
    setApplying(role.id);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Sign in required');
      const { error: err } = await supabase.from('collab_quest_applications').insert({
        role_id: role.id,
        quest_id: id,
        applicant_profile_id: userId,
        message: applyMessage.trim() || null,
        status: 'pending',
      });
      if (err) throw err;
      setApplied(prev => new Set([...prev, role.id]));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Application failed');
    } finally {
      setApplying(null);
    }
  };

  if (loading)
    return (
      <div style={{ padding: 40, color: colors.text.faintest, textAlign: 'center' }}>
        Loading quest...
      </div>
    );
  if (error || !quest) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: colors.dangerStrong, marginBottom: 16 }}>{error || 'Quest not found'}</p>
        <Link to="/collab-quests" style={{ color: 'var(--hive-gold)' }}>
          ← Back to Quests
        </Link>
      </div>
    );
  }

  const openRoles = quest.collab_roles?.filter(r => r.status === 'open') ?? [];
  const phaseInfo = PHASE_LABELS[quest.phase] ?? { label: quest.phase, color: colors.text.muted };
  const isCreator = userId === quest.creator_profile_id;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 20px' }}>
      <Link
        to="/collab-quests"
        style={{
          color: colors.text.faint,
          fontSize: 13,
          textDecoration: 'none',
          display: 'inline-block',
          marginBottom: 20,
        }}
      >
        ← Collab Quests
      </Link>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <span
            style={{
              color: phaseInfo.color,
              fontSize: 12,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              background: `${phaseInfo.color}22`,
              padding: '3px 10px',
              borderRadius: 4,
            }}
          >
            {phaseInfo.label}
          </span>
          {quest.genre_tags.map(t => (
            <span
              key={t}
              style={{
                background: colors.surfaceRaised,
                color: colors.text.faint,
                fontSize: 11,
                padding: '3px 8px',
                borderRadius: 4,
              }}
            >
              {t}
            </span>
          ))}
        </div>
        <h1
          style={{
            fontSize: 26,
            color: colors.white,
            fontWeight: 700,
            margin: '0 0 8px',
            lineHeight: 1.3,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Icon name="quests" size={24} color="var(--hive-gold, #f6c400)" /> {quest.title}
        </h1>
        {quest.narrative && (
          <p
            style={{
              color: colors.text.dimmed,
              fontSize: 15,
              lineHeight: 1.6,
              fontStyle: 'italic',
              margin: 0,
            }}
          >
            "{quest.narrative}"
          </p>
        )}
      </div>

      {/* Meta strip */}
      <div
        style={{
          display: 'flex',
          gap: 20,
          color: colors.text.faint,
          fontSize: 13,
          marginBottom: 24,
          flexWrap: 'wrap',
        }}
      >
        {quest.region && <span>📍 {quest.region}</span>}
        {quest.timeline_days && <span>⏱ {quest.timeline_days} days</span>}
        <span style={{ color: '#f6c40088' }}>⚡ {quest.xp_reward} XP</span>
      </div>

      {/* Goals */}
      {quest.goals.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h2 style={sectionHeadStyle}>Deliverables</h2>
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {quest.goals.map((g, i) => (
              <li
                key={i}
                style={{
                  display: 'flex',
                  gap: 10,
                  color: colors.text.secondary,
                  fontSize: 14,
                  alignItems: 'flex-start',
                }}
              >
                <span style={{ color: 'var(--hive-gold)', flexShrink: 0 }}>→</span>
                {g}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Roles */}
      <section style={{ marginBottom: 28 }}>
        <h2 style={sectionHeadStyle}>Open Roles ({openRoles.length})</h2>
        {openRoles.length === 0 ? (
          <p style={{ color: colors.text.faintest, fontSize: 14 }}>All roles filled.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {openRoles.map(role => (
              <div
                key={role.id}
                style={{
                  background: colors.surface,
                  border: `1px solid ${colors.surfaceRaised}`,
                  borderRadius: 10,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ display: 'inline-flex', color: 'var(--hive-gold, #f6c400)' }}>
                        <Icon
                          name={ROLE_ICONS[role.role_type] ?? 'sparkles'}
                          size={18}
                          color="currentColor"
                        />
                      </span>
                      <h3 style={{ color: colors.white, fontSize: 15, fontWeight: 700, margin: 0 }}>
                        {role.title}
                      </h3>
                      {role.is_paid && (
                        <span
                          style={{
                            background: '#22c55e22',
                            color: colors.successStrong,
                            fontSize: 11,
                            padding: '2px 6px',
                            borderRadius: 4,
                          }}
                        >
                          PAID
                        </span>
                      )}
                    </div>
                    {role.skill_tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {role.skill_tags.map(t => (
                          <span
                            key={t}
                            style={{
                              background: colors.bg,
                              border: `1px solid ${colors.borderStrong}`,
                              color: colors.text.muted,
                              fontSize: 11,
                              padding: '1px 6px',
                              borderRadius: 4,
                            }}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {role.compensation_notes && (
                      <p style={{ color: colors.text.faint, fontSize: 12, margin: '6px 0 0' }}>
                        {role.compensation_notes}
                      </p>
                    )}
                  </div>

                  {!isCreator && quest.phase === 'recruiting' && (
                    <button
                      onClick={() => handleApply(role)}
                      disabled={applying === role.id || applied.has(role.id)}
                      style={{
                        background: applied.has(role.id) ? colors.successBg : 'var(--hive-gold)',
                        color: applied.has(role.id) ? colors.successStrong : colors.black,
                        border: 'none',
                        borderRadius: 8,
                        padding: '8px 18px',
                        fontWeight: 700,
                        fontSize: 13,
                        cursor:
                          applying === role.id || applied.has(role.id) ? 'default' : 'pointer',
                        opacity: applying === role.id ? 0.7 : 1,
                        flexShrink: 0,
                      }}
                    >
                      {applying === role.id
                        ? 'Applying...'
                        : applied.has(role.id)
                          ? 'Applied ✓'
                          : 'Apply'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Apply message */}
      {!isCreator && quest.phase === 'recruiting' && openRoles.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={sectionHeadStyle}>Application Message (optional)</h2>
          <textarea
            value={applyMessage}
            onChange={e => setApplyMessage(e.target.value)}
            placeholder="Tell the creator why you're a great fit..."
            rows={3}
            style={{
              width: '100%',
              background: colors.surface,
              border: `1px solid ${colors.borderStrong}`,
              color: colors.white,
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 14,
              resize: 'vertical',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
        </section>
      )}

      {/* Creator control panel */}
      {isCreator && quest.phase !== 'complete' && quest.phase !== 'cancelled' && (
        <section
          style={{
            marginBottom: 24,
            padding: 16,
            background: colors.bg,
            border: `1px solid ${colors.borderStrong}`,
            borderRadius: 10,
          }}
        >
          <h2 style={sectionHeadStyle}>Quest Controls</h2>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {quest.phase === 'draft' && (
              <button
                onClick={() => handleAdvancePhase('recruiting')}
                disabled={advancing}
                style={{ ...ctrlBtnStyle, background: 'var(--hive-gold)', color: colors.black }}
              >
                {advancing ? '...' : 'Open for Recruiting'}
              </button>
            )}
            {quest.phase === 'recruiting' && (
              <button
                onClick={() => handleAdvancePhase('in_progress')}
                disabled={advancing}
                style={{ ...ctrlBtnStyle, background: colors.successStrong, color: colors.black }}
              >
                {advancing ? '...' : '▶ Launch Quest'}
              </button>
            )}
            {quest.phase === 'in_progress' && (
              <button
                onClick={() => handleAdvancePhase('complete')}
                disabled={advancing}
                style={{ ...ctrlBtnStyle, background: colors.successStrong, color: colors.black }}
              >
                {advancing ? '...' : '✓ Mark Complete + Award XP'}
              </button>
            )}
            <button
              onClick={() => handleAdvancePhase('cancelled')}
              disabled={advancing}
              style={{
                ...ctrlBtnStyle,
                background: 'transparent',
                color: colors.dangerStrong,
                border: '1px solid #ef444444',
              }}
            >
              Cancel Quest
            </button>
          </div>
          {quest.phase === 'recruiting' && (
            <p style={{ color: colors.text.faintest, fontSize: 12, marginTop: 8, marginBottom: 0 }}>
              Launch when all needed roles are filled.
            </p>
          )}
          {quest.phase === 'in_progress' && (
            <p style={{ color: colors.text.faintest, fontSize: 12, marginTop: 8, marginBottom: 0 }}>
              Marking complete awards XP to all filled role holders.
            </p>
          )}
        </section>
      )}

      {quest.phase === 'complete' && (
        <div
          style={{
            padding: 16,
            background: colors.successBg,
            border: '1px solid #22c55e33',
            borderRadius: 10,
            marginBottom: 24,
            textAlign: 'center',
          }}
        >
          <p style={{ color: colors.successStrong, fontWeight: 700, margin: 0 }}>
            ✓ Quest complete — XP awarded to all collaborators
          </p>
        </div>
      )}

      {error && (
        <div
          style={{
            color: colors.dangerStrong,
            padding: 12,
            background: colors.dangerBgDeep,
            borderRadius: 8,
            fontSize: 14,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

const ctrlBtnStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: 8,
  padding: '9px 18px',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
};

const sectionHeadStyle: React.CSSProperties = {
  fontSize: 13,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: colors.text.faint,
  marginBottom: 14,
  marginTop: 0,
};
