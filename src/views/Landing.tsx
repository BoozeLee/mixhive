import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { getHiveStats, getRecentMixes, type HiveStats } from '../lib/api';
import type { FeedMix } from '../lib/types';
import {
  HiveButton,
  HiveCard,
  HiveStat,
  HexIcon,
  WaveBar,
  HoneyDripDivider,
  type IconName,
} from '../components/hive';

const EXPLORE_TILES: { icon: IconName; label: string; to: string }[] = [
  { icon: 'mix-vault', label: 'Mixes', to: '/discover' },
  { icon: 'hive-radar', label: 'Network', to: '/search' },
  { icon: 'nectar-upload', label: 'Upload', to: '/upload' },
  { icon: 'queen-mode', label: 'Events', to: '/opportunities' },
  { icon: 'honeydrop-nft', label: 'HoneyDrop', to: '/discover' },
  { icon: 'buzz-alerts', label: 'Buzz', to: '/feed' },
];

function HiveMap() {
  const nodes: [number, number][] = [
    [14, 55], [26, 68], [38, 46], [50, 75],
    [61, 50], [74, 64], [86, 42], [48, 30],
  ];
  return (
    <HiveCard tone="panel" style={{ minHeight: 240, overflow: 'hidden', height: '100%' }}>
      <h2 style={{
        margin: 0,
        color: 'var(--hive-gold)',
        fontFamily: 'var(--font-ui)',
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: '0.14em',
        fontWeight: 800,
      }}>
        Hive Map
      </h2>
      <svg
        viewBox="0 0 100 70"
        aria-label="Constellation of connected hive nodes"
        style={{ width: '100%', height: 190, marginTop: 14, filter: 'drop-shadow(0 0 10px rgba(246,196,0,0.4))' }}
      >
        <defs>
          <pattern id="hm-dots" width="4" height="4" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r=".45" fill="rgba(246,196,0,.4)" />
          </pattern>
        </defs>
        <path d="M5 52 C18 30, 33 50, 45 28 S77 22, 96 48" fill="none" stroke="rgba(246,196,0,.14)" strokeWidth="7" />
        <rect x="4" y="8" width="92" height="54" fill="url(#hm-dots)" opacity=".7" />
        {nodes.slice(1).map((node, i) => (
          <line key={i} x1={nodes[i][0]} y1={nodes[i][1]} x2={node[0]} y2={node[1]}
            stroke="rgba(246,196,0,.5)" strokeWidth=".4" />
        ))}
        {nodes.map((node, i) => (
          <circle key={i} cx={node[0]} cy={node[1]} r="2.1" fill="#f6c400" />
        ))}
      </svg>
    </HiveCard>
  );
}

function FeedItem({ mix, index }: { mix: FeedMix; index: number }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 18px',
      borderBottom: '1px solid var(--hive-line-soft)',
    }}>
      <div style={{
        width: 38,
        height: 38,
        borderRadius: '50%',
        flexShrink: 0,
        background: mix.cover_url
          ? `url(${mix.cover_url}) center/cover`
          : `linear-gradient(135deg, var(--hive-ink), var(--hive-gold-deep))`,
        border: '1px solid var(--hive-line)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--hive-gold)',
        fontSize: 16,
      }}>
        {!mix.cover_url && '♛'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: 'var(--hive-text)',
          fontFamily: 'var(--font-ui)',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {mix.dj_display_name || mix.dj_username || 'Unknown DJ'}
        </div>
        <div style={{
          color: 'var(--hive-muted)',
          fontSize: 11,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          marginTop: 2,
        }}>
          {mix.title}
        </div>
        <div style={{ marginTop: 6 }}>
          <WaveBar bars={40} height={22} progress={index === 0 ? 0.3 : 0} label={mix.title} />
        </div>
      </div>
      <button
        aria-label="Play"
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: 'rgba(246,196,0,0.12)',
          border: '1px solid var(--hive-line)',
          color: 'var(--hive-gold)',
          fontSize: 10,
          cursor: 'pointer',
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        ▶
      </button>
    </div>
  );
}

export function Landing() {
  const { user } = useAuth();
  const [stats, setStats] = useState<HiveStats>({ mixes_total: 0, voices_total: 0, plays_total: 0, live_now: 0 });
  const [feed, setFeed] = useState<FeedMix[]>([]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getHiveStats(), getRecentMixes(3)])
      .then(([s, f]) => {
        if (cancelled) return;
        setStats(s);
        setFeed(f.data ?? []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{ position: 'relative', minHeight: '100vh', paddingBottom: 80 }}
    >
      {/* Full-bleed fixed backdrop */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -1,
          background: '#050505',
          backgroundImage: 'url(/art/honeycomb-tile.png)',
          backgroundSize: '260px',
          opacity: 0.15,
          pointerEvents: 'none',
        }}
      />

      <main
        id="main-content"
        style={{ position: 'relative', zIndex: 1, maxWidth: 1360, margin: '0 auto', padding: '0 clamp(16px,4vw,48px)' }}
      >

        {/* ── HERO ── */}
        <section
          className="lp-hero"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr) 240px minmax(260px,400px)',
            gap: 40,
            alignItems: 'center',
            minHeight: 'calc(100vh - 64px - 80px)',
            paddingTop: 56,
            paddingBottom: 48,
          }}
        >
          {/* Left: CTA text */}
          <div>
            <p style={{
              margin: '0 0 16px',
              color: 'var(--hive-gold)',
              fontFamily: 'var(--font-ui)',
              fontWeight: 800,
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}>
              The hive never sleeps
            </p>

            <h1 style={{
              margin: '0 0 20px',
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(40px, 6vw, 72px)',
              lineHeight: 0.95,
              fontWeight: 900,
              textTransform: 'uppercase',
              color: 'var(--hive-text)',
              letterSpacing: '0.01em',
            }}>
              The Hive<br />
              Is Your<br />
              <span style={{ color: 'var(--hive-gold)', textShadow: '0 0 28px rgba(246,196,0,0.5)' }}>
                Network
              </span>
            </h1>

            <p style={{
              margin: '0 0 32px',
              fontFamily: 'var(--font-ui)',
              color: 'var(--hive-text-soft)',
              fontSize: 15,
              lineHeight: 1.55,
              maxWidth: 400,
            }}>
              The social platform for DJs, producers and music creators.
            </p>

            <Link to={user ? '/feed' : '/register'} style={{ textDecoration: 'none' }}>
              <HiveButton size="lg" variant={user ? 'primary' : 'ghost'}>
                {user ? 'Enter the Hive' : 'Join the Hive'}
              </HiveButton>
            </Link>
          </div>

          {/* Center: Crown art */}
          <div
            className="lp-hero-crown"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              justifyContent: 'center',
            }}
          >
            <img
              src="/mixhivebusinesslogo.png"
              alt="MixHive"
              style={{
                width: 220,
                height: 220,
                objectFit: 'contain',
                filter: 'drop-shadow(0 0 36px rgba(246,196,0,0.65)) drop-shadow(0 0 8px rgba(246,196,0,0.4))',
                mixBlendMode: 'screen',
              }}
            />
            <span style={{ fontSize: 26, filter: 'drop-shadow(0 0 8px rgba(246,196,0,0.8))' }}>🐝</span>
          </div>

          {/* Right: Live feed */}
          <HiveCard tone="panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 18px',
              borderBottom: '1px solid var(--hive-line-soft)',
            }}>
              <h2 style={{
                margin: 0,
                color: 'var(--hive-gold)',
                fontFamily: 'var(--font-ui)',
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
              }}>
                Hive Feed
              </h2>
              <Link to="/feed" style={{
                color: 'var(--hive-gold)',
                fontSize: 11,
                textDecoration: 'none',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                opacity: 0.7,
              }}>
                See all →
              </Link>
            </div>

            {feed.length === 0 ? (
              <div style={{ padding: '20px 18px', color: 'var(--hive-muted)', fontSize: 13, fontStyle: 'italic' }}>
                The swarm is silent. Drop the first nectar.
              </div>
            ) : (
              feed.slice(0, 3).map((mix, i) => <FeedItem key={mix.id} mix={mix} index={i} />)
            )}

            {/* MixHive branding strip inside feed card */}
            <div style={{
              padding: '14px 18px',
              borderTop: '1px solid var(--hive-line-soft)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <img src="/mixhivebusinesslogo.png" alt="" style={{ width: 28, height: 28, objectFit: 'contain', mixBlendMode: 'screen', opacity: 0.7 }} />
              <div>
                <div style={{ color: 'var(--hive-gold)', fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>MixHive</div>
                <div style={{ color: 'var(--hive-muted)', fontSize: 10, lineHeight: 1.3 }}>The Hive Is Your Network</div>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <Link to={user ? '/feed' : '/register'} style={{ textDecoration: 'none' }}>
                  <HiveButton size="sm" variant="ghost">{user ? 'Enter' : 'Join'}</HiveButton>
                </Link>
              </div>
            </div>
          </HiveCard>
        </section>

        <HoneyDripDivider height={40} />

        {/* ── STATS ── */}
        <section
          className="lp-stats"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4,1fr)',
            gap: 1,
            background: 'rgba(12,10,3,0.7)',
            borderTop: '1px solid var(--hive-line-soft)',
            borderBottom: '1px solid var(--hive-line-soft)',
            margin: '0 calc(-1 * clamp(16px,4vw,48px))',
            padding: '22px clamp(16px,4vw,48px)',
          }}
        >
          <HiveStat icon="♟" label="Mixes" value={stats.mixes_total} />
          <HiveStat icon="◌" label="Voices" value={stats.voices_total} />
          <HiveStat icon="≋" label="Plays" value={stats.plays_total} />
          <HiveStat icon="♕" label="Live Now" value={stats.live_now} />
        </section>

        <HoneyDripDivider height={40} />

        {/* ── EXPLORE + MAP ── */}
        <section
          className="lp-bottom"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 24,
            paddingBottom: 48,
          }}
        >
          {/* Explore */}
          <HiveCard tone="panel" style={{ padding: 24 }}>
            <h2 style={{
              margin: '0 0 20px',
              color: 'var(--hive-gold)',
              fontFamily: 'var(--font-ui)',
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
            }}>
              Explore the Hive
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3,1fr)',
              gap: 18,
            }}>
              {EXPLORE_TILES.map(tile => (
                <Link
                  key={tile.icon}
                  to={tile.to}
                  aria-label={tile.label}
                  style={{
                    textDecoration: 'none',
                    display: 'grid',
                    justifyItems: 'center',
                    gap: 8,
                    color: 'var(--hive-text-soft)',
                  }}
                >
                  <HexIcon name={tile.icon} size={56} label={tile.label} />
                  <span style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    textAlign: 'center',
                  }}>
                    {tile.label}
                  </span>
                </Link>
              ))}
            </div>
          </HiveCard>

          {/* Map */}
          <HiveMap />
        </section>
      </main>

      {/* Responsive overrides */}
      <style>{`
        @media (max-width: 900px) {
          .lp-hero {
            grid-template-columns: minmax(0,1fr) !important;
            min-height: auto !important;
            padding-top: 36px !important;
          }
          .lp-hero-crown { display: none !important; }
          .lp-bottom { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 760px) {
          .lp-stats { grid-template-columns: repeat(2,1fr) !important; }
        }
      `}</style>
    </motion.div>
  );
}
