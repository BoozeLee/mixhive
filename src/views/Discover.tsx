import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTrending } from '../lib/api';
import { getPopularSearches } from '../lib/search';
import { MixCard } from '../components/MixCard';
import type { FeedMix } from '../lib/types';
import { colors, radius, space } from '../styles/tokens';

export function Discover() {
  const [mixes, setMixes] = useState<FeedMix[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getTrending(12)
      .then(result => {
        if (!cancelled) setMixes(result.data);
      })
      .catch(error => {
        console.error('Error fetching discover data:', error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const genres = getPopularSearches().slice(0, 10);

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 96px' }}>
      <header style={{ marginBottom: space[10] }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: colors.text.primary, margin: 0 }}>
          Discover
        </h1>
        <p style={{ color: colors.text.muted, fontSize: 16, margin: '8px 0 0' }}>
          Explore trending mixes and popular search lanes.
        </p>
      </header>

      <section style={{ marginBottom: space[12] }}>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: colors.text.primary,
            marginBottom: space[4],
          }}
        >
          Trending Mixes
        </h2>
        {loading ? (
          <div style={{ display: 'grid', gap: space[4] }}>
            {[1, 2, 3].map(index => (
              <div
                key={index}
                style={{
                  height: 98,
                  background: colors.surface,
                  borderRadius: radius.lg,
                  border: `1px solid ${colors.border}`,
                }}
              />
            ))}
          </div>
        ) : mixes.length === 0 ? (
          <p style={{ color: colors.text.dim, fontSize: 14 }}>No trending mixes yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: space[4] }}>
            {mixes.map(mix => (
              <MixCard key={mix.id} mix={mix} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: colors.text.primary,
            marginBottom: space[4],
          }}
        >
          Popular Genres
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[4] }}>
          {genres.map(genre => (
            <Link
              key={genre}
              to={`/search?q=${encodeURIComponent(genre)}`}
              style={{
                display: 'inline-flex',
                padding: '8px 12px',
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: radius.md,
                color: colors.text.secondary,
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {genre}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
