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
import { WeatherBanner } from '@/components/weather';
import { useWeather } from '@/hooks/useWeather';
import { ActiveHOAIndicator } from '@/components/community/ActiveHOAIndicator';
import { 
  UpcomingActivitySnapshot,
  ActionRequiredAlerts,
  PlayerStatsCard,
  SuggestedActionsCard,
  ProfileCompletenessCard,
  AdminQuickOverview,
  CommunitySignals
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
  GraduationCap
} from 'lucide-react';

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
          <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto"></div>
          <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-r-blue-600 rounded-full animate-spin mx-auto" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
          <Sparkles className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-green-600" />
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
      {/* Header with Active HOA Indicator */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="animate-slide-up">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
            {isCommunityUser ? 'Dashboard' : 'Tennis Network'}
          </h1>
          <p className="text-muted-foreground">
            {isCommunityUser 
              ? `Welcome back! Here's what's happening.`
              : 'Connect, play, and improve your tennis game.'
            }
          </p>
        </div>
        {isCommunityUser && <ActiveHOAIndicator />}
      </div>

      {/* Action Required Alerts */}
      <ActionRequiredAlerts />

      {/* Weather Banner for HOA users */}
      {isCommunityUser && hoaLocation && (
        <WeatherBanner location={hoaLocation} className="animate-slide-up" />
      )}
      
      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Status & Awareness */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming Activity Snapshot */}
          <UpcomingActivitySnapshot forecast={forecast} />

          {/* Match Play Requests */}
          {matchRequests.length > 0 && (
            <Card className="overflow-hidden animate-slide-up">
              <CardHeader className="pb-3 bg-gradient-to-r from-green-50 to-emerald-50">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-green-600" />
                  {isCommunityUser ? 'Match Play Requests' : 'Match Invites'}
                  <span className="ml-auto text-sm font-normal bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    {matchRequests.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  {matchRequests.slice(0, 3).map((request) => (
                    <Card key={request.id} className="p-3 bg-gradient-to-r from-green-50/50 to-blue-50/50 border-l-4 border-l-green-500">
                      <div className="text-sm">
                        <div className="font-medium flex items-center gap-2 mb-2">
                          <Trophy className="h-4 w-4 text-green-600" />
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
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Reserve/Find Coach */}
            <Card className="overflow-hidden hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-3 bg-gradient-to-br from-blue-50 to-indigo-50">
                <CardTitle className="text-base flex items-center gap-2">
                  {isCommunityUser ? (
                    <>
                      <CalendarCheck className="h-5 w-5 text-blue-600" />
                      Reserve Amenity
                    </>
                  ) : (
                    <>
                      <GraduationCap className="h-5 w-5 text-blue-600" />
                      Find a Coach
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <Button asChild className="w-full">
                  <Link to={isCommunityUser ? "/reserve-court" : "/my-locker?tab=lessons"}>
                    {isCommunityUser ? 'Book Now' : 'Browse Coaches'}
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Find Players */}
            <Card className="overflow-hidden hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-3 bg-gradient-to-br from-green-50 to-emerald-50">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-5 w-5 text-green-600" />
                  Find Players
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <Button asChild variant="outline" className="w-full">
                  <Link to="/my-locker?tab=find-partner">
                    Browse Players
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Competitive Play */}
            <Card className="overflow-hidden hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-3 bg-gradient-to-br from-compete/5 to-compete/10">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-compete" />
                  Compete
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <Button asChild variant="outline" className="w-full border-compete/20 text-compete hover:bg-compete/10">
                  <Link to="/leagues-ladders">
                    View Ladders
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Column - Progress, Discovery, Admin */}
        <div className="space-y-6">
          {/* Player Stats */}
          <PlayerStatsCard />

          {/* Profile Completeness */}
          <ProfileCompletenessCard />

          {/* Suggested Actions */}
          <SuggestedActionsCard />

          {/* Admin Overview - Only for HOA admins */}
          {isAdmin && <AdminQuickOverview />}

          {/* Community Signals */}
          {isCommunityUser && <CommunitySignals />}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
