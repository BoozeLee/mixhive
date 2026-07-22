import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from 'react-router-dom';
import { Icon } from './ui/Icon';
import { MixCard } from './MixCard';
import { Button } from './ui/Button';
import type { Mix } from '../lib/types';

interface MixGalleryProps {
  mixes: Mix[];
  currentUserId?: string;
  showControls?: boolean;
  className?: string;
}

export function MixGallery({
  mixes,
  currentUserId,
  showControls = true,
  className = '',
}: MixGalleryProps) {
  const t = useTranslations('mixGallery');
  const [filter, setFilter] = useState<'all' | 'published' | 'recent'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'plays' | 'likes'>('date');

  // Filter mixes based on current filter
  const filteredMixes = mixes.filter(mix => {
    if (filter === 'published') return mix.published;
    if (filter === 'recent') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return new Date(mix.created_at) >= sevenDaysAgo;
    }
    return true;
  });

  // Sort mixes based on current sort
  const sortedMixes = [...filteredMixes].sort((a, b) => {
    switch (sortBy) {
      case 'plays':
        return (b.play_count || 0) - (a.play_count || 0);
      case 'likes':
        return (b.like_count || 0) - (a.like_count || 0);
      case 'date':
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  if (mixes.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <div className="mb-4" style={{ display: 'inline-flex' }}>
          <Icon name="music" size={56} />
        </div>
        <h3 className="text-xl font-semibold text-gray-400 mb-2">{t('noMixesYet')}</h3>
        <p className="text-gray-500 text-sm">
          {currentUserId
            ? 'Start sharing your mixes with the community!'
            : "This DJ hasn't uploaded any mixes yet."}
        </p>
        {currentUserId && (
          <Link
            to="/upload"
            className="inline-block mt-4 bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            {t('uploadYourFirstMix')}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Controls */}
      {showControls && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              All ({mixes.length})
            </Button>
            <Button
              variant={filter === 'published' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFilter('published')}
            >
              Published ({mixes.filter(m => m.published).length})
            </Button>
            <Button
              variant={filter === 'recent' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFilter('recent')}
            >
              Recent Week (
              {
                mixes.filter(m => {
                  const sevenDaysAgo = new Date();
                  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                  return new Date(m.created_at) >= sevenDaysAgo;
                }).length
              }
              )
            </Button>
          </div>

          <div className="flex gap-2 items-center">
            <span className="text-sm text-gray-400">{t('sortBy')}</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as 'date' | 'plays' | 'likes')}
              className="bg-gray-700 text-white text-sm rounded px-3 py-1 border border-gray-600 focus:border-purple-500 focus:outline-none"
            >
              <option value="date">{t('newest')}</option>
              <option value="plays">{t('mostPlays')}</option>
              <option value="likes">{t('mostLikes')}</option>
            </select>
          </div>
        </div>
      )}

      {/* Mix Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {sortedMixes.map(mix => (
          <Link key={mix.id} to={`/mix/${mix.id}`} className="group block">
            <MixCard
              mix={{
                ...mix,
                dj_username: mix.dj?.username || 'unknown',
                dj_display_name: mix.dj?.display_name || mix.dj?.username || 'Unknown DJ',
                dj_avatar_url: mix.dj?.avatar_url || '',
                genre_name: mix.genre_name,
                weekly_plays: mix.weekly_plays || 0,
              }}
            />
          </Link>
        ))}
      </div>

      {/* Load More Button */}
      {showControls && filteredMixes.length > 8 && (
        <div className="text-center">
          <Button variant="secondary" size="lg" className="w-full sm:w-auto">
            {t('loadMoreMixes')}
          </Button>
        </div>
      )}
    </div>
  );
}
