import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { supabase } from '@/integrations/supabase/client';
import { AmenityStatus } from '../types';
import { Link } from 'react-router-dom';

interface UpcomingEvent {
  id: string;
  type: 'reservation' | 'match';
  date: string;
  time?: string;
  title: string;
  location?: string;
  opponent?: string;
}

interface MatchSession {
  id: string;
  date: string;
  time_start: string;
  location: string;
  match_type: string;
  opponent: string;
}

const Upcoming = () => {
  const { currentUser } = useAuth();
  const { bookings, amenities, bookAmenity, cancelBooking } = useData();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [dayEvents, setDayEvents] = useState<UpcomingEvent[]>([]);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [selectedAmenity, setSelectedAmenity] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [matchSessions, setMatchSessions] = useState<MatchSession[]>([]);

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
      const today = new Date().toISOString().split('T')[0];
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
        .gte('date', today);

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

      const sessions: MatchSession[] = (data || []).map(match => ({
        id: match.id,
        date: match.date,
        time_start: match.time_start,
        location: match.location,
        match_type: match.match_type,
        opponent: match.challenger?.full_name === currentUser.fullName 
          ? match.opponent?.full_name 
          : match.challenger?.full_name
      }));

      setUpcomingEvents(matchEvents);
      setMatchSessions(sessions);
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
    setUpcomingEvents(allEvents);
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
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

  const canBookDate = (date: Date) => {
    const today = new Date();
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 7);
    return date >= today && date <= maxDate;
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    const dateStr = date.toISOString().split('T')[0];
    const eventsForDay = upcomingEvents.filter(event => event.date === dateStr);
    setDayEvents(eventsForDay);
  };

  const handleBookAmenity = async () => {
    if (!selectedDate || !selectedAmenity || !selectedTime || !currentUser) return;

    const amenity = amenities.find(a => a.id === selectedAmenity);
    if (!amenity) return;

    const startTime = new Date(`2000-01-01T${selectedTime}`);
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 1);

    const timeSlot = {
      id: `${selectedAmenity}-${selectedDate.toISOString().split('T')[0]}-${selectedTime}`,
      start: `${selectedDate.toISOString().split('T')[0]}T${selectedTime}:00`,
      end: `${selectedDate.toISOString().split('T')[0]}T${endTime.toTimeString().slice(0, 5)}:00`,
      status: AmenityStatus.AVAILABLE
    };

    await bookAmenity(
      currentUser.id,
      currentUser.fullName,
      selectedAmenity,
      amenity.name,
      selectedDate.toISOString().split('T')[0],
      timeSlot
    );

    setShowBookingForm(false);
    setSelectedAmenity('');
    setSelectedTime('');
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

  // Separate upcoming and past bookings for reservations tab - filter for future events only
  const now = new Date();
  const upcomingBookings = bookings.filter(booking => {
    const bookingDateTime = new Date(`${booking.date}T${booking.startTime}`);
    return bookingDateTime > now;
  });
  const pastBookings = bookings.filter(booking => {
    const bookingDateTime = new Date(`${booking.date}T${booking.startTime}`);
    return bookingDateTime <= now;
  });

  // Filter match sessions for future events only
  const upcomingMatchSessions = matchSessions.filter(session => {
    const sessionDateTime = new Date(`${session.date}T${session.time_start}`);
    return sessionDateTime > now;
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Upcoming</h1>
      </div>

      <Tabs defaultValue="calendar" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="reservations">Reservations</TabsTrigger>
          <TabsTrigger value="matchplay">Match Play</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
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
                          } ${
                            !canBookDate(day) ? 'opacity-50' : ''
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

            {selectedDate && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>
                      {selectedDate.toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </CardTitle>
                    {canBookDate(selectedDate) && (
                      <Button onClick={() => setShowBookingForm(!showBookingForm)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Book Amenity
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {showBookingForm && canBookDate(selectedDate) && (
                    <div className="mb-6 p-4 border rounded-lg space-y-4">
                      <h4 className="font-medium">Book an Amenity</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Amenity</label>
                          <select
                            value={selectedAmenity}
                            onChange={(e) => setSelectedAmenity(e.target.value)}
                            className="w-full p-2 border rounded"
                          >
                            <option value="">Select amenity</option>
                            {amenities.map(amenity => (
                              <option key={amenity.id} value={amenity.id}>
                                {amenity.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Time</label>
                          <select
                            value={selectedTime}
                            onChange={(e) => setSelectedTime(e.target.value)}
                            className="w-full p-2 border rounded"
                          >
                            <option value="">Select time</option>
                            {Array.from({ length: 12 }, (_, i) => i + 8).map(hour => (
                              <option key={hour} value={`${hour.toString().padStart(2, '0')}:00`}>
                                {hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleBookAmenity} disabled={!selectedAmenity || !selectedTime}>
                          Book
                        </Button>
                        <Button variant="outline" onClick={() => setShowBookingForm(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {dayEvents.length > 0 ? (
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
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      No events scheduled for this day.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="reservations">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Upcoming Reservations</CardTitle>
                  <Button asChild>
                    <Link to="/reserve-court">Reserve Court</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {upcomingBookings.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">You don't have any upcoming reservations</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {upcomingBookings.map(booking => {
                      const startTime = new Date(`${booking.date}T${booking.startTime}`);
                      const endTime = new Date(`${booking.date}T${booking.endTime}`);
                      
                      return (
                        <Card key={booking.id} className="overflow-hidden">
                          <div className="flex flex-col sm:flex-row">
                            <div className="bg-green-500 p-4 text-white sm:w-32 flex flex-row sm:flex-col justify-between sm:justify-center items-center">
                              <div className="text-lg font-medium">
                                {startTime.toLocaleDateString('en-US', { weekday: 'short' })}
                              </div>
                              <div className="text-2xl font-bold">
                                {startTime.getDate()}
                              </div>
                            </div>
                            <div className="p-4 flex-1">
                              <div className="font-semibold">{booking.amenityName}</div>
                              <div className="text-sm text-muted-foreground">
                                {startTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                {' • '}
                                {startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - 
                                {endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                            <div className="p-4 flex items-center">
                              <Button 
                                variant="destructive" 
                                size="sm"
                                onClick={() => {
                                  if (window.confirm('Are you sure you want to cancel this reservation?')) {
                                    cancelBooking(booking.id);
                                  }
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {pastBookings.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Past Reservations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {pastBookings.slice(0, 5).map(booking => {
                      const startTime = new Date(`${booking.date}T${booking.startTime}`);
                      const endTime = new Date(`${booking.date}T${booking.endTime}`);
                      
                      return (
                        <Card key={booking.id} className="overflow-hidden bg-gray-50">
                          <div className="flex flex-col sm:flex-row">
                            <div className="bg-gray-200 p-4 text-gray-700 sm:w-32 flex flex-row sm:flex-col justify-between sm:justify-center items-center">
                              <div className="text-lg font-medium">
                                {startTime.toLocaleDateString('en-US', { weekday: 'short' })}
                              </div>
                              <div className="text-2xl font-bold">
                                {startTime.getDate()}
                              </div>
                            </div>
                            <div className="p-4 flex-1">
                              <div className="font-semibold">{booking.amenityName}</div>
                              <div className="text-sm text-muted-foreground">
                                {startTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                {' • '}
                                {startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - 
                                {endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="matchplay">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Match Play Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingMatchSessions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No upcoming match play sessions scheduled.</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Visit My Locker to find a partner and schedule matches.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {upcomingMatchSessions.map(session => {
                      const sessionDate = new Date(session.date);
                      
                      return (
                        <Card key={session.id} className="overflow-hidden">
                          <div className="flex flex-col sm:flex-row">
                            <div className="bg-blue-500 p-4 text-white sm:w-32 flex flex-row sm:flex-col justify-between sm:justify-center items-center">
                              <div className="text-lg font-medium">
                                {sessionDate.toLocaleDateString('en-US', { weekday: 'short' })}
                              </div>
                              <div className="text-2xl font-bold">
                                {sessionDate.getDate()}
                              </div>
                            </div>
                            <div className="p-4 flex-1">
                              <div className="font-semibold">
                                {session.match_type?.replace('_', ' ')} Match
                              </div>
                              <div className="text-sm text-muted-foreground">
                                vs {session.opponent} • {session.time_start} • {session.location}
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Upcoming;
