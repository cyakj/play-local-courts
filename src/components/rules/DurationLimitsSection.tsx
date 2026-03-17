
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Amenity } from '../../types';

interface DurationLimitsSectionProps {
  amenity: Amenity;
  formData: any;
  onUpdate: (field: string, value: any) => void;
}

const DurationLimitsSection = ({ amenity, formData, onUpdate }: DurationLimitsSectionProps) => {
  const isCourtSport = amenity.amenityType === 'tennis' || amenity.amenityType === 'pickleball';
  const maxCeiling = isCourtSport ? 240 : 480;
  const label = isCourtSport ? 'Max Duration per Booking' : 'Max Duration per Reservation';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Duration Limits</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>{label} (minutes): {formData.max_duration_minutes ?? 60}</Label>
          <Slider
            value={[formData.max_duration_minutes ?? 60]}
            onValueChange={([value]) => onUpdate('max_duration_minutes', value)}
            max={maxCeiling}
            min={30}
            step={30}
            className="mt-2"
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default DurationLimitsSection;
