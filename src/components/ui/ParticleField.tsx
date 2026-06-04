import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { prefersReducedMotion } from '../../lib/motion';

interface Props {
  /** Number of motes. Kept low for GPU cheapness. */
  count?: number;
  /** Color of the motes. */
  color?: string;
  style?: CSSProperties;
}

interface Mote {
  x: number;
  y: number;
  r: number;
  vy: number;
  vx: number;
  a: number;
  tw: number;
}

/**
 * Ambient drifting honey-mote field rendered on a single <canvas>. Cheap:
 * ~36 alpha-blended circles, capped DPR, pauses when offscreen. Under
 * prefers-reduced-motion it renders one static frame and stops — no animation.
 */
export function ParticleField({ count = 36, color = '246,196,0', style }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = prefersReducedMotion();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let raf = 0;
    const motes: Mote[] = [];

    function resize() {
      const parent = canvas!.parentElement;
      if (!parent) return;
      w = parent.clientWidth;
      h = parent.clientHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function seed() {
      motes.length = 0;
      for (let i = 0; i < count; i++) {
        motes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 0.6 + Math.random() * 2.2,
          vy: -(0.08 + Math.random() * 0.32),
          vx: (Math.random() - 0.5) * 0.18,
          a: 0.12 + Math.random() * 0.4,
          tw: Math.random() * Math.PI * 2,
        });
      }
    }

    function draw(animate: boolean) {
      ctx!.clearRect(0, 0, w, h);
      for (const m of motes) {
        if (animate) {
          m.y += m.vy;
          m.x += m.vx;
          m.tw += 0.02;
          if (m.y < -6) {
            m.y = h + 6;
            m.x = Math.random() * w;
          }
          if (m.x < -6) m.x = w + 6;
          if (m.x > w + 6) m.x = -6;
        }
        const flicker = animate ? 0.6 + 0.4 * Math.sin(m.tw) : 1;
        ctx!.beginPath();
        ctx!.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${color},${m.a * flicker})`;
        ctx!.fill();
      }
    }

    resize();
    seed();

    if (reduced) {
      draw(false);
      return;
    }

    let visible = true;
    const io = new IntersectionObserver(
      entries => {
        visible = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0 }
    );
    io.observe(canvas);

    function loop() {
      if (visible) draw(true);
      raf = requestAnimationFrame(loop);
    }
    loop();

    const onResize = () => {
      resize();
      seed();
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [count, color]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        ...style,
      }}
    />
  );
}
