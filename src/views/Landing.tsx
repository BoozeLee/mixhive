'use client';
import { useTranslations } from 'next-intl';

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getHiveStats, type HiveStats } from '../lib/api';
import { HiveButton } from '../components/hive';
import { MixhiveWordmark } from '../components/brand/MixhiveWordmark';
import {
  colors,
  space,
  radius,
  fontSize,
  fontWeight,
  display,
  gradient,
  shadow,
  transition,
} from '../styles/tokens';
import { DURATION, EASE_OUT } from '../lib/motion';

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

const rise = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div
        style={{
          fontFamily: 'var(--font-display, system-ui)',
          fontSize: fontSize['2xl'],
          color: colors.text.primary,
          lineHeight: 1,
          // Stats sit over the animated WebGL gold backdrop (not a flat
          // surface); the shadow keeps them legible over bright regions.
          textShadow: '0 1px 10px rgba(0,0,0,0.55)',
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: fontSize.xs,
          color: colors.text.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          marginTop: space[2],
          textShadow: '0 1px 8px rgba(0,0,0,0.55)',
        }}
      >
        {label}
      </div>
    </div>
  );
}

// Stylized in-app preview — token-built (not a screenshot), avoids empty-DB ugliness.
function AppPreview() {
  const t = useTranslations('landing');
  return (
    <div
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.xl,
        boxShadow: shadow.elevated,
        padding: space[8],
        display: 'grid',
        gap: space[7],
        maxWidth: 380,
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: space[6] }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: radius.md,
            background: gradient.honey,
            flex: 'none',
          }}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ color: colors.text.primary, fontWeight: fontWeight.semibold }}>
            {t('midnightWarehouse')}
          </div>
          <div style={{ color: colors.text.dim, fontSize: fontSize.sm }}>
            @ken_dovor · 128 BPM · Techno
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 40 }}>
        {[10, 22, 14, 34, 26, 40, 18, 30, 12, 36, 20, 28, 16, 38, 24, 32].map((h, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: h,
              background: i % 3 === 0 ? colors.accent : colors.borderStrong,
              borderRadius: 0,
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: space[8] }}>
        <Stat value="2.4k" label={t('plays')} />
        <Stat value="312" label={t('likes')} />
        <Stat value="18" label={t('reposts')} />
      </div>
      <div style={{ display: 'flex', gap: space[5], flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: fontSize.xs,
            color: colors.bg,
            background: colors.accent,
            padding: '4px 10px',
            borderRadius: radius.pill,
            fontWeight: fontWeight.semibold,
          }}
        >
          Quest · Remix wanted
        </span>
        <span
          style={{
            fontSize: fontSize.xs,
            color: colors.text.secondary,
            border: `1px solid ${colors.border}`,
            padding: '4px 10px',
            borderRadius: radius.pill,
          }}
        >
          Scene · Techno Brussels
        </span>
      </div>
    </div>
  );
}

const pillars = [
  { t: 'Create', d: 'Publish mixes with real waveforms, get plays, build a following.' },
  { t: 'Connect', d: 'Join scenes, take quests, find collaborators and gigs.' },
  { t: 'Earn', d: 'Sell gear and AI agents with built-in escrow payouts.' },
];

export function Landing() {
  const t = useTranslations('landing');
  const navigate = useNavigate();
  const [stats, setStats] = useState<HiveStats | null>(null);
  const [statsError, setStatsError] = useState(false);

  useEffect(() => {
    getHiveStats()
      .then(setStats)
      .catch(() => {
        setStats(null);
        setStatsError(true);
      });
  }, []);

  const s = stats ?? { mixes_total: 0, voices_total: 0, plays_total: 0, live_now: 0 };

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* atmosphere */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: `${gradient.meshTop}, ${gradient.meshBottom}`,
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: gradient.scanline,
          opacity: 0.35,
          pointerEvents: 'none',
        }}
      />

      {/* Hero */}
      <section
        className="landing-hero"
        style={{
          position: 'relative',
          maxWidth: 1180,
          margin: '0 auto',
          padding: 'clamp(48px, 8vw, 110px) clamp(16px, 5vw, 64px) clamp(40px, 6vw, 72px)',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)',
          gap: 'clamp(32px, 5vw, 72px)',
          alignItems: 'center',
        }}
      >
        <style>{`@media (max-width: 880px){ .landing-hero{ grid-template-columns: 1fr !important; } .landing-hero .preview{ order: 2; } }`}</style>

        <motion.div initial="initial" animate="animate" transition={{ staggerChildren: 0.08 }}>
          <motion.div variants={rise} transition={{ duration: DURATION.md, ease: EASE_OUT }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: space[5],
                color: colors.text.dim,
                fontSize: fontSize.xs,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-mono, monospace)',
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: 999, background: colors.accent }} />{' '}
              The underground creative OS
            </div>
          </motion.div>

          <motion.h1
            variants={rise}
            transition={{ duration: DURATION.md, ease: EASE_OUT }}
            style={{
              fontFamily: 'var(--font-display, system-ui)',
              fontSize: display.xl,
              lineHeight: 0.96,
              letterSpacing: '-0.01em',
              textTransform: 'uppercase',
              margin: `${space[8]}px 0 0`,
              color: colors.text.primary,
            }}
          >
            Where the{' '}
            <span
              style={{
                background: gradient.goldText,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              underground
            </span>{' '}
            gets heard.
          </motion.h1>

          <motion.p
            variants={rise}
            transition={{ duration: DURATION.md, ease: EASE_OUT }}
            style={{
              margin: `${space[8]}px 0 0`,
              fontSize: 'clamp(15px, 1.7vw, 18px)',
              lineHeight: 1.6,
              color: colors.text.secondary,
              maxWidth: 520,
            }}
          >
            Publish your mixes, join scenes, take quests and sell gear — one home for DJs, producers
            and the people who power culture from the ground up.
          </motion.p>

          <motion.div
            variants={rise}
            transition={{ duration: DURATION.md, ease: EASE_OUT }}
            style={{ display: 'flex', gap: space[6], flexWrap: 'wrap', marginTop: space[10] }}
          >
            <HiveButton variant="primary" size="lg" onClick={() => navigate('/register')}>
              {t('joinTheHive')}
            </HiveButton>
            <HiveButton variant="ghost" size="lg" onClick={() => navigate('/discover')}>
              {t('exploreMixes')}
            </HiveButton>
          </motion.div>

          <motion.div
            variants={rise}
            transition={{ duration: DURATION.md, ease: EASE_OUT }}
            style={{
              display: 'flex',
              gap: 'clamp(20px, 4vw, 44px)',
              marginTop: space[12],
              flexWrap: 'wrap',
            }}
          >
            <Stat value={formatCount(s.mixes_total)} label={t('mixes')} />
            <Stat value={formatCount(s.voices_total)} label={t('voices')} />
            <Stat value={formatCount(s.plays_total)} label={t('plays2')} />
            <Stat value={formatCount(s.live_now)} label={t('liveNow')} />
            {statsError && (
              <div style={{ color: colors.text.dim, fontSize: fontSize.xs, width: '100%' }}>
                Could not refresh stats
              </div>
            )}
          </motion.div>
        </motion.div>

        <div className="preview" style={{ display: 'flex', justifyContent: 'center' }}>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.lg, ease: EASE_OUT, delay: 0.15 }}
          >
            <AppPreview />
          </motion.div>
        </div>
      </section>

      {/* Pillars */}
      <section
        style={{
          position: 'relative',
          maxWidth: 1180,
          margin: '0 auto',
          padding: '0 clamp(16px, 5vw, 64px) clamp(48px, 7vw, 88px)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: space[8],
          }}
        >
          {pillars.map(p => (
            <div
              key={p.t}
              className="landing-pillar"
              style={{
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: radius['2xl'],
                padding: space[10],
                transition: transition.smooth,
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-display, system-ui)',
                  fontSize: fontSize['2xl'],
                  color: colors.accent,
                  textTransform: 'uppercase',
                }}
              >
                {p.t}
              </div>
              <p
                style={{
                  color: colors.text.secondary,
                  fontSize: fontSize.md,
                  lineHeight: 1.6,
                  marginTop: space[5],
                }}
              >
                {p.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section
        style={{
          position: 'relative',
          maxWidth: 900,
          margin: '0 auto',
          padding: '0 clamp(16px, 5vw, 64px) clamp(64px, 9vw, 120px)',
          textAlign: 'center',
        }}
      >
        <div
          className="landing-pillar"
          style={{
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: radius['2xl'],
            boxShadow: shadow.elevated,
            padding: 'clamp(32px, 5vw, 64px)',
          }}
        >
          <MixhiveWordmark height={30} color={colors.text.primary} />
          <h2
            style={{
              fontFamily: 'var(--font-display, system-ui)',
              fontSize: display.md,
              textTransform: 'uppercase',
              color: colors.text.primary,
              margin: `${space[8]}px 0 0`,
            }}
          >
            {t('yourSoundBelongsHere')}
          </h2>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: space[6],
              marginTop: space[10],
              flexWrap: 'wrap',
            }}
          >
            <HiveButton variant="primary" size="lg" onClick={() => navigate('/register')}>
              {t('createYourAccount')}
            </HiveButton>
            <HiveButton variant="ghost" size="lg" onClick={() => navigate('/login')}>
              {t('signIn')}
            </HiveButton>
          </div>
        </div>
      </section>
    </div>
  );
}
