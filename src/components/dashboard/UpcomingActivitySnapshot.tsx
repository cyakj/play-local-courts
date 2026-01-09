import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { WeatherBadge } from '@/components/weather/WeatherBadge';
import { getWeatherForDate } from '@/hooks/useWeather';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Trophy, 
  GraduationCap,
  CalendarCheck,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';

interface UpcomingItem {
  id: string;
  type: 'reservation' | 'lesson' | 'match';
  title: string;
  date: string;
  time: string;
  location?: string;
  icon: React.ReactNode;
}

interface UpcomingActivitySnapshotProps {
  forecast?: Record<string, { temperature: number; condition: 'sunny' | 'partly_cloudy' | 'cloudy' | 'rainy' | 'stormy'; description: string }>;
}

export const UpcomingActivitySnapshot = ({ forecast = {} }: UpcomingActivitySnapshotProps) => {
  const { currentUser } = useAuth();
  const { bookings } = useData();
  const [upcomingItems, setUpcomingItems] = useState<UpcomingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      loadUpcomingActivity();
    }
  }, [currentUser, bookings]);

  const loadUpcomingActivity = async () => {
    if (!currentUser) return;
    
    try {
      const now = new Date();
      const items: UpcomingItem[] = [];

      // Add upcoming reservations from context
      const upcomingBookings = bookings
        .filter(booking => {
          const bookingDateTime = new Date(`${booking.date}T${booking.startTime}`);
          return bookingDateTime > now;
        })
        .sort((a, b) => {
          const dateA = new Date(`${a.date}T${a.startTime}`);
          const dateB = new Date(`${b.date}T${b.startTime}`);
          return dateA.getTime() - dateB.getTime();
        })
        .slice(0, 3);

      upcomingBookings.forEach(booking => {
        items.push({
          id: booking.id,
          type: 'reservation',
          title: booking.amenityName,
          date: booking.date,
          time: booking.startTime,
          icon: <CalendarCheck className="h-4 w-4 text-blue-600" />
        });
      });

      // Fetch upcoming lessons
      const { data: lessons } = await supabase
        .from('lesson_requests')
        .select('id, preferred_date, preferred_time_start, location, sport')
        .eq('player_id', currentUser.id)
        .eq('status', 'accepted')
        .gte('preferred_date', format(now, 'yyyy-MM-dd'))
        .order('preferred_date', { ascending: true })
        .limit(3);

      if (lessons) {
        lessons.forEach(lesson => {
          items.push({
            id: lesson.id,
            type: 'lesson',
            title: `${lesson.sport} Lesson`,
            date: lesson.preferred_date,
            time: lesson.preferred_time_start,
            location: lesson.location || undefined,
            icon: <GraduationCap className="h-4 w-4 text-green-600" />
          });
        });
      }

      // Fetch upcoming accepted matches
      const { data: matches } = await supabase
        .from('match_requests')
        .select('id, date, time_start, location, match_type')
        .or(`challenger_id.eq.${currentUser.id},opponent_id.eq.${currentUser.id}`)
        .eq('status', 'accepted')
        .gte('date', format(now, 'yyyy-MM-dd'))
        .order('date', { ascending: true })
        .limit(3);

      if (matches) {
        matches.forEach(match => {
          items.push({
            id: match.id,
            type: 'match',
            title: `${match.match_type?.replace('_', ' ')} Match`,
            date: match.date,
            time: match.time_start,
            location: match.location || undefined,
            icon: <Trophy className="h-4 w-4 text-compete" />
          });
        });
      }

      // Sort all items by date/time and take top 3
      const sortedItems = items.sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}`);
        const dateB = new Date(`${b.date}T${b.time}`);
        return dateA.getTime() - dateB.getTime();
      }).slice(0, 3);

      setUpcomingItems(sortedItems);
    } catch (error) {
      console.error('Error loading upcoming activity:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime12Hour = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader className="pb-3">
          <div className="h-5 bg-muted rounded w-1/3"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-muted rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Coming Up
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {upcomingItems.length > 0 ? (
          <div className="space-y-3">
            {upcomingItems.map((item) => {
              const weatherData = getWeatherForDate(forecast, item.date);
              return (
                <div
                  key={`${item.type}-${item.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex-shrink-0 p-2 bg-background rounded-lg">
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate capitalize">
                      {item.title}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(item.date + 'T00:00:00'), 'EEE, MMM d')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime12Hour(item.time)}
                      </span>
                    </div>
                  </div>
                  {weatherData && (
                    <WeatherBadge 
                      temperature={weatherData.temperature} 
                      condition={weatherData.condition}
                      compact
                    />
                  )}
                </div>
              );
            })}
            <Button asChild variant="ghost" size="sm" className="w-full mt-2">
              <Link to="/upcoming" className="flex items-center gap-1">
                View All
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        ) : (
          <div className="text-center py-6">
            <Calendar className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No upcoming activities</p>
            <Button asChild variant="link" size="sm" className="mt-2">
              <Link to="/reserve-court">Book an amenity</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
