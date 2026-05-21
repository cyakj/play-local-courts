
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Users } from 'lucide-react';

interface GuestPoliciesSectionProps {
  allowGuests: boolean;
  maxGuestCount: number;
  checkinRequiredMinutes: number;
  onUpdate: (field: string, value: any) => void;
}

const GuestPoliciesSection = ({ allowGuests, maxGuestCount, checkinRequiredMinutes, onUpdate }: GuestPoliciesSectionProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Guest Policies
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Allow Guests</Label>
          <Switch
            checked={allowGuests}
            onCheckedChange={(checked) => onUpdate('allow_guests', checked)}
          />
        </div>

        {allowGuests && (
          <div>
            <Label>Maximum Guest Count</Label>
            <Input
              type="number"
              min="1"
              max="20"
              value={maxGuestCount}
              onChange={(e) => onUpdate('max_guest_count', parseInt(e.target.value))}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GuestPoliciesSection;
