
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Duration Limits by Play Type</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(amenity.amenityType === 'tennis' || amenity.amenityType === 'pickleball') && (
          <>
            <div>
              <Label>Singles Duration (minutes): {formData.singles_duration_minutes}</Label>
              <Slider
                value={[formData.singles_duration_minutes]}
                onValueChange={([value]) => onUpdate('singles_duration_minutes', value)}
                max={240}
                min={15}
                step={15}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Doubles Duration (minutes): {formData.doubles_duration_minutes}</Label>
              <Slider
                value={[formData.doubles_duration_minutes]}
                onValueChange={([value]) => onUpdate('doubles_duration_minutes', value)}
                max={240}
                min={15}
                step={15}
                className="mt-2"
              />
            </div>
          </>
        )}
        
        {(amenity.amenityType === 'pool' || amenity.amenityType === 'barbecue' || amenity.amenityType === 'jacuzzi' || amenity.amenityType === 'clubhouse') && (
          <>
            <div>
              <Label>Family Duration (minutes): {formData.family_duration_minutes}</Label>
              <Slider
                value={[formData.family_duration_minutes]}
                onValueChange={([value]) => onUpdate('family_duration_minutes', value)}
                max={480}
                min={15}
                step={15}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Group Duration (minutes): {formData.group_duration_minutes}</Label>
              <Slider
                value={[formData.group_duration_minutes]}
                onValueChange={([value]) => onUpdate('group_duration_minutes', value)}
                max={480}
                min={15}
                step={15}
                className="mt-2"
              />
            </div>
          </>
        )}
        
        {amenity.amenityType === 'gym' && (
          <>
            <div>
              <Label>Singles Duration (minutes): {formData.singles_duration_minutes}</Label>
              <Slider
                value={[formData.singles_duration_minutes]}
                onValueChange={([value]) => onUpdate('singles_duration_minutes', value)}
                max={240}
                min={15}
                step={15}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Group Duration (minutes): {formData.group_duration_minutes}</Label>
              <Slider
                value={[formData.group_duration_minutes]}
                onValueChange={([value]) => onUpdate('group_duration_minutes', value)}
                max={240}
                min={15}
                step={15}
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
