import { useTranslations } from 'next-intl';
import { Icon } from '../ui/Icon';
import { colors, fontSize, fontWeight, radius, space, transition } from '../../styles/tokens';

interface AgentFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
}

export function AgentFilters({
  search,
  onSearchChange,
  category,
  onCategoryChange,
}: AgentFiltersProps) {
  const t = useTranslations('agentsGallery');

  const categories = [
    { id: 'all', label: t('allCategories') },
    { id: 'social', label: t('categorySocial') },
    { id: 'growth', label: t('categoryGrowth') },
    { id: 'discovery', label: t('categoryDiscovery') },
    { id: 'release', label: t('categoryRelease') },
    { id: 'moderation', label: t('categoryModeration') },
    { id: 'schedule', label: t('categorySchedule') },
  ];

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: space[4], marginBottom: space[8] }}
    >
      <div style={{ position: 'relative' }}>
        <span
          style={{
            position: 'absolute',
            left: space[4],
            top: '50%',
            transform: 'translateY(-50%)',
            color: colors.text.dim,
            lineHeight: 0,
          }}
        >
          <Icon name="search" size={16} color="currentColor" />
        </span>
        <input
          type="text"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder={t('searchPlaceholder')}
          style={{
            width: '100%',
            padding: `${space[4]}px ${space[4]}px ${space[4]}px ${space[10]}px`,
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.lg,
            color: colors.text.primary,
            fontSize: fontSize.md,
            outline: 'none',
            transition: `border-color ${transition.fast}`,
          }}
          onFocus={e => (e.currentTarget.style.borderColor = colors.accentMuted)}
          onBlur={e => (e.currentTarget.style.borderColor = colors.border)}
        />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[3] }}>
        {categories.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onCategoryChange(id)}
            style={{
              padding: `${space[3]}px ${space[5]}px`,
              borderRadius: radius.pill,
              border: `1px solid ${category === id ? colors.accent : colors.borderStrong}`,
              background: category === id ? colors.accent : colors.surface,
              color: category === id ? colors.bg : colors.text.secondary,
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              cursor: 'pointer',
              transition: `border-color ${transition.fast}, background ${transition.fast}, color ${transition.fast}`,
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
