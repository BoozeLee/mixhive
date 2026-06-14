import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { colors, withAlpha } from '../styles/tokens';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Select } from '../components/ui/Select';

const ROLE_TYPES = [
  'dj',
  'producer',
  'musician',
  'visual_artist',
  'animator',
  'photographer',
  'videographer',
  'writer',
  'business',
  'actor',
  'designer',
  'developer',
  'other',
];

interface RoleForm {
  role_type: string;
  title: string;
  skill_tags: string;
  experience_level: string;
  is_paid: boolean;
  compensation_notes: string;
}

const emptyRole = (): RoleForm => ({
  role_type: '',
  title: '',
  skill_tags: '',
  experience_level: 'any',
  is_paid: false,
  compensation_notes: '',
});

export function NewCollabQuest() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    narrative: '',
    goals: ['', '', ''],
    genre_tags: '',
    discipline_tags: '',
    region: '',
    timeline_days: '',
    xp_reward: '100',
  });
  const [roles, setRoles] = useState<RoleForm[]>([emptyRole()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const updateForm = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const updateGoal = (i: number, v: string) =>
    setForm(f => {
      const g = [...f.goals];
      g[i] = v;
      return { ...f, goals: g };
    });
  const updateRole = (i: number, k: keyof RoleForm, v: string | boolean) =>
    setRoles(rs => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const addRole = () => setRoles(rs => [...rs, emptyRole()]);
  const removeRole = (i: number) => setRoles(rs => rs.filter((_, j) => j !== i));

  const handleSubmit = async () => {
    setError('');
    const validGoals = form.goals.filter(g => g.trim());
    if (!form.title.trim()) return setError('Title required');
    if (validGoals.length === 0) return setError('At least one goal required');
    const validRoles = roles.filter(r => r.role_type && r.title.trim());
    if (validRoles.length === 0) return setError('At least one role required');

    setSubmitting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Sign in required');

      const res = await fetch('/api/collab-quests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: form.title.trim(),
          narrative: form.narrative.trim() || undefined,
          goals: validGoals,
          genre_tags: form.genre_tags
            .split(',')
            .map(t => t.trim())
            .filter(Boolean),
          discipline_tags: form.discipline_tags
            .split(',')
            .map(t => t.trim())
            .filter(Boolean),
          region: form.region.trim() || undefined,
          timeline_days: form.timeline_days ? parseInt(form.timeline_days) : undefined,
          xp_reward: parseInt(form.xp_reward) || 100,
          roles: validRoles.map(r => ({
            role_type: r.role_type,
            title: r.title.trim(),
            skill_tags: r.skill_tags
              .split(',')
              .map(t => t.trim())
              .filter(Boolean),
            experience_level: r.experience_level,
            is_paid: r.is_paid,
            compensation_notes: r.compensation_notes.trim() || undefined,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create quest');
      navigate(`/collab-quests/${data.quest.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px' }}>
      <h1
        style={{
          fontSize: 24,
          fontFamily: 'var(--font-display)',
          color: 'var(--hive-gold)',
          marginBottom: 4,
        }}
      >
        Post a Quest
      </h1>
      <p style={{ color: colors.text.faint, fontSize: 14, marginBottom: 28 }}>
        Define your creative project and the collaborators you need
      </p>

      {error && (
        <div
          style={{
            background: colors.dangerBgDeep,
            border: `1px solid ${withAlpha(colors.dangerStrong, 0.4)}`,
            color: colors.dangerStrong,
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Quest basics */}
        <section>
          <h2 style={sectionHeadStyle}>Quest Details</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input
              label="Quest title *"
              value={form.title}
              onChange={e => updateForm('title', e.target.value)}
              placeholder='e.g. "Build visual identity for my techno alias"'
            />
            <Textarea
              label="Narrative (RPG-style context)"
              value={form.narrative}
              onChange={e => updateForm('narrative', e.target.value)}
              placeholder="Describe the project in your own words..."
              rows={3}
              style={{ resize: 'vertical' }}
            />
            <div>
              <p style={{ color: colors.text.dimmed, fontSize: 13, marginBottom: 8 }}>
                Goals * (what will be delivered)
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                {form.goals.map((g, i) => (
                  <Input
                    key={i}
                    hideLabel
                    label={`Goal ${i + 1}`}
                    value={g}
                    onChange={e => updateGoal(i, e.target.value)}
                    placeholder={`Goal ${i + 1}${i === 0 ? ' (required)' : ' (optional)'}`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, goals: [...f.goals, ''] }))}
                style={ghostBtnStyle}
              >
                + Add goal
              </button>
            </div>
          </div>
        </section>

        {/* Tags & logistics */}
        <section>
          <h2 style={sectionHeadStyle}>Tags &amp; Logistics</h2>
          <div
            className="p15-form-2col"
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
          >
            <Input
              label="Genre tags (comma-separated)"
              value={form.genre_tags}
              onChange={e => updateForm('genre_tags', e.target.value)}
              placeholder="techno, ambient, house"
            />
            <Input
              label="Discipline tags"
              value={form.discipline_tags}
              onChange={e => updateForm('discipline_tags', e.target.value)}
              placeholder="visual_artist, dj"
            />
            <Input
              label="Region (optional)"
              value={form.region}
              onChange={e => updateForm('region', e.target.value)}
              placeholder="Brussels, Remote, Europe"
            />
            <Input
              label="Timeline (days)"
              type="number"
              value={form.timeline_days}
              onChange={e => updateForm('timeline_days', e.target.value)}
              placeholder="30"
              min="1"
            />
            <Input
              label="XP reward"
              type="number"
              value={form.xp_reward}
              onChange={e => updateForm('xp_reward', e.target.value)}
              min="0"
              max="2000"
            />
          </div>
        </section>

        {/* Roles */}
        <section>
          <h2 style={sectionHeadStyle}>Roles Needed *</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {roles.map((role, i) => (
              <div
                key={i}
                style={{
                  background: colors.surfaceMuted,
                  border: `1px solid ${colors.surfaceRaised}`,
                  borderRadius: 10,
                  padding: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ color: colors.text.muted, fontSize: 13 }}>Role {i + 1}</span>
                  {roles.length > 1 && (
                    <button
                      onClick={() => removeRole(i)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: colors.dangerStrong,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div
                  className="p15-form-2col"
                  style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}
                >
                  <Select
                    label="Type *"
                    placeholder="Select..."
                    value={role.role_type}
                    onChange={e => updateRole(i, 'role_type', e.target.value)}
                    options={ROLE_TYPES.map(rt => ({ value: rt, label: rt.replace('_', ' ') }))}
                  />
                  <Input
                    label="Label *"
                    value={role.title}
                    onChange={e => updateRole(i, 'title', e.target.value)}
                    placeholder="Lead Animator"
                  />
                  <Input
                    label="Skills (comma-sep)"
                    value={role.skill_tags}
                    onChange={e => updateRole(i, 'skill_tags', e.target.value)}
                    placeholder="after_effects, 3d"
                  />
                  <Select
                    label="Experience level"
                    value={role.experience_level}
                    onChange={e => updateRole(i, 'experience_level', e.target.value)}
                  >
                    <option value="any">Any level</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="pro">Pro</option>
                  </Select>
                </div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    color: colors.text.dimmed,
                    fontSize: 13,
                    marginTop: 10,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={role.is_paid}
                    onChange={e => updateRole(i, 'is_paid', e.target.checked)}
                  />
                  Paid role
                </label>
                {role.is_paid && (
                  <div style={{ marginTop: 8 }}>
                    <Input
                      hideLabel
                      label="Compensation notes"
                      value={role.compensation_notes}
                      onChange={e => updateRole(i, 'compensation_notes', e.target.value)}
                      placeholder="e.g. rev share + credit"
                    />
                  </div>
                )}
              </div>
            ))}
            <button type="button" onClick={addRole} style={ghostBtnStyle}>
              + Add role
            </button>
          </div>
        </section>

        <Button
          onClick={handleSubmit}
          disabled={submitting}
          loading={submitting}
          size="lg"
          style={{ alignSelf: 'flex-end' }}
        >
          {submitting ? 'Posting...' : 'Post Quest'}
        </Button>
      </div>
    </div>
  );
}

const sectionHeadStyle: React.CSSProperties = {
  fontSize: 13,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: colors.text.faint,
  marginBottom: 14,
  marginTop: 0,
};
const ghostBtnStyle: React.CSSProperties = {
  background: 'transparent',
  color: colors.text.faint,
  border: `1px dashed ${colors.borderStrong}`,
  borderRadius: 8,
  padding: '8px 16px',
  fontSize: 13,
  cursor: 'pointer',
};
