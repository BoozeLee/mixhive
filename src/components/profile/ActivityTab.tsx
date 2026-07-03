import { Link } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { EmptyState } from '../EmptyState';
import { Icon } from '../ui/Icon';
import { colors, fontSize, fontWeight, radius, space } from '../../styles/tokens';
import type { ActivityEvent } from '../../lib/types';

interface ActivityTabProps {
  activity: ActivityEvent[];
  milestones: string[];
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 2592000)}mo ago`;
}

function activityText(event: ActivityEvent) {
  if (event.activity_type === 'upload')
    return (
      <>
        Uploaded{' '}
        <Link to={`/mix/${event.mix_id}`} style={{ color: colors.text.secondary }}>
          {event.mix_title}
        </Link>
      </>
    );
  if (event.activity_type === 'like')
    return (
      <>
        Liked{' '}
        <Link to={`/mix/${event.mix_id}`} style={{ color: colors.text.secondary }}>
          {event.mix_title}
        </Link>
      </>
    );
  return (
    <>
      Followed{' '}
      <Link to={`/u/${event.target_username}`} style={{ color: colors.text.secondary }}>
        {event.target_display_name || event.target_username}
      </Link>
    </>
  );
}

export function ActivityTab({ activity, milestones }: ActivityTabProps) {
  const t = useTranslations('profile');

  if (activity.length === 0 && milestones.length === 0) {
    return <EmptyState iconKey="feed" title={t('noActivityTitle')} body={t('noActivityBody')} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
      {milestones.map(item => (
        <div
          key={item}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: space[4],
            color: colors.accent,
            fontSize: fontSize.sm,
            background: `linear-gradient(135deg, ${colors.surface}, ${colors.accentFaint})`,
            border: `1px solid ${colors.accentMuted}`,
            borderRadius: radius.md,
            padding: space[5],
          }}
        >
          <span style={{ color: colors.accent, lineHeight: 0 }}>
            <Icon name="star" size={16} color="currentColor" />
          </span>
          {item}
        </div>
      ))}
      {activity.slice(0, 20).map((event, index) => (
        <div
          key={`${event.created_at}-${index}`}
          style={{
            display: 'flex',
            gap: space[4],
            alignItems: 'center',
            color: colors.text.muted,
            fontSize: fontSize.sm,
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: space[5],
          }}
        >
          <span aria-hidden="true" style={{ lineHeight: 0 }}>
            <Icon
              name={
                event.activity_type === 'upload'
                  ? 'mix'
                  : event.activity_type === 'like'
                    ? 'like'
                    : 'profile'
              }
              size={16}
              color={colors.text.dim}
            />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>{activityText(event)}</span>
          <span style={{ color: colors.text.dim, flexShrink: 0 }}>{timeAgo(event.created_at)}</span>
        </div>
      ))}
    </div>
  );
}
