import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useMessages } from '../lib/messagesStore';
import { Logo } from './Logo';
import { Icon, HexIcon } from './ui/Icon';
import type { IconKey } from '../lib/icons';
import { colors, space, transition, fontSize, fontWeight } from '../styles/tokens';

interface SidebarItem {
  path: string;
  icon: IconKey;
  label: string;
  ariaLabel: string;
  highlight?: boolean;
}

const topItems: SidebarItem[] = [
  {
    path: '/feed?compose=1',
    icon: 'buzz',
    label: 'Buzz',
    ariaLabel: 'Post a Buzz',
    highlight: true,
  },
  { path: '/dashboard', icon: 'dashboard', label: 'Dashboard', ariaLabel: 'Creator dashboard' },
  { path: '/feed', icon: 'feed', label: 'Feed', ariaLabel: 'Hive Feed' },
  { path: '/discover', icon: 'discover', label: 'Explore', ariaLabel: 'Explore MixHive' },
  { path: '/scenes', icon: 'events', label: 'Scenes', ariaLabel: 'Scene communities' },
  { path: '/events', icon: 'events', label: 'Events', ariaLabel: 'Events and raves' },
  { path: '/live-rooms', icon: 'session', label: 'Live Rooms', ariaLabel: 'Live audio rooms' },
  { path: '/search', icon: 'network', label: 'Network', ariaLabel: 'Hive Radar' },
  { path: '/opportunities', icon: 'events', label: 'Opportunities', ariaLabel: 'Opportunity Hub' },
  {
    path: '/collab-quests',
    icon: 'sparkles',
    label: 'Collab Quests',
    ariaLabel: 'Collaboration quests',
  },
  { path: '/epk', icon: 'epk', label: 'EPK', ariaLabel: 'Press Kit Studio' },
  { path: '/upload', icon: 'upload', label: 'Upload', ariaLabel: 'Nectar Upload' },
  { path: '/studio/art', icon: 'visual', label: 'Art Studio', ariaLabel: 'Art Studio' },
  { path: '/studio/avatar', icon: 'camera', label: 'Avatar Studio', ariaLabel: 'Avatar Studio' },
  { path: '/agents/inbox', icon: 'inbox', label: 'Inbox', ariaLabel: 'Agent Inbox' },
  { path: '/messages', icon: 'messages', label: 'Messages', ariaLabel: 'Direct messages' },
  { path: '/agents/gallery', icon: 'agents', label: 'BeeCast', ariaLabel: 'BeeCast agents' },
  { path: '/ai-band', icon: 'agents', label: 'AI Band', ariaLabel: 'AI Band agents' },
  { path: '/marketplace/gear', icon: 'gear', label: 'Gear Market', ariaLabel: 'Gear marketplace' },
  { path: '/leaderboard', icon: 'star', label: 'Leaderboard', ariaLabel: 'XP Leaderboard' },
  { path: '/quests', icon: 'quests', label: 'Quests', ariaLabel: 'Mythic Quest Lines' },
  { path: '/rituals', icon: 'mythic', label: 'Rituals', ariaLabel: 'Live mythic rituals' },
  { path: '/scene-radar', icon: 'radar', label: 'Radar', ariaLabel: 'Scene Radar' },
  { path: '/composer', icon: 'composer', label: 'Composer', ariaLabel: 'Hive Composer' },
  { path: '/hive-story', icon: 'story', label: 'Hive Story', ariaLabel: 'Hive Story editorial' },
  { path: '/hub', icon: 'hub', label: 'Hub', ariaLabel: 'Feature hub' },
  {
    path: '/earnings',
    icon: 'earnings',
    label: 'Earnings',
    ariaLabel: 'Marketplace earnings and payouts',
  },
];

function isActive(itemPath: string, currentPath: string): boolean {
  const path = itemPath.split('?')[0];
  if (path === '/feed') return currentPath === '/feed' || currentPath === '/trending';
  if (path === '/feed?compose=1') return false;
  return currentPath === path || currentPath.startsWith(path + '/');
}

export function DesktopSidebar() {
  const location = useLocation();
  const { user, profile } = useAuth();
  const { unreadTotal } = useMessages();

  if (!user) return null;

  const profilePath = profile?.username ? `/u/${profile.username}` : '/settings';

  return (
    <aside
      className="desktop-sidebar"
      aria-label="Main navigation"
      style={{
        position: 'fixed',
        top: 'var(--navbar-height, 73px)',
        left: 0,
        bottom: 0,
        width: 220,
        zIndex: 90,
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, rgba(8,8,6,0.94) 0%, rgba(2,2,2,0.99) 100%)',
        borderRight: `1px solid ${colors.accentMuted}`,
        backdropFilter: 'blur(18px)',
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: `${space[7]}px 0`,
      }}
    >
      {/* Logo (mobile doesn't have a persistent logo in nav) */}
      <div style={{ padding: `0 ${space[8]}px ${space[7]}px` }}>
        <Link to="/" style={{ textDecoration: 'none' }} aria-label="MixHive home">
          <Logo size="small" variant="business" showText={true} />
        </Link>
      </div>

      {/* Nav items */}
      <nav
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: space[1],
          padding: `0 ${space[5]}px`,
        }}
      >
        {topItems.map(item => {
          const active = isActive(item.path, location.pathname);
          if (item.highlight) {
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-label={item.ariaLabel}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: space[6],
                  padding: `${space[4]}px ${space[6]}px`,
                  borderRadius: 999,
                  background: `linear-gradient(135deg, ${colors.accent}, ${colors.accentBrightest})`,
                  color: colors.bg,
                  textDecoration: 'none',
                  fontWeight: fontWeight.bold,
                  fontSize: fontSize.md,
                  marginBottom: space[4],
                  boxShadow: '0 4px 18px rgba(246,196,0,0.35)',
                  transition: transition.base,
                }}
              >
                <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center' }}>
                  <Icon name={item.icon} size={19} color={colors.bg} strokeWidth={2.4} />
                </span>
                {item.label}
              </Link>
            );
          }
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-label={item.ariaLabel}
              aria-current={active ? 'page' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: space[6],
                padding: `${space[4]}px ${space[6]}px`,
                borderRadius: 10,
                background: active ? colors.accentFaint : 'transparent',
                color: active ? colors.accent : colors.text.muted,
                textDecoration: 'none',
                fontWeight: active ? fontWeight.bold : fontWeight.normal,
                fontSize: fontSize.md,
                transition: transition.base,
                position: 'relative',
              }}
              onMouseEnter={e => {
                if (!active) {
                  e.currentTarget.style.background = 'rgba(246,196,0,0.06)';
                  e.currentTarget.style.color = colors.text.secondary;
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = colors.text.muted;
                }
              }}
            >
              <HexIcon name={item.icon} cell={32} size={16} active={active} />
              <span>{item.label}</span>
              {item.path === '/messages' && unreadTotal > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 12,
                    background: colors.accent,
                    color: colors.bg,
                    fontSize: 11,
                    fontWeight: 700,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1,
                    zIndex: 2,
                  }}
                >
                  {unreadTotal > 9 ? '9+' : unreadTotal}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Profile at bottom */}
      <div
        style={{
          padding: `${space[5]}px ${space[5]}px 0`,
          borderTop: `1px solid ${colors.border}`,
          marginTop: space[5],
        }}
      >
        <Link
          to={profilePath}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: space[5],
            padding: `${space[4]}px ${space[5]}px`,
            borderRadius: 10,
            textDecoration: 'none',
            transition: transition.base,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(246,196,0,0.06)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              flexShrink: 0,
              background: profile?.avatar_url
                ? `url(${profile.avatar_url}) center/cover`
                : colors.surface,
              border: `1px solid ${colors.accentMuted}`,
              backgroundSize: 'cover',
            }}
          />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: fontSize.base,
                fontWeight: fontWeight.semibold,
                color: colors.text.primary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {profile?.display_name || profile?.username || 'Profile'}
            </div>
            {profile?.username && (
              <div
                style={{
                  fontSize: fontSize.xs,
                  color: colors.text.dim,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                @{profile.username}
              </div>
            )}
          </div>
        </Link>
      </div>
    </aside>
  );
}
