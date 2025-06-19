
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, MessageCircle, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import PlayerProfile from '../components/locker/PlayerProfile';
import MatchPreferences from '../components/locker/MatchPreferences';
import FindPartner from '../components/locker/FindPartner';
import MessagingDialog from '../components/locker/MessagingDialog';
import ErrorBoundary from '../components/ErrorBoundary';

const MyLocker = () => {
  const { currentUser } = useAuth();
  const [showFindPartner, setShowFindPartner] = useState(false);
  const [showMessaging, setShowMessaging] = useState(false);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

  console.log('MyLocker component loaded, showFindPartner:', showFindPartner);

  useEffect(() => {
    if (currentUser) {
      checkForUnreadMessages();
    }
  }, [currentUser]);

  const checkForUnreadMessages = async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id')
        .eq('receiver_id', currentUser.id)
        .limit(1);

      if (error) throw error;
      setHasUnreadMessages((data?.length || 0) > 0);
    } catch (error) {
      console.error('Error checking for unread messages:', error);
    }
  };

  const handleMarkAsRead = () => {
    setHasUnreadMessages(false);
  };

  if (showFindPartner) {
    return (
      <ErrorBoundary>
        <FindPartner onBack={() => setShowFindPartner(false)} />
      </ErrorBoundary>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold">My Locker</h1>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setShowMessaging(true)}
            variant="outline"
            className="flex items-center gap-2 relative"
          >
            <MessageCircle className="h-4 w-4" />
            Messages
            {hasUnreadMessages && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full"></div>
            )}
          </Button>
          <Button 
            onClick={() => {
              console.log('Find a Partner button clicked');
              setShowFindPartner(true);
            }}
            className="flex items-center gap-2"
          >
            <Search className="h-4 w-4" />
            Find a Partner
          </Button>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="profile">Player Profile</TabsTrigger>
          <TabsTrigger value="preferences">Match Finder</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <PlayerProfile />
        </TabsContent>

        <TabsContent value="preferences">
          <MatchPreferences />
        </TabsContent>
      </Tabs>

      <MessagingDialog 
        open={showMessaging} 
        onOpenChange={setShowMessaging}
        hasUnreadMessages={hasUnreadMessages}
        onMarkAsRead={handleMarkAsRead}
      />
    </div>
  );
};

export default MyLocker;
