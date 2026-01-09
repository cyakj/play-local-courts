import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useActiveHOA } from '../contexts/ActiveHOAContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import PendingApprovalMessage from '../components/PendingApprovalMessage';
import { WeatherPill } from '@/components/weather/WeatherPill';
import { useWeather } from '@/hooks/useWeather';
import { ActiveHOAIndicator } from '@/components/community/ActiveHOAIndicator';
import { 
  UpcomingActivitySnapshot,
  ActionRequiredAlerts,
  PlayerStatsCard,
  SuggestedActionsCard,
  ProfileCompletenessCard,
  AdminQuickOverview,
  CommunityLinksCard,
  QuickActionButton
} from '@/components/dashboard';
import { UserType } from '../types';
import { 
  Users, 
  Calendar, 
  CalendarCheck, 
  Trophy, 
  MapPin, 
  Clock,
  CheckCircle2,
  XCircle,
  Sparkles,
  GraduationCap,
  Bell,
  Headphones
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface MatchRequest {
  id: string;
  challenger_id: string;
  match_type: string;
  date: string;
  time_start: string;
  location: string;
  challenger: {
    full_name: string;
  };
}

const Dashboard = () => {
  const { currentUser, isAdmin, isPending, isCoach, isPlatformReviewer } = useAuth();
  const { toast } = useToast();
  const { activeHOA } = useActiveHOA();
  const { 
    bookings,
    pendingUsers,
    currentHOA,
    loading
  } = useData();
  
  const [matchRequests, setMatchRequests] = useState<MatchRequest[]>([]);

  // Get HOA location for weather
  const hoaLocation = currentHOA?.address || activeHOA?.hoaName || null;
  const { weather, forecast, loading: weatherLoading, locationName } = useWeather(hoaLocation);

  useEffect(() => {
    if (currentUser) {
      loadMatchRequests();
    }
  }, [currentUser]);

  const loadMatchRequests = async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('match_requests')
        .select(`
          id,
          challenger_id,
          match_type,
          date,
          time_start,
          location,
          challenger:profiles!match_requests_challenger_id_fkey(full_name)
        `)
        .eq('opponent_id', currentUser.id)
        .eq('status', 'pending');

      if (error) throw error;
      setMatchRequests(data || []);
    } catch (error) {
      console.error('Error loading match requests:', error);
    }
  };

  const handleMatchRequestAction = async (requestId: string, action: 'accept' | 'decline') => {
    try {
      const { error } = await supabase
        .from('match_requests')
        .update({ status: action === 'accept' ? 'accepted' : 'declined' })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: action === 'accept' ? "Match Accepted" : "Match Declined",
        description: `You have ${action}ed the match request.`
      });

      loadMatchRequests();
    } catch (error) {
      console.error('Error updating match request:', error);
      toast({
        title: "Error",
        description: "Failed to update match request",
        variant: "destructive"
      });
    }
  };

  // Redirect platform reviewers to their dedicated dashboard
  if (isPlatformReviewer) {
    return <Navigate to="/reviewer/dashboard" replace />;
  }

  // Redirect coaches to coach dashboard
  if (isCoach) {
    return <Navigate to="/coach-dashboard" replace />;
  }

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
          <Sparkles className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-primary" />
        </div>
      </div>
    );
  }

  // Show pending approval message if user is pending (but only for HOA users)
  if (isPending && currentUser?.userType !== UserType.NON_HOA) {
    return <PendingApprovalMessage />;
  }

  if (!currentUser) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Please log in to continue</h2>
          <Button asChild>
            <Link to="/login">Go to Login</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Determine if this is a community user or individual user
  const isCommunityUser = currentUser.userType !== UserType.NON_HOA;
  
  return (
    <div className="space-y-6 animate-fade-scale">
      {/* Top Header Row with Weather Pill */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {isCommunityUser && <ActiveHOAIndicator />}
        </div>
        <div className="flex items-center gap-3">
          {isCommunityUser && hoaLocation && (
            <WeatherPill location={hoaLocation} />
          )}
          <Button variant="ghost" size="icon" className="rounded-full">
            <Bell className="h-5 w-5" />
          </Button>
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
              {currentUser?.fullName?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Action Required Alerts */}
      <ActionRequiredAlerts />

      {/* Quick Action Buttons Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <QuickActionButton
          icon={<CalendarCheck className="h-5 w-5" />}
          title="Reserve"
          subtitle={isCommunityUser ? "Book a court" : "Find availability"}
          to={isCommunityUser ? "/reserve-court" : "/my-locker?tab=lessons"}
          iconBgColor="bg-primary"
        />
        <QuickActionButton
          icon={<Users className="h-5 w-5" />}
          title="Find Players"
          subtitle="Browse members"
          to="/my-locker?tab=find-partner"
          iconBgColor="bg-primary"
        />
        <QuickActionButton
          icon={<Trophy className="h-5 w-5" />}
          title="Compete"
          subtitle="View ladders"
          to="/leagues-ladders"
          iconBgColor="bg-compete"
        />
      </div>
      
      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Coming Up & Performance */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming Activity Snapshot */}
          <UpcomingActivitySnapshot forecast={forecast} />

          {/* Match Play Requests */}
          {matchRequests.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  {isCommunityUser ? 'Match Play Requests' : 'Match Invites'}
                  <span className="ml-auto text-sm font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {matchRequests.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {matchRequests.slice(0, 3).map((request) => (
                    <div key={request.id} className="p-3 rounded-xl border bg-muted/50">
                      <div className="text-sm">
                        <div className="font-medium flex items-center gap-2 mb-2">
                          <span className="capitalize">
                            {request.challenger?.full_name} wants to play {request.match_type?.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(request.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {request.time_start}
                          </div>
                          {request.location && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {request.location}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            onClick={() => handleMatchRequestAction(request.id, 'accept')}
                            className="text-xs flex items-center gap-1"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Accept
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleMatchRequestAction(request.id, 'decline')}
                            className="text-xs flex items-center gap-1"
                          >
                            <XCircle className="h-3 w-3" />
                            Decline
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Player Performance Stats */}
          <PlayerStatsCard />
        </div>

        {/* Right Column - Growth & Community */}
        <div className="space-y-6">
          {/* Profile Completeness / Growth */}
          <ProfileCompletenessCard />

          {/* Community Links */}
          {isCommunityUser && <CommunityLinksCard />}

          {/* Admin Overview - Only for HOA admins */}
          {isAdmin && <AdminQuickOverview />}

          {/* Support Card */}
          <Card className="overflow-hidden bg-primary text-primary-foreground">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-1">Need assistance?</h3>
              <p className="text-sm text-primary-foreground/80 mb-4">
                Our support team is available 24/7 to help you with bookings and matches.
              </p>
              <Button variant="secondary" className="w-full">
                <Headphones className="h-4 w-4 mr-2" />
                Contact Support
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
