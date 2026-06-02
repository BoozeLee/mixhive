import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { getHiveStats, getRecentMixes, type HiveStats } from '../lib/api';
import type { FeedMix } from '../lib/types';
import {
  HiveLogo,
  HiveButton,
  HiveCard,
  HoneycombGrid,
  HoneyDripDivider,
  HexIcon,
  HiveStat,
  WaveBar,
  type IconName,
} from '../components/hive';

interface ExploreTile {
  icon: IconName;
  label: string;
  to: string;
}

const EXPLORE_TILES: ExploreTile[] = [
  { icon: 'hive-feed', label: 'Hive Feed', to: '/feed' },
  { icon: 'mix-vault', label: 'Mix Vault', to: '/discover' },
  { icon: 'swarm-chat', label: 'Swarm Chat', to: '/messages' },
  { icon: 'beecast-live', label: 'BeeCast Live', to: '/feed' },
  { icon: 'queen-mode', label: 'Queen Mode', to: '/admin/verification' },
  { icon: 'vinyl-marketplace', label: 'Vinyl Market', to: '/discover' },
  { icon: 'honeydrop-nft', label: 'HoneyDrop NFTs', to: '/discover' },
  { icon: 'buzz-alerts', label: 'Buzz Alerts', to: '/notifications' },
];

function HiveMap() {
  const nodes = [
    [14, 55],
    [26, 68],
    [38, 46],
    [50, 75],
    [61, 50],
    [74, 64],
    [86, 42],
    [48, 30],
  ];
  return (
    <HiveCard tone="panel" style={{ minHeight: 230, overflow: 'hidden' }}>
      <h2
        style={{
          margin: 0,
          color: 'var(--hive-gold, #f6c400)',
          fontFamily: 'var(--font-ui)',
          fontSize: 16,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          fontWeight: 900,
        }}
      >
        Hive Map
      </h2>
      <svg
        viewBox="0 0 100 70"
        aria-label="Constellation of connected hive nodes"
        style={{
          width: '100%',
          height: 190,
          marginTop: 12,
          filter: 'drop-shadow(0 0 10px rgba(246,196,0,0.4))',
        }}
      >
        <defs>
          <pattern id="dots" width="4" height="4" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r=".45" fill="rgba(246,196,0,.45)" />
          </pattern>
        </defs>
        <path
          d="M5 52 C18 30, 33 50, 45 28 S77 22, 96 48"
          fill="none"
          stroke="rgba(246,196,0,.18)"
          strokeWidth="7"
        />
        <rect x="4" y="8" width="92" height="54" fill="url(#dots)" opacity=".75" />
        {nodes.slice(1).map((node, index) => (
          <line
            key={`${node[0]}-${node[1]}`}
            x1={nodes[index][0]}
            y1={nodes[index][1]}
            x2={node[0]}
            y2={node[1]}
            stroke="rgba(246,196,0,.55)"
            strokeWidth=".4"
          />
        ))}
        {nodes.map(node => (
          <circle key={`${node[0]}-${node[1]}`} cx={node[0]} cy={node[1]} r="2.1" fill="#f6c400" />
        ))}
      </svg>
    </HiveCard>
  );
}

function HiveFeed({ mixes }: { mixes: FeedMix[] }) {
  return (
    <HiveCard tone="panel" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '18px 22px',
          borderBottom: '1px solid var(--hive-line-soft, rgba(246,196,0,0.12))',
        }}
      >
        <h2
          style={{
            margin: 0,
            color: 'var(--hive-gold, #f6c400)',
            fontFamily: 'var(--font-ui)',
            fontSize: 14,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            fontWeight: 800,
          }}
        >
          Hive Feed
        </h2>
        <Link
          to="/feed"
          style={{
            color: 'var(--hive-gold, #f6c400)',
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            textDecoration: 'none',
          }}
        >
          View all
        </Link>
      </div>
      {mixes.length === 0 ? (
        <div style={{ padding: 22, color: 'var(--hive-muted, #a9a390)', fontSize: 13 }}>
          The swarm is silent. Be the first to drop nectar.
        </div>
      ) : (
        mixes.slice(0, 3).map((mix, i) => (
          <article
            key={mix.id}
            style={{
              padding: '16px 22px',
              borderBottom:
                i === Math.min(mixes.length, 3) - 1
                  ? 'none'
                  : '1px solid var(--hive-line-soft, rgba(246,196,0,0.12))',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                aria-hidden="true"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background:
                    'linear-gradient(135deg, var(--hive-surfaceHi, #1c1812), var(--hive-gold-deep, #c79100))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--hive-gold, #f6c400)',
                  fontSize: 16,
                  flexShrink: 0,
                }}
              >
                ♛
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3
                  style={{
                    margin: 0,
                    color: 'var(--hive-text, #f5f3e7)',
                    fontFamily: 'var(--font-ui)',
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {mix.dj_display_name || mix.dj_username || 'Unknown DJ'}
                </h3>
                <p
                  style={{
                    margin: '2px 0 0',
                    color: 'var(--hive-muted, #a9a390)',
                    fontSize: 11,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {mix.title}
                </p>
              </div>
            </div>
            <WaveBar
              bars={48}
              height={28}
              progress={i === 0 ? 0.35 : 0}
              label={`Waveform preview for ${mix.title}`}
            />
          </article>
        ))
      )}
    </HiveCard>
  );
}

export function Landing() {
  const { user } = useAuth();
  const [stats, setStats] = useState<HiveStats>({
    mixes_total: 0,
    voices_total: 0,
    plays_total: 0,
    live_now: 0,
  });
  const [feed, setFeed] = useState<FeedMix[]>([]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getHiveStats(), getRecentMixes(3)])
      .then(([s, f]) => {
        if (cancelled) return;
        setStats(s);
        setFeed(f.data ?? []);
      })
      .catch(() => {
        /* silent — fallback to zeros */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      style={{ position: 'relative', minHeight: '100vh', paddingBottom: 80 }}
    >
      {/* Brand background — falls back to the CSS @utility when the ComfyUI tile isn't generated yet */}
      <HoneycombGrid density="mid" />

      <main
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 1280,
          margin: '0 auto',
          padding: '40px 24px 0',
        }}
      >
        {/* HERO — two-up on desktop, stacked on mobile */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gap: 24,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 1fr)',
              gap: 24,
            }}
            className="hive-landing__hero-row"
          >
            {/* Left: wordmark + CTA */}
            <HiveCard
              tone="panel"
              style={{ padding: 36, minHeight: 380, position: 'relative', overflow: 'hidden' }}
            >
              <p
                style={{
                  color: 'var(--hive-gold, #f6c400)',
                  fontFamily: 'var(--font-ui)',
                  fontWeight: 800,
                  fontSize: 12,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  margin: '0 0 14px',
                }}
              >
                The hive never sleeps
              </p>

              <HiveLogo variant="stacked" size="hero" />

              <h1
                style={{
                  fontFamily: 'var(--font-display, "Permanent Marker"), system-ui, sans-serif',
                  fontSize: 56,
                  lineHeight: 0.98,
                  margin: '24px 0 16px',
                  color: 'var(--hive-text, #f5f3e7)',
                  letterSpacing: '0.01em',
                }}
              >
                The Hive
                <br />
                Is Your
                <br />
                <span
                  style={{
                    color: 'var(--hive-gold, #f6c400)',
                    textShadow: '0 0 24px rgba(246,196,0,0.45)',
                  }}
                >
                  Network
                </span>
              </h1>

              <p
                style={{
                  fontFamily: 'var(--font-ui)',
                  color: 'var(--hive-text-soft, #d4cdb0)',
                  fontSize: 15,
                  lineHeight: 1.5,
                  margin: 0,
                  maxWidth: 480,
                }}
              >
                A cybernetic music hive-city for DJs, producers, rave organizers, visual artists,
                and underground culture creators.
              </p>

              <div style={{ marginTop: 28 }}>
                <Link to={user ? '/feed' : '/register'} style={{ textDecoration: 'none' }}>
                  <HiveButton size="lg">{user ? 'Enter the Hive' : 'Join the Hive'}</HiveButton>
                </Link>
              </div>
            </HiveCard>

            {/* Right: live hive feed */}
            <HiveFeed mixes={feed} />
          </div>
        </section>

        <HoneyDripDivider height={48} />

        {/* STATS STRIP */}
        <section style={{ marginBottom: 32 }}>
          <HiveCard tone="panel" style={{ padding: 24 }}>
            <h2
              style={{
                color: 'var(--hive-gold, #f6c400)',
                fontFamily: 'var(--font-ui)',
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                margin: '0 0 16px',
              }}
            >
              Hive Stats
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 16,
              }}
            >
              <HiveStat icon="♟" label="Mixes" value={stats.mixes_total} />
              <HiveStat icon="◌" label="Voices" value={stats.voices_total} />
              <HiveStat icon="≋" label="Plays" value={stats.plays_total} />
              <HiveStat icon="♕" label="Live now" value={stats.live_now} />
            </div>
          </HiveCard>
        </section>

        {/* EXPLORE + HIVE MAP — two-up */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: 24,
          }}
          className="hive-landing__lower-row"
        >
          <HiveCard tone="panel" style={{ padding: 24 }}>
            <h2
              style={{
                color: 'var(--hive-gold, #f6c400)',
                fontFamily: 'var(--font-ui)',
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                margin: '0 0 20px',
              }}
            >
              Explore the Hive
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                gap: 18,
              }}
            >
              {EXPLORE_TILES.map(tile => (
                <Link
                  key={tile.icon}
                  to={tile.to}
                  aria-label={tile.label}
                  style={{
                    textDecoration: 'none',
                    display: 'grid',
                    justifyItems: 'center',
                    gap: 10,
                    color: 'var(--hive-text-soft, #d4cdb0)',
                  }}
                >
                  <HexIcon name={tile.icon} size={56} label={tile.label} />
                  <span
                    style={{
                      fontFamily: 'var(--font-ui)',
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {tile.label}
                  </span>
                </Link>
              ))}
            </div>
          </HiveCard>

          <HiveMap />
        </section>

        {/* Responsive overrides for the two grid rows above */}
        <style>{`
          @media (max-width: 900px) {
            .hive-landing__hero-row,
            .hive-landing__lower-row {
              grid-template-columns: minmax(0, 1fr) !important;
            }
          }
        `}</style>
      </main>
    </motion.div>
  );
}
