
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from 'lucide-react';

interface BookingLimitsSectionProps {
  maxReservationsPerDay: number;
  maxReservationsPerWeek: number;
  advanceBookingDays: number;
  onUpdate: (field: string, value: any) => void;
}

const BookingLimitsSection = ({ maxReservationsPerDay, maxReservationsPerWeek, advanceBookingDays, onUpdate }: BookingLimitsSectionProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Booking Limits
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Max per Day</Label>
            <Input
              type="number"
              min="1"
              max="10"
              value={maxReservationsPerDay}
              onChange={(e) => onUpdate('max_reservations_per_day', parseInt(e.target.value))}
            />
          </div>
          <div>
            <Label>Max per Week</Label>
            <Input
              type="number"
              min="1"
              max="14"
              value={maxReservationsPerWeek}
              onChange={(e) => onUpdate('max_reservations_per_week', parseInt(e.target.value))}
            />
          </div>
        </div>
        
        <div>
          <Label>Advance Booking (days)</Label>
          <Input
            type="number"
            min="1"
            max="30"
            value={advanceBookingDays}
            onChange={(e) => onUpdate('advance_booking_days', parseInt(e.target.value))}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default BookingLimitsSection;
