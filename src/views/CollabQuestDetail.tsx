import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

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

const ROLE_ICONS: Record<string, string> = {
  dj: '🎧', producer: '🎹', musician: '🎸', visual_artist: '🎨',
  animator: '✏️', photographer: '📷', videographer: '🎥',
  writer: '✍️', business: '💼', actor: '🎭', designer: '🖌️', developer: '💻', other: '⚡',
};

const PHASE_LABELS: Record<string, { label: string; color: string }> = {
  draft:      { label: 'Draft',       color: '#555' },
  recruiting: { label: 'Recruiting',  color: 'var(--hive-gold)' },
  in_progress:{ label: 'In Progress', color: '#22c55e' },
  complete:   { label: 'Complete',    color: '#888' },
  cancelled:  { label: 'Cancelled',   color: '#ef4444' },
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

  const handleApply = async (role: Role) => {
    if (!userId) { setError('Sign in to apply'); return; }
    setApplying(role.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
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

  if (loading) return <div style={{ padding: 40, color: '#555', textAlign: 'center' }}>Loading quest...</div>;
  if (error || !quest) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: '#ef4444', marginBottom: 16 }}>{error || 'Quest not found'}</p>
        <Link to="/collab-quests" style={{ color: 'var(--hive-gold)' }}>← Back to Quests</Link>
      </div>
    );
  }

  const openRoles = quest.collab_roles?.filter(r => r.status === 'open') ?? [];
  const phaseInfo = PHASE_LABELS[quest.phase] ?? { label: quest.phase, color: '#888' };
  const isCreator = userId === quest.creator_profile_id;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 20px' }}>
      <Link to="/collab-quests" style={{ color: '#666', fontSize: 13, textDecoration: 'none', display: 'inline-block', marginBottom: 20 }}>
        ← Collab Quests
      </Link>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <span style={{ color: phaseInfo.color, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', background: `${phaseInfo.color}22`, padding: '3px 10px', borderRadius: 4 }}>
            {phaseInfo.label}
          </span>
          {quest.genre_tags.map(t => (
            <span key={t} style={{ background: '#1a1a1a', color: '#666', fontSize: 11, padding: '3px 8px', borderRadius: 4 }}>{t}</span>
          ))}
        </div>
        <h1 style={{ fontSize: 26, color: '#fff', fontWeight: 700, margin: '0 0 8px', lineHeight: 1.3 }}>
          ⚔ {quest.title}
        </h1>
        {quest.narrative && (
          <p style={{ color: '#aaa', fontSize: 15, lineHeight: 1.6, fontStyle: 'italic', margin: 0 }}>
            "{quest.narrative}"
          </p>
        )}
      </div>

      {/* Meta strip */}
      <div style={{ display: 'flex', gap: 20, color: '#666', fontSize: 13, marginBottom: 24, flexWrap: 'wrap' }}>
        {quest.region && <span>📍 {quest.region}</span>}
        {quest.timeline_days && <span>⏱ {quest.timeline_days} days</span>}
        <span style={{ color: '#f6c40088' }}>⚡ {quest.xp_reward} XP</span>
      </div>

      {/* Goals */}
      {quest.goals.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h2 style={sectionHeadStyle}>Deliverables</h2>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {quest.goals.map((g, i) => (
              <li key={i} style={{ display: 'flex', gap: 10, color: '#ccc', fontSize: 14, alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--hive-gold)', flexShrink: 0 }}>→</span>
                {g}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Roles */}
      <section style={{ marginBottom: 28 }}>
        <h2 style={sectionHeadStyle}>
          Open Roles ({openRoles.length})
        </h2>
        {openRoles.length === 0 ? (
          <p style={{ color: '#555', fontSize: 14 }}>All roles filled.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {openRoles.map(role => (
              <div key={role.id} style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 10, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 20 }}>{ROLE_ICONS[role.role_type] ?? '⚡'}</span>
                      <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 700, margin: 0 }}>{role.title}</h3>
                      {role.is_paid && (
                        <span style={{ background: '#22c55e22', color: '#22c55e', fontSize: 11, padding: '2px 6px', borderRadius: 4 }}>PAID</span>
                      )}
                    </div>
                    {role.skill_tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {role.skill_tags.map(t => (
                          <span key={t} style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', color: '#888', fontSize: 11, padding: '1px 6px', borderRadius: 4 }}>{t}</span>
                        ))}
                      </div>
                    )}
                    {role.compensation_notes && (
                      <p style={{ color: '#666', fontSize: 12, margin: '6px 0 0' }}>{role.compensation_notes}</p>
                    )}
                  </div>

                  {!isCreator && quest.phase === 'recruiting' && (
                    <button
                      onClick={() => handleApply(role)}
                      disabled={applying === role.id || applied.has(role.id)}
                      style={{
                        background: applied.has(role.id) ? '#1a3a1a' : 'var(--hive-gold)',
                        color: applied.has(role.id) ? '#22c55e' : '#000',
                        border: 'none',
                        borderRadius: 8,
                        padding: '8px 18px',
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: applying === role.id || applied.has(role.id) ? 'default' : 'pointer',
                        opacity: applying === role.id ? 0.7 : 1,
                        flexShrink: 0,
                      }}
                    >
                      {applying === role.id ? 'Applying...' : applied.has(role.id) ? 'Applied ✓' : 'Apply'}
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
            style={{ width: '100%', background: '#111', border: '1px solid #2a2a2a', color: '#fff', borderRadius: 8, padding: '10px 12px', fontSize: 14, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
        </section>
      )}

      {error && (
        <div style={{ color: '#ef4444', padding: 12, background: '#1a0000', borderRadius: 8, fontSize: 14, marginBottom: 16 }}>
          {error}
        </div>
      )}
    </div>
  );
}

const sectionHeadStyle: React.CSSProperties = {
  fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.1em',
  color: '#666', marginBottom: 14, marginTop: 0,
};
