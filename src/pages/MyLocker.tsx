
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, MessageCircle } from 'lucide-react';
import PlayerProfile from '../components/locker/PlayerProfile';
import MatchPreferences from '../components/locker/MatchPreferences';
import FindPartner from '../components/locker/FindPartner';
import MessagingDialog from '../components/locker/MessagingDialog';
import ErrorBoundary from '../components/ErrorBoundary';

const MyLocker = () => {
  const [showFindPartner, setShowFindPartner] = useState(false);
  const [showMessaging, setShowMessaging] = useState(false);

  console.log('MyLocker component loaded, showFindPartner:', showFindPartner);

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
        <h1 className="text-3xl font-bold">My Locker</h1>
        <div className="flex gap-2">
          <Button 
            onClick={() => setShowMessaging(true)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <MessageCircle className="h-4 w-4" />
            Messages
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
      />
    </div>
  );
};

export default MyLocker;
