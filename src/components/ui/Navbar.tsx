import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Settings, MessageCircle } from 'lucide-react';
import { Button } from './button';
import { Badge } from './badge';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

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
    if (currentUser) {
      loadUnreadCount();
    }
  }, [currentUser]);

  useRealtimeSubscription({
    table: 'messages',
    event: 'INSERT',
    filter: currentUser?.id ? `receiver_id=eq.${currentUser.id}` : undefined,
    onInsert: () => loadUnreadCount(),
    enabled: !!currentUser?.id
  });

  if (!currentUser) {
    return null;
  }

  return (
    <nav className="bg-background/80 backdrop-blur-lg shadow-sm border-b border-border sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14">
          <div className="flex items-center">
            <Button asChild variant="ghost" size="icon" className="h-11 w-11 rounded-full">
              <Link to="/settings" aria-label="Open settings">
                <Settings className="h-5 w-5 text-muted-foreground" />
              </Link>
            </Button>
          </div>
          <div className="flex items-center">
            <Button asChild variant="ghost" size="icon" className="relative h-11 w-11 rounded-full">
              <Link to="/messages" aria-label="Open messages">
                <MessageCircle className="h-5 w-5 text-muted-foreground" />
                {unreadCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-destructive text-destructive-foreground border-2 border-background rounded-full">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Badge>
                )}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
