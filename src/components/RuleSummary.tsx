
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Clock, Calendar, Users, Shield, AlertCircle } from 'lucide-react';
import { Amenity } from '../types';

interface RuleSummaryProps {
  amenity: Amenity;
  rules: any;
}

const RuleSummary = ({ amenity, rules }: RuleSummaryProps) => {
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  return (
    <Card className="sticky top-6">
      <CardHeader>
        <CardTitle className="text-lg">Rule Summary</CardTitle>
        <Badge variant="outline" className="w-fit">
          {amenity.amenityType}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Booking Hours */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4" />
            <span className="font-medium">Booking Hours</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatTime(rules.booking_start_time)} - {formatTime(rules.booking_end_time)}
          </p>
        </div>

        <Separator />

        {/* Duration */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4" />
            <span className="font-medium">Duration</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Maximum {rules.max_duration_minutes} minutes
          </p>
        </div>

        <Separator />

        {/* Booking Limits */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4" />
            <span className="font-medium">Booking Limits</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {rules.max_reservations_per_day} per day, {rules.max_reservations_per_week} per week
          </p>
          <p className="text-sm text-muted-foreground">
            Book up to {rules.advance_booking_days} days ahead
          </p>
        </div>

        <Separator />

        {/* Guests */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4" />
            <span className="font-medium">Guests</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {rules.allow_guests ? `Up to ${rules.max_guest_count} guests allowed` : 'No guests allowed'}
          </p>
        </div>

        <Separator />

        {/* Peak Hours */}
        {rules.enable_peak_hours && (
          <>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">Peak Hours</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {formatTime(rules.peak_start_time)} - {formatTime(rules.peak_end_time)}
              </p>
              <p className="text-sm text-muted-foreground">
                {rules.peak_max_duration_minutes} min limit during peak
              </p>
            </div>
            <Separator />
          </>
        )}

        {/* Admin Requirements */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4" />
            <span className="font-medium">Requirements</span>
          </div>
          <div className="space-y-1">
            {rules.requires_admin_approval && (
              <Badge variant="secondary" className="text-xs">Admin Approval</Badge>
            )}
            {rules.security_deposit_required && (
              <Badge variant="secondary" className="text-xs">
                ${rules.security_deposit_amount} Deposit
              </Badge>
            )}
            {rules.requires_cleanup_agreement && (
              <Badge variant="secondary" className="text-xs">Cleanup Agreement</Badge>
            )}
            {rules.no_lifeguard_acknowledgment && (
              <Badge variant="secondary" className="text-xs">No Lifeguard</Badge>
            )}
          </div>
        </div>

        <Separator />

        {/* Cancellation */}
        <div>
          <span className="font-medium">Cancellation Policy</span>
          <p className="text-sm text-muted-foreground">
            Cancel at least {rules.min_cancellation_hours} hours before
          </p>
        </div>

        {/* Custom Rules */}
        {rules.custom_rules && (
          <>
            <Separator />
            <div>
              <span className="font-medium">Additional Rules</span>
              <p className="text-sm text-muted-foreground mt-1">
                {rules.custom_rules}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default RuleSummary;
