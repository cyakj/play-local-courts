
import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { supabase } from '../integrations/supabase/client';
import CalendarSection from '../components/upcoming/CalendarSection';
import UpcomingReservations from '../components/upcoming/UpcomingReservations';
import UpcomingMatchSessions from '../components/upcoming/UpcomingMatchSessions';
import PastMatchSessions from '../components/upcoming/PastMatchSessions';
import EventDetails from '../components/upcoming/EventDetails';
import { UserType } from '../types';
import { formatMatchType, capitalizeWords } from '@/lib/textUtils';

const Upcoming = () => {
  const { currentUser } = useAuth();
  const { bookings } = useData();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [upcomingLessons, setUpcomingLessons] = useState<any[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<any[]>([]);
  const [upcomingLadderMatches, setUpcomingLadderMatches] = useState<any[]>([]);
  const [acceptedMatchRequests, setAcceptedMatchRequests] = useState<any[]>([]);

  const now = new Date();
  const isNonHOA = currentUser?.userType === UserType.NON_HOA;

  // Filter reservations for upcoming events only (only for HOA users)
  const upcomingReservations = isNonHOA ? [] : bookings.filter(booking => {
    const bookingDateTime = new Date(`${booking.date}T${booking.startTime}`);
    return bookingDateTime > now;
  });

  // Load lessons for non-HOA users
  // Load lessons for ALL users (including accepted status)
  useEffect(() => {
    const loadUpcomingLessons = async () => {
      if (!currentUser?.id) return;

      try {
        // Fetch lesson requests with accepted or confirmed status
        const { data: lessons, error } = await supabase
          .from('lesson_requests')
          .select('*')
          .eq('player_id', currentUser.id)
          .in('status', ['accepted', 'confirmed'])
          .gte('preferred_date', new Date().toISOString().split('T')[0])
          .order('preferred_date', { ascending: true });

        if (error) throw error;

        // Manually fetch coach data
        if (lessons && lessons.length > 0) {
          const coachIds = [...new Set(lessons.map(l => l.coach_id))];
          
          const { data: coachProfiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', coachIds);
          
          const { data: coachData } = await supabase
            .from('coaches')
            .select('user_id, business_name')
            .in('user_id', coachIds);

          // Attach coach data
          lessons.forEach((lesson: any) => {
            const profile = coachProfiles?.find(p => p.id === lesson.coach_id);
            const coach = coachData?.find(c => c.user_id === lesson.coach_id);
            lesson.coach = {
              business_name: coach?.business_name,
              profiles: profile
            };
          });
        }

        setUpcomingLessons(lessons || []);
      } catch (error) {
        console.error('Error loading lessons:', error);
      }
    };

    loadUpcomingLessons();
  }, [currentUser?.id]);

  // Load upcoming matches
  useEffect(() => {
    const loadUpcomingMatches = async () => {
      if (!currentUser?.id) return;

      try {
        const { data: matches } = await supabase
          .from('matches')
          .select(`
            *,
            player1:profiles!matches_player1_id_fkey(full_name),
            player2:profiles!matches_player2_id_fkey(full_name),
            player3:profiles!matches_player3_id_fkey(full_name),
            player4:profiles!matches_player4_id_fkey(full_name)
          `)
          .or(`player1_id.eq.${currentUser.id},player2_id.eq.${currentUser.id},player3_id.eq.${currentUser.id},player4_id.eq.${currentUser.id}`)
          .gte('date', new Date().toISOString().split('T')[0])
          .order('date', { ascending: true });

        setUpcomingMatches(matches || []);
      } catch (error) {
        console.error('Error loading matches:', error);
      }
    };

    loadUpcomingMatches();
  }, [currentUser?.id]);

  // Load accepted match requests
  useEffect(() => {
    const loadAcceptedMatchRequests = async () => {
      if (!currentUser?.id) return;

      try {
        const { data: matchRequests } = await supabase
          .from('match_requests')
          .select(`
            *,
            challenger:profiles!match_requests_challenger_id_fkey(full_name),
            opponent:profiles!match_requests_opponent_id_fkey(full_name)
          `)
          .eq('status', 'accepted')
          .or(`challenger_id.eq.${currentUser.id},opponent_id.eq.${currentUser.id}`)
          .gte('date', new Date().toISOString().split('T')[0])
          .order('date', { ascending: true });

        setAcceptedMatchRequests(matchRequests || []);
      } catch (error) {
        console.error('Error loading accepted match requests:', error);
      }
    };

    loadAcceptedMatchRequests();
  }, [currentUser?.id]);

  // Load upcoming ladder matches
  useEffect(() => {
    const loadUpcomingLadderMatches = async () => {
      if (!currentUser?.id) return;

      try {
        const { data: ladderMatches } = await supabase
          .from('ladder_matches')
          .select(`
            *,
            ladder:ladders(name),
            team1:ladder_teams!ladder_matches_team1_id_fkey(
              team_name,
              player1:profiles!ladder_teams_player1_id_fkey(full_name),
              player2:profiles!ladder_teams_player2_id_fkey(full_name)
            ),
            team2:ladder_teams!ladder_matches_team2_id_fkey(
              team_name,
              player1:profiles!ladder_teams_player1_id_fkey(full_name),
              player2:profiles!ladder_teams_player2_id_fkey(full_name)
            )
          `)
          .or(`team1.player1_id.eq.${currentUser.id},team1.player2_id.eq.${currentUser.id},team2.player1_id.eq.${currentUser.id},team2.player2_id.eq.${currentUser.id}`)
          .eq('status', 'pending')
          .gte('scheduled_date', new Date().toISOString().split('T')[0])
          .order('scheduled_date', { ascending: true });

        setUpcomingLadderMatches(ladderMatches || []);
      } catch (error) {
        console.error('Error loading ladder matches:', error);
      }
    };

    loadUpcomingLadderMatches();
  }, [currentUser?.id]);

  // Helper function to get opponent name from match request
  function getMatchRequestOpponentName(request: any) {
    if (request.challenger_id === currentUser?.id) {
      return request.opponent?.full_name || 'Unknown';
    }
    return request.challenger?.full_name || 'Unknown';
  }

  // Combine all match sessions for display
  const upcomingMatchSessions = [
    ...upcomingMatches.map(match => ({
      id: match.id,
      type: 'match',
      opponent: getOpponentName(match),
      match_type: match.match_type,
      date: match.date,
      time_start: match.time_start,
      location: match.location
    })),
    ...acceptedMatchRequests.map(request => ({
      id: request.id,
      type: 'match_request',
      opponent: getMatchRequestOpponentName(request),
      match_type: request.match_type || 'Match',
      date: request.date,
      time_start: request.time_start || '12:00',
      location: request.location || 'TBD'
    })),
    ...upcomingLadderMatches.map(match => ({
      id: match.id,
      type: 'ladder',
      opponent: getOpponentTeamName(match),
      match_type: 'Ladder Match',
      date: match.scheduled_date,
      time_start: match.scheduled_time || '12:00',
      location: match.ladder?.name || 'TBD'
    }))
  ];

  const pastMatchSessions: any[] = [];

  // Helper function to get opponent name
  function getOpponentName(match: any) {
    const players = [match.player1, match.player2, match.player3, match.player4].filter(Boolean);
    const currentPlayerName = currentUser?.fullName;
    return players.find(p => p?.full_name !== currentPlayerName)?.full_name || 'Unknown';
  }

  // Helper function to get opponent team name
  function getOpponentTeamName(match: any) {
    // Determine which team the current user is on
    const isOnTeam1 = match.team1?.player1?.id === currentUser?.id || match.team1?.player2?.id === currentUser?.id;
    const opponentTeam = isOnTeam1 ? match.team2 : match.team1;
    return opponentTeam?.team_name || 'Unknown Team';
  }

  // Combine all events for calendar and event details
  const allEvents = [
    // Bookings (only for HOA users)
    ...(isNonHOA ? [] : bookings.map(booking => ({
      id: booking.id,
      type: 'booking' as const,
      title: booking.amenityName,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      playType: booking.playType,
      status: booking.status
    }))),
    // Lessons (for all users with accepted/confirmed lessons)
    ...upcomingLessons.map(lesson => ({
      id: lesson.id,
      type: 'lesson' as const,
      title: `${capitalizeWords(lesson.lesson_type)} Lesson`,
      date: lesson.preferred_date,
      startTime: lesson.preferred_time_start,
      endTime: lesson.preferred_time_end,
      coach: lesson.coach?.business_name || lesson.coach?.profiles?.full_name,
      sport: lesson.sport,
      location: lesson.location,
      status: lesson.status
    })),
    // Matches
    ...upcomingMatches.map(match => ({
      id: match.id,
      type: 'match' as const,
      title: `${formatMatchType(match.match_type)} Match`,
      date: match.date,
      startTime: match.time_start,
      endTime: match.time_end,
      opponent: getOpponentName(match),
      location: match.location
    })),
    // Accepted match requests
    ...acceptedMatchRequests.map(request => ({
      id: request.id,
      type: 'match_request' as const,
      title: `${formatMatchType(request.match_type)} Match`,
      date: request.date,
      startTime: request.time_start || '12:00',
      endTime: request.time_end || null,
      opponent: getMatchRequestOpponentName(request),
      location: request.location || 'TBD',
      status: 'accepted'
    })),
    // Ladder matches
    ...upcomingLadderMatches.map(match => ({
      id: match.id,
      type: 'ladder' as const,
      title: `Ladder Match`,
      date: match.scheduled_date,
      startTime: match.scheduled_time || '12:00',
      endTime: null,
      opponent: getOpponentTeamName(match),
      location: match.ladder?.name
    }))
  ];

  // Only show events that are in the future for calendar dots
  const upcomingEvents = allEvents.filter(event => {
    const eventDateTime = new Date(`${event.date}T${event.startTime}`);
    return eventDateTime > now;
  });

  const hasEventsOnDate = (date: Date) => {
    // Format as YYYY-MM-DD using local date to avoid timezone issues
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return allEvents.some(event => event.date === dateStr);
  };

  // Only show green dot for future events
  const hasFutureEventsOnDate = (date: Date) => {
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
            {!isNonHOA && <UpcomingReservations upcomingReservations={upcomingReservations} />}
            <UpcomingMatchSessions upcomingMatchSessions={upcomingMatchSessions} />
          </div>
          {isNonHOA && upcomingLessons.length > 0 && (
            <div className="bg-card rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Upcoming Lessons</h3>
              <div className="space-y-3">
                {upcomingLessons.slice(0, 5).map((lesson) => (
                  <div key={lesson.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <div className="font-medium">{capitalizeWords(lesson.lesson_type)} Lesson</div>
                      <div className="text-sm text-muted-foreground">
                        {lesson.sport} • {lesson.preferred_date} at {lesson.preferred_time_start}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Coach: {lesson.coach?.business_name || lesson.coach?.profiles?.full_name}
                      </div>
                    </div>
                  </div>
                ))}
                {upcomingLessons.length > 5 && (
                  <div className="text-center text-sm text-muted-foreground">
                    +{upcomingLessons.length - 5} more lessons
                  </div>
                )}
              </div>
            </div>
          )}
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
