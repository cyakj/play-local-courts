
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Amenity } from '../../types';

interface PeakHoursSectionProps {
  amenity: Amenity;
  formData: any;
  onUpdate: (field: string, value: any) => void;
}

const PeakHoursSection = ({ amenity, formData, onUpdate }: PeakHoursSectionProps) => {
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
                <Input
                  type="time"
                  value={formData.peak_start_time}
                  onChange={(e) => onUpdate('peak_start_time', e.target.value)}
                />
              </div>
              <div>
                <Label>Peak End Time</Label>
                <Input
                  type="time"
                  value={formData.peak_end_time}
                  onChange={(e) => onUpdate('peak_end_time', e.target.value)}
                />
              </div>
            </div>
            
            {(amenity.amenityType === 'tennis' || amenity.amenityType === 'pickleball') && (
              <>
                <div>
                  <Label>Peak Singles Duration (minutes): {formData.peak_singles_duration_minutes}</Label>
                  <Slider
                    value={[formData.peak_singles_duration_minutes]}
                    onValueChange={([value]) => onUpdate('peak_singles_duration_minutes', value)}
                    max={120}
                    min={15}
                    step={15}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Peak Doubles Duration (minutes): {formData.peak_doubles_duration_minutes}</Label>
                  <Slider
                    value={[formData.peak_doubles_duration_minutes]}
                    onValueChange={([value]) => onUpdate('peak_doubles_duration_minutes', value)}
                    max={120}
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
                  <Label>Peak Family Duration (minutes): {formData.peak_family_duration_minutes}</Label>
                  <Slider
                    value={[formData.peak_family_duration_minutes]}
                    onValueChange={([value]) => onUpdate('peak_family_duration_minutes', value)}
                    max={240}
                    min={15}
                    step={15}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Peak Group Duration (minutes): {formData.peak_group_duration_minutes}</Label>
                  <Slider
                    value={[formData.peak_group_duration_minutes]}
                    onValueChange={([value]) => onUpdate('peak_group_duration_minutes', value)}
                    max={240}
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
                  <Label>Peak Singles Duration (minutes): {formData.peak_singles_duration_minutes}</Label>
                  <Slider
                    value={[formData.peak_singles_duration_minutes]}
                    onValueChange={([value]) => onUpdate('peak_singles_duration_minutes', value)}
                    max={120}
                    min={15}
                    step={15}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Peak Group Duration (minutes): {formData.peak_group_duration_minutes}</Label>
                  <Slider
                    value={[formData.peak_group_duration_minutes]}
                    onValueChange={([value]) => onUpdate('peak_group_duration_minutes', value)}
                    max={120}
                    min={15}
                    step={15}
                    className="mt-2"
                  />
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PeakHoursSection;
