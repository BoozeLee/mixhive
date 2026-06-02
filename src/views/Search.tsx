import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MixCard } from '../components/MixCard';
import { SearchAutocomplete } from '../components/SearchAutocomplete';
import { SearchFilters } from '../components/SearchFilters';
import { SearchHistory } from '../components/SearchHistory';
import { SkeletonFeed } from '../components/Skeleton';
import { enhancedSearch, trackSearch } from '../lib/search';
import type { SearchFilters as SearchFiltersValue } from '../lib/search';
import type { FeedMix, Profile } from '../lib/types';
import { colors, radius, space } from '../styles/tokens';

type Tab = 'all' | 'mixes' | 'djs';

const popularQueries = ['house', 'techno', 'deep house', 'trance'];

export function SearchPage() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [tab, setTab] = useState<Tab>('all');
  const [mixes, setMixes] = useState<FeedMix[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFiltersValue>({ type: 'all' });

  async function runSearch(searchQuery: string, nextFilters = filters) {
    const trimmed = searchQuery.trim();
    setQuery(trimmed);
    setShowFilters(false);
    if (!trimmed) {
      setMixes([]);
      setProfiles([]);
      return;
    }

    setLoading(true);
    try {
      const results = await enhancedSearch(trimmed, nextFilters);
      setMixes(results.mixes);
      setProfiles(results.profiles);
      trackSearch(trimmed, nextFilters, results.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initial = searchParams.get('q') || '';
    if (initial) void runSearch(initial);
    // Intentionally run only when the URL query changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const activeFilterCount = [
    filters.genre,
    filters.duration,
    filters.explicit !== undefined ? 'explicit' : undefined,
  ].filter(Boolean).length;

  const profileCard = (profile: Profile) => (
    <Link
      key={profile.id}
      to={`/u/${profile.username}`}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <article
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: space[8],
          padding: space[8],
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.lg,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: profile.avatar_url
              ? `url(${profile.avatar_url}) center/cover`
              : colors.surfaceHover,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.accent,
            fontWeight: 700,
          }}
        >
          {!profile.avatar_url &&
            (profile.display_name || profile.username).slice(0, 1).toUpperCase()}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              color: colors.text.primary,
              fontWeight: 700,
              fontSize: 15,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {profile.display_name || profile.username}
          </div>
          <div style={{ color: colors.text.dim, fontSize: 13 }}>@{profile.username}</div>
          {profile.bio && (
            <p
              style={{
                color: colors.text.muted,
                fontSize: 12,
                margin: '4px 0 0',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {profile.bio}
            </p>
          )}
        </div>
      </article>
    </Link>
  );

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px 96px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: colors.text.primary, margin: '0 0 16px' }}>
        {query ? (
          <>
            Results for <span style={{ color: colors.accent }}>"{query}"</span>
          </>
        ) : (
          'Search MixHive'
        )}
      </h1>

      <div style={{ marginBottom: space[9] }}>
        <SearchAutocomplete onSearch={runSearch} />
      </div>

      {!query && (
        <section style={{ textAlign: 'center', padding: '32px 16px', color: colors.text.muted }}>
          <p style={{ margin: '0 0 18px', fontSize: 14 }}>Find mixes, DJs, and genres.</p>
          <div
            style={{ display: 'flex', justifyContent: 'center', gap: space[6], flexWrap: 'wrap' }}
          >
            {popularQueries.map(value => (
              <button
                key={value}
                type="button"
                onClick={() => runSearch(value)}
                style={{
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.pill,
                  color: colors.text.secondary,
                  cursor: 'pointer',
                  padding: '8px 14px',
                  font: 'inherit',
                  fontSize: 13,
                }}
              >
                {value}
              </button>
            ))}
          </div>
        </section>
      )}

      {query && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: space[6],
              marginBottom: space[9],
              flexWrap: 'wrap',
            }}
          >
            <SearchHistory onSelect={runSearch} />
            <button
              type="button"
              onClick={() => setShowFilters(prev => !prev)}
              style={{
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: radius.md,
                color: colors.text.secondary,
                cursor: 'pointer',
                padding: '7px 12px',
                font: 'inherit',
                fontSize: 12,
              }}
            >
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </button>
          </div>

          {showFilters && (
            <SearchFilters
              filters={filters}
              onFiltersChange={setFilters}
              onApply={() => runSearch(query, filters)}
              onReset={() => {
                const reset: SearchFiltersValue = { type: 'all' };
                setFilters(reset);
                void runSearch(query, reset);
              }}
              isLoading={loading}
            />
          )}

          <div
            style={{
              display: 'flex',
              gap: 4,
              marginBottom: space[10],
              background: colors.surface,
              borderRadius: radius.lg,
              padding: 4,
            }}
          >
            {(['all', 'mixes', 'djs'] as const).map(value => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: radius.md,
                  border: 'none',
                  background: tab === value ? colors.accent : 'transparent',
                  color: tab === value ? colors.bg : colors.text.muted,
                  cursor: 'pointer',
                  fontWeight: tab === value ? 700 : 500,
                  textTransform: 'capitalize',
                }}
              >
                {value === 'djs' ? 'DJs' : value}
              </button>
            ))}
          </div>

          {loading ? (
            <SkeletonFeed />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: space[8] }}>
              {(tab === 'all' || tab === 'mixes') &&
                mixes.map(mix => <MixCard key={mix.id} mix={mix} />)}
              {(tab === 'all' || tab === 'djs') && profiles.map(profileCard)}
              {((tab === 'mixes' && mixes.length === 0) ||
                (tab === 'djs' && profiles.length === 0) ||
                (tab === 'all' && mixes.length + profiles.length === 0)) && (
                <div style={{ textAlign: 'center', color: colors.text.dim, padding: '36px 16px' }}>
                  No results found
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
