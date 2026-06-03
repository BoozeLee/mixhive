import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { SkeletonBar } from '@/components/Skeleton';
import { BpmChip } from '@/components/BpmChip';
import { KeyChip } from '@/components/KeyChip';
import { getGenreColor } from '@/styles/tokens';
import { colors, fontSize, fontWeight, radius, space } from '@/styles/tokens';

interface SimilarMix {
  mix_id: string;
  title: string;
  artist: string;
  similarity: number;
  bpm: number | null;
  camelot: string | null;
  genre: string | null;
}

export function SimilarMixesPanel({ mixId }: { mixId: string }) {
  const [mixes, setMixes] = useState<SimilarMix[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !mixId) {
      setLoading(false);
      return;
    }
    supabase
      .rpc('find_similar_mixes', { p_mix_id: mixId, p_k: 4 })
      .then(({ data }) => {
        setMixes((data ?? []) as SimilarMix[]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [mixId]);

  if (loading) {
    return (
      <div style={{ marginTop: 32 }}>
        <h3
          style={{
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
            color: colors.text.secondary,
            marginBottom: 12,
          }}
        >
          Similar Vibes
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1, 2].map(i => (
            <SkeletonBar key={i} height={56} style={{ borderRadius: 8 }} />
          ))}
        </div>
      </div>
    );
  }

  if (mixes.length === 0) return null;

  return (
    <div style={{ marginTop: 32 }}>
      <h3
        style={{
          fontSize: fontSize.sm,
          fontWeight: fontWeight.semibold,
          color: colors.text.secondary,
          marginBottom: 12,
        }}
      >
        Similar Vibes
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {mixes.map(m => (
          <Link key={m.mix_id} to={`/mix/${m.mix_id}`} style={{ textDecoration: 'none' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: space[6],
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: radius.md,
                padding: `${space[5]}px ${space[6]}px`,
                transition: 'border-color 120ms',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = colors.accent)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = colors.border)}
            >
              {/* Genre accent stripe */}
              <div
                aria-hidden="true"
                style={{
                  width: 3,
                  height: 36,
                  borderRadius: 2,
                  background: getGenreColor(m.genre),
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    color: colors.text.primary,
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.semibold,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {m.title}
                </div>
                <div style={{ color: colors.text.muted, fontSize: 12 }}>{m.artist}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: space[4], flexShrink: 0 }}>
                {m.bpm && <BpmChip bpm={m.bpm} />}
                {m.camelot && <KeyChip keyCamelot={m.camelot} />}
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: fontWeight.semibold,
                    color: colors.accent,
                    background: `${colors.accent}18`,
                    padding: '2px 7px',
                    borderRadius: radius.pill,
                    whiteSpace: 'nowrap',
                  }}
                >
                  ↑ {Math.round(m.similarity * 100)}%
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
