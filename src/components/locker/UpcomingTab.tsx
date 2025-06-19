
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [dayEvents, setDayEvents] = useState<UpcomingEvent[]>([]);

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
      // Load accepted match requests where user is either challenger or opponent
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
        title: `${match.match_type?.replace('_', ' ')} Match`,
        location: match.location,
        opponent: match.challenger?.full_name === currentUser.full_name 
          ? match.opponent?.full_name 
          : match.challenger?.full_name
      }));

      setUpcomingEvents(matchEvents);
    } catch (error) {
      console.error('Error loading upcoming matches:', error);
    }
  };

  const combineEvents = () => {
    // Combine reservations and matches
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
    setUpcomingEvents(allEvents);
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = last/Day.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const hasEventsOnDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return upcomingEvents.some(event => event.date === dateStr);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    const dateStr = date.toISOString().split('T')[0];
    const eventsForDay = upcomingEvents.filter(event => event.date === dateStr);
    setDayEvents(eventsForDay);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const days = getDaysInMonth(currentDate);
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Calendar</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth('prev')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-medium min-w-[120px] text-center">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth('next')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map(day => (
              <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => (
              <div key={index} className="aspect-square">
                {day && (
                  <Button
                    variant="ghost"
                    className={`w-full h-full p-1 relative ${
                      isToday(day) ? 'bg-green-500 text-white' : ''
                    } ${
                      selectedDate?.toDateString() === day.toDateString() ? 'ring-2 ring-green-500' : ''
                    }`}
                    onClick={() => handleDateClick(day)}
                  >
                    <span className="text-sm">{day.getDate()}</span>
                    {hasEventsOnDate(day) && !isToday(day) && (
                      <div className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full"></div>
                    )}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedDate && dayEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Events for {selectedDate.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dayEvents.map(event => (
                <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h4 className="font-medium">{event.title}</h4>
                    <div className="text-sm text-muted-foreground">
                      {event.time && <span>{event.time}</span>}
                      {event.location && <span> • {event.location}</span>}
                      {event.opponent && <span> • vs {event.opponent}</span>}
                    </div>
                  </div>
                  <div className="text-xs bg-muted px-2 py-1 rounded">
                    {event.type === 'match' ? 'Match' : 'Reservation'}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedDate && dayEvents.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No events scheduled for this day.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default UpcomingTab;
