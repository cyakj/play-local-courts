
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Amenity } from '../../types';

interface AmenitySpecificSectionProps {
  amenity: Amenity;
  formData: any;
  onUpdate: (field: string, value: any) => void;
}

const AmenitySpecificSection = ({ amenity, formData, onUpdate }: AmenitySpecificSectionProps) => {
  if (amenity.amenityType === 'tennis' || amenity.amenityType === 'pickleball') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Court-Specific Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Allow Ball Machine</Label>
            <Switch
              checked={formData.allow_ball_machine}
              onCheckedChange={(checked) => onUpdate('allow_ball_machine', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Singles</Label>
            <Switch
              checked={formData.singles_only}
              onCheckedChange={(checked) => onUpdate('singles_only', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Doubles</Label>
            <Switch
              checked={formData.doubles_only}
              onCheckedChange={(checked) => onUpdate('doubles_only', checked)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Toggle on to allow residents to book that play type. At least one must be enabled.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (amenity.amenityType === 'clubhouse') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Clubhouse Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Security Deposit Required</Label>
            <Switch
              checked={formData.security_deposit_required}
              onCheckedChange={(checked) => onUpdate('security_deposit_required', checked)}
            />
          </div>
          {formData.security_deposit_required && (
            <div>
              <Label>Security Deposit Amount ($)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.security_deposit_amount}
                onChange={(e) => onUpdate('security_deposit_amount', parseFloat(e.target.value))}
              />
            </div>
          )}
          <div className="flex items-center justify-between">
            <Label>Power Outlet Access</Label>
            <Switch
              checked={formData.requires_power_outlet}
              onCheckedChange={(checked) => onUpdate('requires_power_outlet', checked)}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (amenity.amenityType === 'pool' || amenity.amenityType === 'barbecue') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{amenity.amenityType === 'pool' ? 'Pool' : 'BBQ'} Area Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Cleanup Agreement Required</Label>
            <Switch
              checked={formData.requires_cleanup_agreement}
              onCheckedChange={(checked) => onUpdate('requires_cleanup_agreement', checked)}
            />
          </div>
          {amenity.amenityType === 'pool' && (
            <div className="flex items-center justify-between">
              <Label>No Lifeguard Acknowledgment</Label>
              <Switch
                checked={formData.no_lifeguard_acknowledgment}
                onCheckedChange={(checked) => onUpdate('no_lifeguard_acknowledgment', checked)}
              />
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return null;
};

export default AmenitySpecificSection;
