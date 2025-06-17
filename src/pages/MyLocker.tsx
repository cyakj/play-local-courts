
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search } from 'lucide-react';
import PlayerProfile from '../components/locker/PlayerProfile';
import MatchPreferences from '../components/locker/MatchPreferences';
import FindPartner from '../components/locker/FindPartner';

const MyLocker = () => {
  const [showFindPartner, setShowFindPartner] = useState(false);

  console.log('MyLocker component loaded'); // Debug log

  if (showFindPartner) {
    return <FindPartner onBack={() => setShowFindPartner(false)} />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">My Locker</h1>
        <Button 
          onClick={() => setShowFindPartner(true)}
          className="flex items-center gap-2"
        >
          <Search className="h-4 w-4" />
          Find a Partner
        </Button>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="profile">Player Profile</TabsTrigger>
          <TabsTrigger value="preferences">Match Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <PlayerProfile />
        </TabsContent>

        <TabsContent value="preferences">
          <MatchPreferences />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MyLocker;
