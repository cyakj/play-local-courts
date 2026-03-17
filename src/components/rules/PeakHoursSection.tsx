
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { TimeSelect } from '@/components/ui/time-select';
import { Amenity } from '../../types';

interface PeakHoursSectionProps {
  amenity: Amenity;
  formData: any;
  onUpdate: (field: string, value: any) => void;
}

const PeakHoursSection = ({ amenity, formData, onUpdate }: PeakHoursSectionProps) => {
  const isCourtSport = amenity.amenityType === 'tennis' || amenity.amenityType === 'pickleball';
  const maxCeiling = isCourtSport ? 120 : 240;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Peak Hour Restrictions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Enable Peak Hour Restrictions</Label>
          <Switch
            checked={formData.enable_peak_hours}
            onCheckedChange={(checked) => onUpdate('enable_peak_hours', checked)}
          />
        </div>
        
        {formData.enable_peak_hours && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Peak Start Time</Label>
                <TimeSelect
                  value={formData.peak_start_time}
                  onChange={(value) => onUpdate('peak_start_time', value)}
                  placeholder="Select start time"
                />
              </div>
              <div>
                <Label>Peak End Time</Label>
                <TimeSelect
                  value={formData.peak_end_time}
                  onChange={(value) => onUpdate('peak_end_time', value)}
                  placeholder="Select end time"
                />
              </div>
            </div>
            
            <div>
              <Label>Peak Max Duration (minutes): {formData.peak_max_duration_minutes ?? 30}</Label>
              <Slider
                value={[formData.peak_max_duration_minutes ?? 30]}
                onValueChange={([value]) => onUpdate('peak_max_duration_minutes', value)}
                max={maxCeiling}
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

export default PeakHoursSection;
