import { useEffect, useState } from 'react'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import type { SearchFilters as SearchFiltersValue } from '../lib/search'
import { colors, radius, space } from '../styles/tokens'

interface SearchFiltersProps {
  filters: SearchFiltersValue
  onFiltersChange: (filters: SearchFiltersValue) => void
  onApply: () => void
  onReset: () => void
  isLoading?: boolean
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
]

export function SearchFilters({
  filters,
  onFiltersChange,
  onApply,
  onReset,
  isLoading = false,
}: SearchFiltersProps) {
  const [localFilters, setLocalFilters] = useState<SearchFiltersValue>(filters)

  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  function update(next: Partial<SearchFiltersValue>) {
    const updated = { ...localFilters, ...next }
    setLocalFilters(updated)
    onFiltersChange(updated)
  }

  function reset() {
    const resetFilters: SearchFiltersValue = { type: 'mixes' }
    setLocalFilters(resetFilters)
    onFiltersChange(resetFilters)
    onReset()
  }

  const hasActiveFilters = Boolean(
    localFilters.genre ||
      localFilters.duration ||
      localFilters.explicit !== undefined ||
      localFilters.type !== 'mixes',
  )

  return (
    <section
      aria-label="Search filters"
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.lg,
        padding: space[10],
        marginBottom: space[10],
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space[8], marginBottom: space[9] }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: colors.text.primary, margin: 0 }}>Filters</h2>
        <div style={{ display: 'flex', gap: space[6] }}>
          <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={!hasActiveFilters || isLoading}>
            Reset
          </Button>
          <Button type="button" size="sm" onClick={onApply} loading={isLoading}>
            Apply
          </Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: space[9] }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: colors.text.muted, marginBottom: space[5] }}>
            Content
          </label>
          <div style={{ display: 'flex', gap: space[4] }}>
            {(['mixes', 'profiles', 'all'] as const).map(type => (
              <Button
                key={type}
                type="button"
                variant={localFilters.type === type ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => update({ type })}
                style={{ flex: 1, textTransform: 'capitalize' }}
              >
                {type === 'profiles' ? 'DJs' : type}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="search-genre" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: colors.text.muted, marginBottom: space[5] }}>
            Genre
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
            <option value="">All genres</option>
            {genres.map(genre => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: colors.text.muted, marginBottom: space[5] }}>
            Duration
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: space[5] }}>
            <Input
              type="number"
              min={0}
              placeholder="Min"
              value={localFilters.duration?.min ?? ''}
              onChange={event => update({
                duration: {
                  min: event.target.value ? Number(event.target.value) : 0,
                  max: localFilters.duration?.max ?? 0,
                },
              })}
              style={{ width: 76 }}
            />
            <span style={{ color: colors.text.dim, fontSize: 12 }}>to</span>
            <Input
              type="number"
              min={0}
              placeholder="Max"
              value={localFilters.duration?.max ?? ''}
              onChange={event => update({
                duration: {
                  min: localFilters.duration?.min ?? 0,
                  max: event.target.value ? Number(event.target.value) : 0,
                },
              })}
              style={{ width: 76 }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: colors.text.muted, marginBottom: space[5] }}>
            Explicit
          </label>
          <div style={{ display: 'flex', gap: space[4] }}>
            <Button type="button" variant={localFilters.explicit === undefined ? 'primary' : 'secondary'} size="sm" onClick={() => update({ explicit: undefined })}>
              All
            </Button>
            <Button type="button" variant={localFilters.explicit === false ? 'primary' : 'secondary'} size="sm" onClick={() => update({ explicit: false })}>
              Clean
            </Button>
            <Button type="button" variant={localFilters.explicit === true ? 'primary' : 'secondary'} size="sm" onClick={() => update({ explicit: true })}>
              Explicit
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
