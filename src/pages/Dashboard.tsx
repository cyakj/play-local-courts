
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import PendingApprovalMessage from '../components/PendingApprovalMessage';

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
  const { currentUser, isAdmin, isPending } = useAuth();
  const { toast } = useToast();
  const { 
    bookings,
    pendingUsers,
    currentHOA,
    loading
  } = useData();
  
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

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show pending approval message if user is pending
  if (isPending) {
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
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome to {currentHOA?.name || 'your HOA'} amenity reservation system.
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Match Play Requests Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Match Play Requests</CardTitle>
            <CardDescription>Invitations to play from other members</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{matchRequests.length}</div>
            <div className="mt-4 space-y-2">
              {matchRequests.length > 0 ? (
                <div className="space-y-3">
                  {matchRequests.slice(0, 2).map((request) => (
                    <Card key={request.id} className="p-3">
                      <div className="text-sm">
                        <div className="font-medium">🎾 {request.challenger?.full_name} has invited you to a {request.match_type?.replace('_', ' ')} for {new Date(request.date).toLocaleDateString('en-US', { weekday: 'long' })} {request.time_start} at {request.location}.</div>
                        <div className="flex gap-2 mt-2">
                          <Button 
                            size="sm" 
                            onClick={() => handleMatchRequestAction(request.id, 'accept')}
                            className="text-xs"
                          >
                            Accept
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleMatchRequestAction(request.id, 'decline')}
                            className="text-xs"
                          >
                            Decline
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            className="text-xs"
                          >
                            Message
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
                <div className="text-sm text-muted-foreground">No pending requests</div>
              )}
            </div>
          </CardContent>
        </Card>
        
        {isAdmin && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Pending Requests</CardTitle>
              <CardDescription>Users waiting for approval</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{pendingUsers.length}</div>
              <div className="mt-4 space-y-2">
                {pendingUsers.length > 0 ? (
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/pending-requests">Review Requests</Link>
                  </Button>
                ) : (
                  <div className="text-sm text-muted-foreground">No pending requests</div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      
      {upcomingBookings.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Your Upcoming Reservations</h2>
          <div className="space-y-4">
            {upcomingBookings.map((booking) => {
              const bookingDate = new Date(`${booking.date}T${booking.startTime}`);
              const endTime = new Date(`${booking.date}T${booking.endTime}`);
              
              return (
                <Card key={booking.id} className="overflow-hidden">
                  <div className="flex flex-col sm:flex-row">
                    <div className="bg-primary p-4 text-white sm:w-32 flex flex-row sm:flex-col justify-between sm:justify-center items-center">
                      <div className="text-lg font-medium">
                        {bookingDate.toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                      <div className="text-2xl font-bold">
                        {bookingDate.getDate()}
                      </div>
                    </div>
                    <div className="p-4 flex-1">
                      <div className="font-semibold">{booking.amenityName}</div>
                      <div className="text-sm text-muted-foreground">
                        {bookingDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - 
                        {endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className="p-4 flex items-center">
                      <Button variant="ghost" asChild size="sm">
                        <Link to="/my-reservations">View</Link>
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
