
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clock } from 'lucide-react';

interface BookingHoursSectionProps {
  bookingStartTime: string;
  bookingEndTime: string;
  onUpdate: (field: string, value: any) => void;
}

const BookingHoursSection = ({ bookingStartTime, bookingEndTime, onUpdate }: BookingHoursSectionProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Booking Hours
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Start Time</Label>
            <Input
              type="time"
              value={bookingStartTime}
              onChange={(e) => onUpdate('booking_start_time', e.target.value)}
            />
          </div>
          <div>
            <Label>End Time</Label>
            <Input
              type="time"
              value={bookingEndTime}
              onChange={(e) => onUpdate('booking_end_time', e.target.value)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BookingHoursSection;
