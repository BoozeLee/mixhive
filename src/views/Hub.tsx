import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { Icon } from '../components/ui/Icon';
import type { IconKey } from '../lib/icons';
import { colors, space, radius, fontSize, fontWeight, withAlpha } from '../styles/tokens';

// ─── Data ──────────────────────────────────────────────────────────────────────

const TABS = [
  {
    id: 'discover',
    label: 'Discover',
    watermark: 'DISCOVER',
    accent: '#f0c040',
    dim: withAlpha(colors.accent, 0.09),
  },
  {
    id: 'create',
    label: 'Create',
    watermark: 'CREATE',
    accent: '#ffd84a',
    dim: withAlpha(colors.accentBright, 0.086),
  },
  {
    id: 'community',
    label: 'Community',
    watermark: 'COMMUNITY',
    accent: '#e8b830',
    dim: '#e8b83016',
  },
  {
    id: 'marketplace',
    label: 'Marketplace',
    watermark: 'MARKET',
    accent: '#f0c040',
    dim: withAlpha(colors.accent, 0.09),
  },
  { id: 'agents', label: 'Agents & AI', watermark: 'AGENTS', accent: '#d4a830', dim: '#d4a83016' },
  {
    id: 'profile',
    label: 'Profile',
    watermark: 'PROFILE',
    accent: '#f0c040',
    dim: withAlpha(colors.accent, 0.09),
  },
  {
    id: 'editorial',
    label: 'Editorial',
    watermark: 'STORIES',
    accent: '#ffd84a',
    dim: withAlpha(colors.accentBright, 0.086),
  },
] as const;

type TabId = (typeof TABS)[number]['id'];

interface HubCardData {
  icon: IconKey;
  title: string;
  desc: string;
  path: string;
  auth: boolean;
  badge?: string;
}

const CARDS: Record<TabId, HubCardData[]> = {
  discover: [
    { icon: 'feed', title: 'Feed', desc: 'Your hive social stream', path: '/feed', auth: false },
    {
      icon: 'discover',
      title: 'Explore',
      desc: 'Trending mixes by genre',
      path: '/discover',
      auth: false,
    },
    {
      icon: 'search',
      title: 'Search',
      desc: 'Find DJs, mixes, collabs',
      path: '/search',
      auth: false,
    },
    {
      icon: 'mix',
      title: 'Trending',
      desc: 'What the scene plays now',
      path: '/trending',
      auth: false,
    },
    { icon: 'home', title: 'Home', desc: 'MixHive landing page', path: '/', auth: false },
  ],
  create: [
    {
      icon: 'upload',
      title: 'Upload Mix',
      desc: 'Drop your next release',
      path: '/upload',
      auth: true,
      badge: 'New',
    },
    {
      icon: 'composer',
      title: 'Composer',
      desc: 'AI-assisted solo track builder',
      path: '/composer',
      auth: true,
    },
    {
      icon: 'mix',
      title: 'Edit Mix',
      desc: 'Update a published release',
      path: '/mix',
      auth: true,
    },
  ],
  community: [
    {
      icon: 'quests',
      title: 'Collab Quests',
      desc: 'Team-based music projects',
      path: '/collab-quests',
      auth: false,
    },
    {
      icon: 'quests',
      title: 'New Quest',
      desc: 'Start a collaboration',
      path: '/collab-quests/new',
      auth: true,
    },
    {
      icon: 'quests',
      title: 'My Quests',
      desc: 'Track quest progress',
      path: '/quests',
      auth: true,
    },
    {
      icon: 'session',
      title: 'Live Session',
      desc: 'Real-time collab workspace',
      path: '/session',
      auth: true,
    },
  ],
  marketplace: [
    {
      icon: 'gear',
      title: 'Gear Market',
      desc: 'Buy & sell DJ equipment',
      path: '/marketplace/gear',
      auth: false,
    },
    {
      icon: 'gear',
      title: 'List Gear',
      desc: 'Sell your equipment',
      path: '/marketplace/gear/new',
      auth: true,
    },
    {
      icon: 'agentMarket',
      title: 'Agent Market',
      desc: 'Lua automation agents',
      path: '/marketplace/agents',
      auth: false,
      badge: 'Phase 16',
    },
    {
      icon: 'events',
      title: 'Opportunities',
      desc: 'AI-matched gig board',
      path: '/opportunities',
      auth: true,
    },
  ],
  agents: [
    {
      icon: 'agents',
      title: 'Agent Builder',
      desc: 'Write custom Lua agents',
      path: '/agents',
      auth: true,
    },
    {
      icon: 'agents',
      title: 'Agent Gallery',
      desc: 'Starter & community agents',
      path: '/agents/gallery',
      auth: false,
    },
    {
      icon: 'inbox',
      title: 'Agent Inbox',
      desc: 'Suggestions and task output',
      path: '/agents/inbox',
      auth: true,
    },
    {
      icon: 'radar',
      title: 'Scene Radar',
      desc: 'AI-powered orbit map',
      path: '/scene-radar',
      auth: true,
    },
  ],
  profile: [
    {
      icon: 'profile',
      title: 'My Profile',
      desc: 'Your public creator page',
      path: '/u',
      auth: true,
    },
    {
      icon: 'dashboard',
      title: 'Dashboard',
      desc: 'Analytics, mixes, activity',
      path: '/dashboard',
      auth: true,
    },
    {
      icon: 'settings',
      title: 'Settings',
      desc: 'Account & preferences',
      path: '/settings',
      auth: true,
    },
    {
      icon: 'profile',
      title: 'Onboarding',
      desc: 'Complete your profile setup',
      path: '/setup',
      auth: true,
    },
    { icon: 'epk', title: 'Press Kit', desc: 'Build & share your EPK', path: '/epk', auth: true },
  ],
  editorial: [
    {
      icon: 'story',
      title: 'Hive Story',
      desc: 'Monthly editorial showcase',
      path: '/hive-story',
      auth: false,
      badge: 'Phase 16',
    },
    {
      icon: 'notifications',
      title: 'Notifications',
      desc: 'Activity, alerts, push updates',
      path: '/notifications',
      auth: true,
    },
  ],
};

// ─── Framer variants ───────────────────────────────────────────────────────────

const gridVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.045, delayChildren: 0.05 } },
  exit: { transition: { staggerChildren: 0.025, staggerDirection: -1 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -8, scale: 0.97, transition: { duration: 0.12 } },
};

// ─── Decorative SVG background ────────────────────────────────────────────────

function HexGridBg({ accent }: { accent: string }) {
  return (
    <svg
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      <defs>
        <pattern id="hub-hex-bg" x="0" y="0" width="60" height="52" patternUnits="userSpaceOnUse">
          <polygon
            points="30,2 58,16 58,44 30,58 2,44 2,16"
            fill="none"
            stroke={accent}
            strokeWidth="0.5"
            opacity="0.06"
          />
        </pattern>
        {/* Radial fade mask so grid fades at edges */}
        <radialGradient id="hub-grid-fade" cx="50%" cy="50%" r="65%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id="hub-grid-mask">
          <rect width="100%" height="100%" fill="url(#hub-grid-fade)" />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="url(#hub-hex-bg)" mask="url(#hub-grid-mask)" />
    </svg>
  );
}

// ─── Single card ───────────────────────────────────────────────────────────────

function HubCard({
  card,
  isAuthed,
  accent,
}: {
  card: HubCardData;
  isAuthed: boolean;
  accent: string;
}) {
  const locked = card.auth && !isAuthed;

  return (
    <motion.div variants={cardVariants}>
      <Link
        to={locked ? '/login' : card.path}
        style={{ textDecoration: 'none', display: 'block', height: '100%' }}
        data-testid={`hub-card-${card.title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <motion.div
          whileHover={{
            y: -4,
            boxShadow: locked ? 'none' : `0 8px 32px ${accent}22, 0 0 0 1px ${accent}33`,
          }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.15 }}
          style={{
            position: 'relative',
            height: '100%',
            minHeight: 130,
            background: `linear-gradient(135deg, rgba(16,14,10,0.82) 0%, rgba(22,18,12,0.76) 100%)`,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${locked ? 'rgba(255,255,255,0.04)' : 'rgba(240,192,64,0.10)'}`,
            borderRadius: radius.xl,
            padding: `${space[8]}px`,
            display: 'flex',
            flexDirection: 'column',
            gap: space[5],
            cursor: 'pointer',
            overflow: 'hidden',
          }}
        >
          {/* Subtle inner glow top-left corner */}
          {!locked && (
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: -20,
                left: -20,
                width: 80,
                height: 80,
                background: `radial-gradient(circle, ${accent}0d 0%, transparent 70%)`,
                pointerEvents: 'none',
              }}
            />
          )}

          {/* Top row: hex icon + badges */}
          <div
            style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}
          >
            {/* Hex icon */}
            <span
              aria-hidden="true"
              style={{
                width: 44,
                height: 44,
                display: 'grid',
                placeItems: 'center',
                clipPath: 'polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%)',
                background: locked
                  ? 'rgba(255,255,255,0.04)'
                  : `linear-gradient(135deg, ${accent}1a 0%, ${accent}0d 100%)`,
                color: locked ? '#3a3830' : accent,
                flexShrink: 0,
                filter: locked ? 'none' : `drop-shadow(0 0 6px ${accent}44)`,
              }}
            >
              <Icon name={card.icon} size={20} color="currentColor" />
            </span>

            <div style={{ display: 'flex', gap: space[2], alignItems: 'center' }}>
              {card.badge && !locked && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: fontWeight.bold,
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase',
                    color: accent,
                    background: `${accent}18`,
                    border: `1px solid ${accent}33`,
                    borderRadius: radius.pill,
                    padding: '2px 6px',
                    lineHeight: 1.5,
                  }}
                >
                  {card.badge}
                </span>
              )}
              {locked && (
                <span aria-label="requires sign in" style={{ fontSize: 11, opacity: 0.35 }}>
                  🔒
                </span>
              )}
            </div>
          </div>

          {/* Text */}
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: fontSize.base,
                fontWeight: fontWeight.bold,
                color: locked ? '#3a3830' : colors.text.primary,
                marginBottom: 3,
                fontFamily: 'var(--font-display, monospace)',
                letterSpacing: '0.01em',
              }}
            >
              {card.title}
            </div>
            <div
              style={{
                fontSize: fontSize.xs,
                color: locked ? '#2e2c28' : colors.text.muted,
                lineHeight: 1.45,
              }}
            >
              {card.desc}
            </div>
          </div>

          {/* Bottom arrow — only on unlocked hover (CSS transition via opacity) */}
          {!locked && (
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                bottom: space[6],
                right: space[6],
                fontSize: 11,
                color: `${accent}55`,
                fontWeight: 900,
                letterSpacing: '-0.02em',
              }}
            >
              →
            </div>
          )}
        </motion.div>
      </Link>
    </motion.div>
  );
}

// ─── Hub page ──────────────────────────────────────────────────────────────────

export function Hub() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('discover');

  const tab = TABS.find(t => t.id === activeTab)!;
  const cards = CARDS[activeTab];

  return (
    <div
      id="main-content"
      style={{
        position: 'relative',
        minHeight: '100vh',
        padding: '36px 16px 96px',
        overflow: 'hidden',
      }}
    >
      {/* Background layers */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <HexGridBg accent={tab.accent} />

        {/* Corner mesh gradients */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '55%',
            height: '45%',
            background: `radial-gradient(ellipse at 90% 10%, ${tab.accent}0e 0%, transparent 65%)`,
            transition: 'background 0.5s ease',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '40%',
            height: '35%',
            background: `radial-gradient(ellipse at 10% 90%, ${tab.accent}07 0%, transparent 70%)`,
            transition: 'background 0.5s ease',
          }}
        />
      </div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto' }}>
        {/* Page header */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          style={{ marginBottom: space[12] }}
        >
          <div
            style={{
              fontSize: fontSize.xs,
              color: tab.accent,
              fontWeight: fontWeight.bold,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-display, monospace)',
              marginBottom: space[2],
              transition: 'color 0.3s',
            }}
          >
            Feature Hub
          </div>

          {/* Gradient text headline */}
          <h1
            style={{
              fontSize: 'clamp(28px, 5vw, 44px)',
              fontWeight: 900,
              margin: 0,
              lineHeight: 1.05,
              fontFamily: 'var(--font-display, monospace)',
              letterSpacing: '-0.02em',
              background: `linear-gradient(120deg, ${colors.text.primary} 40%, ${tab.accent} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              transition: 'background 0.4s',
            }}
          >
            MixHive
          </h1>

          <p
            style={{
              fontSize: fontSize.md,
              color: colors.text.muted,
              margin: `${space[3]}px 0 0`,
              display: 'flex',
              alignItems: 'center',
              gap: space[4],
              flexWrap: 'wrap',
            }}
          >
            Every feature, one place.
            {!user && (
              <span
                style={{
                  color: colors.text.dim,
                  fontSize: fontSize.xs,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: radius.pill,
                  padding: '3px 8px',
                }}
              >
                🔒 locked routes require sign in
              </span>
            )}
          </p>
        </motion.header>

        {/* Tab bar with layoutId animated pill */}
        <div
          role="tablist"
          aria-label="Hub navigation"
          style={{
            display: 'flex',
            gap: space[1],
            marginBottom: space[10],
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            paddingBottom: space[1],
            borderBottom: `1px solid rgba(255,255,255,0.05)`,
          }}
        >
          {TABS.map(t => (
            <button
              key={t.id}
              role="tab"
              aria-selected={activeTab === t.id}
              aria-controls={`hub-panel-${t.id}`}
              onClick={() => setActiveTab(t.id)}
              style={{
                position: 'relative',
                flexShrink: 0,
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${activeTab === t.id ? t.accent : 'transparent'}`,
                color: activeTab === t.id ? t.accent : colors.text.dim,
                fontSize: fontSize.xs,
                fontWeight: activeTab === t.id ? fontWeight.bold : fontWeight.normal,
                fontFamily: 'var(--font-display, monospace)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: `${space[4]}px ${space[7]}px ${space[4]}px`,
                cursor: 'pointer',
                transition: 'color 0.18s, border-color 0.18s',
                whiteSpace: 'nowrap',
                marginBottom: -1,
              }}
            >
              {activeTab === t.id && (
                <motion.span
                  layoutId="hub-tab-highlight"
                  style={{
                    position: 'absolute',
                    inset: '4px 4px 0',
                    background: `${t.accent}0d`,
                    borderRadius: `${radius.md}px ${radius.md}px 0 0`,
                    zIndex: 0,
                  }}
                  transition={{ type: 'spring', stiffness: 360, damping: 34 }}
                />
              )}
              <span style={{ position: 'relative', zIndex: 1 }}>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Tab panel */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.16 }}
          >
            <section
              id={`hub-panel-${activeTab}`}
              role="tabpanel"
              aria-label={tab.label}
              style={{ position: 'relative' }}
            >
              {/* Watermark */}
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: -12,
                  right: -8,
                  fontSize: 'clamp(80px, 12vw, 160px)',
                  fontWeight: 900,
                  color: tab.accent,
                  opacity: 0.022,
                  lineHeight: 1,
                  pointerEvents: 'none',
                  userSelect: 'none',
                  fontFamily: 'var(--font-display, monospace)',
                  letterSpacing: '-0.04em',
                  overflow: 'hidden',
                  maxWidth: '70%',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.watermark}
              </div>

              {/* Staggered card grid */}
              <motion.div
                variants={gridVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: space[5],
                }}
              >
                {cards.map(card => (
                  <HubCard key={card.path} card={card} isAuthed={!!user} accent={tab.accent} />
                ))}
              </motion.div>

              {/* Card count */}
              <div
                style={{
                  marginTop: space[9],
                  fontSize: fontSize.xs,
                  color: colors.text.dim,
                  fontFamily: 'var(--font-display, monospace)',
                  letterSpacing: '0.06em',
                }}
              >
                {cards.length} feature{cards.length !== 1 ? 's' : ''} in {tab.label}
              </div>
            </section>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
