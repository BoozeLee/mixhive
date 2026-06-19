import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { colors, withAlpha } from '../styles/tokens';
import { Link } from 'react-router-dom';
import { Icon } from '../components/ui/Icon';
import type { IconKey } from '../lib/icons';

interface CollabQuest {
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
  collab_roles?: Array<{ id: string; role_type: string; title: string; status: string }>;
}

const DISCIPLINES = [
  { value: '', label: 'All Disciplines' },
  { value: 'dj', label: 'DJ' },
  { value: 'producer', label: 'Producer' },
  { value: 'musician', label: 'Musician' },
  { value: 'visual_artist', label: 'Visual Artist' },
  { value: 'animator', label: 'Animator' },
  { value: 'photographer', label: 'Photographer' },
  { value: 'videographer', label: 'Videographer' },
  { value: 'writer', label: 'Writer' },
  { value: 'business', label: 'Business' },
  { value: 'designer', label: 'Designer' },
  { value: 'developer', label: 'Developer' },
];

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

export function CollabQuests() {
  const t = useTranslations('quests');
  const [quests, setQuests] = useState<CollabQuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [total, setTotal] = useState(0);

  const fetchQuests = async (disc: string) => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ phase: 'recruiting', limit: '20' });
    if (disc) params.set('discipline', disc);
    try {
      const res = await fetch(`/api/collab-quests?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      setQuests(data.quests ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load quests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuests(discipline);
  }, [discipline]);

  return (
    <div style={{ padding: '24px 20px', maxWidth: 900, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 28,
              fontFamily: 'var(--font-display)',
              color: 'var(--hive-gold)',
              margin: 0,
              letterSpacing: '0.05em',
            }}
          >
            {t('collabQuests')}
          </h1>
          <p style={{ color: colors.text.muted, margin: '4px 0 0', fontSize: 14 }}>
            {t('collabSubtitle')}
          </p>
        </div>
        <Link
          to="/collab-quests/new"
          style={{
            background: 'var(--hive-gold)',
            color: colors.black,
            padding: '10px 20px',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 14,
            textDecoration: 'none',
          }}
        >
          + Post a Quest
        </Link>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <select
          value={discipline}
          onChange={e => setDiscipline(e.target.value)}
          style={selectStyle}
        >
          {DISCIPLINES.map(d => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      {!loading && (
        <p style={{ color: colors.text.faintest, fontSize: 13, marginBottom: 16 }}>
          {total} open quest{total !== 1 ? 's' : ''}
        </p>
      )}

      {error && (
        <div
          style={{
            color: colors.dangerStrong,
            padding: 12,
            background: colors.dangerBgDeep,
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 160,
                background: colors.surface,
                borderRadius: 12,
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      ) : quests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 20px', color: colors.text.faintest }}>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
            <Icon name="quests" size={44} color="rgba(246,196,0,0.5)" strokeWidth={1.6} />
          </div>
          <p style={{ fontSize: 18 }}>{t('noRecruiting')}</p>
          <p style={{ fontSize: 14 }}>
            <Link to="/collab-quests/new" style={{ color: 'var(--hive-gold)' }}>
              {t('postFirst')}
            </Link>
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {quests.map(quest => (
            <QuestCard key={quest.id} quest={quest} />
          ))}
        </div>
      )}
    </div>
  );
}

function QuestCard({ quest }: { quest: CollabQuest }) {
  const t = useTranslations('quests');
  const openRoles = quest.collab_roles?.filter(r => r.status === 'open') ?? [];
  const uniqueRoleTypes = [...new Set(openRoles.map(r => r.role_type))];

  return (
    <Link to={`/collab-quests/${quest.id}`} style={{ textDecoration: 'none' }}>
      <div
        style={{
          background: colors.surface,
          border: `1px solid ${colors.surfaceRaised}`,
          borderRadius: 12,
          padding: 20,
          transition: 'border-color 0.2s, transform 0.15s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = withAlpha(colors.accentBright, 0.2);
          (e.currentTarget as HTMLElement).style.transform = 'translateX(4px)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = colors.surfaceRaised;
          (e.currentTarget as HTMLElement).style.transform = 'translateX(0)';
        }}
      >
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            {/* Tags */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              <span
                style={{
                  background: withAlpha(colors.accentBright, 0.13),
                  color: 'var(--hive-gold)',
                  fontSize: 10,
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                {t('recruiting')}
              </span>
              {quest.genre_tags.slice(0, 3).map(t => (
                <span
                  key={t}
                  style={{
                    background: colors.surfaceRaised,
                    color: colors.text.faint,
                    fontSize: 10,
                    padding: '2px 8px',
                    borderRadius: 4,
                  }}
                >
                  {t}
                </span>
              ))}
            </div>

            {/* Title */}
            <h3
              style={{
                color: colors.white,
                fontSize: 18,
                fontWeight: 700,
                margin: '0 0 6px',
                lineHeight: 1.3,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Icon name="quests" size={17} color={`var(--hive-gold, ${colors.accentBright})`} /> {quest.title}
            </h3>

            {/* Narrative */}
            {quest.narrative && (
              <p
                style={{
                  color: colors.text.muted,
                  fontSize: 13,
                  margin: '0 0 12px',
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                "{quest.narrative}"
              </p>
            )}

            {/* Roles needed */}
            {uniqueRoleTypes.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {uniqueRoleTypes.slice(0, 5).map(rt => (
                  <span
                    key={rt}
                    style={{
                      background: colors.bg,
                      border: `1px solid ${colors.borderStrong}`,
                      color: colors.text.secondary,
                      fontSize: 12,
                      padding: '4px 10px',
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Icon name={ROLE_ICONS[rt] ?? 'sparkles'} size={13} color="currentColor" />{' '}
                    {rt.replace('_', ' ')}
                  </span>
                ))}
                {uniqueRoleTypes.length > 5 && (
                  <span style={{ color: colors.text.faintest, fontSize: 12, alignSelf: 'center' }}>
                    +{uniqueRoleTypes.length - 5} more
                  </span>
                )}
              </div>
            )}

            {/* Meta */}
            <div style={{ display: 'flex', gap: 16, color: colors.text.faintest, fontSize: 12 }}>
              {quest.region && <span>📍 {quest.region}</span>}
              {quest.timeline_days && <span>⏱ {quest.timeline_days} days</span>}
              <span style={{ color: withAlpha(colors.accentBright, 0.53) }}>
                ⚡ {quest.xp_reward} XP
              </span>
            </div>
          </div>

          {/* Apply button */}
          <div style={{ flexShrink: 0 }}>
            <div
              style={{
                color: withAlpha(colors.accentBright, 0.53),
                fontSize: 13,
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              Apply for a Role →
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

const selectStyle: React.CSSProperties = {
  background: colors.surface,
  border: `1px solid ${colors.borderStrong}`,
  color: colors.text.secondary,
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 13,
  cursor: 'pointer',
};
