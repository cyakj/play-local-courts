import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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
  TrendingUp,
  Search,
  User,
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

const NonHOADashboard = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [matchRequests, setMatchRequests] = useState<MatchRequest[]>([]);

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

  return (
    <div className="space-y-8 animate-fade-scale">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div className="animate-slide-up">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
            Tennis Network Dashboard
          </h1>
          <p className="text-muted-foreground">
            Welcome to your tennis networking hub! Connect, play, and improve your game.
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Match Play Network Card */}
        <Card className="overflow-hidden group hover:shadow-xl transition-all duration-300 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <CardHeader className="pb-4 bg-gradient-to-br from-green-50 to-emerald-50 relative">
            <div className="absolute top-4 right-4 opacity-20">
              <Trophy className="h-12 w-12 text-green-600" />
            </div>
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-xl">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              Match Invites
            </CardTitle>
            <CardDescription>Play requests from other tennis players</CardDescription>
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
                          {request.challenger?.full_name} wants to play {request.match_type?.replace('_', ' ')}
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
                  <div className="text-sm text-muted-foreground">No pending invites</div>
                </div>
              )}
            </div>
            <Button asChild className="w-full mt-4" variant="outline">
              <Link to="/my-locker" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Find Players
              </Link>
            </Button>
          </CardContent>
        </Card>
        
        {/* Discover Courts Card */}
        <Card className="overflow-hidden group hover:shadow-xl transition-all duration-300 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <CardHeader className="pb-4 bg-gradient-to-br from-blue-50 to-indigo-50 relative">
            <div className="absolute top-4 right-4 opacity-20">
              <Search className="h-12 w-12 text-blue-600" />
            </div>
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-xl">
                <Search className="h-6 w-6 text-blue-600" />
              </div>
              Discover Courts
            </CardTitle>
            <CardDescription>Find public courts and partner facilities</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-4">
              <div className="text-center p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border-2 border-dashed border-blue-200">
                <Search className="h-12 w-12 mx-auto text-blue-500 mb-4" />
                <div className="text-lg font-semibold text-blue-800 mb-2">
                  Coming Soon!
                </div>
                <div className="text-sm text-blue-600">
                  We're partnering with public courts and clubs to bring you searchable court availability.
                </div>
              </div>
              <div className="flex justify-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Public Courts
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  Partner Clubs
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  Indoor Courts
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Find a Coach Card */}
        <Card className="overflow-hidden group hover:shadow-xl transition-all duration-300 animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <CardHeader className="pb-4 bg-gradient-to-br from-orange-50 to-red-50 relative">
            <div className="absolute top-4 right-4 opacity-20">
              <GraduationCap className="h-12 w-12 text-orange-600" />
            </div>
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-xl">
                <GraduationCap className="h-6 w-6 text-orange-600" />
              </div>
              Tennis Coaching
            </CardTitle>
            <CardDescription>Find certified tennis coaches in your area</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-4">
              <Button asChild className="w-full group hover:scale-105 transition-all duration-200">
                <Link to="/coach-dashboard" className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 group-hover:rotate-12 transition-transform" />
                  Find a Coach
                </Link>
              </Button>
              <div className="text-center p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-xl">
                <div className="text-sm text-muted-foreground mb-2">
                  Browse certified coaches, read reviews, and book lessons
                </div>
                <div className="flex justify-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    USPTA Certified
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    PTR Certified
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Leagues & Ladders Card */}
        <Card className="overflow-hidden group hover:shadow-xl transition-all duration-300 animate-slide-up" style={{ animationDelay: '0.4s' }}>
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
            <CardDescription>Join public ladders and leagues</CardDescription>
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
                  Compete in public ladders and track your progress
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

        {/* My Stats Card */}
        <Card className="overflow-hidden group hover:shadow-xl transition-all duration-300 animate-slide-up" style={{ animationDelay: '0.5s' }}>
          <CardHeader className="pb-4 bg-gradient-to-br from-cyan-50 to-teal-50 relative">
            <div className="absolute top-4 right-4 opacity-20">
              <TrendingUp className="h-12 w-12 text-cyan-600" />
            </div>
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 bg-cyan-100 rounded-xl">
                <TrendingUp className="h-6 w-6 text-cyan-600" />
              </div>
              My Tennis Stats
            </CardTitle>
            <CardDescription>Track your progress and achievements</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-4">
              <Button asChild className="w-full group hover:scale-105 transition-all duration-200" variant="outline">
                <Link to="/my-locker" className="flex items-center gap-2">
                  <User className="h-4 w-4 group-hover:scale-110 transition-transform" />
                  View Profile
                </Link>
              </Button>
              <div className="text-center p-4 bg-gradient-to-r from-cyan-50 to-teal-50 rounded-xl">
                <div className="text-sm text-muted-foreground mb-2">
                  Update your ratings, view match history, and set preferences
                </div>
                <div className="flex justify-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-cyan-500 rounded-full"></div>
                    NTRP Rating
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
                    Match History
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* My Reservations Card */}
        <Card className="overflow-hidden group hover:shadow-xl transition-all duration-300 animate-slide-up" style={{ animationDelay: '0.6s' }}>
          <CardHeader className="pb-4 bg-gradient-to-br from-emerald-50 to-green-50 relative">
            <div className="absolute top-4 right-4 opacity-20">
              <CalendarCheck className="h-12 w-12 text-emerald-600" />
            </div>
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-xl">
                <CalendarCheck className="h-6 w-6 text-emerald-600" />
              </div>
              My Schedule
            </CardTitle>
            <CardDescription>Upcoming matches and lessons</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-4">
              <Button asChild className="w-full group hover:scale-105 transition-all duration-200" variant="outline">
                <Link to="/my-reservations" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 group-hover:rotate-12 transition-transform" />
                  View Schedule
                </Link>
              </Button>
              <div className="text-center p-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl">
                <div className="text-sm text-muted-foreground mb-2">
                  Keep track of your matches, lessons, and tennis activities
                </div>
                <div className="flex justify-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    Matches
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    Lessons
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NonHOADashboard;