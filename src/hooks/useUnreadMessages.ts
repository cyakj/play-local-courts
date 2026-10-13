import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Live count of messages addressed to the signed-in user that they have not read.
 * Backed by RLS (users only ever see their own messages) and Supabase realtime on public.messages:
 * a new incoming message, or the recipient marking messages read, refreshes the count.
 */
export function useUnreadMessages(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || cancelled) return;

      const refresh = async () => {
        const { count: n, error } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('receiver_id', user.id)
          .is('read_at', null);
        if (!cancelled && !error) setCount(n ?? 0);
      };
      refresh();

      // Unique topic per hook instance: several components may use this hook at once.
      const channel = supabase
        .channel(`unread-messages-${user.id}-${Math.random().toString(36).slice(2, 8)}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
          () => { refresh(); },
        )
        .subscribe();
      cleanup = () => { supabase.removeChannel(channel); };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return count;
}
