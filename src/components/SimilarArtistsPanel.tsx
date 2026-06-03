import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { SkeletonBar } from '@/components/Skeleton';
import { getGenreColor } from '@/styles/tokens';
import { colors, fontSize, fontWeight, radius, space } from '@/styles/tokens';

interface SimilarArtist {
  profile_id: string;
  username: string;
  similarity: number;
  genre_tags: string[] | null;
}

export function SimilarArtistsPanel({ profileId }: { profileId: string }) {
  const [artists, setArtists] = useState<SimilarArtist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !profileId) {
      setLoading(false);
      return;
    }
    supabase
      .rpc('find_similar_artists', { p_profile_id: profileId, p_k: 3 })
      .then(({ data }) => {
        setArtists((data ?? []) as SimilarArtist[]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [profileId]);

  if (loading) {
    return (
      <div style={{ marginTop: space[10] }}>
        <h3
          style={{
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
            color: colors.text.secondary,
            marginBottom: space[6],
          }}
        >
          Similar DJs
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[0, 1, 2].map(i => (
            <SkeletonBar key={i} height={52} style={{ borderRadius: 8 }} />
          ))}
        </div>
      </div>
    );
  }

  if (artists.length === 0) return null;

  return (
    <div style={{ marginTop: space[10] }}>
      <h3
        style={{
          fontSize: fontSize.sm,
          fontWeight: fontWeight.semibold,
          color: colors.text.secondary,
          marginBottom: space[6],
        }}
      >
        Similar DJs
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {artists.map(a => (
          <Link key={a.profile_id} to={`/u/${a.username}`} style={{ textDecoration: 'none' }}>
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
              {/* Avatar placeholder with genre color */}
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: getGenreColor(a.genre_tags?.[0]),
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0a0a0a',
                  fontSize: 13,
                  fontWeight: fontWeight.bold,
                }}
              >
                {a.username[0]?.toUpperCase() ?? '?'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    color: colors.text.primary,
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.semibold,
                  }}
                >
                  {a.username}
                </div>
                {a.genre_tags && a.genre_tags.length > 0 && (
                  <div style={{ color: colors.text.dim, fontSize: 11, marginTop: 2 }}>
                    {a.genre_tags.slice(0, 3).join(' · ')}
                  </div>
                )}
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: fontWeight.semibold,
                  color: colors.accent,
                  background: `${colors.accent}18`,
                  padding: '2px 7px',
                  borderRadius: radius.pill,
                  flexShrink: 0,
                }}
              >
                {Math.round(a.similarity * 100)}% match
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
