
import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import CalendarSection from '../components/upcoming/CalendarSection';
import UpcomingReservations from '../components/upcoming/UpcomingReservations';
import UpcomingMatchSessions from '../components/upcoming/UpcomingMatchSessions';
import PastMatchSessions from '../components/upcoming/PastMatchSessions';
import EventDetails from '../components/upcoming/EventDetails';

const Upcoming = () => {
  const { currentUser } = useAuth();
  const { bookings } = useData();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const now = new Date();

  // Filter reservations for upcoming events only
  const upcomingReservations = bookings.filter(booking => {
    const bookingDateTime = new Date(`${booking.date}T${booking.startTime}`);
    return bookingDateTime > now;
  });

  // No mock match sessions - these will come from actual data
  const upcomingMatchSessions: any[] = [];
  const pastMatchSessions: any[] = [];

  // Combine all events for calendar and event details - only bookings for now
  const allEvents = [
    ...bookings.map(booking => ({
      id: booking.id,
      type: 'booking' as const,
      title: booking.amenityName,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      playType: booking.playType,
      status: booking.status
    }))
  ];

  // Only show events that are in the future for calendar dots
  const upcomingEvents = allEvents.filter(event => {
    const eventDateTime = new Date(`${event.date}T${event.startTime}`);
    return eventDateTime > now;
  });

  const hasEventsOnDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return allEvents.some(event => event.date === dateStr);
  };

  // Only show green dot for future events
  const hasFutureEventsOnDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Only show green dot if the date is today or in the future AND has events
    if (date >= today && hasEventsOnDate(date)) {
      return true;
    }
    return false;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upcoming Events</h1>
        <p className="text-muted-foreground">
          View your upcoming reservations and match play sessions
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <UpcomingReservations upcomingReservations={upcomingReservations} />
            <UpcomingMatchSessions upcomingMatchSessions={upcomingMatchSessions} />
          </div>
          <PastMatchSessions pastMatchSessions={pastMatchSessions} />
        </TabsContent>

        <TabsContent value="calendar" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <CalendarSection
                currentMonth={currentMonth}
                setCurrentMonth={setCurrentMonth}
                selectedDate={selectedDate}
                handleDateClick={handleDateClick}
                hasFutureEventsOnDate={hasFutureEventsOnDate}
                isToday={isToday}
              />
            </div>
            <div className="lg:col-span-1">
              <EventDetails
                selectedDate={selectedDate}
                events={allEvents}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Upcoming;
