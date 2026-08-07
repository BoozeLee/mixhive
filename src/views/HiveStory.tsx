import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { supabase } from '../lib/supabase';
import { colors, fontSize, fontWeight, getMoodColor, space } from '../styles/tokens';
import { StoryChapterCell, type StoryChapter } from '../components/story/StoryChapterCell';
import { SoundEvolutionBanner, type EvolutionData } from '../components/story/SoundEvolutionBanner';
import { StoryDetailPanel } from '../components/story/StoryDetailPanel';
import { getGenreColor } from '../styles/tokens';

interface HiveStoryProps {
  profileId: string;
  showJourney: boolean;
  isOwn: boolean;
}

interface SnapshotRow {
  metadata: {
    snapshot_index: number;
    narrative?: string;
    genre_tags?: string[];
    period_start?: string;
    period_end?: string;
  };
  entity_id: string;
}

interface SnapshotPeriod {
  index: number;
  genreTags: string[];
  label: string;
}

export function HiveStory({ profileId, showJourney, isOwn }: HiveStoryProps) {
  const t = useTranslations('hiveStory');
  const [chapters, setChapters] = useState<StoryChapter[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<StoryChapter | null>(null);
  const [evolution, setEvolution] = useState<EvolutionData | null>(null);
  const [evolutionLoading, setEvolutionLoading] = useState(true);
  const [snapshotPeriods, setSnapshotPeriods] = useState<SnapshotPeriod[]>([]);

  useEffect(() => {
    if (!showJourney) {
      setLoading(false);
      setEvolutionLoading(false);
      return;
    }

    let mounted = true;

    async function fetchStory() {
      try {
        const { data, error: rpcErr } = await supabase.rpc('get_profile_story', {
          p_profile_id: profileId,
        });
        if (!mounted) return;
        if (rpcErr) throw rpcErr;
        setChapters((data ?? []) as StoryChapter[]);
      } catch {
        if (mounted) setError('Could not load story data.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    async function fetchEvolution() {
      try {
        const { data: snapshots } = await supabase
          .from('ai_embeddings')
          .select('metadata, entity_id')
          .eq('entity_type', 'profile_snapshot')
          .eq('entity_id', profileId)
          .order('metadata->snapshot_index', { ascending: true })
          .limit(3);

        if (!mounted) return;

        const rows = (snapshots ?? []) as SnapshotRow[];
        if (rows.length < 2) {
          setEvolution({});
          setEvolutionLoading(false);
          return;
        }

        const periodLabels = ['Early', 'Mid', 'Recent'];
        const periods: SnapshotPeriod[] = rows.map((r, i) => ({
          index: r.metadata.snapshot_index,
          genreTags: r.metadata.genre_tags ?? [],
          label: periodLabels[i] ?? `Period ${i + 1}`,
        }));
        setSnapshotPeriods(periods);

        const first = rows[0];
        const last = rows[rows.length - 1];
        setEvolution({
          narrative: last?.metadata?.narrative ?? null,
          earlyGenre: first?.metadata?.genre_tags?.[0] ?? null,
          recentGenre: last?.metadata?.genre_tags?.[0] ?? null,
          earlyTags: first?.metadata?.genre_tags?.join(', ') ?? undefined,
          recentTags: last?.metadata?.genre_tags?.join(', ') ?? undefined,
        });
      } catch {
        if (mounted) setEvolution({});
      } finally {
        if (mounted) setEvolutionLoading(false);
      }
    }

    fetchStory();
    fetchEvolution();
    return () => {
      mounted = false;
    };
  }, [profileId, showJourney]);

  if (!showJourney) {
    return (
      <div
        style={{
          padding: `${space[14]}px ${space[10]}px`,
          textAlign: 'center',
          color: colors.text.dim,
        }}
      >
        <p style={{ fontSize: fontSize.md, margin: '0 0 8px' }}>{t('thisArtistHasnT')}</p>
        {isOwn && (
          <p style={{ fontSize: fontSize.sm, color: colors.text.faint }}>
            Enable "Share my journey" in Settings to show your story.
          </p>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: `${space[10]}px`, display: 'flex', gap: 8 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="skeleton"
            style={{ width: 180, height: 208, borderRadius: 8, flexShrink: 0 }}
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: space[10], textAlign: 'center' }}>
        <p style={{ color: colors.danger, fontSize: fontSize.sm }}>{error}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setError(null);
          }}
          style={{
            color: colors.accent,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: fontSize.sm,
          }}
        >
          {t('retry')}
        </button>
      </div>
    );
  }

  if (!chapters || chapters.length < 3) {
    return (
      <div
        style={{
          padding: `${space[14]}px ${space[10]}px`,
          textAlign: 'center',
          color: colors.text.dim,
        }}
      >
        <p style={{ fontSize: fontSize.md, margin: 0 }}>
          Your journey is just beginning. Start by collaborating, gigging, or completing a quest.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Main story content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: space[10],
          padding: `${space[10]}px`,
          overflowY: 'auto',
        }}
      >
        {/* Section A: Milestone chain */}
        <section>
          <h2
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              color: colors.text.muted,
              margin: `0 0 ${space[8]}px`,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {t('journey')}
          </h2>
          <div
            style={{
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'thin',
              scrollbarColor: `${colors.border} transparent`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                paddingBottom: space[6],
                position: 'relative',
              }}
            >
              {chapters.map((ch, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center' }}>
                  {idx > 0 && (
                    <div
                      aria-hidden="true"
                      style={{ width: 12, height: 1, background: colors.border, flexShrink: 0 }}
                    />
                  )}
                  <StoryChapterCell
                    chapter={ch}
                    selected={selectedChapter === ch}
                    onClick={() => setSelectedChapter(selectedChapter === ch ? null : ch)}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section B: Sound evolution */}
        <section>
          <h2
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              color: colors.text.muted,
              margin: `0 0 ${space[8]}px`,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {t('soundEvolution')}
          </h2>

          {/* 3-period genre timeline */}
          {snapshotPeriods.length >= 2 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: space[6],
                marginBottom: space[8],
                flexWrap: 'wrap',
              }}
            >
              {snapshotPeriods.map((period, idx) => (
                <div
                  key={period.index}
                  style={{ display: 'flex', alignItems: 'center', gap: space[6] }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: space[3] }}>
                    <span
                      style={{
                        fontSize: fontSize.xs,
                        color: colors.text.dim,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {period.label}
                    </span>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {period.genreTags.length > 0 ? (
                        period.genreTags.map(tag => (
                          <span
                            key={tag}
                            style={{
                              fontSize: fontSize.xs,
                              padding: '2px 7px',
                              borderRadius: 999,
                              background: `${getGenreColor(tag)}22`,
                              border: `1px solid ${getGenreColor(tag)}55`,
                              color: getGenreColor(tag),
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: fontSize.xs, color: colors.text.faint }}>—</span>
                      )}
                    </div>
                  </div>
                  {idx < snapshotPeriods.length - 1 && (
                    <span
                      style={{ fontSize: fontSize.md, color: colors.text.faint, flexShrink: 0 }}
                    >
                      →
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <SoundEvolutionBanner evolution={evolution} loading={evolutionLoading} />

          {/* Evolution score bar */}
          {evolution?.score !== undefined && (
            <div
              style={{
                marginTop: space[8],
                display: 'flex',
                flexDirection: 'column',
                gap: space[3],
              }}
            >
              {(() => {
                const score = evolution.score ?? 0;
                const label =
                  score >= 0.7 ? 'Consistent' : score >= 0.4 ? 'Evolving' : 'Transformed';
                const barColor =
                  score >= 0.7
                    ? getMoodColor('ambient')
                    : score >= 0.4
                      ? getMoodColor('groove')
                      : getMoodColor('peak');
                return (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span
                        style={{
                          fontSize: fontSize.xs,
                          color: colors.text.dim,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                        }}
                      >
                        Sound consistency
                      </span>
                      <span
                        style={{
                          fontSize: fontSize.xs,
                          fontWeight: fontWeight.semibold,
                          color: barColor,
                        }}
                      >
                        {label}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 4,
                        borderRadius: 999,
                        background: colors.border,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.round(score * 100)}%`,
                          background: barColor,
                          borderRadius: 999,
                          transition: 'width 600ms ease',
                        }}
                      />
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </section>

        {/* Section C: Narrative annotation */}
        {evolution?.narrative && (
          <section>
            <div
              style={{
                background: colors.accentFaint,
                border: `1px solid ${colors.accentMuted}`,
                borderLeft: `4px solid ${colors.accent}`,
                borderRadius: 8,
                padding: space[10],
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: fontSize.sm,
                  color: colors.text.primary,
                  lineHeight: 1.6,
                }}
              >
                ⚡ {evolution.narrative}
              </p>
            </div>
          </section>
        )}

        {!evolution?.narrative && !evolutionLoading && (
          <section>
            <div
              style={{
                background: colors.accentFaint,
                border: `1px solid ${colors.border}`,
                borderLeft: `4px solid ${colors.accentMuted}`,
                borderRadius: 8,
                padding: space[10],
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: fontSize.sm,
                  color: colors.text.muted,
                  lineHeight: 1.6,
                }}
              >
                ⚡ Your sound story is being analysed — check back soon.
              </p>
            </div>
          </section>
        )}
      </div>

      {/* Detail panel */}
      {selectedChapter && (
        <StoryDetailPanel chapter={selectedChapter} onClose={() => setSelectedChapter(null)} />
      )}
    </div>
  );
}
