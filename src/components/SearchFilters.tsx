import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import type { SearchFilters as SearchFiltersValue } from '../lib/search';
import { colors, radius, space } from '../styles/tokens';

interface SearchFiltersProps {
  filters: SearchFiltersValue;
  onFiltersChange: (filters: SearchFiltersValue) => void;
  onApply: () => void;
  onReset: () => void;
  isLoading?: boolean;
}

const genres = [
  'House',
  'Techno',
  'Deep House',
  'Tech House',
  'Trance',
  'Progressive House',
  'Minimal',
  'Dubstep',
  'Drum and Bass',
  'Disco',
  'Afro House',
  'Hard Dance',
  'UK Garage',
  'Breakbeat',
];

export function SearchFilters({
  filters,
  onFiltersChange,
  onApply,
  onReset,
  isLoading = false,
}: SearchFiltersProps) {
  const t = useTranslations('searchFilters');
  const [localFilters, setLocalFilters] = useState<SearchFiltersValue>(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  function update(next: Partial<SearchFiltersValue>) {
    const updated = { ...localFilters, ...next };
    setLocalFilters(updated);
    onFiltersChange(updated);
  }

  function reset() {
    const resetFilters: SearchFiltersValue = { type: 'all' };
    setLocalFilters(resetFilters);
    onFiltersChange(resetFilters);
    onReset();
  }

  const hasActiveFilters = Boolean(
    localFilters.genre || localFilters.location || localFilters.type !== 'all'
  );

  return (
    <section
      aria-label={t('searchFilters')}
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.lg,
        padding: space[10],
        marginBottom: space[10],
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: space[8],
          marginBottom: space[9],
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, color: colors.text.primary, margin: 0 }}>
          {t('filters')}
        </h2>
        <div style={{ display: 'flex', gap: space[6] }}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={reset}
            disabled={!hasActiveFilters || isLoading}
          >
            {t('reset')}
          </Button>
          <Button type="button" size="sm" onClick={onApply} loading={isLoading}>
            {t('apply')}
          </Button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: space[9],
        }}
      >
        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: colors.text.muted,
              marginBottom: space[5],
            }}
          >
            {t('content')}
          </legend>
          <div style={{ display: 'flex', gap: space[4] }}>
            {(['all', 'mixes', 'profiles', 'scenes'] as const).map(type => (
              <Button
                key={type}
                type="button"
                variant={localFilters.type === type ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => update({ type })}
                style={{ flex: 1, textTransform: 'capitalize' }}
              >
                {type === 'profiles' ? 'Artists' : type}
              </Button>
            ))}
          </div>
        </fieldset>

        <div>
          <label
            htmlFor="search-genre"
            style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: colors.text.muted,
              marginBottom: space[5],
            }}
          >
            {t('genre')}
          </label>
          <select
            id="search-genre"
            value={localFilters.genre || ''}
            onChange={event => update({ genre: event.target.value || undefined })}
            style={{
              width: '100%',
              height: 32,
              background: colors.bg,
              color: colors.text.primary,
              border: `1px solid ${colors.borderStrong}`,
              borderRadius: radius.md,
              padding: '0 10px',
              font: 'inherit',
            }}
          >
            <option value="">{t('allGenres')}</option>
            {genres.map(genre => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="search-location"
            style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: colors.text.muted,
              marginBottom: space[5],
            }}
          >
            {t('location')}
          </label>
          <Input
            id="search-location"
            placeholder={t('cityOrCountry')}
            value={localFilters.location || ''}
            onChange={event => update({ location: event.target.value || undefined })}
          />
        </div>
      </div>
    </section>
  );
}
