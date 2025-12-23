
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatTime12Hour } from '@/lib/textUtils';

interface Booking {
  id: string;
  amenityName: string;
  date: string;
  startTime: string;
  endTime: string;
  playType?: string;
  status: string;
}

interface UpcomingReservationsProps {
  upcomingReservations: Booking[];
}

const UpcomingReservations = ({ upcomingReservations }: UpcomingReservationsProps) => {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Upcoming Reservations</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {upcomingReservations.length === 0 ? (
          <div className="text-center py-8">
            <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No upcoming reservations</p>
            <Button 
              variant="outline"
              onClick={() => navigate('/reserve-court')}
            >
              Reserve Amenity
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {upcomingReservations.slice(0, 5).map(booking => {
              const bookingDate = new Date(booking.date);
              
              return (
                <Card key={booking.id} className="overflow-hidden">
                  <div className="flex flex-col sm:flex-row">
                    <div className="bg-primary text-primary-foreground p-4 sm:w-32 flex flex-row sm:flex-col justify-between sm:justify-center items-center">
                      <div className="text-lg font-medium">
                        {bookingDate.toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                      <div className="text-2xl font-bold">
                        {bookingDate.getDate()}
                      </div>
                    </div>
                    <div className="p-4 flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-semibold">{booking.amenityName}</div>
                        <Badge variant={booking.status === 'confirmed' ? 'default' : 'secondary'}>
                          {booking.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {formatTime12Hour(booking.startTime)} - {formatTime12Hour(booking.endTime)}
                        </div>
                        {booking.playType && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {booking.playType}
                          </div>
                        )}
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
  );
};

export default UpcomingReservations;
