import React, { type CSSProperties, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { DURATION, EASE_OUT } from '../../lib/motion';

interface Props {
  children: ReactNode;
  /** Stagger index — multiplies the base delay for sequenced reveals. */
  index?: number;
  /** Animation direction. */
  from?: 'up' | 'down' | 'left' | 'right' | 'scale';
  delay?: number;
  style?: CSSProperties;
}

const OFFSET: Record<NonNullable<Props['from']>, { x?: number; y?: number; scale?: number }> = {
  up: { y: 28 },
  down: { y: -28 },
  left: { x: -28 },
  right: { x: 28 },
  scale: { scale: 0.94 },
};

/**
 * Scroll-reveal wrapper. Fades + translates content into view once.
 * Framer's `whileInView` + viewport.once handles the IntersectionObserver,
 * and reduces to a simple fade under prefers-reduced-motion via MotionConfig.
 * Uses inline `style` to match the repo's motion-component convention.
 */
export function Reveal({ children, index = 0, from = 'up', delay = 0, style = {} }: Props) {
  const offset = OFFSET[from];

  return (
    <motion.div
      style={style as NonNullable<React.ComponentProps<typeof motion.div>['style']>}
      initial={{ opacity: 0, ...offset }}
      whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: DURATION.lg, ease: EASE_OUT, delay: delay + index * 0.07 }}
    >
      {children}
    </motion.div>
  );
}
