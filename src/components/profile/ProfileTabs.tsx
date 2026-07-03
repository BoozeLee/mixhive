import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '../ui/Icon';
import { colors, fontSize, fontWeight, radius, space, transition } from '../../styles/tokens';

export type ProfileTab =
  | 'mixes'
  | 'buzzes'
  | 'playlists'
  | 'story'
  | 'activity'
  | 'agents'
  | 'events'
  | 'about';

interface TabConfig {
  id: ProfileTab;
  label: string;
  count?: number;
  icon: 'mix' | 'buzz' | 'music' | 'story' | 'feed' | 'agents' | 'events' | 'profile';
}

interface ProfileTabsProps {
  tabs: TabConfig[];
  activeTab: ProfileTab;
  onChange: (tab: ProfileTab) => void;
}

export function ProfileTabs({ tabs, activeTab, onChange }: ProfileTabsProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const urlTab = searchParams.get('tab') as ProfileTab | null;
    if (urlTab && urlTab !== activeTab && tabs.some(t => t.id === urlTab)) {
      onChange(urlTab);
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClick(tab: ProfileTab) {
    onChange(tab);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  }

  return (
    <div
      role="tablist"
      aria-label="Profile sections"
      style={{
        display: 'flex',
        gap: 4,
        marginBottom: space[8],
        background: colors.surface,
        borderRadius: radius.lg,
        padding: 4,
        border: `1px solid ${colors.border}`,
        overflowX: 'auto',
        scrollbarWidth: 'none',
      }}
    >
      {tabs.map(({ id, label, count, icon }) => (
        <button
          key={id}
          role="tab"
          aria-selected={activeTab === id}
          onClick={() => handleClick(id)}
          style={{
            flex: '1 0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: space[3],
            padding: `${space[4]}px ${space[5]}px`,
            borderRadius: radius.md,
            border: 'none',
            background: activeTab === id ? colors.accent : 'transparent',
            color: activeTab === id ? colors.bg : colors.text.muted,
            fontWeight: activeTab === id ? fontWeight.bold : fontWeight.normal,
            cursor: 'pointer',
            fontSize: fontSize.sm,
            transition: transition.fast,
            whiteSpace: 'nowrap',
          }}
        >
          <Icon name={icon} size={14} color="currentColor" />
          {label}
          {count !== undefined && (
            <span
              style={{
                fontSize: fontSize.xs,
                padding: '1px 6px',
                borderRadius: radius.pill,
                background: activeTab === id ? 'rgba(0,0,0,0.2)' : colors.border,
                color: activeTab === id ? colors.bg : colors.text.muted,
              }}
            >
              {count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
