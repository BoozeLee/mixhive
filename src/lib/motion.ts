// Shared motion vocabulary for MixHive.
//
// Division of labour:
//   • Framer Motion  → component-level state (hover, tap, presence, in-view reveals)
//   • GSAP + Lenis   → page-level choreography (scroll timelines, pinned hero)
//
// All consumers must respect prefers-reduced-motion. Use `prefersReducedMotion()`
// before kicking off any non-essential animation.

import type { Variants } from 'framer-motion';

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

export const DURATION = {
  xs: 0.12,
  sm: 0.18,
  md: 0.28,
  lg: 0.45,
  xl: 0.7,
} as const;

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ─── Framer variants ──────────────────────────────────────────────────────────

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: DURATION.lg, ease: EASE_OUT } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION.md, ease: EASE_OUT } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  visible: { opacity: 1, scale: 1, transition: { duration: DURATION.md, ease: EASE_OUT } },
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -28 },
  visible: { opacity: 1, x: 0, transition: { duration: DURATION.lg, ease: EASE_OUT } },
};

export const stagger = (childDelay = 0.07, initial = 0.05): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: childDelay, delayChildren: initial } },
});

export const glowPulse: Variants = {
  rest: { filter: 'drop-shadow(0 0 6px rgba(246,196,0,0.25))' },
  pulse: {
    filter: [
      'drop-shadow(0 0 6px rgba(246,196,0,0.25))',
      'drop-shadow(0 0 18px rgba(246,196,0,0.55))',
      'drop-shadow(0 0 6px rgba(246,196,0,0.25))',
    ],
    transition: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' },
  },
};

// in-view defaults for <motion.* whileInView>
export const inViewProps = {
  initial: 'hidden' as const,
  whileInView: 'visible' as const,
  viewport: { once: true, margin: '-80px' },
};
