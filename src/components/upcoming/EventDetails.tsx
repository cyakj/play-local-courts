
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, MapPin, Users, Calendar } from 'lucide-react';

interface Event {
  id: string;
  type: 'booking' | 'match';
  title: string;
  date: string;
  startTime: string;
  endTime?: string;
  location?: string;
  playType?: string;
  status?: string;
  opponent?: string;
}

interface EventDetailsProps {
  selectedDate: Date | null;
  events: Event[];
}

const EventDetails = ({ selectedDate, events }: EventDetailsProps) => {
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

  const selectedDateEvents = events.filter(event => 
    event.date === selectedDate.toISOString().split('T')[0]
  );

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
            {selectedDateEvents.map(event => (
              <Card key={event.id} className="p-4">
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <h4 className="font-semibold">{event.title}</h4>
                    {event.status && (
                      <Badge variant={event.status === 'confirmed' ? 'default' : 'secondary'}>
                        {event.status}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {event.startTime}{event.endTime && ` - ${event.endTime}`}
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
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EventDetails;
