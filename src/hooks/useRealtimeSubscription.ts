import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

type PostgresChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface RealtimePayload<T> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T;
  old: T;
}

interface RealtimeSubscriptionOptions<T = any> {
  table: string;
  event?: PostgresChangeEvent;
  filter?: string;
  onInsert?: (payload: T) => void;
  onUpdate?: (payload: { old: T; new: T }) => void;
  onDelete?: (payload: T) => void;
  onChange?: (payload: RealtimePayload<T>) => void;
  enabled?: boolean;
}

/**
 * A reusable hook for subscribing to real-time database changes
 * 
 * @example
 * // Subscribe to new messages for a specific user
 * useRealtimeSubscription({
 *   table: 'messages',
 *   event: 'INSERT',
 *   filter: `receiver_id=eq.${userId}`,
 *   onInsert: (message) => {
 *     console.log('New message:', message);
 *     refetchMessages();
 *   }
 * });
 */
export const useRealtimeSubscription = <T = any>(options: RealtimeSubscriptionOptions<T>) => {
  const {
    table,
    event = '*',
    filter,
    onInsert,
    onUpdate,
    onDelete,
    onChange,
    enabled = true
  } = options;

  const channelRef = useRef<RealtimeChannel | null>(null);

  // Memoize callbacks to prevent unnecessary resubscriptions
  const handleInsert = useCallback((data: T) => onInsert?.(data), [onInsert]);
  const handleUpdate = useCallback((data: { old: T; new: T }) => onUpdate?.(data), [onUpdate]);
  const handleDelete = useCallback((data: T) => onDelete?.(data), [onDelete]);
  const handleChange = useCallback((data: RealtimePayload<T>) => onChange?.(data), [onChange]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const channelName = `realtime-${table}-${filter || 'all'}-${Date.now()}`;
    
    const channel = supabase.channel(channelName);

    // Build the subscription config
    const config: any = {
      event,
      schema: 'public',
      table
    };

    if (filter) {
      config.filter = filter;
    }

    channel
      .on('postgres_changes', config, (payload: any) => {
        const typedPayload = payload as RealtimePayload<T>;
        
        // Call the general onChange callback if provided
        handleChange(typedPayload);

        // Call specific callbacks based on event type
        switch (typedPayload.eventType) {
          case 'INSERT':
            handleInsert(typedPayload.new);
            break;
          case 'UPDATE':
            handleUpdate({ old: typedPayload.old, new: typedPayload.new });
            break;
          case 'DELETE':
            handleDelete(typedPayload.old);
            break;
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to ${table} real-time updates`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`Failed to subscribe to ${table} real-time updates`);
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, event, filter, enabled, handleInsert, handleUpdate, handleDelete, handleChange]);

  return channelRef.current;
};

export default useRealtimeSubscription;
