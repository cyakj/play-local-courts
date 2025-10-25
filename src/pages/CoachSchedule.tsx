import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin } from 'lucide-react';
import { toast } from 'sonner';

export default function CoachSchedule() {
  const { currentUser } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [upcomingLessons, setUpcomingLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Calendar</CardTitle>
            <CardDescription>Select a date to view lessons</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Lessons</CardTitle>
            <CardDescription>{upcomingLessons.length} lessons scheduled</CardDescription>
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
                          {lesson.player?.full_name || 'Student'}
                        </span>
                        <Badge variant="outline">{lesson.lesson_type}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {new Date(lesson.preferred_date).toLocaleDateString()} at{' '}
                          {lesson.preferred_time_start}
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
    </div>
  );
}
