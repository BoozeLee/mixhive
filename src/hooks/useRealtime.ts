import { useEffect, useState, useRef } from 'react';
import { realtimeManager, RealtimeEvent, FeedUpdate } from '../lib/websocket';

export interface RealtimeState {
  isConnected: boolean;
  mixUpdates: FeedUpdate[];
  notifications: RealtimeEvent[];
  comments: RealtimeEvent[];
  error: string | null;
}

export function useRealtime(
  userId: string | null,
  options?: {
    enableMixUpdates?: boolean;
    enableNotifications?: boolean;
    enableComments?: boolean;
  }
) {
  const [state, setState] = useState<RealtimeState>({
    isConnected: false,
    mixUpdates: [],
    notifications: [],
    comments: [],
    error: null,
  });

  const [isInitialized, setIsInitialized] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    if (!userId) {
      setState(prev => ({ ...prev, error: 'User ID required for real-time features' }));
      return;
    }

    // Cleanup any existing reconnect timer
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const initializeRealtime = async () => {
      try {
        setIsInitialized(false);

        // Check if WebSocket is available
        if (!realtimeManager.getConnectionStatus().connected) {
          setState(prev => ({ ...prev, error: 'WebSocket not available' }));
          return;
        }

        // Set up event handlers
        const feedHandler = (event: FeedUpdate) => {
          setState(prev => {
            const updatedMixes = [event, ...prev.mixUpdates].slice(0, 20); // Keep last 20 updates
            return { ...prev, mixUpdates: updatedMixes };
          });
        };

        const notificationHandler = (event: RealtimeEvent) => {
          setState(prev => {
            const updatedNotifications = [event, ...prev.notifications].slice(0, 10); // Keep last 10 notifications
            return { ...prev, notifications: updatedNotifications };
          });
        };

        const _commentHandler = (event: RealtimeEvent) => {
          setState(prev => {
            const updatedComments = [event, ...prev.comments].slice(0, 50); // Keep last 50 comments
            return { ...prev, comments: updatedComments };
          });
        };

        // Subscribe to feeds based on options
        const subscriptions = [];

        if (options?.enableMixUpdates !== false) {
          subscriptions.push(realtimeManager.subscribeToFeed(userId, feedHandler));
        }

        if (options?.enableNotifications !== false) {
          subscriptions.push(realtimeManager.subscribeToNotifications(userId, notificationHandler));
        }

        await Promise.all(subscriptions);

        setState(prev => ({
          ...prev,
          isConnected: true,
          error: null,
        }));

        setIsInitialized(true);
        reconnectAttempts.current = 0; // Reset reconnect attempts on success
      } catch (error) {
        console.error('Failed to initialize real-time features:', error);
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Connection failed',
        }));
        scheduleReconnect();
      }
    };

    const scheduleReconnect = () => {
      if (reconnectAttempts.current >= maxReconnectAttempts) {
        setState(prev => ({ ...prev, error: 'Max reconnection attempts reached' }));
        return;
      }

      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000); // Exponential backoff
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectAttempts.current++;
        initializeRealtime();
      }, delay);
    };

    initializeRealtime();

    // Cleanup function
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      // Unsubscribe from all real-time channels
      realtimeManager.unsubscribeUser(userId);
    };
  }, [userId, options?.enableMixUpdates, options?.enableNotifications, options?.enableComments]);

  // Manual methods to trigger events
  const triggerMixUpload = async (mixData: unknown) => {
    try {
      await realtimeManager.broadcastMixUpload(mixData);
    } catch (error) {
      console.error('Failed to trigger mix upload:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to broadcast mix upload',
      }));
    }
  };

  const triggerComment = async (commentData: unknown) => {
    try {
      await realtimeManager.broadcastComment(commentData);
    } catch (error) {
      console.error('Failed to trigger comment:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to broadcast comment',
      }));
    }
  };

  const triggerNotification = async (notificationData: unknown) => {
    try {
      await realtimeManager.broadcastNotification(notificationData);
    } catch (error) {
      console.error('Failed to trigger notification:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to broadcast notification',
      }));
    }
  };

  const refreshConnection = async () => {
    setState(prev => ({ ...prev, isConnected: false, error: 'Refreshing connection...' }));
    reconnectAttempts.current = 0;
    // Re-run the effect by changing a dummy state
    setIsInitialized(false);
  };

  return {
    ...state,
    isInitialized,
    triggerMixUpload,
    triggerComment,
    triggerNotification,
    refreshConnection,
    reconnectAttempts: reconnectAttempts.current,
  };
}

// Hook for specific mix comment subscriptions
export function useRealtimeComments(mixId: string | null, userId: string | null) {
  const [comments, setComments] = useState<RealtimeEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!mixId || !userId) return;

    const commentHandler = (event: RealtimeEvent) => {
      setComments(prev => [event, ...prev].slice(0, 100)); // Keep last 100 comments
    };

    const setupSubscription = async () => {
      try {
        setIsConnected(false);
        await realtimeManager.subscribeToMixComments(mixId, commentHandler);
        setIsConnected(true);
      } catch (error) {
        console.error('Failed to setup mix comment subscription:', error);
      }
    };

    setupSubscription();

    return () => {
      // Cleanup would happen in the main manager
    };
  }, [mixId, userId]);

  return {
    comments,
    isConnected,
    count: comments.length,
  };
}

// Hook for real-time notifications
export function useRealtimeNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<RealtimeEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userId) return;

    const notificationHandler = (event: RealtimeEvent) => {
      setNotifications(prev => [event, ...prev].slice(0, 50));
      setUnreadCount(prev => prev + 1);
    };

    const setupSubscription = async () => {
      try {
        await realtimeManager.subscribeToNotifications(userId, notificationHandler);
      } catch (error) {
        console.error('Failed to setup notification subscription:', error);
      }
    };

    setupSubscription();

    return () => {
      // Cleanup would happen in the main manager
    };
  }, [userId]);

  const markAsRead = () => {
    setUnreadCount(0);
  };

  return {
    notifications,
    unreadCount,
    markAsRead,
    totalNotifications: notifications.length,
  };
}
