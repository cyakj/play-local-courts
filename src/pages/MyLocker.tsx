import React, { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { MessageCircle, User, Building2, Target, GraduationCap, Search } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useMode } from "../contexts/ModeContext";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";
import PlayerProfile from "../components/locker/PlayerProfile";
import ErrorBoundary from "../components/ErrorBoundary";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { CommunityManagement } from "@/components/community";
import MessagingDialog from "../components/locker/MessagingDialog";
// Tennis-only — kept but gated
import MatchPreferences from "../components/locker/MatchPreferences";
import FindPartner from "../components/locker/FindPartner";
import FindCoach from "../components/locker/FindCoach";
import { LessonsTab } from "../components/locker/LessonsTab";

const MyLocker = () => {
  const { currentUser } = useAuth();
  const { isHOAMode, triggerTennisComingSoon } = useMode();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [showFindPartner, setShowFindPartner] = useState(false);
  const [showFindCoach, setShowFindCoach] = useState(false);
  const [showMessaging, setShowMessaging] = useState(false);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

  const handleNewMessage = useCallback(async (newMsg: any) => {
    if (!showMessaging && newMsg.receiver_id === currentUser?.id) {
      setHasUnreadMessages(true);
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', newMsg.sender_id)
        .single();
      toast({
        title: 'New message',
        description: `${senderProfile?.full_name || 'Someone'} sent you a message`,
      });
    }
  }, [showMessaging, currentUser?.id, toast]);

  useRealtimeSubscription({
    table: 'messages',
    event: 'INSERT',
    filter: currentUser?.id ? `receiver_id=eq.${currentUser.id}` : undefined,
    onInsert: handleNewMessage,
    enabled: !!currentUser?.id && !showMessaging,
  });

  useEffect(() => {
    if (currentUser) checkForUnreadMessages();
  }, [currentUser]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (isHOAMode && (tab === 'find-partner' || tab === 'preferences' || tab === 'lessons')) {
      triggerTennisComingSoon();
    } else if (!isHOAMode && tab === 'find-partner') {
      setTimeout(() => setShowFindPartner(true), 100);
    }
  }, [searchParams, isHOAMode, triggerTennisComingSoon]);

  const checkForUnreadMessages = async () => {
    if (!currentUser) return;
    try {
      const { data } = await supabase
        .from('messages')
        .select('id')
        .eq('receiver_id', currentUser.id)
        .is('read_at', null)
        .limit(1);
      setHasUnreadMessages((data?.length || 0) > 0);
    } catch (error) {
      console.error('Error checking for unread messages:', error);
    }
  };

  const handleMarkAsRead = async () => { await checkForUnreadMessages(); };

  if (!isHOAMode && showFindPartner) {
    return (
      <ErrorBoundary>
        <div className="animate-in slide-in-from-right duration-300">
          <FindPartner onBack={() => setShowFindPartner(false)} />
        </div>
      </ErrorBoundary>
    );
  }

  if (!isHOAMode && showFindCoach) {
    return (
      <ErrorBoundary>
        <div className="animate-in slide-in-from-right duration-300">
          <FindCoach onBack={() => setShowFindCoach(false)} />
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
            <User className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-pink-600 bg-clip-text text-transparent">
              Profile
            </h1>
            <p className="text-muted-foreground">Your account &amp; community hub</p>
          </div>
        </div>
        <Button onClick={() => setShowMessaging(true)} variant="outline" size="icon"
          className="relative hover:scale-105 transition-all duration-200 hover:shadow-lg">
          <MessageCircle className="h-5 w-5" />
          {hasUnreadMessages && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
          )}
        </Button>
      </div>

      {isHOAMode ? (
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 bg-white/80 backdrop-blur-sm shadow-lg rounded-xl p-1">
            <TabsTrigger value="profile"
              className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-pink-500 data-[state=active]:text-white transition-all duration-200 rounded-lg">
              <User className="h-4 w-4" /><span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="community"
              className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white transition-all duration-200 rounded-lg">
              <Building2 className="h-4 w-4" /><span className="hidden sm:inline">Community</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="profile" className="animate-in fade-in duration-300"><PlayerProfile /></TabsContent>
          <TabsContent value="community" className="animate-in fade-in duration-300"><CommunityManagement /></TabsContent>
        </Tabs>
      ) : (
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-white/80 backdrop-blur-sm shadow-lg rounded-xl p-1">
            <TabsTrigger value="profile"
              className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-pink-500 data-[state=active]:text-white transition-all duration-200 rounded-lg">
              <User className="h-4 w-4" /><span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="community"
              className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white transition-all duration-200 rounded-lg">
              <Building2 className="h-4 w-4" /><span className="hidden sm:inline">Community</span>
            </TabsTrigger>
            <TabsTrigger value="preferences"
              className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-blue-500 data-[state=active]:text-white transition-all duration-200 rounded-lg">
              <Target className="h-4 w-4" /><span className="hidden sm:inline">Match</span>
            </TabsTrigger>
            <TabsTrigger value="lessons"
              className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white transition-all duration-200 rounded-lg">
              <GraduationCap className="h-4 w-4" /><span className="hidden sm:inline">Lessons</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="profile" className="animate-in fade-in duration-300"><PlayerProfile /></TabsContent>
          <TabsContent value="community" className="animate-in fade-in duration-300"><CommunityManagement /></TabsContent>
          <TabsContent value="preferences" className="animate-in fade-in duration-300">
            <div className="space-y-6">
              <div className="flex justify-end">
                <Button onClick={() => setShowFindPartner(true)}
                  className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 transition-all duration-200 hover:scale-105 hover:shadow-lg">
                  <Search className="h-4 w-4" />Find a Partner
                </Button>
              </div>
              <MatchPreferences />
            </div>
          </TabsContent>
          <TabsContent value="lessons" className="animate-in fade-in duration-300">
            <div className="space-y-6">
              <div className="flex justify-end">
                <Button onClick={() => setShowFindCoach(true)} variant="outline"
                  className="flex items-center gap-2 hover:scale-105 transition-all duration-200 hover:shadow-lg">
                  <GraduationCap className="h-4 w-4" />Find a Coach
                </Button>
              </div>
              <LessonsTab />
            </div>
          </TabsContent>
        </Tabs>
      )}

      <MessagingDialog open={showMessaging} onOpenChange={setShowMessaging}
        hasUnreadMessages={hasUnreadMessages} onMarkAsRead={handleMarkAsRead} />
    </div>
  );
};

export default MyLocker;
