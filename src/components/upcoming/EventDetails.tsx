
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, Users, Calendar } from 'lucide-react';
import { formatTime12Hour } from '@/lib/textUtils';
import { WeatherBadge } from '@/components/weather';
import { useWeather, getWeatherForDate } from '@/hooks/useWeather';

interface Event {
  id: string;
  type: 'booking' | 'match' | 'lesson' | 'ladder' | 'match_request';
  title: string;
  date: string;
  startTime: string;
  endTime?: string | null;
  location?: string;
  playType?: string;
  status?: string;
  opponent?: string;
  coach?: string;
  sport?: string;
}

interface EventDetailsProps {
  selectedDate: Date | null;
  events: Event[];
}

const EventDetails = ({ selectedDate, events }: EventDetailsProps) => {
  // Get weather for event locations
  const getEventLocation = (event: Event) => event.location || null;
  
  // We'll fetch weather based on the first event's location or a default
  const firstEventWithLocation = events.find(e => e.location);
  const { forecast } = useWeather(firstEventWithLocation?.location || 'San Juan');

  if (!selectedDate) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Event Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Select a date to view events</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Format as YYYY-MM-DD using local date to avoid timezone issues
  const selectedDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
  const selectedDateEvents = events.filter(event => event.date === selectedDateStr);

  return (
    <Card className="sticky top-6">
      <CardHeader>
        <CardTitle>
          {selectedDate.toLocaleDateString('en-US', { 
            weekday: 'long',
            month: 'long', 
            day: 'numeric'
          })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {selectedDateEvents.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-muted-foreground">No events on this date</p>
          </div>
        ) : (
          <div className="space-y-4">
            {selectedDateEvents.map(event => {
              const weatherData = getWeatherForDate(forecast, event.date);
              
              return (
                <Card key={event.id} className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <h4 className="font-semibold">{event.title}</h4>
                      <div className="flex items-center gap-2">
                        {weatherData && (
                          <WeatherBadge 
                            temperature={weatherData.temperature} 
                            condition={weatherData.condition}
                            compact
                          />
                        )}
                        {event.status && (
                          <Badge variant={event.status === 'confirmed' ? 'default' : 'secondary'}>
                            {event.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {formatTime12Hour(event.startTime)}{event.endTime && ` - ${formatTime12Hour(event.endTime)}`}
                      </div>
                      
                      {event.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {event.location}
                        </div>
                      )}
                      
                      {event.playType && (
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          {event.playType}
                        </div>
                      )}
                      
                      {event.opponent && (
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          vs {event.opponent}
                        </div>
                      )}
                      
                      {event.coach && (
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Coach: {event.coach}
                        </div>
                      )}
                      
                      {event.sport && (
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Sport: {event.sport}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EventDetails;
