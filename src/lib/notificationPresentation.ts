import type { Notification } from './types';

export type NotificationCategory = 'messages' | 'social' | 'uploads' | 'account';
export type NotificationUrgency = 'immediate' | 'digest';

type NotificationLike = Pick<Notification, 'type' | 'actor_id' | 'mix_id' | 'buzz_id' | 'data'> & {
  actor?: Notification['actor'] | null;
};

export interface NotificationPresentation {
  category: NotificationCategory;
  urgency: NotificationUrgency;
  title: string;
  body: string;
  url: string;
}

const SOCIAL_DIGEST_TYPES = new Set(['like', 'follow', 'buzz_like', 'repost']);

function dataString(data: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = data?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function safeNotificationPath(path: string | null | undefined): string {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return '/notifications';
  try {
    const url = new URL(path, 'https://mixhive.invalid');
    return url.origin === 'https://mixhive.invalid'
      ? `${url.pathname}${url.search}${url.hash}`
      : '/notifications';
  } catch {
    return '/notifications';
  }
}

export function notificationPresentation(notification: NotificationLike): NotificationPresentation {
  const data = notification.data ?? {};
  const actor =
    notification.actor?.display_name ||
    notification.actor?.username ||
    dataString(data, 'actor_name') ||
    'Someone';
  const customBody = dataString(data, 'body') || dataString(data, 'message');
  const listingId = dataString(data, 'listing_id');
  const conversationId = dataString(data, 'conversation_id');
  const ctaUrl = dataString(data, 'cta_url');

  switch (notification.type) {
    case 'message':
      return {
        category: 'messages',
        urgency: 'immediate',
        title: 'New message',
        body: customBody || `${actor} sent you a message`,
        url: safeNotificationPath(conversationId ? `/messages/${conversationId}` : '/messages'),
      };
    case 'comment':
    case 'reply':
    case 'mention':
      return {
        category: 'social',
        urgency: 'immediate',
        title:
          notification.type === 'reply'
            ? 'New reply'
            : notification.type === 'mention'
              ? 'You were mentioned'
              : 'New comment',
        body:
          customBody ||
          `${actor} ${notification.type === 'reply' ? 'replied to your comment' : notification.type === 'mention' ? 'mentioned you' : 'commented on your mix'}`,
        url: safeNotificationPath(notification.mix_id ? `/mix/${notification.mix_id}` : null),
      };
    case 'like':
    case 'follow':
    case 'buzz_like':
    case 'repost':
      return {
        category: 'social',
        urgency: 'digest',
        title: 'New activity on MixHive',
        body:
          customBody ||
          `${actor} ${
            notification.type === 'follow'
              ? 'followed you'
              : notification.type === 'like'
                ? 'liked your mix'
                : notification.type === 'buzz_like'
                  ? 'liked your buzz'
                  : 'reposted your buzz'
          }`,
        url: safeNotificationPath(
          notification.type === 'follow'
            ? notification.actor?.username
              ? `/u/${notification.actor.username}`
              : '/notifications'
            : notification.mix_id
              ? `/mix/${notification.mix_id}`
              : notification.buzz_id
                ? `/buzz/${notification.buzz_id}`
                : null
        ),
      };
    case 'mix_upload':
      return {
        category: 'uploads',
        urgency: 'digest',
        title: 'New mix from someone you follow',
        body: customBody || `${actor} uploaded a new mix`,
        url: safeNotificationPath(notification.mix_id ? `/mix/${notification.mix_id}` : null),
      };
    case 'verification':
      return {
        category: 'account',
        urgency: 'immediate',
        title: 'Verification update',
        body: customBody || 'Your verification request was updated',
        url: '/profile',
      };
    case 'gear_sale':
    case 'gear_shipped':
    case 'gear_delivered':
    case 'gear_confirmed':
    case 'gear_refunded':
    case 'gear_disputed':
      return {
        category: 'account',
        urgency: 'immediate',
        title: 'Marketplace update',
        body: customBody || 'Your gear transaction was updated',
        url: safeNotificationPath(
          listingId ? `/marketplace/gear/${listingId}` : '/marketplace/gear'
        ),
      };
    case 'gear_payout':
    case 'earnings_paid':
    case 'agent_sale':
      return {
        category: 'account',
        urgency: 'immediate',
        title: 'Earnings update',
        body: customBody || 'Your earnings were updated',
        url: '/earnings',
      };
    case 'agent_purchased':
      return {
        category: 'account',
        urgency: 'immediate',
        title: 'Agent purchase complete',
        body: customBody || 'Your agent is ready',
        url: '/agents',
      };
    case 'agent_notification':
      return {
        category: 'account',
        urgency: 'immediate',
        title: dataString(data, 'subject') || 'MixHive update',
        body: customBody || 'You have a new update',
        url: safeNotificationPath(ctaUrl),
      };
    case 'quest_complete': {
      const questId = dataString(data, 'quest_id');
      return {
        category: 'social',
        urgency: 'immediate',
        title: 'Quest complete',
        body: customBody || 'Your collab quest is complete!',
        url: safeNotificationPath(questId ? `/collab-quests/${questId}` : '/notifications'),
      };
    }
    case 'live_room_invite': {
      const roomId = dataString(data, 'room_id');
      return {
        category: 'social',
        urgency: 'immediate',
        title: 'Live room invite',
        body: customBody || `${actor} invited you to a live room`,
        url: safeNotificationPath(roomId ? `/live-rooms/${roomId}` : '/live-rooms'),
      };
    }
    case 'live_room_started': {
      const roomId = dataString(data, 'room_id');
      return {
        category: 'social',
        urgency: 'immediate',
        title: 'Live session started',
        body: customBody || `${actor} started a live session`,
        url: safeNotificationPath(roomId ? `/live-rooms/${roomId}` : '/live-rooms'),
      };
    }
    case 'live_room_ended': {
      const roomId = dataString(data, 'room_id');
      return {
        category: 'social',
        urgency: 'digest',
        title: 'Live session ended',
        body: customBody || `A live session has ended`,
        url: safeNotificationPath(roomId ? `/live-rooms/${roomId}` : '/live-rooms'),
      };
    }
    case 'event_created': {
      const eventId = dataString(data, 'event_id');
      return {
        category: 'social',
        urgency: 'digest',
        title: 'New event',
        body: customBody || `${actor} created a new event`,
        url: safeNotificationPath(eventId ? `/events/${eventId}` : '/events'),
      };
    }
    case 'event_reminder': {
      const eventId = dataString(data, 'event_id');
      return {
        category: 'social',
        urgency: 'immediate',
        title: 'Event starting soon',
        body: customBody || 'An event you RSVP\'d to is starting soon',
        url: safeNotificationPath(eventId ? `/events/${eventId}` : '/events'),
      };
    }
    case 'event_update': {
      const eventId = dataString(data, 'event_id');
      return {
        category: 'social',
        urgency: 'immediate',
        title: 'Event updated',
        body: customBody || `${actor} updated an event`,
        url: safeNotificationPath(eventId ? `/events/${eventId}` : '/events'),
      };
    }
    case 'event_cancelled': {
      const eventId = dataString(data, 'event_id');
      return {
        category: 'social',
        urgency: 'immediate',
        title: 'Event cancelled',
        body: customBody || `An event has been cancelled`,
        url: safeNotificationPath(eventId ? `/events/${eventId}` : '/events'),
      };
    }
    case 'rsvp_confirmed': {
      const eventId = dataString(data, 'event_id');
      return {
        category: 'social',
        urgency: 'digest',
        title: 'RSVP confirmed',
        body: customBody || `${actor} is going to an event`,
        url: safeNotificationPath(eventId ? `/events/${eventId}` : '/events'),
      };
    }
    default:
      return {
        category: 'social',
        urgency: SOCIAL_DIGEST_TYPES.has(notification.type) ? 'digest' : 'immediate',
        title: 'New notification from MixHive',
        body: customBody || `${actor} interacted with you`,
        url: '/notifications',
      };
  }
}

export function categoryPreferenceKey(category: NotificationCategory) {
  return `${category}_enabled` as const;
}
