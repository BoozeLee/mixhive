import React from 'react';
import { colors } from '@/styles/tokens';

interface WaveformAccentProps {
  playing?: boolean;
  bars?: number;
  color?: string;
  height?: number;
  seedId?: string;
}

function seedRandom(seed: string, index: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  h = (Math.imul(17, h) + index) | 0;
  return Math.abs(h % 100) / 100;
}

export function WaveformAccent({
  playing = false,
  bars = 12,
  color = colors.accent,
  height = 16,
  seedId = 'default',
}: WaveformAccentProps) {
  const barWidth = 2;
  const gap = 1;
  const totalWidth = bars * (barWidth + gap) - gap;

  return (
    <svg
      width={totalWidth}
      height={height}
      viewBox={`0 0 ${totalWidth} ${height}`}
      aria-hidden="true"
      style={{ display: 'block', overflow: 'visible' }}
    >
      {Array.from({ length: bars }).map((_, i) => {
        const staticHeight = Math.max(0.2, 0.3 + seedRandom(seedId, i) * 0.7);
        const x = i * (barWidth + gap);
        const barH = staticHeight * height;
        const y = (height - barH) / 2;
        const delay = `${i * 50}ms`;

        return (
          <rect
            key={i}
            className={playing ? 'eq-bar' : undefined}
            x={x}
            y={y}
            width={barWidth}
            height={barH}
            rx={1}
            fill={color}
            style={
              playing
                ? {
                    transformOrigin: `${x + barWidth / 2}px ${height / 2}px`,
                    animationName: 'eq-bar',
                    animationDuration: '800ms',
                    animationTimingFunction: 'ease-in-out',
                    animationIterationCount: 'infinite',
                    animationDelay: delay,
                  }
                : undefined
            }
          />
        );
      })}
    </svg>
  );
}
