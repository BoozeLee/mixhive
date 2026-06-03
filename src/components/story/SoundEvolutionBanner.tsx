import React from 'react';
import { colors, fontSize, fontWeight } from '@/styles/tokens';
import { getGenreColor } from '@/styles/tokens';

export interface EvolutionData {
  earlyGenre?: string | null;
  recentGenre?: string | null;
  earlyTags?: string;
  recentTags?: string;
  score?: number;
  narrative?: string | null;
}

function evolutionLabel(score?: number): string {
  if (score === undefined) return 'Analysing…';
  if (score >= 0.9) return 'Consistent';
  if (score >= 0.7) return 'Evolving';
  if (score >= 0.5) return 'Transitioning';
  return 'Transformed';
}

interface SoundEvolutionBannerProps {
  evolution: EvolutionData | null;
  loading?: boolean;
}

export function SoundEvolutionBanner({ evolution, loading }: SoundEvolutionBannerProps) {
  const height = 100;
  const svgW = 900;
  const svgH = 60;

  if (loading || !evolution) {
    return (
      <div
        className="skeleton"
        style={{ height, borderRadius: 8 }}
        aria-label="Sound evolution loading"
      />
    );
  }

  const earlyColor = getGenreColor(evolution.earlyGenre);
  const recentColor = getGenreColor(evolution.recentGenre);
  const label = evolutionLabel(evolution.score);

  // Sine-wave path for waveform clip effect
  const points: string[] = [];
  for (let x = 0; x <= svgW; x += 4) {
    const y = svgH / 2 + Math.sin((x / svgW) * Math.PI * 6) * (svgH / 3);
    points.push(`${x},${y}`);
  }
  const wavePath = `M 0 ${svgH} L ${points.join(' L ')} L ${svgW} ${svgH} Z`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          position: 'relative',
          height: svgH,
          borderRadius: 8,
          overflow: 'hidden',
          background: `linear-gradient(to right, ${earlyColor}, ${recentColor})`,
        }}
      >
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.25 }}
          aria-hidden="true"
        >
          <path d={wavePath} fill={colors.bg} />
        </svg>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingInline: 4,
        }}
      >
        <span
          style={{
            fontSize: fontSize.xs,
            color: colors.text.dim,
            maxWidth: '30%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          Early: {evolution.earlyTags ?? evolution.earlyGenre ?? '—'}
        </span>
        <span
          style={{
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
            color: colors.accent,
            padding: '2px 10px',
            border: `1px solid ${colors.accentMuted}`,
            borderRadius: 999,
            background: colors.accentFaint,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: fontSize.xs,
            color: colors.text.dim,
            maxWidth: '30%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textAlign: 'right',
          }}
        >
          Now: {evolution.recentTags ?? evolution.recentGenre ?? '—'}
        </span>
      </div>
    </div>
  );
}
