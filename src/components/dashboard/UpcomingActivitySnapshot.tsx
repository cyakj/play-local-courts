import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { WeatherBadge } from '@/components/weather/WeatherBadge';
import { getWeatherForDate } from '@/hooks/useWeather';
import { TENNIS_FEATURES_ENABLED } from '@/config/featureFlags';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Trophy, 
  GraduationCap,
  CalendarCheck,
  Waves
} from 'lucide-react';
import { format } from 'date-fns';

interface UpcomingItem {
  id: string;
  type: 'reservation' | 'lesson' | 'match';
  title: string;
  subtitle?: string;
  date: string;
  time: string;
  location?: string;
  icon: React.ReactNode;
  badge?: string;
  avatars?: string[];
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

      // Add upcoming reservations from context (always active)
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
        const isPool = booking.amenityName?.toLowerCase().includes('pool');
        items.push({
          id: booking.id,
          type: 'reservation',
          title: booking.amenityName,
          subtitle: booking.amenityName,
          date: booking.date,
          time: booking.startTime,
          icon: isPool ? <Waves className="h-4 w-4" /> : <CalendarCheck className="h-4 w-4" />,
          badge: 'RESERVATION'
        });
      });

      // Fetch upcoming lessons (only if tennis features enabled)
      if (TENNIS_FEATURES_ENABLED) {
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
              title: 'Personal Training',
              subtitle: `${lesson.sport} Lesson`,
              date: lesson.preferred_date,
              time: lesson.preferred_time_start,
              location: lesson.location || undefined,
              icon: <GraduationCap className="h-4 w-4" />,
              badge: 'LESSON'
            });
          });
        }

        // Fetch upcoming accepted matches
        const { data: matches } = await supabase
          .from('match_requests')
          .select(`
            id, date, time_start, location, match_type,
            challenger:profiles!match_requests_challenger_id_fkey(full_name, avatar_url),
            opponent:profiles!match_requests_opponent_id_fkey(full_name, avatar_url)
          `)
          .or(`challenger_id.eq.${currentUser.id},opponent_id.eq.${currentUser.id}`)
          .eq('status', 'accepted')
          .gte('date', format(now, 'yyyy-MM-dd'))
          .order('date', { ascending: true })
          .limit(3);

        if (matches) {
          matches.forEach((match: any) => {
            const opponent = match.challenger_id === currentUser.id ? match.opponent : match.challenger;
            items.push({
              id: match.id,
              type: 'match',
              title: `${match.match_type?.replace('_', ' ')} Match`,
              subtitle: opponent?.full_name ? `Vs. ${opponent.full_name}` : undefined,
              date: match.date,
              time: match.time_start,
              location: match.location || undefined,
              icon: <Trophy className="h-4 w-4" />,
              badge: 'NEXT MATCH',
              avatars: [match.challenger?.avatar_url, match.opponent?.avatar_url].filter(Boolean)
            });
          });
        }
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.getTime() === today.getTime()) {
      return 'Today';
    } else if (date.getTime() === tomorrow.getTime()) {
      return 'Tomorrow';
    }
    return format(date, 'EEEE');
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
              <div key={i} className="h-20 bg-muted rounded-xl"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Coming Up
          </div>
          <Link to="/upcoming" className="text-sm font-medium text-primary hover:underline">
            View All
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {upcomingItems.length > 0 ? (
          upcomingItems.map((item, index) => {
            const weatherData = getWeatherForDate(forecast, item.date);
            const isFirst = index === 0;
            
            return (
              <div
                key={`${item.type}-${item.id}`}
                className={`rounded-xl border transition-all ${
                  isFirst 
                    ? 'bg-primary text-primary-foreground p-4 border-primary' 
                    : 'bg-card p-3 border-border hover:border-primary/20'
                }`}
              >
                {isFirst && item.badge && (
                  <Badge variant="secondary" className="mb-2 bg-primary-foreground/20 text-primary-foreground text-xs">
                    {item.badge}
                  </Badge>
                )}
                
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className={`font-semibold ${isFirst ? 'text-lg' : 'text-sm'} capitalize`}>
                      {item.title}
                    </div>
                    {item.subtitle && (
                      <div className={`text-sm ${isFirst ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                        {item.subtitle}
                      </div>
                    )}
                    
                    <div className={`flex items-center gap-3 mt-2 text-xs ${isFirst ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(item.date)}, {formatTime12Hour(item.time)}
                      </span>
                      {item.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {item.location}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {item.avatars && item.avatars.length > 0 && (
                    <div className="flex -space-x-2">
                      {item.avatars.slice(0, 2).map((avatar, idx) => (
                        <Avatar key={idx} className="w-8 h-8 border-2 border-background">
                          <AvatarImage src={avatar} />
                          <AvatarFallback className="bg-muted text-xs">
                            {idx === 0 ? 'P1' : 'P2'}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  )}
                  
                  {!isFirst && weatherData && (
                    <WeatherBadge 
                      temperature={weatherData.temperature} 
                      condition={weatherData.condition}
                      compact
                    />
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground mb-3">No upcoming activities</p>
            <Button asChild size="sm">
              <Link to="/reserve-court">Book an amenity</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
