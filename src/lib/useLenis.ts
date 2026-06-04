import { useEffect } from 'react';
import Lenis from 'lenis';
import { prefersReducedMotion } from './motion';

/**
 * Mounts a single global Lenis smooth-scroll instance for the app.
 * Call once near the root (MixHiveClient). Disabled when the user prefers
 * reduced motion, when touch scrolling (Lenis can fight native momentum on
 * mobile, so we keep native there), or during SSR.
 */
export function useLenis() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (prefersReducedMotion()) return;
    // Keep native scroll on coarse pointers (mobile/tablet) for best feel.
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const lenis = new Lenis({
      duration: 1.05,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.5,
    });

    let rafId = 0;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);
}
