import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getHiveStats, getRecentMixes, type HiveStats } from '../lib/api';
import type { FeedMix } from '../lib/types';
import { HiveButton } from '../components/hive';
import { MixhiveWordmark } from '../components/brand/MixhiveWordmark';
import { BeeMark } from '../components/brand/BeeMark';
import { Reveal } from '../components/ui/Reveal';
import { GlowText } from '../components/ui/GlowText';
import { SectionHeading } from '../components/ui/SectionHeading';
import { NeonDivider } from '../components/ui/NeonDivider';
import { ParticleField } from '../components/ui/ParticleField';
import { DURATION, EASE_OUT } from '../lib/motion';

// ─── Static content ─────────────────────────────────────────────────────────

const ECOSYSTEM = [
  { label: 'Create', sub: 'in Beehive Studio', glyph: '✦' },
  { label: 'Distribute', sub: 'on MixHive', glyph: '⌁' },
  { label: 'Get discovered', sub: 'Scene Radar', glyph: '◈' },
  { label: 'Collaborate', sub: 'Collab Quests', glyph: '⚔' },
  { label: 'Get paid', sub: 'Marketplace', glyph: '◆' },
];

const PILLARS = [
  { glyph: '⌁', title: 'Mixes & Feed', desc: 'Upload sets with waveforms. A living feed of the underground, not an algorithm feeding you.', to: '/discover' },
  { glyph: '✦', title: 'AI Lua Agents', desc: 'Automation agents that work your profile while you sleep — yours to build, fork, and sell.', to: '/agents/gallery' },
  { glyph: '⚔', title: 'Collab Quests', desc: 'RPG-style team quests. Assemble crews across every creative discipline and ship together.', to: '/collab-quests' },
  { glyph: '◆', title: 'Gear + Agent Market', desc: 'Buy and sell gear with escrow. Install paid agents. The economy is yours, not a middleman’s.', to: '/marketplace/gear' },
  { glyph: '◈', title: 'Scene Radar', desc: 'Vector + graph recommendations that surface the artists and nights actually near your sound.', to: '/scene-radar' },
  { glyph: '♕', title: 'MythicNode Graph', desc: 'A living career knowledge graph for every artist — your scene, mapped and growing.', to: '/hub' },
];

const CREATORS = [
  { glyph: '⌁', label: 'DJs', line: 'Share sets, get booked, build a following.' },
  { glyph: '✦', label: 'Producers', line: 'Release tracks, find collaborators, sell sounds.' },
  { glyph: '◈', label: 'Visual artists', line: 'Cover art, visuals, AV collabs — get commissioned.' },
  { glyph: '◆', label: 'Organizers', line: 'Cast lineups, post quests, find the next wave.' },
];

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MascotPicture({ size }: { size: number }) {
  return (
    <picture>
      <source srcSet="/brand/mascot-640.avif" type="image/avif" />
      <source srcSet="/brand/mascot-640.webp" type="image/webp" />
      <img
        src="/mixhive.png"
        alt="MixHive"
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          filter: 'drop-shadow(0 0 50px rgba(246,196,0,0.45))',
          mixBlendMode: 'screen',
        }}
      />
    </picture>
  );
}

function StatBlock({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          fontFamily: 'var(--font-display, system-ui)',
          fontSize: 'clamp(28px, 5vw, 48px)',
          lineHeight: 1,
          color: 'var(--hive-gold, #f6c400)',
          textShadow: '0 0 24px rgba(246,196,0,0.35)',
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 11,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--hive-muted, #a9a390)',
          marginTop: 8,
          fontFamily: 'var(--font-mono, monospace)',
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function Landing() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<HiveStats | null>(null);
  const [mixes, setMixes] = useState<FeedMix[]>([]);

  useEffect(() => {
    let cancelled = false;
    getHiveStats()
      .then(s => { if (!cancelled) setStats(s); })
      .catch(() => {});
    getRecentMixes(6)
      .then(r => { if (!cancelled) setMixes(r.data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <div id="main-content" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* ═══ HERO ═══ */}
      <section
        style={{
          position: 'relative',
          minHeight: 'calc(100vh - 64px)',
          display: 'flex',
          alignItems: 'center',
          padding: '40px clamp(16px, 5vw, 64px) 64px',
          overflow: 'hidden',
        }}
      >
        {/* ambient layers */}
        <ParticleField count={40} />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 60% 50% at 75% 30%, rgba(246,196,0,0.10), transparent 70%), radial-gradient(ellipse 50% 40% at 15% 80%, rgba(37,217,255,0.05), transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            maxWidth: 1200,
            margin: '0 auto',
            width: '100%',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 0.85fr)',
            gap: 'clamp(24px, 4vw, 64px)',
            alignItems: 'center',
          }}
          className="landing-hero-grid"
        >
          {/* Left: copy */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.xl, ease: EASE_OUT }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                borderRadius: 999,
                border: '1px solid rgba(246,196,0,0.25)',
                background: 'rgba(246,196,0,0.06)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--hive-gold, #f6c400)',
                fontFamily: 'var(--font-mono, monospace)',
                marginBottom: 24,
              }}
            >
              <BeeMark size={16} color="#f6c400" /> The underground creative OS
            </div>

            <h1
              style={{
                fontFamily: 'var(--font-display, system-ui)',
                fontSize: 'clamp(44px, 9vw, 104px)',
                lineHeight: 0.92,
                letterSpacing: '-0.01em',
                margin: 0,
                textTransform: 'uppercase',
              }}
            >
              <GlowText variant="gradient" style={{ display: 'block' }}>The Hive</GlowText>
              <GlowText variant="neon" style={{ display: 'block' }}>Never Sleeps</GlowText>
            </h1>

            <p
              style={{
                margin: '24px 0 0',
                fontSize: 'clamp(15px, 1.8vw, 19px)',
                lineHeight: 1.6,
                color: 'var(--hive-text-soft, #d4cdb0)',
                maxWidth: 540,
              }}
            >
              The social operating system for the underground creative economy.
              Facebook × SoundCloud × Upwork — built for DJs, producers, visual
              artists, and the people who power culture from the underground up.
            </p>

            {/* kinetic subline */}
            <div
              style={{
                margin: '22px 0 34px',
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.22em',
                color: 'var(--hive-muted, #a9a390)',
                fontFamily: 'var(--font-mono, monospace)',
              }}
            >
              BEATS · ENERGY · CREATIVITY · CONNECTION
            </div>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <HiveButton variant="primary" size="lg" onClick={() => navigate('/register')}>
                Join the Hive
              </HiveButton>
              <HiveButton variant="ghost" size="lg" onClick={() => navigate('/discover')}>
                Explore Mixes
              </HiveButton>
            </div>
          </motion.div>

          {/* Right: mascot */}
          <div className="landing-hero-mascot" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1, y: [0, -14, 0] }}
              transition={{
                opacity: { duration: DURATION.xl, ease: EASE_OUT, delay: 0.15 },
                scale: { duration: DURATION.xl, ease: EASE_OUT, delay: 0.15 },
                y: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
              }}
            >
              <MascotPicture size={420} />
            </motion.div>
          </div>
        </div>

        {/* scroll cue */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            bottom: 22,
            left: '50%',
            transform: 'translateX(-50%)',
            color: 'var(--hive-dim, #6a624a)',
            fontSize: 11,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          Scroll ↓
        </div>
      </section>

      {/* ═══ VISION BAND ═══ */}
      <section style={{ padding: '80px clamp(16px, 5vw, 64px)', position: 'relative' }}>
        <div style={{ maxWidth: 920, margin: '0 auto', textAlign: 'center' }}>
          <Reveal>
            <p
              style={{
                fontFamily: 'var(--font-display, system-ui)',
                fontSize: 'clamp(24px, 4vw, 44px)',
                lineHeight: 1.25,
                color: 'var(--hive-text, #f5f3e7)',
                margin: 0,
              }}
            >
              Where Spotify tells you what to listen to,{' '}
              <GlowText variant="neon">MixHive puts the DJ back in control.</GlowText>{' '}
              Where LinkedIn is for suits, MixHive is for scene-builders. Where Fiverr
              is transactional, <GlowText variant="gradient">MixHive is community-first.</GlowText>
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <NeonDivider style={{ marginTop: 40 }} />
          </Reveal>
        </div>
      </section>

      {/* ═══ ECOSYSTEM FLOW ═══ */}
      <section style={{ padding: '40px clamp(16px, 5vw, 64px) 90px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <Reveal>
            <SectionHeading
              align="center"
              eyebrow="The flywheel"
              title="One ecosystem, end to end"
              subtitle="Create in Beehive Studio, distribute on MixHive, get discovered, collaborate, and get paid — without leaving the hive."
            />
          </Reveal>

          <div
            style={{
              display: 'flex',
              alignItems: 'stretch',
              justifyContent: 'center',
              gap: 12,
              flexWrap: 'wrap',
              marginTop: 48,
            }}
          >
            {ECOSYSTEM.map((step, i) => (
              <Reveal key={step.label} index={i} from="up">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 168,
                      padding: '22px 16px',
                      borderRadius: 14,
                      background: 'rgba(16,14,10,0.7)',
                      border: '1px solid rgba(246,196,0,0.14)',
                      backdropFilter: 'blur(14px)',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        margin: '0 auto 12px',
                        display: 'grid',
                        placeItems: 'center',
                        clipPath: 'polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%)',
                        background: 'rgba(246,196,0,0.12)',
                        color: '#f6c400',
                        fontSize: 17,
                        fontWeight: 900,
                      }}
                    >
                      {step.glyph}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        color: 'var(--hive-text, #f5f3e7)',
                        fontFamily: 'var(--font-display, system-ui)',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {step.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--hive-muted, #a9a390)', marginTop: 4 }}>
                      {step.sub}
                    </div>
                  </div>
                  {i < ECOSYSTEM.length - 1 && (
                    <span
                      aria-hidden
                      className="ecosystem-arrow"
                      style={{ color: 'rgba(246,196,0,0.5)', fontSize: 20, fontWeight: 900 }}
                    >
                      →
                    </span>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FEATURE PILLARS ═══ */}
      <section style={{ padding: '40px clamp(16px, 5vw, 64px) 90px', position: 'relative' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <Reveal>
            <SectionHeading
              eyebrow="What's inside"
              title="Everything the underground needs"
              subtitle="The only platform combining social discovery, AI agent automation, a creator marketplace, collab quests, and a living career graph — in one place."
            />
          </Reveal>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 20,
              marginTop: 48,
            }}
          >
            {PILLARS.map((p, i) => (
              <Reveal key={p.title} index={i} from="up">
                <Link to={p.to} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
                  <motion.div
                    whileHover={{ y: -5 }}
                    transition={{ duration: 0.18 }}
                    style={{
                      height: '100%',
                      padding: 26,
                      borderRadius: 18,
                      background: 'linear-gradient(160deg, rgba(18,16,11,0.85), rgba(10,9,6,0.8))',
                      border: '1px solid rgba(246,196,0,0.13)',
                      backdropFilter: 'blur(16px)',
                    }}
                  >
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        display: 'grid',
                        placeItems: 'center',
                        clipPath: 'polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%)',
                        background: 'linear-gradient(135deg, rgba(246,196,0,0.18), rgba(246,196,0,0.06))',
                        color: '#f6c400',
                        fontSize: 22,
                        fontWeight: 900,
                        marginBottom: 18,
                        filter: 'drop-shadow(0 0 10px rgba(246,196,0,0.3))',
                      }}
                    >
                      {p.glyph}
                    </div>
                    <h3
                      style={{
                        margin: '0 0 8px',
                        fontSize: 18,
                        fontWeight: 800,
                        color: 'var(--hive-text, #f5f3e7)',
                        fontFamily: 'var(--font-display, system-ui)',
                        letterSpacing: '0.01em',
                      }}
                    >
                      {p.title}
                    </h3>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--hive-muted, #a9a390)' }}>
                      {p.desc}
                    </p>
                  </motion.div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FOR EVERY CREATOR ═══ */}
      <section style={{ padding: '40px clamp(16px, 5vw, 64px) 90px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <Reveal>
            <SectionHeading align="center" eyebrow="Built for all of you" title="For every creator in the scene" />
          </Reveal>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 18,
              marginTop: 44,
            }}
          >
            {CREATORS.map((c, i) => (
              <Reveal key={c.label} index={i} from="scale">
                <div
                  style={{
                    textAlign: 'center',
                    padding: '30px 20px',
                    borderRadius: 16,
                    background: 'rgba(14,12,8,0.6)',
                    border: '1px solid rgba(246,196,0,0.1)',
                  }}
                >
                  <div style={{ fontSize: 30, marginBottom: 12 }}>{c.glyph}</div>
                  <div
                    style={{
                      fontSize: 17,
                      fontWeight: 800,
                      color: 'var(--hive-gold, #f6c400)',
                      fontFamily: 'var(--font-display, system-ui)',
                    }}
                  >
                    {c.label}
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--hive-muted, #a9a390)' }}>
                    {c.line}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ LIVE SOCIAL PROOF ═══ */}
      <section style={{ padding: '40px clamp(16px, 5vw, 64px) 90px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          {stats && (
            <Reveal>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 16,
                  padding: '32px 20px',
                  borderRadius: 18,
                  background: 'rgba(16,14,10,0.6)',
                  border: '1px solid rgba(246,196,0,0.12)',
                  marginBottom: 56,
                }}
                className="landing-stats-grid"
              >
                <StatBlock value={formatCount(stats.mixes_total)} label="Mixes" />
                <StatBlock value={formatCount(stats.voices_total)} label="Voices" />
                <StatBlock value={formatCount(stats.plays_total)} label="Plays" />
                <StatBlock value={formatCount(stats.live_now)} label="Live now" />
              </div>
            </Reveal>
          )}

          {mixes.length > 0 && (
            <>
              <Reveal>
                <SectionHeading eyebrow="Fresh from the hive" title="Now playing underground" />
              </Reveal>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: 18,
                  marginTop: 36,
                }}
              >
                {mixes.slice(0, 6).map((mix, i) => (
                  <Reveal key={mix.id} index={i} from="up">
                    <Link to={`/mix/${mix.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                      <motion.div
                        whileHover={{ y: -4 }}
                        transition={{ duration: 0.16 }}
                        style={{
                          borderRadius: 14,
                          overflow: 'hidden',
                          background: 'rgba(14,12,8,0.7)',
                          border: '1px solid rgba(246,196,0,0.12)',
                        }}
                      >
                        <div
                          style={{
                            height: 140,
                            background: mix.artwork_url
                              ? `url(${mix.artwork_url}) center/cover`
                              : 'linear-gradient(135deg, rgba(246,196,0,0.18), rgba(10,9,6,0.9))',
                            display: 'grid',
                            placeItems: 'center',
                          }}
                        >
                          {!mix.artwork_url && <BeeMark size={40} color="rgba(246,196,0,0.5)" />}
                        </div>
                        <div style={{ padding: '14px 16px' }}>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: 'var(--hive-text, #f5f3e7)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {mix.title}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--hive-muted, #a9a390)', marginTop: 3 }}>
                            @{mix.dj_username} · {formatCount(mix.play_count)} plays
                          </div>
                        </div>
                      </motion.div>
                    </Link>
                  </Reveal>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ═══ BIG CTA ═══ */}
      <section style={{ padding: '20px clamp(16px, 5vw, 64px) 100px' }}>
        <Reveal from="scale">
          <div
            style={{
              maxWidth: 1000,
              margin: '0 auto',
              padding: 'clamp(40px, 7vw, 80px) clamp(24px, 5vw, 64px)',
              borderRadius: 28,
              textAlign: 'center',
              background:
                'radial-gradient(ellipse at 50% 0%, rgba(246,196,0,0.16), rgba(10,9,6,0.9) 70%), linear-gradient(160deg, rgba(20,17,10,0.9), rgba(8,7,4,0.95))',
              border: '1px solid rgba(246,196,0,0.22)',
              boxShadow: '0 0 60px rgba(246,196,0,0.1)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <ParticleField count={24} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h2
                style={{
                  fontFamily: 'var(--font-display, system-ui)',
                  fontSize: 'clamp(32px, 6vw, 64px)',
                  lineHeight: 1,
                  margin: 0,
                  textTransform: 'uppercase',
                }}
              >
                <GlowText variant="gradient">Join the Hive</GlowText>
              </h2>
              <p
                style={{
                  margin: '18px auto 32px',
                  maxWidth: 520,
                  fontSize: 16,
                  lineHeight: 1.6,
                  color: 'var(--hive-text-soft, #d4cdb0)',
                }}
              >
                The scene is building itself a home. Claim your cell, drop your first
                mix, and start collaborating with the underground.
              </p>
              <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                <HiveButton variant="primary" size="lg" onClick={() => navigate('/register')}>
                  Create your account
                </HiveButton>
                <HiveButton variant="ghost" size="lg" onClick={() => navigate('/login')}>
                  Sign in
                </HiveButton>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer
        style={{
          borderTop: '1px solid rgba(246,196,0,0.12)',
          padding: '44px clamp(16px, 5vw, 64px)',
          background: 'rgba(5,5,4,0.6)',
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 24,
            flexWrap: 'wrap',
          }}
        >
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <BeeMark size={26} color="#f6c400" />
            <MixhiveWordmark height={16} color="var(--hive-text, #f5f3e7)" />
          </Link>
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
            {[
              { to: '/discover', label: 'Explore' },
              { to: '/hub', label: 'Features' },
              { to: '/hive-story', label: 'Hive Story' },
              { to: '/marketplace/gear', label: 'Marketplace' },
              { to: '/register', label: 'Join' },
            ].map(l => (
              <Link
                key={l.to}
                to={l.to}
                style={{
                  color: 'var(--hive-muted, #a9a390)',
                  textDecoration: 'none',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                {l.label}
              </Link>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--hive-dim, #6a624a)', fontFamily: 'var(--font-mono, monospace)' }}>
            © {new Date().getFullYear()} MixHive · The Hive Never Sleeps
          </div>
        </div>
      </footer>

      {/* responsive: collapse hero to one column, stack stats on mobile */}
      <style>{`
        @media (max-width: 860px) {
          .landing-hero-grid { grid-template-columns: 1fr !important; }
          .landing-hero-mascot { order: -1; }
          .landing-hero-mascot picture img { width: 280px !important; height: 280px !important; }
          .ecosystem-arrow { transform: rotate(90deg); }
        }
        @media (max-width: 560px) {
          .landing-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
