import {
  categoryPreferenceKey,
  notificationPresentation,
  safeNotificationPath,
} from '../lib/notificationPresentation';
import type { Notification } from '../lib/types';

function notification(overrides: Partial<Notification>): Notification {
  return {
    id: 'notification-1',
    user_id: 'user-1',
    type: 'like',
    actor_id: 'actor-1',
    mix_id: null,
    buzz_id: null,
    data: {},
    read: false,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('notificationPresentation', () => {
  it('maps messages to immediate conversation deep-links', () => {
    const result = notificationPresentation(
      notification({ type: 'message', data: { conversation_id: 'conversation-1' } })
    );
    expect(result).toMatchObject({
      category: 'messages',
      urgency: 'immediate',
      url: '/messages/conversation-1',
    });
  });

  it('maps likes to social digests and exact mix links', () => {
    const result = notificationPresentation(notification({ type: 'like', mix_id: 'mix-1' }));
    expect(result).toMatchObject({ category: 'social', urgency: 'digest', url: '/mix/mix-1' });
  });

  it('maps marketplace events to their listing', () => {
    const result = notificationPresentation(
      notification({
        type: 'gear_shipped',
        data: { listing_id: 'listing-1', body: 'Your gear shipped.' },
      })
    );
    expect(result).toMatchObject({
      category: 'account',
      urgency: 'immediate',
      body: 'Your gear shipped.',
      url: '/marketplace/gear/listing-1',
    });
  });

  it('maps quest_complete to an immediate branded push with a collab-quest deep link', () => {
    const result = notificationPresentation(
      notification({
        type: 'quest_complete',
        data: { quest_id: 'quest-1', body: 'Quest "Night Ride" is complete! You earned 50 XP.' },
      })
    );
    expect(result).toMatchObject({
      category: 'social',
      urgency: 'immediate',
      title: 'Quest complete',
      body: 'Quest "Night Ride" is complete! You earned 50 XP.',
      url: '/collab-quests/quest-1',
    });
  });

  it('falls back to /notifications for quest_complete without a quest id', () => {
    const result = notificationPresentation(notification({ type: 'quest_complete', data: {} }));
    expect(result).toMatchObject({ title: 'Quest complete', url: '/notifications' });
  });

  it('rejects external and protocol-relative links', () => {
    expect(safeNotificationPath('https://evil.example/x')).toBe('/notifications');
    expect(safeNotificationPath('//evil.example/x')).toBe('/notifications');
  });

  it('maps categories to preference columns', () => {
    expect(categoryPreferenceKey('uploads')).toBe('uploads_enabled');
  });
});
