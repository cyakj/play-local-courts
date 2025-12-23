import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, MapPin, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { toast } from 'sonner';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { formatTime12Hour } from '@/lib/textUtils';
import WeeklyCalendarView from '@/components/WeeklyCalendarView';
import { startOfWeek } from 'date-fns';

export default function CoachSchedule() {
  const { currentUser } = useAuth();
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [upcomingLessons, setUpcomingLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUpcomingLessonsCallback = useCallback(() => {
    loadUpcomingLessons();
  }, [currentUser]);

  // Real-time subscription for lesson request updates
  useRealtimeSubscription({
    table: 'lesson_requests',
    event: '*',
    filter: currentUser?.id ? `coach_id=eq.${currentUser.id}` : undefined,
    onChange: loadUpcomingLessonsCallback,
    enabled: !!currentUser?.id
  });

  useEffect(() => {
    loadUpcomingLessons();
  }, [currentUser]);

  const loadUpcomingLessons = async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('lesson_requests')
        .select('*')
        .eq('coach_id', currentUser.id)
        .eq('status', 'accepted')
        .gte('preferred_date', new Date().toISOString().split('T')[0])
        .order('preferred_date', { ascending: true })
        .order('preferred_time_start', { ascending: true });

      if (error) throw error;

      // Manually fetch player profiles
      if (data && data.length > 0) {
        const playerIds = [...new Set(data.map(r => r.player_id))];
        const { data: playersData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', playerIds);

        // Attach player data to lessons
        data.forEach((lesson: any) => {
          lesson.player = playersData?.find(p => p.id === lesson.player_id);
        });
      }

      setUpcomingLessons(data || []);
    } catch (error) {
      console.error('Error loading lessons:', error);
      toast.error('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  // Convert lessons to weekly calendar format
  const weeklyTimeSlots = useMemo(() => {
    return upcomingLessons.map(lesson => ({
      id: lesson.id,
      date: lesson.preferred_date,
      startTime: lesson.preferred_time_start,
      endTime: lesson.preferred_time_end,
      title: lesson.player?.full_name || 'Student',
      subtitle: `${lesson.lesson_type} - ${lesson.sport}`,
      color: 'bg-green-500',
      type: 'lesson'
    }));
  }, [upcomingLessons]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentMonth);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentMonth(newDate);
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];
    
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

  const hasLessonsOnDate = (date: Date): boolean => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return upcomingLessons.some(lesson => lesson.preferred_date === dateStr);
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
  };

  const getLessonsForSelectedDate = () => {
    if (!selectedDate) return [];
    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
    return upcomingLessons.filter(lesson => lesson.preferred_date === dateStr);
  };

  const days = getDaysInMonth(currentMonth);
  const lessonsForSelectedDate = getLessonsForSelectedDate();

  if (loading) {
    return <div className="p-6">Loading schedule...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
          My Schedule
        </h1>
        <p className="text-muted-foreground mt-2">
          View and manage your upcoming lessons
        </p>
      </div>

      <Tabs defaultValue="weekly" className="space-y-6">
        <TabsList>
          <TabsTrigger value="weekly">Weekly View</TabsTrigger>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly" className="space-y-6">
          <WeeklyCalendarView
            title="Weekly Schedule"
            currentWeekStart={currentWeekStart}
            onWeekChange={setCurrentWeekStart}
            timeSlots={weeklyTimeSlots}
            startHour={7}
            endHour={20}
            emptyMessage="No lessons scheduled this week"
            mode="events"
          />
        </TabsContent>

        <TabsContent value="calendar" className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Large Calendar - Takes 2 columns on large screens */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Calendar</span>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigateMonth('prev')}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="font-medium min-w-[140px] text-center">
                      {currentMonth.toLocaleDateString('en-US', { 
                        month: 'long', 
                        year: 'numeric' 
                      })}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigateMonth('next')}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-1 mb-4">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {days.map((day, index) => (
                    <div key={index} className="aspect-square">
                      {day && (
                        <Button
                          variant={selectedDate?.toDateString() === day.toDateString() ? "default" : "ghost"}
                          className={`w-full h-full p-0 relative ${
                            isToday(day) ? 'bg-primary text-primary-foreground' : ''
                          }`}
                          onClick={() => handleDateClick(day)}
                        >
                          <span className="text-sm">{day.getDate()}</span>
                          {hasLessonsOnDate(day) && (
                            <div className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full"></div>
                          )}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Selected Date Details */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {selectedDate ? selectedDate.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric' 
                  }) : 'Select a Date'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {lessonsForSelectedDate.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No lessons scheduled for this day
                  </p>
                ) : (
                  lessonsForSelectedDate.map((lesson) => (
                    <div
                      key={lesson.id}
                      className="p-4 border rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="font-semibold">
                          {lesson.lesson_type} Lesson
                        </span>
                        <Badge variant="secondary">accepted</Badge>
                      </div>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          {formatTime12Hour(lesson.preferred_time_start)} - {formatTime12Hour(lesson.preferred_time_end)}
                        </div>
                        {lesson.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            {lesson.location}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          {lesson.player?.full_name || 'Unknown Student'}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* All Upcoming Lessons List */}
      <Card>
        <CardHeader>
          <CardTitle>All Upcoming Lessons</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {upcomingLessons.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No upcoming lessons scheduled
            </p>
          ) : (
            upcomingLessons.map((lesson) => (
              <div
                key={lesson.id}
                className="p-4 border rounded-lg hover:bg-accent transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        {lesson.player?.full_name || 'Unknown Student'}
                      </span>
                      <Badge variant="outline">{lesson.lesson_type}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {new Date(lesson.preferred_date).toLocaleDateString()} at{' '}
                        {formatTime12Hour(lesson.preferred_time_start)}
                      </div>
                      {lesson.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {lesson.location}
                        </div>
                      )}
                    </div>
                    {lesson.notes && (
                      <p className="text-sm text-muted-foreground">{lesson.notes}</p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
