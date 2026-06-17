import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getAgentName, getMixesByAgent } from '../lib/api';
import type { Mix } from '../lib/types';
import { MixCard } from '../components/MixCard';
import { EmptyState } from '../components/EmptyState';
import { SkeletonBar } from '../components/Skeleton';
import { colors, space } from '../styles/tokens';

export function AgentTracks() {
  const { slug } = useParams<{ slug: string }>();
  const [mixes, setMixes] = useState<Mix[]>([]);
  const [agentName, setAgentName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([getMixesByAgent(slug), getAgentName(slug)])
      .then(([rows, name]) => {
        if (cancelled) return;
        setMixes(rows);
        setAgentName(name);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const heading = agentName || slug || 'agent';

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px 12px 96px' }}>
      <header style={{ marginBottom: space[9] }}>
        <div style={{ color: colors.accent, fontSize: 12, fontWeight: 700, letterSpacing: 0.4 }}>
          ✦ AI BAND
        </div>
        <h1 style={{ margin: '4px 0 0', fontSize: 26, color: colors.text.primary }}>
          Tracks featuring {heading}
        </h1>
      </header>

      {loading ? (
        <div style={{ display: 'grid', gap: space[5] }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBar key={i} height={96} />
          ))}
        </div>
      ) : mixes.length === 0 ? (
        <EmptyState
          icon="✦"
          title="No tracks yet"
          body={`No published tracks credit ${heading} as an AI band member yet.`}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[6] }}>
          {mixes.map(mix => (
            <MixCard
              key={mix.id}
              mix={{
                ...mix,
                dj_username: mix.dj?.username || '',
                dj_display_name: mix.dj?.display_name || mix.dj?.username || '',
                dj_avatar_url: mix.dj?.avatar_url || '',
                genre_name: mix.genre_name || null,
                weekly_plays: mix.weekly_plays || 0,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
