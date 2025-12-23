
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { TimeSelect } from '@/components/ui/time-select';
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
            <TimeSelect
              value={bookingStartTime}
              onChange={(value) => onUpdate('booking_start_time', value)}
              placeholder="Select start time"
            />
          </div>
          <div>
            <Label>End Time</Label>
            <TimeSelect
              value={bookingEndTime}
              onChange={(value) => onUpdate('booking_end_time', value)}
              placeholder="Select end time"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BookingHoursSection;
