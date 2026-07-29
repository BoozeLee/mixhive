import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '../hooks/useAuth';
import { listAIAgents, type AIAgent } from '../lib/api';
import { AIAgentCard } from '../components/AIAgentCard';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { Button } from '../components/ui/Button';
import { colors, fontSize, fontWeight, radius, space } from '../styles/tokens';

type Sort = 'followers' | 'mixes' | 'credibility';

export function AIBandIndex() {
  const t = useTranslations('aiBand');
  const { user } = useAuth();
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('followers');
  const [selectedGenre, setSelectedGenre] = useState<string>('');

  function load() {
    setLoading(true);
    setError(null);
    listAIAgents(50)
      .then(a => {
        setAgents(a);
        setLoading(false);
      })
      .catch(() => { setError('Failed to load AI agents'); setLoading(false); });
  }

  useEffect(() => {
    load();
  }, []);

  const allGenres = useMemo(() => {
    const genreSet = new Set<string>();
    agents.forEach(a => (a.genres ?? []).forEach(g => genreSet.add(g)));
    return Array.from(genreSet).sort();
  }, [agents]);

  const sorted = useMemo(() => {
    let list = [...agents];
    if (selectedGenre) {
      list = list.filter(a => (a.genres ?? []).includes(selectedGenre));
    }
    if (sort === 'followers') return list.sort((a, b) => b.followers_count - a.followers_count);
    if (sort === 'credibility') return list.sort((a, b) => b.mixes_credited - a.mixes_credited);
    return list.sort((a, b) => b.mixes_credited - a.mixes_credited);
  }, [agents, sort, selectedGenre]);

  if (error) {
    return (
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: colors.text.primary }}>{t('title')}</h1>
          <p style={{ color: colors.text.dim, fontSize: 13, margin: '6px 0 0' }}>{t('subtitle')}</p>
        </div>
        <div style={{ textAlign: 'center', padding: 40, color: colors.danger }}>
          <p>{error}</p>
          <Button variant="primary" size="md" onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: space[4],
          marginBottom: space[8],
        }}
      >
        <div>
          <h1
            style={{
              fontSize: fontSize['2xl'],
              fontWeight: fontWeight.bold,
              color: colors.text.primary,
              margin: 0,
            }}
          >
            {t('title')}
          </h1>
          <p style={{ fontSize: fontSize.md, color: colors.text.muted, marginTop: 6 }}>
            {t('subtitle')}
          </p>
        </div>

        {/* Sort toggle */}
        <div
          role="group"
          aria-label={t('sortLabel')}
          style={{
            display: 'flex',
            gap: 2,
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: 2,
          }}
        >
          {(['followers', 'credibility'] as const).map(value => (
            <button
              key={value}
              type="button"
              aria-pressed={sort === value}
              onClick={() => setSort(value)}
              style={{
                padding: '6px 14px',
                borderRadius: radius.sm,
                border: 'none',
                background: sort === value ? colors.accent : 'transparent',
                color: sort === value ? colors.bg : colors.text.muted,
                fontSize: fontSize.sm,
                fontWeight: sort === value ? fontWeight.semibold : fontWeight.normal,
                cursor: 'pointer',
              }}
            >
              {value === 'followers' ? t('sortFollowers') : t('sortCredibility')}
            </button>
          ))}
        </div>
      </div>

      {/* Genre filter pills */}
      {allGenres.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            marginBottom: space[6],
          }}
        >
          <button
            type="button"
            onClick={() => setSelectedGenre('')}
            style={{
              padding: '4px 12px',
              borderRadius: radius.pill,
              border: `1px solid ${!selectedGenre ? colors.accent : colors.border}`,
              background: !selectedGenre ? colors.accent : 'transparent',
              color: !selectedGenre ? colors.bg : colors.text.muted,
              fontSize: fontSize.xs,
              fontWeight: !selectedGenre ? fontWeight.bold : fontWeight.normal,
              cursor: 'pointer',
            }}
          >
            {t('allGenres')}
          </button>
          {allGenres.map(genre => (
            <button
              key={genre}
              type="button"
              onClick={() => setSelectedGenre(selectedGenre === genre ? '' : genre)}
              style={{
                padding: '4px 12px',
                borderRadius: radius.pill,
                border: `1px solid ${selectedGenre === genre ? colors.accent : colors.border}`,
                background: selectedGenre === genre ? colors.accent : 'transparent',
                color: selectedGenre === genre ? colors.bg : colors.text.muted,
                fontSize: fontSize.xs,
                fontWeight: selectedGenre === genre ? fontWeight.bold : fontWeight.normal,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {genre}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <LoadingSpinner />
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState title={t('emptyTitle')} body={t('emptyBody')} />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: space[5],
          }}
        >
          {sorted.map(agent => (
            <AIAgentCard
              key={agent.id}
              agent={agent}
              currentUserId={user?.id}
              onFollowToggle={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}
