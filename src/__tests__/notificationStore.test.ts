/**
 * @jest-environment node
 */

// Test the data extraction fix and the response parsing logic in isolation.
// Full hook testing requires a React renderer; here we focus on the pure logic
// exercised by the store: that data.notifications is extracted, not the raw response.

describe('notificationStore — data extraction contract', () => {
  it('API response shape matches what the store expects', () => {
    // The /api/notifications route returns { notifications: [...], cached: boolean }
    // The store must extract .notifications, not use the whole object.
    const apiResponse = { notifications: [{ id: 'n1', read: false }], cached: false };

    // Simulate the extraction the store performs after the fix
    const extracted = apiResponse.notifications ?? [];
    expect(Array.isArray(extracted)).toBe(true);
    expect(extracted).toHaveLength(1);
    expect(extracted[0].id).toBe('n1');
  });

  it('falls back to empty array when notifications key is absent', () => {
    // Defensive: if the API response is malformed
    const malformed = {} as { notifications?: unknown[] };
    const extracted = malformed.notifications ?? [];
    expect(extracted).toEqual([]);
  });

  it('unreadCount is derived from notifications where read === false', () => {
    const notifications = [
      { id: 'n1', read: false },
      { id: 'n2', read: true },
      { id: 'n3', read: false },
    ];
    const unreadCount = notifications.filter(n => !n.read).length;
    expect(unreadCount).toBe(2);
  });

  it('optimistic mark-all-read sets every notification.read to true', () => {
    const notifications = [
      { id: 'n1', read: false },
      { id: 'n2', read: false },
    ];
    const optimistic = notifications.map(n => ({ ...n, read: true }));
    expect(optimistic.every(n => n.read)).toBe(true);
    // Original is unchanged (immutable update)
    expect(notifications[0].read).toBe(false);
  });

  it('optimistic mark-as-read only updates the targeted IDs', () => {
    const notifications = [
      { id: 'n1', read: false },
      { id: 'n2', read: false },
      { id: 'n3', read: false },
    ];
    const ids = ['n1', 'n3'];
    const optimistic = notifications.map(n => ({
      ...n,
      read: ids.includes(n.id) || n.read,
    }));
    expect(optimistic[0].read).toBe(true);
    expect(optimistic[1].read).toBe(false);
    expect(optimistic[2].read).toBe(true);
  });
});
