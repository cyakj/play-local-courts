
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useData } from '../../contexts/DataContext';

interface UpcomingEvent {
  id: string;
  type: 'reservation' | 'match';
  date: string;
  time?: string;
  title: string;
  location?: string;
  opponent?: string;
}

const UpcomingTab = () => {
  const { currentUser } = useAuth();
  const { bookings } = useData();
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);

  useEffect(() => {
    if (currentUser) {
      loadUpcomingMatches();
    }
  }, [currentUser]);

  useEffect(() => {
    combineEvents();
  }, [bookings]);

  const loadUpcomingMatches = async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('match_requests')
        .select(`
          id,
          date,
          time_start,
          location,
          match_type,
          challenger:profiles!match_requests_challenger_id_fkey(full_name),
          opponent:profiles!match_requests_opponent_id_fkey(full_name)
        `)
        .or(`challenger_id.eq.${currentUser.id},opponent_id.eq.${currentUser.id}`)
        .eq('status', 'accepted')
        .gte('date', new Date().toISOString().split('T')[0]);

      if (error) throw error;

      const matchEvents: UpcomingEvent[] = (data || []).map(match => ({
        id: match.id,
        type: 'match',
        date: match.date,
        time: match.time_start,
        title: `${match.match_type?.replace('_', ' ')} Match`.replace(/\b\w/g, l => l.toUpperCase()),
        location: match.location,
        opponent: match.challenger?.full_name === currentUser.fullName 
          ? match.opponent?.full_name 
          : match.challenger?.full_name
      }));

      setUpcomingEvents(matchEvents);
    } catch (error) {
      console.error('Error loading upcoming matches:', error);
    }
  };

  const combineEvents = () => {
    const reservationEvents: UpcomingEvent[] = bookings
      .filter(booking => new Date(`${booking.date}T${booking.startTime}`) > new Date())
      .map(booking => ({
        id: booking.id,
        type: 'reservation',
        date: booking.date,
        time: booking.startTime,
        title: booking.amenityName,
        location: 'Community Amenity'
      }));

    const allEvents = [...upcomingEvents, ...reservationEvents];
    
    // Sort events by date
    allEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    setUpcomingEvents(allEvents);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Your Upcoming Events</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingEvents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No upcoming events scheduled.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Visit the main Upcoming page to book amenities or check your calendar.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingEvents.slice(0, 5).map(event => {
                const eventDate = new Date(event.date);
                return (
                  <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <div className="text-sm font-medium">
                          {eventDate.toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                        <div className="text-lg font-bold">
                          {eventDate.getDate()}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium">{event.title}</h4>
                        <div className="text-sm text-muted-foreground">
                          {event.time && <span>{event.time}</span>}
                          {event.location && <span> • {event.location}</span>}
                          {event.opponent && <span> • vs {event.opponent}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs bg-muted px-2 py-1 rounded">
                      {event.type === 'match' ? 'Match' : 'Reservation'}
                    </div>
                  </div>
                );
              })}
              {upcomingEvents.length > 5 && (
                <p className="text-sm text-muted-foreground text-center mt-4">
                  And {upcomingEvents.length - 5} more events...
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UpcomingTab;
