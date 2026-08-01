import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import {
  getTrendingMixes,
  getRecentMixes,
  getTopDJs,
  getLatestBuzzes,
  getAIAgentLeaderboard,
  getPopularGenres,
  type AIAgent,
} from '../lib/api';
import { supabase } from '../lib/supabase';
import { MixCard } from '../components/MixCard';
import { BuzzCard } from '../components/BuzzCard';
import { AIAgentCard } from '../components/AIAgentCard';
import { DiscoverLane } from '../components/discover/DiscoverLane';
import { CompactMixCard } from '../components/discover/CompactMixCard';
import { CreatorCard } from '../components/discover/CreatorCard';
import { GenreCard } from '../components/discover/GenreCard';
import { SectionHeading } from '../components/ui/SectionHeading';
import { Reveal } from '../components/ui/Reveal';
import { useAuth } from '../hooks/useAuth';
import type { FeedMix, Profile, FeedBuzz } from '../lib/types';
import {
  colors,
  radius,
  space,
  fontSize,
  fontWeight,
  transition,
  withAlpha,
} from '../styles/tokens';

const NAV_ITEMS: { key: string; label: string }[] = [
  { key: 'trending', label: 'Trending' },
  { key: 'fresh', label: 'Fresh' },
  { key: 'creators', label: 'Creators' },
  { key: 'buzz', label: 'Buzz' },
  { key: 'aiBand', label: 'AI Band' },
  { key: 'genres', label: 'Genres' },
  { key: 'events', label: 'Events' },
];

interface DiscoverGenre {
  id: string;
  name: string;
  count: number;
}

interface DiscoverEvent {
  id: string;
  title: string;
  starts_at: string;
  venue_name: string | null;
  is_free: boolean;
  rsvp_counts: { going: number; maybe: number };
  cover_image_url: string | null;
}

export function Discover() {
  const t = useTranslations('discover');
  const { user } = useAuth();

  const [trending, setTrending] = useState<FeedMix[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [trendingError, setTrendingError] = useState(false);

  const [fresh, setFresh] = useState<FeedMix[]>([]);
  const [freshLoading, setFreshLoading] = useState(true);
  const [freshError, setFreshError] = useState(false);

  const [creators, setCreators] = useState<Profile[]>([]);
  const [creatorsLoading, setCreatorsLoading] = useState(true);
  const [creatorsError, setCreatorsError] = useState(false);

  const [buzzes, setBuzzes] = useState<FeedBuzz[]>([]);
  const [buzzLoading, setBuzzLoading] = useState(true);
  const [buzzError, setBuzzError] = useState(false);

  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [agentsError, setAgentsError] = useState(false);

  const [genres, setGenres] = useState<DiscoverGenre[]>([]);
  const [genresLoading, setGenresLoading] = useState(true);
  const [genresError, setGenresError] = useState(false);

  const [events, setEvents] = useState<DiscoverEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState(false);

  const scrollToSection = useCallback((key: string) => {
    const el = document.getElementById(`discover-${key}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    let cancelled = false;

    getTrendingMixes(6)
      .then(result => {
        if (!cancelled) setTrending(result.data);
      })
      .catch(() => {
        if (!cancelled) setTrendingError(true);
      })
      .finally(() => {
        if (!cancelled) setTrendingLoading(false);
      });

    getRecentMixes(12)
      .then(result => {
        if (!cancelled) setFresh(result.data);
      })
      .catch(() => {
        if (!cancelled) setFreshError(true);
      })
      .finally(() => {
        if (!cancelled) setFreshLoading(false);
      });

    getTopDJs(10)
      .then(result => {
        if (!cancelled) setCreators(result.data);
      })
      .catch(() => {
        if (!cancelled) setCreatorsError(true);
      })
      .finally(() => {
        if (!cancelled) setCreatorsLoading(false);
      });

    getLatestBuzzes(8)
      .then(result => {
        if (!cancelled) setBuzzes(result.data);
      })
      .catch(() => {
        if (!cancelled) setBuzzError(true);
      })
      .finally(() => {
        if (!cancelled) setBuzzLoading(false);
      });

    getAIAgentLeaderboard(6)
      .then(result => {
        if (!cancelled) setAgents(result);
      })
      .catch(() => {
        if (!cancelled) setAgentsError(true);
      })
      .finally(() => {
        if (!cancelled) setAgentsLoading(false);
      });

    getPopularGenres(12)
      .then(result => {
        if (!cancelled) setGenres(result.data);
      })
      .catch(() => {
        if (!cancelled) setGenresError(true);
      })
      .finally(() => {
        if (!cancelled) setGenresLoading(false);
      });

    // Fetch upcoming events
    (async () => {
      try {
        const { data } = await supabase
          .from('events')
          .select('id, title, starts_at, venue_name, is_free, cover_image_url')
          .eq('status', 'published')
          .gte('starts_at', new Date().toISOString())
          .order('starts_at', { ascending: true })
          .limit(8);
        if (!cancelled && data) {
          // Get RSVP counts
          const ids = data.map(e => e.id);
          const counts: Record<string, { going: number; maybe: number }> = {};
          if (ids.length > 0) {
            const { data: rsvps } = await supabase
              .from('event_rsvps')
              .select('event_id, status')
              .in('event_id', ids)
              .neq('status', 'cancelled');
            if (rsvps) {
              for (const r of rsvps) {
                if (!counts[r.event_id]) counts[r.event_id] = { going: 0, maybe: 0 };
                if (r.status === 'going') counts[r.event_id].going++;
                else if (r.status === 'maybe') counts[r.event_id].maybe++;
              }
            }
          }
          setEvents(data.map(e => ({ ...e, rsvp_counts: counts[e.id] || { going: 0, maybe: 0 } })));
        }
      } catch {
        if (!cancelled) setEventsError(true);
      } finally {
        if (!cancelled) setEventsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 16px 96px' }}>
      <header style={{ marginBottom: space[8] }}>
        <SectionHeading
          as="h1"
          eyebrow={t('eyebrow')}
          title={t('title')}
          subtitle={t('subtitle')}
        />
      </header>

      {/* Quick-nav pills */}
      <div
        style={{
          display: 'flex',
          gap: space[2],
          overflowX: 'auto',
          paddingBottom: space[4],
          marginBottom: space[6],
          scrollbarWidth: 'none',
          position: 'sticky',
          top: 72,
          zIndex: 20,
          background: withAlpha(colors.bg, 0.92),
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        {NAV_ITEMS.map(item => (
          <button
            key={item.key}
            onClick={() => scrollToSection(item.key)}
            style={{
              flexShrink: 0,
              padding: `${space[2]}px ${space[5]}px`,
              borderRadius: radius.pill,
              border: `1px solid ${colors.border}`,
              background: colors.surface,
              color: colors.text.muted,
              fontSize: fontSize.sm,
              fontWeight: fontWeight.medium,
              cursor: 'pointer',
              transition: transition.fast,
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = colors.accentMuted;
              e.currentTarget.style.color = colors.accent;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = colors.border;
              e.currentTarget.style.color = colors.text.muted;
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Hero: top trending mix */}
      {!trendingLoading && trending[0] && (
        <section id="discover-hero" style={{ marginBottom: space[12] }}>
          <Reveal index={0} from="up">
            <MixCard mix={trending[0]} />
          </Reveal>
        </section>
      )}

      {/* Trending mixes lane */}
      <div id="discover-trending">
        <Reveal index={1} from="up">
          <DiscoverLane
            title={t('trendingMixes')}
            subtitle={t('trendingSubtitle')}
            href="/search?tab=mixes"
            hrefLabel={t('seeAll')}
            loading={trendingLoading}
            error={trendingError}
            skeletonCount={5}
            skeletonWidth={160}
          >
            {trending.slice(1).map(mix => (
              <CompactMixCard key={mix.id} mix={mix} />
            ))}
          </DiscoverLane>
        </Reveal>
      </div>

      {/* Fresh drops lane */}
      <div id="discover-fresh">
        <Reveal index={2} from="up">
          <DiscoverLane
            title={t('freshDrops')}
            subtitle={t('freshDropsSubtitle')}
            href="/search?tab=mixes"
            hrefLabel={t('seeAll')}
            loading={freshLoading}
            error={freshError}
            skeletonCount={5}
            skeletonWidth={160}
          >
            {fresh.map(mix => (
              <CompactMixCard key={mix.id} mix={mix} />
            ))}
          </DiscoverLane>
        </Reveal>
      </div>

      {/* Top creators lane */}
      <div id="discover-creators">
        <Reveal index={3} from="up">
          <DiscoverLane
            title={t('topCreators')}
            subtitle={t('topCreatorsSubtitle')}
            href="/search?tab=artists"
            hrefLabel={t('seeAll')}
            loading={creatorsLoading}
            error={creatorsError}
            skeletonCount={5}
            skeletonWidth={160}
          >
            {creators.map(profile => (
              <CreatorCard key={profile.id} profile={profile} />
            ))}
          </DiscoverLane>
        </Reveal>
      </div>

      {/* Buzzing now lane */}
      <div id="discover-buzz">
        <Reveal index={4} from="up">
          <DiscoverLane
            title={t('buzzingNow')}
            subtitle={t('buzzingNowSubtitle')}
            href="/feed?tab=latest"
            hrefLabel={t('seeAll')}
            loading={buzzLoading}
            error={buzzError}
            skeletonCount={4}
            skeletonWidth={280}
          >
            {buzzes.map(buzz => (
              <div
                key={buzz.id}
                style={{
                  flexShrink: 0,
                  width: 280,
                  scrollSnapAlign: 'start',
                  background: colors.surface,
                  borderRadius: radius.lg,
                  border: `1px solid ${colors.border}`,
                  padding: space[5],
                }}
              >
                <BuzzCard buzz={buzz} compact />
              </div>
            ))}
          </DiscoverLane>
        </Reveal>
      </div>

      {/* AI Band lane */}
      <div id="discover-aiBand">
        <Reveal index={5} from="up">
          <DiscoverLane
            title={t('aiBand')}
            subtitle={t('aiBandSubtitle')}
            href="/ai-band"
            hrefLabel={t('seeAll')}
            loading={agentsLoading}
            error={agentsError}
            skeletonCount={4}
            skeletonWidth={240}
          >
            {agents.map(agent => (
              <div key={agent.id} style={{ flexShrink: 0, width: 240, scrollSnapAlign: 'start' }}>
                <AIAgentCard agent={agent} currentUserId={user?.id} />
              </div>
            ))}
          </DiscoverLane>
        </Reveal>
      </div>

      {/* Popular genres lane */}
      <div id="discover-genres">
        <Reveal index={6} from="up">
          <DiscoverLane
            title={t('popularGenres')}
            subtitle={t('popularGenresSubtitle')}
            href="/search"
            hrefLabel={t('seeAll')}
            loading={genresLoading}
            error={genresError}
            skeletonCount={6}
            skeletonWidth={140}
          >
            {genres.map(genre => (
              <GenreCard key={genre.id} name={genre.name} count={genre.count} />
            ))}
          </DiscoverLane>
        </Reveal>
      </div>

      {/* Upcoming events lane */}
      <div id="discover-events">
        <Reveal index={7} from="up">
          <DiscoverLane
            title={t('upcomingEvents') || 'Upcoming Events'}
            subtitle={t('upcomingEventsSubtitle') || 'Raves, sessions, and meetups'}
            href="/events"
            hrefLabel={t('seeAll')}
            loading={eventsLoading}
            error={eventsError}
            skeletonCount={4}
            skeletonWidth={260}
          >
            {events.map(event => (
              <Link
                key={event.id}
                to={`/events/${event.id}`}
                style={{
                  flexShrink: 0,
                  width: 260,
                  scrollSnapAlign: 'start',
                  background: colors.surface,
                  borderRadius: radius.lg,
                  border: `1px solid ${colors.border}`,
                  textDecoration: 'none',
                  color: colors.text.primary,
                  overflow: 'hidden',
                  transition: transition.base,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = colors.accent;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = colors.border;
                }}
              >
                <div
                  style={{
                    height: 100,
                    background: event.cover_image_url
                      ? `url(${event.cover_image_url}) center/cover`
                      : `linear-gradient(135deg, ${colors.surfaceHover}, ${colors.surface})`,
                    display: 'flex',
                    alignItems: 'flex-end',
                    padding: space[2],
                  }}
                >
                  <div
                    style={{
                      background: colors.bg,
                      borderRadius: radius.sm,
                      padding: `${space[1]} ${space[2]}`,
                      textAlign: 'center',
                      minWidth: space[12],
                    }}
                  >
                    <div
                      style={{
                        fontSize: fontSize.xs,
                        color: colors.accent,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                      }}
                    >
                      {new Date(event.starts_at).toLocaleDateString(undefined, { month: 'short' })}
                    </div>
                    <div style={{ fontSize: fontSize.xl, fontWeight: 700, lineHeight: 1 }}>
                      {new Date(event.starts_at).getDate()}
                    </div>
                  </div>
                </div>
                <div style={{ padding: space[3] }}>
                  <h4
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: 700,
                      margin: 0,
                      marginBottom: space[1],
                      lineHeight: 1.3,
                    }}
                  >
                    {event.title}
                  </h4>
                  {event.venue_name && (
                    <p style={{ fontSize: fontSize.xs, color: colors.text.faint, margin: 0 }}>
                      {event.venue_name}
                    </p>
                  )}
                  <p
                    style={{
                      fontSize: fontSize.xs,
                      color: colors.text.muted,
                      margin: 0,
                      marginTop: space[1],
                    }}
                  >
                    {event.rsvp_counts.going} going · {event.is_free ? 'Free' : 'Ticket'}
                  </p>
                </div>
              </Link>
            ))}
          </DiscoverLane>
        </Reveal>
      </div>

      {/* Empty state when everything fails */}
      {!trendingLoading &&
        !freshLoading &&
        !creatorsLoading &&
        !buzzLoading &&
        !agentsLoading &&
        !genresLoading &&
        !eventsLoading &&
        trending.length === 0 &&
        fresh.length === 0 &&
        creators.length === 0 &&
        buzzes.length === 0 &&
        agents.length === 0 &&
        genres.length === 0 &&
        events.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: `${space[14]}px 0`,
              color: colors.text.dim,
              fontSize: fontSize.md,
            }}
          >
            {t('emptyState')}
          </div>
        )}
    </div>
  );
}
