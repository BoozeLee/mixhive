import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

interface Props {
  height?: number;
  className?: string;
}

/**
 * Section divider — a row of honey droplets that lengthen as the user scrolls
 * past. Falls back to a static gradient stripe when prefers-reduced-motion is set.
 */
export function HoneyDripDivider({ height = 64, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const len = useTransform(scrollYProgress, [0, 1], [4, height - 6]);

  // 7 droplets spaced across the width
  const drops = [10, 22, 36, 50, 64, 78, 90];

  return (
    <div
      ref={ref}
      className={className}
      aria-hidden="true"
      style={{
        position: 'relative',
        width: '100%',
        height,
        overflow: 'hidden',
        marginBlock: 24,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, transparent 0%, rgba(246,196,0,0.06) 60%, transparent 100%)',
        }}
      />
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        {drops.map((cx, i) => (
          <motion.path
            key={cx}
            d={`M ${cx} 0 Q ${cx - 1.5} 4, ${cx} 8 Q ${cx + 1.5} 12, ${cx} 16`}
            stroke="var(--hive-gold, #f6c400)"
            strokeWidth="0.6"
            fill="none"
            style={{
              pathLength: 1,
              strokeDasharray: '1 0',
              filter: 'drop-shadow(0 0 2px rgba(246,196,0,0.55))',
            }}
            initial={{ scaleY: 0.2 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.6, delay: i * 0.04, ease: 'easeOut' }}
          />
        ))}
        <motion.line
          x1={50}
          y1={0}
          x2={50}
          y2={len}
          stroke="var(--hive-gold-hot, #ffd84a)"
          strokeWidth="0.4"
          style={{ opacity: 0.65 }}
        />
      </svg>
    </div>
  );
}
