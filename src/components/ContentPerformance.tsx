import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { HiveCard } from './hive';
import type { Mix } from '../lib/types';
import { colors, radius, space, fontWeight } from '../styles/tokens';

type SortKey = 'plays' | 'likes' | 'comments' | 'engagement';
type SortDir = 'asc' | 'desc';

interface Genre {
  name: string;
  count: number;
}

interface Props {
  mixes: Mix[];
  genres: Genre[];
}

/** Engagement rate = (likes + comments) / plays. Null when there are no plays. */
function engagementRate(mix: Mix): number | null {
  const plays = mix.play_count || 0;
  if (plays === 0) return null;
  return ((mix.like_count || 0) + (mix.comment_count || 0)) / plays;
}

function sortValue(mix: Mix, key: SortKey): number {
  switch (key) {
    case 'plays':
      return mix.play_count || 0;
    case 'likes':
      return mix.like_count || 0;
    case 'comments':
      return mix.comment_count || 0;
    case 'engagement':
      return engagementRate(mix) ?? -1; // no-play mixes sink to the bottom
  }
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'plays', label: 'Plays' },
  { key: 'likes', label: 'Likes' },
  { key: 'comments', label: 'Comments' },
  { key: 'engagement', label: 'Engagement' },
];

/**
 * Content-performance breakdown for the creator Dashboard: a sortable per-mix
 * table plus a share-of-catalog genre distribution. Reads only data already
 * loaded on the Dashboard (the mixes array + computed genreDistribution) — no
 * new fetches. Answers "which of my drops actually work?".
 */
export function ContentPerformance({ mixes, genres }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: 'plays',
    dir: 'desc',
  });

  const sortedMixes = useMemo(() => {
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...mixes].sort((a, b) => (sortValue(a, sort.key) - sortValue(b, sort.key)) * factor);
  }, [mixes, sort]);

  const topGenreCount = useMemo(
    () => genres.reduce((max, g) => Math.max(max, g.count), 0),
    [genres]
  );
  const totalGenreCount = useMemo(() => genres.reduce((sum, g) => sum + g.count, 0), [genres]);
  const sortedGenres = useMemo(() => [...genres].sort((a, b) => b.count - a.count), [genres]);

  function toggleSort(key: SortKey) {
    setSort(prev =>
      prev.key === key ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }
    );
  }

  const headerCellStyle = {
    padding: `${space[4]}px ${space[5]}px`,
    textAlign: 'right' as const,
    whiteSpace: 'nowrap' as const,
  };
  const bodyCellStyle = {
    padding: `${space[4]}px ${space[5]}px`,
    textAlign: 'right' as const,
    whiteSpace: 'nowrap' as const,
    color: colors.text.secondary,
    fontSize: 13,
    fontVariantNumeric: 'tabular-nums' as const,
  };

  return (
    <section style={{ marginBottom: space[10] }}>
      <HiveCard>
        <h2 style={{ margin: '0 0 4px', color: colors.text.primary, fontSize: 20 }}>
          Content performance
        </h2>
        <p style={{ margin: '0 0 18px', color: colors.text.muted, fontSize: 13 }}>
          Which of your drops actually work — ranked by the signal they pull.
        </p>

        {mixes.length === 0 ? (
          <p style={{ margin: 0, color: colors.text.muted }}>
            Publish a mix to see how each one performs.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                minWidth: 460,
                borderCollapse: 'collapse',
                fontSize: 13,
              }}
            >
              <thead>
                <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                  <th
                    scope="col"
                    style={{
                      padding: `${space[4]}px ${space[5]}px`,
                      textAlign: 'left',
                      color: colors.text.dim,
                      fontSize: 11,
                      fontWeight: fontWeight.bold,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    Mix
                  </th>
                  {COLUMNS.map(col => {
                    const active = sort.key === col.key;
                    return (
                      <th
                        key={col.key}
                        scope="col"
                        aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                        style={headerCellStyle}
                      >
                        <button
                          type="button"
                          onClick={() => toggleSort(col.key)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                            font: 'inherit',
                            fontSize: 11,
                            fontWeight: fontWeight.bold,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            color: active ? colors.accent : colors.text.dim,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          {col.label}
                          <span aria-hidden="true" style={{ fontSize: 9, opacity: active ? 1 : 0.3 }}>
                            {active ? (sort.dir === 'asc' ? '▲' : '▼') : '▼'}
                          </span>
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sortedMixes.map(mix => {
                  const rate = engagementRate(mix);
                  return (
                    <tr key={mix.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                      <td style={{ padding: `${space[4]}px ${space[5]}px` }}>
                        <Link
                          to={`/mix/${mix.id}`}
                          aria-label={mix.title}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: space[5],
                            color: colors.text.primary,
                            textDecoration: 'none',
                            minWidth: 0,
                          }}
                        >
                          <span
                            style={{
                              width: 34,
                              height: 34,
                              flexShrink: 0,
                              borderRadius: radius.sm,
                              background: mix.artwork_url
                                ? `url(${mix.artwork_url}) center/cover`
                                : colors.surfaceHover,
                            }}
                          />
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: 13,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: 200,
                            }}
                          >
                            {mix.title}
                          </span>
                        </Link>
                      </td>
                      <td style={bodyCellStyle}>{(mix.play_count || 0).toLocaleString()}</td>
                      <td style={bodyCellStyle}>{(mix.like_count || 0).toLocaleString()}</td>
                      <td style={bodyCellStyle}>{(mix.comment_count || 0).toLocaleString()}</td>
                      <td
                        style={{
                          ...bodyCellStyle,
                          color: rate === null ? colors.text.faint : colors.accent,
                          fontWeight: fontWeight.semibold,
                        }}
                      >
                        {rate === null ? '—' : `${Math.round(rate * 100)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {sortedGenres.length > 0 && (
          <div style={{ marginTop: space[9] }}>
            <h3
              style={{
                margin: '0 0 12px',
                color: colors.text.secondary,
                fontSize: 12,
                fontWeight: fontWeight.bold,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Catalog by genre
            </h3>
            <div style={{ display: 'grid', gap: space[5] }}>
              {sortedGenres.map(genre => {
                const pct = totalGenreCount > 0 ? Math.round((genre.count / totalGenreCount) * 100) : 0;
                const barPct = topGenreCount > 0 ? (genre.count / topGenreCount) * 100 : 0;
                return (
                  <div key={genre.name}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: space[5],
                        marginBottom: 5,
                        fontSize: 12,
                      }}
                    >
                      <span
                        style={{
                          color: colors.text.secondary,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {genre.name}
                      </span>
                      <span style={{ color: colors.text.dim, flexShrink: 0 }}>
                        {genre.count} · {pct}%
                      </span>
                    </div>
                    <div
                      style={{
                        height: 8,
                        borderRadius: 999,
                        background: colors.surfaceHover,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.max(barPct, 3)}%`,
                          height: '100%',
                          borderRadius: 999,
                          background: colors.accent,
                          transition: 'width 500ms cubic-bezier(0.22,1,0.36,1)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </HiveCard>
    </section>
  );
}

export default ContentPerformance;
