
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Settings, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

// This Navbar is now hidden for residents (they use in-page headers).
// Kept for compatibility with coach layout.
const Navbar = () => {
  const { currentUser } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = async () => {
    if (!currentUser) return;
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', currentUser.id)
      .is('read_at', null);
    setUnreadCount(count || 0);
  };

  useEffect(() => {
    if (currentUser) loadUnreadCount();
  }, [currentUser]);

  useRealtimeSubscription({
    table: 'messages',
    event: 'INSERT',
    filter: currentUser?.id ? `receiver_id=eq.${currentUser.id}` : undefined,
    onInsert: () => loadUnreadCount(),
    enabled: !!currentUser?.id
  });

  // Hidden for resident layout — no top navbar
  return null;
};

export default Navbar;
