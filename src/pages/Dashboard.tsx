
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
import { UserType } from '../types';
import { 
  Users, 
  Calendar, 
  CalendarCheck, 
  UserCheck, 
  Trophy, 
  MapPin, 
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Sparkles,
  TrendingUp
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
  
  // Filter for upcoming bookings
  const upcomingBookings = bookings.filter(booking => {
    const bookingDateTime = new Date(`${booking.date}T${booking.startTime}`);
    return bookingDateTime > new Date();
  }).sort((a, b) => {
    const dateA = new Date(`${a.date}T${a.startTime}`);
    const dateB = new Date(`${b.date}T${b.startTime}`);
    return dateA.getTime() - dateB.getTime();
  }).slice(0, 3); // Show only next 3 upcoming bookings
  
  return (
    <div className="space-y-8 animate-fade-scale">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div className="animate-slide-up">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
            {isCommunityUser ? 'Dashboard' : 'Tennis Network'}
          </h1>
          <p className="text-muted-foreground">
            {isCommunityUser 
              ? `Welcome to ${currentHOA?.name || 'your HOA'} amenity reservation system.`
              : 'Connect, play, and improve your tennis game.'
            }
          </p>
        </div>
      </div>

      {/* Weather Banner for HOA users */}
      {isCommunityUser && hoaLocation && (
        <WeatherBanner location={hoaLocation} className="animate-slide-up" />
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Match Play Requests Card */}
        <Card className="overflow-hidden group hover:shadow-xl transition-all duration-300 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <CardHeader className="pb-4 bg-gradient-to-br from-green-50 to-emerald-50 relative">
            <div className="absolute top-4 right-4 opacity-20">
              <Trophy className="h-12 w-12 text-green-600" />
            </div>
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-xl">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              {isCommunityUser ? 'Match Play Requests' : 'Match Invites'}
            </CardTitle>
            <CardDescription>
              {isCommunityUser ? 'Invitations to play from other members' : 'Play requests from other tennis players'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="text-4xl font-bold text-green-600">{matchRequests.length}</div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span>Pending invites</span>
              </div>
            </div>
            <div className="space-y-3">
              {matchRequests.length > 0 ? (
                <div className="space-y-3">
                  {matchRequests.slice(0, 2).map((request) => (
                    <Card key={request.id} className="p-3 bg-gradient-to-r from-green-50 to-blue-50 border-l-4 border-l-green-500">
                      <div className="text-sm">
                        <div className="font-medium flex items-center gap-2 mb-2">
                          <Trophy className="h-4 w-4 text-green-600" />
                          {request.challenger?.full_name} {isCommunityUser ? 'has invited you to a' : 'wants to play'} {request.match_type?.replace('_', ' ')}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(request.date).toLocaleDateString('en-US', { weekday: 'long' })}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {request.time_start}
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {request.location}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            onClick={() => handleMatchRequestAction(request.id, 'accept')}
                            className="text-xs flex items-center gap-1 hover:scale-105 transition-transform"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Accept
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleMatchRequestAction(request.id, 'decline')}
                            className="text-xs flex items-center gap-1 hover:scale-105 transition-transform"
                          >
                            <XCircle className="h-3 w-3" />
                            Decline
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                  {matchRequests.length > 2 && (
                    <div className="text-xs text-muted-foreground">
                      +{matchRequests.length - 2} more requests
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <Trophy className="h-8 w-8 mx-auto text-muted-foreground mb-2 opacity-50" />
                  <div className="text-sm text-muted-foreground">No pending requests</div>
                </div>
              )}
            </div>
            <Button asChild className="w-full mt-4" variant="outline">
              <Link to="/my-locker?tab=find-partner" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Find Players
              </Link>
            </Button>
          </CardContent>
        </Card>
        
        {/* Second Card - Reserve Amenity / Find Coach */}
        <Card className="overflow-hidden group hover:shadow-xl transition-all duration-300 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <CardHeader className="pb-4 bg-gradient-to-br from-blue-50 to-indigo-50 relative">
            <div className="absolute top-4 right-4 opacity-20">
              {isCommunityUser ? (
                <CalendarCheck className="h-12 w-12 text-blue-600" />
              ) : (
                <Users className="h-12 w-12 text-blue-600" />
              )}
            </div>
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-xl">
                {isCommunityUser ? (
                  <Calendar className="h-6 w-6 text-blue-600" />
                ) : (
                  <Users className="h-6 w-6 text-blue-600" />
                )}
              </div>
              {isCommunityUser ? 'Reserve an Amenity' : 'Find a Coach'}
            </CardTitle>
            <CardDescription>
              {isCommunityUser 
                ? 'Book courts and amenities at your community' 
                : 'Find certified tennis coaches in your area'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-4">
              <Button asChild className="w-full group hover:scale-105 transition-all duration-200">
                <Link to={isCommunityUser ? "/reserve-court" : "/coach-dashboard"} className="flex items-center gap-2">
                  {isCommunityUser ? (
                    <CalendarCheck className="h-4 w-4 group-hover:rotate-12 transition-transform" />
                  ) : (
                    <Users className="h-4 w-4 group-hover:scale-110 transition-transform" />
                  )}
                  {isCommunityUser ? 'Reserve Court' : 'Find a Coach'}
                </Link>
              </Button>
              <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                <div className="text-sm text-muted-foreground mb-2">
                  {isCommunityUser 
                    ? 'Book tennis courts, pickleball courts, and other amenities'
                    : 'Browse certified coaches, read reviews, and book lessons'
                  }
                </div>
                <div className="flex justify-center gap-4 text-xs text-muted-foreground">
                  {isCommunityUser ? (
                    <>
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        Tennis
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        Pool
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        Clubhouse
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        USPTA Certified
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                        PTR Certified
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Third Card - Competitive Play */}
        <Card className="overflow-hidden group hover:shadow-xl transition-all duration-300 animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <CardHeader className="pb-4 bg-gradient-to-br from-purple-50 to-pink-50 relative">
            <div className="absolute top-4 right-4 opacity-20">
              <Trophy className="h-12 w-12 text-purple-600" />
            </div>
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-xl">
                <Trophy className="h-6 w-6 text-purple-600" />
              </div>
              Competitive Play
            </CardTitle>
            <CardDescription>
              {isCommunityUser ? 'Join community ladders and leagues' : 'Join public ladders and leagues'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-4">
              <Button asChild className="w-full group hover:scale-105 transition-all duration-200" variant="outline">
                <Link to="/leagues-ladders" className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 group-hover:scale-110 transition-transform" />
                  View Ladders
                </Link>
              </Button>
              <div className="text-center p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
                <div className="text-sm text-muted-foreground mb-2">
                  Compete in {isCommunityUser ? 'community' : 'public'} ladders and track your progress
                </div>
                <div className="flex justify-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    Singles
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
                    Doubles
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Admin Panel Card - Only for HOA admins */}
        {isAdmin && (
          <Card className="overflow-hidden group hover:shadow-xl transition-all duration-300 animate-slide-up" style={{ animationDelay: '0.4s' }}>
            <CardHeader className="pb-4 bg-gradient-to-br from-orange-50 to-red-50 relative">
              <div className="absolute top-4 right-4 opacity-20">
                <UserCheck className="h-12 w-12 text-orange-600" />
              </div>
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-xl">
                  <UserCheck className="h-6 w-6 text-orange-600" />
                </div>
                Pending Requests
              </CardTitle>
              <CardDescription>Users waiting for approval</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="text-4xl font-bold text-orange-600">{pendingUsers.length}</div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>Awaiting review</span>
                </div>
              </div>
              <div className="space-y-2">
                {pendingUsers.length > 0 ? (
                  <Button asChild variant="outline" className="w-full group hover:scale-105 transition-all duration-200">
                    <Link to="/pending-requests" className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 group-hover:scale-110 transition-transform" />
                      Review Requests
                    </Link>
                  </Button>
                ) : (
                  <div className="text-center py-4">
                    <UserCheck className="h-8 w-8 mx-auto text-muted-foreground mb-2 opacity-50" />
                    <div className="text-sm text-muted-foreground">No pending requests</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      
      {isCommunityUser && upcomingBookings.length > 0 && (
        <div className="mt-8 animate-slide-up" style={{ animationDelay: '0.4s' }}>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-green-600" />
            Your Upcoming Reservations
          </h2>
          <div className="space-y-4">
            {upcomingBookings.map((booking, index) => {
              const bookingDate = new Date(`${booking.date}T${booking.startTime}`);
              const endTime = new Date(`${booking.date}T${booking.endTime}`);
              
              return (
                <Card key={booking.id} className="overflow-hidden hover:shadow-lg transition-all duration-300 animate-fade-scale" style={{ animationDelay: `${0.5 + index * 0.1}s` }}>
                  <div className="flex flex-col sm:flex-row">
                    <div className="bg-gradient-to-br from-green-500 to-blue-500 p-4 text-white sm:w-32 flex flex-row sm:flex-col justify-between sm:justify-center items-center relative overflow-hidden">
                      <div className="absolute inset-0 bg-white/10 transform -skew-y-12 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                      <div className="text-lg font-medium relative z-10">
                        {bookingDate.toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                      <div className="text-2xl font-bold relative z-10">
                        {bookingDate.getDate()}
                      </div>
                      <Calendar className="absolute bottom-2 right-2 h-4 w-4 opacity-30" />
                    </div>
                    <div className="p-4 flex-1">
                      <div className="font-semibold flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                        {booking.amenityName}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                        <Clock className="h-4 w-4" />
                        {bookingDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - 
                        {endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className="p-4 flex items-center">
                      <Button variant="ghost" asChild size="sm" className="hover:scale-105 transition-transform">
                        <Link to="/my-reservations" className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          View
                        </Link>
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
