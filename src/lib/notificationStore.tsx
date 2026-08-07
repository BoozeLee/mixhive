import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { isSupabaseConfigured, supabase } from './supabase';
import type { Notification } from '../lib/types';
import { useAuth } from '../hooks/useAuth';
import { markNotificationsRead } from '../lib/api';

export interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (ids: string[]) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [_loading, setLoading] = useState(true);

  // Fetch notifications from server API (with Redis caching)
  const fetchNotifications = useCallback(async () => {
    if (!user || !isSupabaseConfigured) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(`/api/notifications?userId=${user.id}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to fetch notifications');
      const data = await res.json();
      setNotifications(data.notifications ?? []);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;

    // Fetch initial data
    void fetchNotifications();

    // Setup realtime subscription
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Refetch on any change
          void fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchNotifications]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'mixhive-notification-refresh') void fetchNotifications();
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [fetchNotifications]);

  const markAsRead = useCallback(
    async (ids: string[]) => {
      if (!user || ids.length === 0) return;

      try {
        // Optimistic update: mark as read immediately
        setNotifications(prev =>
          prev.map(n => ({
            ...n,
            read: ids.includes(n.id) || n.read,
          }))
        );

        // Call API to persist
        await markNotificationsRead(user.id, ids);

        // Refetch to ensure consistency (handles rollback on failure)
        void fetchNotifications();
      } catch (error) {
        console.error('Failed to mark notifications as read:', error);
        // Rollback optimistic update
        void fetchNotifications();
      }
    },
    [user, fetchNotifications]
  );

  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    try {
      // Optimistic update
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));

      // Call API
      await markNotificationsRead(user.id);

      // Refetch
      void fetchNotifications();
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      // Rollback
      void fetchNotifications();
    }
  }, [user, fetchNotifications]);

  const refresh = useCallback(() => {
    return fetchNotifications();
  }, [fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        refresh,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
