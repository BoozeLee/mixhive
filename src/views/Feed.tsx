import { useEffect, useState, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { getTrending, getMixedFollowingFeed, getLatestMixed } from '../lib/api';
import { useRealtime } from '../hooks/useRealtime';
import { MixCard } from '../components/MixCard';
import { BuzzCard } from '../components/BuzzCard';
import { BuzzComposer } from '../components/BuzzComposer';
import { RecommendedDJs } from '../components/RecommendedDJs';
import { SkeletonFeed } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { Icon } from '../components/ui/Icon';
import {
  colors,
  display,
  fontSize,
  fontWeight,
  getGenreColor,
  radius,
  shadow,
  space,
  transition,
  withAlpha,
} from '../styles/tokens';
import type {
  FeedMix,
  FeedCursor,
  TrendingCursor,
  FeedItem,
  MixedFeedResult,
  Buzz,
} from '../lib/types';

type Tab = 'feed' | 'trending' | 'latest';
type DateRange = 'all' | '24h' | 'week' | 'month' | 'year';

interface MixTabState {
  data: FeedMix[];
  cursor: TrendingCursor | null;
  hasMore: boolean;
  loading: boolean;
}

interface MixedTabState {
  data: FeedItem[];
  mixCursor: FeedCursor | null;
  buzzCursor: FeedCursor | null;
  hasMore: boolean;
  loading: boolean;
}

const emptyMixTab = (): MixTabState => ({ data: [], cursor: null, hasMore: true, loading: true });
const emptyMixedTab = (): MixedTabState => ({
  data: [],
  mixCursor: null,
  buzzCursor: null,
  hasMore: true,
  loading: true,
});

const POPULAR_GENRES = [
  'techno',
  'house',
  'drum and bass',
  'ambient',
  'trance',
  'garage',
  'jungle',
  'breaks',
  'electro',
  'trap',
];

function RightRailPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="hive-panel"
      style={{
        padding: `${space[8]}px`,
        overflow: 'hidden',
      }}
    >
      <h3
        style={{
          margin: `0 0 ${space[6]}px`,
          fontSize: fontSize.sm,
          fontWeight: fontWeight.semibold,
          color: colors.text.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function GenreRadar() {
  const navigate = useNavigate();
  const t = useTranslations('feed');
  return (
    <RightRailPanel title={t('genreRadar')}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {POPULAR_GENRES.map(genre => {
          const c = getGenreColor(genre);
          return (
            <button
              key={genre}
              onClick={() => navigate(`/search?genre=${encodeURIComponent(genre)}`)}
              style={{
                padding: '4px 10px',
                borderRadius: radius.pill,
                border: `1px solid ${withAlpha(c, 0.33)}`,
                background: withAlpha(c, 0.09),
                color: c,
                fontSize: fontSize.xs,
                fontWeight: fontWeight.semibold,
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: transition.smooth,
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = withAlpha(c, 0.19);
                e.currentTarget.style.borderColor = withAlpha(c, 0.53);
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = withAlpha(c, 0.09);
                e.currentTarget.style.borderColor = withAlpha(c, 0.33);
              }}
            >
              {genre}
            </button>
          );
        })}
      </div>
    </RightRailPanel>
  );
}

function TrendingNowPanel({ mixes }: { mixes: FeedMix[] }) {
  const t = useTranslations('feed');
  if (mixes.length === 0) return null;
  return (
    <RightRailPanel title={t('trendingNow')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {mixes.slice(0, 5).map((mix, i) => (
          <Link
            key={mix.id}
            to={`/mix/${mix.id}`}
            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: space[5] }}
          >
            <span
              style={{
                width: 18,
                fontSize: 11,
                fontWeight: fontWeight.bold,
                color: i === 0 ? colors.accent : colors.text.dim,
                flexShrink: 0,
                textAlign: 'right',
              }}
            >
              {i + 1}
            </span>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 6,
                flexShrink: 0,
                background: mix.artwork_url
                  ? `url(${mix.artwork_url}) center/cover`
                  : `linear-gradient(135deg, ${getGenreColor(mix.genre_name)}33, ${colors.surface})`,
                backgroundSize: 'cover',
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                  color: colors.text.primary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {mix.title}
              </div>
              <div style={{ fontSize: fontSize.xs, color: colors.text.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {mix.dj_display_name || mix.dj_username}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </RightRailPanel>
  );
}

interface TabConfig {
  id: Tab;
  label: string;
  icon: 'feed' | 'discover' | 'zap';
}

export function Feed() {
  const t = useTranslations('feed');
  const { user, profile } = useAuth();
  const [tab, setTab] = useState<Tab>(user ? 'feed' : 'trending');
  const [mixedFeed, setMixedFeed] = useState<MixedTabState>(emptyMixedTab());
  const [latestMixed, setLatestMixed] = useState<MixedTabState>(emptyMixedTab());
  const [trendingTab, setTrendingTab] = useState<MixTabState>(emptyMixTab());
  const loadingMoreRef = useRef(false);
  const [newCount, setNewCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [aiBandOnly, setAiBandOnly] = useState(false);

  const { mixUpdates } = useRealtime(user?.id ?? null, {
    enableMixUpdates: true,
    enableNotifications: true,
  });

  const tabs: TabConfig[] = user
    ? [
        { id: 'feed', label: t('tabFollowing'), icon: 'feed' },
        { id: 'trending', label: t('tabTrending'), icon: 'zap' },
        { id: 'latest', label: t('tabLatest'), icon: 'discover' },
      ]
    : [
        { id: 'trending', label: t('tabTrending'), icon: 'zap' },
        { id: 'latest', label: t('tabLatest'), icon: 'discover' },
        { id: 'feed', label: t('tabFollowing'), icon: 'feed' },
      ];

  const fetchFollowingFeed = useCallback(
    async (mixCursor?: FeedCursor, buzzCursor?: FeedCursor): Promise<MixedFeedResult> => {
      if (!user) return { data: [], mixCursor: null, buzzCursor: null };
      return getMixedFollowingFeed(user.id, 20, mixCursor, buzzCursor);
    },
    [user]
  );

  useEffect(() => {
    if (!user || !mixUpdates.length) return;
    setNewCount(prev => prev + mixUpdates.length);
  }, [mixUpdates, user]);

  useEffect(() => {
    setError(null);
    if (tab === 'feed') {
      if (mixedFeed.data.length > 0 || !mixedFeed.hasMore || mixedFeed.loading) return;
      if (!user) return;
      setMixedFeed(prev => ({ ...prev, loading: true }));
      fetchFollowingFeed()
        .then(res => {
          setMixedFeed({
            data: res.data,
            mixCursor: res.mixCursor,
            buzzCursor: res.buzzCursor,
            hasMore: !!(res.mixCursor || res.buzzCursor),
            loading: false,
          });
        })
        .catch(() => {
          setMixedFeed(prev => ({ ...prev, loading: false }));
          setError('Failed to load feed');
        });
      return;
    }
    if (tab === 'latest') {
      if (latestMixed.data.length > 0 || !latestMixed.hasMore || latestMixed.loading) return;
      setLatestMixed(prev => ({ ...prev, loading: true }));
      getLatestMixed(20)
        .then(res => {
          setLatestMixed({
            data: res.data,
            mixCursor: res.mixCursor,
            buzzCursor: res.buzzCursor,
            hasMore: !!(res.mixCursor || res.buzzCursor),
            loading: false,
          });
        })
        .catch(() => {
          setLatestMixed(prev => ({ ...prev, loading: false }));
          setError('Failed to load latest mixes');
        });
      return;
    }
    if (trendingTab.data.length > 0 || !trendingTab.hasMore || trendingTab.loading) return;
    setTrendingTab(prev => ({ ...prev, loading: true }));
    getTrending(20)
      .then(res => {
        setTrendingTab({
          data: res.data,
          cursor: res.cursor as TrendingCursor | null,
          hasMore: !!res.cursor,
          loading: false,
        });
      })
      .catch(() => {
        setTrendingTab(prev => ({ ...prev, loading: false }));
        setError('Failed to load trending');
      });
  }, [tab, user, fetchFollowingFeed, latestMixed, trendingTab, mixedFeed]);

  useEffect(() => {
    if (!isSupabaseConfigured || !user) return;
    const channel = supabase
      .channel(`feed:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'feed_events',
          filter: `target_id=eq.${user.id}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          if (payload.new?.actor_id !== user.id) setNewCount(c => c + 1);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Keep default tab in sync if auth state changes
  useEffect(() => {
    setTab(prev => {
      if (user && prev === 'trending') return 'feed';
      if (!user && prev === 'feed') return 'trending';
      return prev;
    });
  }, [user]);

  const handleShowNew = async () => {
    if (!user) return;
    setNewCount(0);
    setTab('feed');
    const res = await fetchFollowingFeed();
    setMixedFeed({
      data: res.data,
      mixCursor: res.mixCursor,
      buzzCursor: res.buzzCursor,
      hasMore: !!(res.mixCursor || res.buzzCursor),
      loading: false,
    });
  };

  const handleLoadMore = async () => {
    if (loadingMoreRef.current) return;
    loadingMoreRef.current = true;

    if (tab === 'feed') {
      if (!mixedFeed.mixCursor && !mixedFeed.buzzCursor) {
        loadingMoreRef.current = false;
        return;
      }
      setMixedFeed(prev => ({ ...prev, loading: true }));
      try {
        const res = await fetchFollowingFeed(
          mixedFeed.mixCursor ?? undefined,
          mixedFeed.buzzCursor ?? undefined
        );
        setMixedFeed(prev => ({
          data: [...prev.data, ...res.data],
          mixCursor: res.mixCursor,
          buzzCursor: res.buzzCursor,
          hasMore: !!(res.mixCursor || res.buzzCursor),
          loading: false,
        }));
      } catch {
        setMixedFeed(prev => ({ ...prev, loading: false }));
      } finally {
        loadingMoreRef.current = false;
      }
      return;
    }

    if (tab === 'latest') {
      if (!latestMixed.mixCursor && !latestMixed.buzzCursor) {
        loadingMoreRef.current = false;
        return;
      }
      setLatestMixed(prev => ({ ...prev, loading: true }));
      try {
        const res = await getLatestMixed(
          20,
          latestMixed.mixCursor ?? undefined,
          latestMixed.buzzCursor ?? undefined
        );
        setLatestMixed(prev => ({
          data: [...prev.data, ...res.data],
          mixCursor: res.mixCursor,
          buzzCursor: res.buzzCursor,
          hasMore: !!(res.mixCursor || res.buzzCursor),
          loading: false,
        }));
      } catch {
        setLatestMixed(prev => ({ ...prev, loading: false }));
      } finally {
        loadingMoreRef.current = false;
      }
      return;
    }

    if (!trendingTab.cursor) {
      loadingMoreRef.current = false;
      return;
    }
    setTrendingTab(prev => ({ ...prev, loading: true }));
    try {
      const res = await getTrending(20, trendingTab.cursor ?? undefined);
      setTrendingTab(prev => ({
        data: [...prev.data, ...res.data],
        cursor: res.cursor as TrendingCursor | null,
        hasMore: !!res.cursor,
        loading: false,
      }));
    } catch {
      setTrendingTab(prev => ({ ...prev, loading: false }));
    } finally {
      loadingMoreRef.current = false;
    }
  };

  const handleRetry = async (t: Tab) => {
    setError(null);
    if (t === 'feed') {
      setMixedFeed(prev => ({ ...prev, loading: true }));
      try {
        const res = await fetchFollowingFeed();
        setMixedFeed({
          data: res.data,
          mixCursor: res.mixCursor,
          buzzCursor: res.buzzCursor,
          hasMore: !!(res.mixCursor || res.buzzCursor),
          loading: false,
        });
      } catch {
        setMixedFeed(prev => ({ ...prev, loading: false }));
        setError('Failed to load feed');
      }
      return;
    }
    if (t === 'latest') {
      setLatestMixed(prev => ({ ...prev, loading: true }));
      try {
        const res = await getLatestMixed(20);
        setLatestMixed({
          data: res.data,
          mixCursor: res.mixCursor,
          buzzCursor: res.buzzCursor,
          hasMore: !!(res.mixCursor || res.buzzCursor),
          loading: false,
        });
      } catch {
        setLatestMixed(prev => ({ ...prev, loading: false }));
        setError('Failed to load latest mixes');
      }
      return;
    }
    setTrendingTab(prev => ({ ...prev, loading: true }));
    try {
      const res = await getTrending(20);
      setTrendingTab({
        data: res.data,
        cursor: res.cursor as TrendingCursor | null,
        hasMore: !!res.cursor,
        loading: false,
      });
    } catch {
      setTrendingTab(prev => ({ ...prev, loading: false }));
      setError('Failed to load trending');
    }
  };

  function handleBuzzCreated(buzz: Buzz) {
    const feedBuzz = { ...buzz, author: profile ?? undefined };
    setMixedFeed(prev => ({
      ...prev,
      data: [{ type: 'buzz' as const, data: feedBuzz }, ...prev.data],
    }));
    setLatestMixed(prev => ({
      ...prev,
      data: [{ type: 'buzz' as const, data: feedBuzz }, ...prev.data],
    }));
    if (tab !== 'feed' && tab !== 'latest') setNewCount(c => c + 1);
  }

  function isWithinDateRange(dateStr: string, range: DateRange): boolean {
    if (range === 'all') return true;
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = now - then;
    switch (range) {
      case '24h': return diff < 86400000;
      case 'week': return diff < 604800000;
      case 'month': return diff < 2592000000;
      case 'year': return diff < 31536000000;
      default: return true;
    }
  }

  const filterItem = (item: FeedItem): boolean => {
    const mix = item.type === 'mix' ? item.data : null;
    if (!mix) return true;
    if (selectedGenre && mix.genre_name?.toLowerCase() !== selectedGenre.toLowerCase()) return false;
    if (dateRange !== 'all' && !isWithinDateRange(mix.created_at, dateRange)) return false;
    if (aiBandOnly && !mix.ai_band) return false;
    return true;
  };

  const currentData: FeedItem[] =
    tab === 'feed'
      ? mixedFeed.data.filter(filterItem)
      : tab === 'latest'
        ? latestMixed.data.filter(filterItem)
        : trendingTab.data.map(m => ({ type: 'mix' as const, data: m })).filter(filterItem);
  const currentLoading =
    tab === 'feed'
      ? mixedFeed.loading
      : tab === 'latest'
        ? latestMixed.loading
        : trendingTab.loading;
  const currentHasMore =
    tab === 'feed'
      ? mixedFeed.hasMore
      : tab === 'latest'
        ? latestMixed.hasMore
        : trendingTab.hasMore;

  function emptyStateForTab(tabId: Tab): {
    iconKey: 'feed' | 'discover' | 'zap';
    title: string;
    body: string;
    actionLabel: string;
    actionTo?: string;
    onAction?: () => void;
  } {
    switch (tabId) {
      case 'feed':
        return {
          iconKey: 'feed',
          title: t('emptyFollowingTitle'),
          body: t('emptyFollowingBody'),
          actionLabel: t('emptyFollowingAction'),
          actionTo: '/discover',
        };
      case 'latest':
        return {
          iconKey: 'discover',
          title: t('emptyLatestTitle'),
          body: t('emptyLatestBody'),
          actionLabel: t('emptyLatestAction'),
          actionTo: '/upload',
        };
      case 'trending':
      default:
        return {
          iconKey: 'zap',
          title: t('emptyTrendingTitle'),
          body: t('emptyTrendingBody'),
          actionLabel: t('emptyTrendingAction'),
          onAction: () => handleRetry('trending'),
        };
    }
  }

  const emptyState = emptyStateForTab(tab);

  return (
    <>
      {/* Hero strip — desktop only */}
      <div
        className="feed-hero hive-panel"
        style={{
          margin: '0',
          padding: 'clamp(16px, 2.5vw, 28px) clamp(20px, 4vw, 48px)',
          borderRadius: 0,
          borderLeft: 'none',
          borderRight: 'none',
          borderTop: 'none',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: '0 0 4px',
              fontSize: fontSize.xs,
              fontWeight: fontWeight.semibold,
              color: colors.accent,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            {t('liveFeed')}
          </p>
          <h1
            className="hive-title"
            style={{ margin: 0, fontSize: display.sm, lineHeight: 1.1 }}
          >
            {t('heroTitle')}
          </h1>
          <p
            style={{
              margin: '6px 0 0',
              fontSize: fontSize.md,
              color: colors.text.muted,
              lineHeight: 1.4,
            }}
          >
            {t('heroSubtitle')}
          </p>
        </div>
        {user && (
          <Link
            to="/upload"
            className="hive-button"
            style={{ fontSize: 13, padding: '0 22px', flexShrink: 0, textDecoration: 'none' }}
          >
            + {t('uploadMix')}
          </Link>
        )}
      </div>

      {/* Main 3-column layout */}
      <div className="feed-layout">
        {/* Left: feed column */}
        <div>
          <BuzzComposer onBuzzCreated={handleBuzzCreated} />

          {/* New items pill */}
          {user && newCount > 0 && tab !== 'feed' && (
            <button
              onClick={handleShowNew}
              style={{
                display: 'block',
                margin: `0 auto ${space[6]}px`,
                padding: `${space[3]}px ${space[9]}px`,
                background: colors.accent,
                color: colors.bg,
                border: 'none',
                borderRadius: radius.pill,
                fontWeight: fontWeight.bold,
                fontSize: fontSize.sm,
                cursor: 'pointer',
                boxShadow: shadow.accent,
              }}
            >
              ↑ {t('newItems', { count: newCount })}
            </button>
          )}

          {/* Tab bar */}
          <div
            role="tablist"
            aria-label={t('tabsAria')}
            style={{
              display: 'flex',
              gap: space[1],
              marginBottom: space[8],
              background: colors.surface,
              borderRadius: radius.lg,
              padding: space[1],
              border: `1px solid ${colors.border}`,
              overflow: 'hidden',
            }}
          >
            {tabs.map(({ id, label, icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: space[3],
                  padding: `${space[4]}px ${space[5]}px`,
                  borderRadius: radius.md,
                  border: 'none',
                  background: tab === id ? colors.accent : 'transparent',
                  color: tab === id ? colors.bg : colors.text.muted,
                  fontWeight: tab === id ? fontWeight.bold : fontWeight.normal,
                  cursor: 'pointer',
                  fontSize: fontSize.sm,
                  transition: transition.smooth,
                  whiteSpace: 'nowrap',
                }}
              >
                <Icon name={icon} size={14} color="currentColor" />
                {label}
              </button>
            ))}
          </div>

          {/* Filter bar */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: space[3],
              marginBottom: space[8],
            }}
          >
            {/* Genre chips */}
            {POPULAR_GENRES.map(g => (
              <button
                key={g}
                onClick={() => setSelectedGenre(selectedGenre === g ? '' : g)}
                style={{
                  padding: '4px 12px',
                  borderRadius: radius.pill,
                  border: `1px solid ${selectedGenre === g ? colors.accent : colors.border}`,
                  background: selectedGenre === g ? colors.accent : 'transparent',
                  color: selectedGenre === g ? colors.bg : colors.text.muted,
                  fontSize: fontSize.xs,
                  fontWeight: selectedGenre === g ? fontWeight.bold : fontWeight.normal,
                  cursor: 'pointer',
                  transition: transition.fast,
                  whiteSpace: 'nowrap',
                }}
              >
                {g}
              </button>
            ))}
            {/* AI Band only toggle */}
            <button
              type="button"
              onClick={() => setAiBandOnly(v => !v)}
              aria-pressed={aiBandOnly}
              style={{
                padding: '4px 12px',
                borderRadius: radius.pill,
                border: `1px solid ${aiBandOnly ? colors.accent : colors.border}`,
                background: aiBandOnly ? colors.accent : 'transparent',
                color: aiBandOnly ? colors.bg : colors.text.muted,
                fontSize: fontSize.xs,
                fontWeight: aiBandOnly ? fontWeight.bold : fontWeight.normal,
                cursor: 'pointer',
                transition: transition.fast,
                whiteSpace: 'nowrap',
              }}
            >
              {t('aiBandOnly')}
            </button>
            {/* Date range select */}
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value as DateRange)}
              style={{
                marginLeft: 'auto',
                padding: '4px 10px',
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                background: colors.surface,
                color: colors.text.muted,
                fontSize: fontSize.xs,
                cursor: 'pointer',
              }}
            >
              <option value="all">{t('dateAll')}</option>
              <option value="24h">{t('date24h')}</option>
              <option value="week">{t('dateWeek')}</option>
              <option value="month">{t('dateMonth')}</option>
              <option value="year">{t('dateYear')}</option>
            </select>
          </div>

          {/* Error banner */}
          {error && (
            <div style={{ padding: `${space[6]}px ${space[8]}px`, marginBottom: space[8], background: withAlpha(colors.danger, 0.1), border: `1px solid ${withAlpha(colors.danger, 0.3)}`, borderRadius: radius.md, color: colors.danger, fontSize: fontSize.sm }}>
              {error}
              <Button variant="danger" size="sm" onClick={() => handleRetry(tab)}>Retry</Button>
            </div>
          )}

          {/* Unauthenticated following tab prompt */}
          {tab === 'feed' && !user && (
            <div
              style={{
                textAlign: 'center',
                padding: `${space[14]}px ${space[10]}px`,
                color: colors.text.dim,
                fontSize: fontSize.md,
              }}
            >
              {t.rich('followingPrompt', {
                link: chunks => (
                  <Link to="/login" style={{ color: colors.accent }}>
                    {chunks}
                  </Link>
                ),
              })}
            </div>
          )}

          {/* Feed content */}
          {currentLoading && currentData.length === 0 ? (
            <SkeletonFeed />
          ) : currentData.length === 0 && !currentLoading ? (
            <EmptyState
              iconKey={emptyState.iconKey}
              title={emptyState.title}
              body={emptyState.body}
              actionLabel={emptyState.actionLabel}
              actionTo={emptyState.actionTo}
              onAction={emptyState.onAction}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {currentData.map(item =>
                item.type === 'buzz' ? (
                  <BuzzCard key={item.data.id} buzz={item.data} />
                ) : (
                  <MixCard key={item.data.id} mix={item.data} />
                )
              )}
              {currentHasMore && (
                <button
                  onClick={handleLoadMore}
                  disabled={currentLoading}
                  style={{
                    marginTop: space[6],
                    padding: `${space[5]}px ${space[8]}px`,
                    background: currentLoading ? colors.surfaceMuted : colors.surface,
                    border: `1px solid ${colors.border}`,
                    color: currentLoading ? colors.text.faint : colors.text.muted,
                    borderRadius: radius.md,
                    cursor: currentLoading ? 'default' : 'pointer',
                    fontSize: fontSize.md,
                    fontWeight: fontWeight.medium,
                    transition: transition.fast,
                  }}
                >
                  {currentLoading ? t('loadingMore') : t('loadMore')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right rail — desktop only */}
        <aside
          className="feed-right-rail"
          aria-label={t('sidebarAria')}
          style={{ alignSelf: 'start' }}
        >
          {trendingTab.data.length > 0 && <TrendingNowPanel mixes={trendingTab.data} />}
          <GenreRadar />
          {user && <RecommendedDJs userId={user.id} />}
        </aside>
      </div>
    </>
  );
}
