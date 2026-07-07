import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { MixCard } from '../components/MixCard';
import { SearchAutocomplete } from '../components/SearchAutocomplete';
import { SearchFilters } from '../components/SearchFilters';
import { SearchHistory } from '../components/SearchHistory';
import { SkeletonFeed } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { ErrorComponent } from '../components/ErrorComponent';
import { Button } from '../components/ui/Button';
import {
  emptySearchResponse,
  enhancedSearch,
  trackSearch,
  type SceneSearchResult,
  type SearchEntityType,
  type SearchFilters as SearchFiltersValue,
  type SearchResponse,
} from '../lib/search';
import { listAIAgents, type AIAgent } from '../lib/api';
import type { Profile } from '../lib/types';
import { colors, fontSize, fontWeight, radius, space } from '../styles/tokens';

const popularQueries = ['house', 'techno', 'Brussels', 'Amsterdam'];
const tabs: Array<{ value: SearchEntityType; labelKey: string }> = [
  { value: 'all', labelKey: 'all' },
  { value: 'mixes', labelKey: 'mixes' },
  { value: 'profiles', labelKey: 'artists' },
  { value: 'scenes', labelKey: 'scenes' },
];

export function SearchPage() {
  const t = useTranslations('search');
  const tc = useTranslations('common');
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [tab, setTab] = useState<SearchEntityType>('all');
  const [results, setResults] = useState<SearchResponse>(emptySearchResponse);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFiltersValue>({ type: 'all' });
  const [allAgents, setAllAgents] = useState<AIAgent[]>([]);

  useEffect(() => {
    listAIAgents(50).then(setAllAgents).catch((err: unknown) => console.error('Failed to load agents:', err));
  }, []);

  const filteredAgents = query.trim().length >= 2
    ? allAgents.filter(a => {
        const q = query.toLowerCase();
        return a.name.toLowerCase().includes(q) ||
          a.slug.toLowerCase().includes(q) ||
          (a.bio ?? '').toLowerCase().includes(q);
      }).slice(0, 4)
    : [];

  async function performSearch(searchQuery: string, nextFilters: SearchFiltersValue, offset = 0) {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setResults(emptySearchResponse());
      setError(trimmed ? 'Enter at least 2 characters.' : '');
      return;
    }
    if (offset) setLoadingMore(true);
    else setLoading(true);
    setError('');
    try {
      const next = await enhancedSearch(trimmed, nextFilters, offset);
      setResults(current => {
        if (!offset || nextFilters.type === 'all') return next;
        return {
          ...next,
          sections: {
            ...next.sections,
            [nextFilters.type]: {
              ...next.sections[nextFilters.type],
              items: [
                ...current.sections[nextFilters.type].items,
                ...next.sections[nextFilters.type].items,
              ],
            },
          },
        } as SearchResponse;
      });
      if (!offset) trackSearch(trimmed, nextFilters, totalResults(next));
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Search failed.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  function updateUrl(searchQuery: string, nextFilters: SearchFiltersValue) {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (nextFilters.type !== 'all') params.set('type', nextFilters.type);
    if (nextFilters.genre) params.set('genre', nextFilters.genre);
    if (nextFilters.location) params.set('location', nextFilters.location);
    setSearchParams(params);
  }

  function runSearch(searchQuery: string, nextFilters = filters) {
    const trimmed = searchQuery.trim();
    setQuery(trimmed);
    setFilters(nextFilters);
    setTab(nextFilters.type);
    setShowFilters(false);
    updateUrl(trimmed, nextFilters);
  }

  useEffect(() => {
    const nextQuery = searchParams.get('q') || '';
    const requestedType = searchParams.get('type');
    const nextType: SearchEntityType = ['mixes', 'profiles', 'scenes'].includes(requestedType || '')
      ? (requestedType as SearchEntityType)
      : 'all';
    const nextFilters: SearchFiltersValue = {
      type: nextType,
      ...(searchParams.get('genre') ? { genre: searchParams.get('genre')! } : {}),
      ...(searchParams.get('location') ? { location: searchParams.get('location')! } : {}),
    };
    setQuery(nextQuery);
    setTab(nextType);
    setFilters(nextFilters);
    if (nextQuery) void performSearch(nextQuery, nextFilters);
    else setResults(emptySearchResponse());
  }, [searchParams]);

  const activeFilterCount = [filters.genre, filters.location].filter(Boolean).length;
  const activeSection = tab === 'all' ? null : results.sections[tab];

  function switchTab(nextTab: SearchEntityType) {
    runSearch(query, { ...filters, type: nextTab });
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 96px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: colors.text.primary, margin: '0 0 16px' }}>
        {query
          ? t.rich('resultsFor', {
              query,
              q: chunks => <span style={{ color: colors.accent }}>"{chunks}"</span>,
            })
          : t('title')}
      </h1>

      <div style={{ marginBottom: space[9] }}>
        <SearchAutocomplete onSearch={value => runSearch(value, { ...filters, type: 'all' })} />
      </div>

      {!query && (
        <section style={{ textAlign: 'center', padding: '32px 16px', color: colors.text.muted }}>
          <p style={{ margin: '0 0 18px', fontSize: 14 }}>{t('subtitle')}</p>
          <div
            style={{ display: 'flex', justifyContent: 'center', gap: space[6], flexWrap: 'wrap' }}
          >
            {popularQueries.map(value => (
              <Button
                key={value}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => runSearch(value, { type: 'all' })}
              >
                {value}
              </Button>
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
            <SearchHistory onSelect={value => runSearch(value, filters)} />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowFilters(value => !value)}
            >
              Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
            </Button>
          </div>

          {showFilters && (
            <SearchFilters
              filters={filters}
              onFiltersChange={setFilters}
              onApply={() => runSearch(query, filters)}
              onReset={() => runSearch(query, { type: 'all' })}
              isLoading={loading}
            />
          )}

          <div
            role="tablist"
            aria-label={t('resultTypes')}
            style={{
              display: 'flex',
              gap: 4,
              marginBottom: space[10],
              background: colors.surface,
              borderRadius: radius.lg,
              padding: 4,
            }}
          >
            {tabs.map(({ value, labelKey }) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => switchTab(value)}
                style={{
                  flex: 1,
                  minHeight: 42,
                  padding: '8px 6px',
                  borderRadius: radius.md,
                  border: 'none',
                  background: tab === value ? colors.accent : 'transparent',
                  color: tab === value ? colors.bg : colors.text.muted,
                  cursor: 'pointer',
                  fontWeight: tab === value ? 700 : 500,
                }}
              >
                {t(labelKey)}
                {results.sections[value === 'all' ? 'mixes' : value]?.total && value !== 'all'
                  ? ` (${results.sections[value].total})`
                  : ''}
              </button>
            ))}
          </div>

          {loading ? (
            <SkeletonFeed />
          ) : error ? (
            <ErrorComponent
              message="Search unavailable"
              error={error}
              onRetry={() => void performSearch(query, filters)}
            />
          ) : tab === 'all' ? (
            <GroupedResults results={results} onSeeAll={switchTab} agents={filteredAgents} />
          ) : (
            <>
              <EntityResults type={tab} results={results} />
              {activeSection?.hasMore && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: space[10] }}>
                  <Button
                    type="button"
                    variant="secondary"
                    loading={loadingMore}
                    onClick={() => void performSearch(query, filters, activeSection.items.length)}
                  >
                    {tc('loadMore')}
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function totalResults(results: SearchResponse) {
  return (
    results.sections.mixes.total + results.sections.profiles.total + results.sections.scenes.total
  );
}

function GroupedResults({
  results,
  onSeeAll,
  agents = [],
}: {
  results: SearchResponse;
  onSeeAll: (type: SearchEntityType) => void;
  agents?: AIAgent[];
}) {
  const t = useTranslations('search');
  const hasMainResults = totalResults(results);
  if (!hasMainResults && !agents.length)
    return <EmptyState iconKey="search" title={t('noResults')} body={t('noResultsBody')} />;
  return (
    <div style={{ display: 'grid', gap: space[12] }}>
      {agents.length > 0 && (
        <section>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: space[6],
            }}
          >
            <h2 style={{ margin: 0, color: colors.text.primary, fontSize: fontSize.lg }}>
              {t('aiBand')}{' '}
              <span style={{ color: colors.text.dim, fontSize: fontSize.sm }}>({agents.length})</span>
            </h2>
            <Link
              to="/ai-band"
              style={{
                fontSize: fontSize.sm,
                color: colors.accentMuted,
                textDecoration: 'none',
                fontWeight: fontWeight.semibold,
              }}
            >
              See all →
            </Link>
          </div>
          <div style={{ display: 'grid', gap: space[4] }}>
            {agents.map(agent => (
              <AgentRow key={agent.id} agent={agent} />
            ))}
          </div>
        </section>
      )}
      <ResultGroup
        title={t('scenes')}
        total={results.sections.scenes.total}
        onSeeAll={() => onSeeAll('scenes')}
      >
        {results.sections.scenes.items.map(scene => (
          <SceneCard key={scene.id} scene={scene} />
        ))}
      </ResultGroup>
      <ResultGroup
        title={t('artists')}
        total={results.sections.profiles.total}
        onSeeAll={() => onSeeAll('profiles')}
      >
        {results.sections.profiles.items.map(profile => (
          <ProfileCard key={profile.id} profile={profile} />
        ))}
      </ResultGroup>
      <ResultGroup
        title={t('mixes')}
        total={results.sections.mixes.total}
        onSeeAll={() => onSeeAll('mixes')}
      >
        {results.sections.mixes.items.map(mix => (
          <MixCard key={mix.id} mix={mix} />
        ))}
      </ResultGroup>
    </div>
  );
}

function ResultGroup({
  title,
  total,
  onSeeAll,
  children,
}: {
  title: string;
  total: number;
  onSeeAll: () => void;
  children: React.ReactNode;
}) {
  const tc = useTranslations('common');
  if (!total) return null;
  return (
    <section>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: space[6],
        }}
      >
        <h2 style={{ margin: 0, color: colors.text.primary, fontSize: fontSize.lg }}>
          {title} <span style={{ color: colors.text.dim, fontSize: fontSize.sm }}>({total})</span>
        </h2>
        <Button type="button" variant="ghost" size="sm" onClick={onSeeAll}>
          {tc('seeAll')}
        </Button>
      </div>
      <div style={{ display: 'grid', gap: space[6] }}>{children}</div>
    </section>
  );
}

function EntityResults({
  type,
  results,
}: {
  type: Exclude<SearchEntityType, 'all'>;
  results: SearchResponse;
}) {
  const section = results.sections[type];
  if (!section.items.length)
    return (
      <EmptyState
        iconKey="search"
        title={`No ${type === 'profiles' ? 'artists' : type} found`}
        body="Try another spelling, genre, or location."
      />
    );
  if (type === 'mixes')
    return (
      <div style={{ display: 'grid', gap: space[6] }}>
        {results.sections.mixes.items.map(mix => (
          <MixCard key={mix.id} mix={mix} />
        ))}
      </div>
    );
  if (type === 'profiles')
    return (
      <div style={{ display: 'grid', gap: space[6] }}>
        {results.sections.profiles.items.map(profile => (
          <ProfileCard key={profile.id} profile={profile} />
        ))}
      </div>
    );
  return (
    <div style={{ display: 'grid', gap: space[6] }}>
      {results.sections.scenes.items.map(scene => (
        <SceneCard key={scene.id} scene={scene} />
      ))}
    </div>
  );
}

function ProfileCard({ profile }: { profile: Profile }) {
  return (
    <Link to={`/u/${profile.username}`} style={{ textDecoration: 'none', color: 'inherit' }}>
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
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: profile.avatar_url
              ? `url(${profile.avatar_url}) center/cover`
              : colors.surfaceHover,
            flexShrink: 0,
            display: 'grid',
            placeItems: 'center',
            color: colors.accent,
            fontWeight: 700,
          }}
        >
          {!profile.avatar_url &&
            (profile.display_name || profile.username).slice(0, 1).toUpperCase()}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: colors.text.primary, fontWeight: fontWeight.bold }}>
            {profile.display_name || profile.username}
            {profile.verified ? ' ✓' : ''}
          </div>
          <div style={{ color: colors.text.dim, fontSize: fontSize.sm }}>
            @{profile.username}
            {profile.location ? ` · ${profile.location}` : ''}
          </div>
          {profile.bio && (
            <p
              style={{
                color: colors.text.muted,
                fontSize: fontSize.sm,
                margin: `${space[2]}px 0 0`,
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
}

function AgentRow({ agent }: { agent: AIAgent }) {
  return (
    <Link to={`/ai-band/${agent.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <article
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: space[8],
          padding: space[6],
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
            flexShrink: 0,
            background: agent.avatar_url ? undefined : `${colors.accentMuted}44`,
            border: `2px solid ${colors.accentMuted}`,
            overflow: 'hidden',
            display: 'grid',
            placeItems: 'center',
            fontSize: 20,
            color: colors.accentMuted,
          }}
        >
          {agent.avatar_url ? (
            <img
              src={agent.avatar_url}
              alt={agent.name}
              width={48}
              height={48}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <span aria-hidden="true">🤖</span>
          )}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ color: colors.text.primary, fontWeight: fontWeight.bold }}>
            {agent.name}
          </div>
          <div style={{ color: colors.text.dim, fontSize: fontSize.sm }}>
            @{agent.slug}
            {agent.followers_count > 0 ? ` · ${agent.followers_count} followers` : ''}
            {agent.mixes_credited > 0 ? ` · ${agent.mixes_credited} mixes` : ''}
          </div>
          {agent.bio && (
            <p
              style={{
                color: colors.text.muted,
                fontSize: fontSize.sm,
                margin: `${space[2]}px 0 0`,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {agent.bio}
            </p>
          )}
        </div>
      </article>
    </Link>
  );
}

function SceneCard({ scene }: { scene: SceneSearchResult }) {
  return (
    <Link to={`/scene/${scene.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <article
        style={{
          padding: space[8],
          minHeight: 96,
          background: scene.hero_image_url
            ? `linear-gradient(90deg, ${colors.surface} 15%, transparent), url(${scene.hero_image_url}) center/cover`
            : colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.lg,
        }}
      >
        <div
          style={{ color: colors.text.primary, fontWeight: fontWeight.bold, fontSize: fontSize.lg }}
        >
          {scene.name}
        </div>
        <div style={{ color: colors.text.dim, fontSize: fontSize.sm, marginTop: space[2] }}>
          {[scene.city, scene.country, scene.genre].filter(Boolean).join(' · ')}
        </div>
        {scene.description && (
          <p
            style={{ color: colors.text.muted, fontSize: fontSize.sm, margin: `${space[3]}px 0 0` }}
          >
            {scene.description}
          </p>
        )}
      </article>
    </Link>
  );
}
