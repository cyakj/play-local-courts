
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
  const isGym = amenity.amenityType === 'gym';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Duration Limits</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isCourtSport && (
          <>
            <div>
              <Label>Singles Max Duration (minutes): {formData.singles_duration_minutes ?? 60}</Label>
              <Slider
                value={[formData.singles_duration_minutes ?? 60]}
                onValueChange={([value]) => onUpdate('singles_duration_minutes', value)}
                max={240}
                min={30}
                step={30}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Doubles Max Duration (minutes): {formData.doubles_duration_minutes ?? 90}</Label>
              <Slider
                value={[formData.doubles_duration_minutes ?? 90]}
                onValueChange={([value]) => onUpdate('doubles_duration_minutes', value)}
                max={240}
                min={30}
                step={30}
                className="mt-2"
              />
            </div>
          </>
        )}

        {!isCourtSport && !isGym && (
          <>
            <div>
              <Label>Family Max Duration (minutes): {formData.family_duration_minutes ?? 120}</Label>
              <Slider
                value={[formData.family_duration_minutes ?? 120]}
                onValueChange={([value]) => onUpdate('family_duration_minutes', value)}
                max={480}
                min={30}
                step={30}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Group Max Duration (minutes): {formData.group_duration_minutes ?? 120}</Label>
              <Slider
                value={[formData.group_duration_minutes ?? 120]}
                onValueChange={([value]) => onUpdate('group_duration_minutes', value)}
                max={480}
                min={30}
                step={30}
                className="mt-2"
              />
            </div>
          </>
        )}

        {isGym && (
          <>
            <div>
              <Label>Individual Max Duration (minutes): {formData.singles_duration_minutes ?? 60}</Label>
              <Slider
                value={[formData.singles_duration_minutes ?? 60]}
                onValueChange={([value]) => onUpdate('singles_duration_minutes', value)}
                max={240}
                min={30}
                step={30}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Group Max Duration (minutes): {formData.group_duration_minutes ?? 120}</Label>
              <Slider
                value={[formData.group_duration_minutes ?? 120]}
                onValueChange={([value]) => onUpdate('group_duration_minutes', value)}
                max={240}
                min={30}
                step={30}
                className="mt-2"
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default DurationLimitsSection;
