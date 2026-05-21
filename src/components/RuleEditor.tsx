import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save } from 'lucide-react';
import { Amenity } from '../types';
import { useAmenityRules } from '../hooks/useAmenityRules';
import { useToast } from '@/hooks/use-toast';
import RuleSummary from './RuleSummary';
import BookingHoursSection from './rules/BookingHoursSection';
import DurationLimitsSection from './rules/DurationLimitsSection';
import BookingLimitsSection from './rules/BookingLimitsSection';
import GuestPoliciesSection from './rules/GuestPoliciesSection';
import PeakHoursSection from './rules/PeakHoursSection';
import AmenitySpecificSection from './rules/AmenitySpecificSection';
import AdminControlsSection from './rules/AdminControlsSection';
import CustomRulesSection from './rules/CustomRulesSection';

interface RuleEditorProps {
  amenity: Amenity;
  onBack: () => void;
}

const RuleEditor = ({ amenity, onBack }: RuleEditorProps) => {
  const { rules, loading, saveRules } = useAmenityRules(amenity.id);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    booking_start_time: '07:00',
    booking_end_time: '21:00',
    singles_duration_minutes: 60,
    doubles_duration_minutes: 90,
    family_duration_minutes: 120,
    group_duration_minutes: 120,
    max_reservations_per_day: 1,
    max_reservations_per_week: 3,
    min_time_between_reservations: 0,
    advance_booking_days: 7,
    allow_guests: true,
    checkin_required_minutes: 15,
    min_cancellation_hours: 24,
    max_no_shows: 3,
    no_show_restriction_days: 30,
    enable_peak_hours: false,
    peak_start_time: '17:00',
    peak_end_time: '19:00',
    peak_singles_duration_minutes: 30,
    peak_doubles_duration_minutes: 45,
    peak_family_duration_minutes: 60,
    peak_group_duration_minutes: 60,
    requires_admin_approval: false,
    security_deposit_required: false,
    security_deposit_amount: 0,
    max_guest_count: 4,
    requires_cleanup_agreement: false,
    allow_ball_machine: false,
    singles_only: false,
    doubles_only: false,
    requires_power_outlet: false,
    no_lifeguard_acknowledgment: false,
    custom_rules: ''
  });

  useEffect(() => {
    if (rules) {
      setFormData({
        booking_start_time: rules.booking_start_time || '07:00',
        booking_end_time: rules.booking_end_time || '21:00',
        singles_duration_minutes: rules.singles_duration_minutes || 60,
        doubles_duration_minutes: rules.doubles_duration_minutes || 90,
        family_duration_minutes: rules.family_duration_minutes || 120,
        group_duration_minutes: rules.group_duration_minutes || 120,
        max_reservations_per_day: rules.max_reservations_per_day || 1,
        max_reservations_per_week: rules.max_reservations_per_week || 3,
        min_time_between_reservations: rules.min_time_between_reservations || 0,
        advance_booking_days: rules.advance_booking_days || 7,
        allow_guests: rules.allow_guests ?? true,
        checkin_required_minutes: rules.checkin_required_minutes || 15,
        min_cancellation_hours: rules.min_cancellation_hours || 24,
        max_no_shows: rules.max_no_shows || 3,
        no_show_restriction_days: rules.no_show_restriction_days || 30,
        enable_peak_hours: rules.enable_peak_hours ?? false,
        peak_start_time: rules.peak_start_time || '17:00',
        peak_end_time: rules.peak_end_time || '19:00',
        peak_singles_duration_minutes: rules.peak_singles_duration_minutes || 30,
        peak_doubles_duration_minutes: rules.peak_doubles_duration_minutes || 45,
        peak_family_duration_minutes: rules.peak_family_duration_minutes || 60,
        peak_group_duration_minutes: rules.peak_group_duration_minutes || 60,
        requires_admin_approval: rules.requires_admin_approval ?? false,
        security_deposit_required: rules.security_deposit_required ?? false,
        security_deposit_amount: rules.security_deposit_amount || 0,
        max_guest_count: rules.max_guest_count || 4,
        requires_cleanup_agreement: rules.requires_cleanup_agreement ?? false,
        allow_ball_machine: rules.allow_ball_machine ?? false,
        singles_only: rules.singles_only ?? false,
        doubles_only: rules.doubles_only ?? false,
        requires_power_outlet: rules.requires_power_outlet ?? false,
        no_lifeguard_acknowledgment: rules.no_lifeguard_acknowledgment ?? false,
        custom_rules: rules.custom_rules || ''
      });
    }
  }, [rules]);

  const handleSave = async () => {
    try {
      await saveRules(formData);
      toast({
        title: "Rules saved successfully",
        description: `Rules for ${amenity.name} have been updated.`
      });
    } catch (error) {
      toast({
        title: "Error saving rules",
        description: "Failed to save the amenity rules. Please try again.",
        variant: "destructive"
      });
    }
  };

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Amenities
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configure Rules</h1>
          <p className="text-muted-foreground">{amenity.name} • {amenity.amenityType}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <BookingHoursSection
            bookingStartTime={formData.booking_start_time}
            bookingEndTime={formData.booking_end_time}
            onUpdate={updateField}
          />

          <DurationLimitsSection
            amenity={amenity}
            formData={formData}
            onUpdate={updateField}
          />

          <BookingLimitsSection
            maxReservationsPerDay={formData.max_reservations_per_day}
            maxReservationsPerWeek={formData.max_reservations_per_week}
            advanceBookingDays={formData.advance_booking_days}
            onUpdate={updateField}
          />

          <GuestPoliciesSection
            allowGuests={formData.allow_guests}
            maxGuestCount={formData.max_guest_count}
            checkinRequiredMinutes={formData.checkin_required_minutes}
            onUpdate={updateField}
          />

          <PeakHoursSection
            amenity={amenity}
            formData={formData}
            onUpdate={updateField}
          />

          <AmenitySpecificSection
            amenity={amenity}
            formData={formData}
            onUpdate={updateField}
          />

          <AdminControlsSection
            requiresAdminApproval={formData.requires_admin_approval}
            minCancellationHours={formData.min_cancellation_hours}
            onUpdate={updateField}
          />

          <CustomRulesSection
            customRules={formData.custom_rules}
            onUpdate={updateField}
          />
        </div>

        <div className="lg:col-span-1">
          <RuleSummary amenity={amenity} rules={formData} />
        </div>
      </div>

      <div className="flex justify-end gap-4 pt-6 border-t">
        <Button variant="outline" onClick={onBack} style={{ color: '#0F1F3D', fontSize: '15px', fontWeight: 500, textDecoration: 'underline' }}>
          Cancel
        </Button>
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          Save Rules
        </Button>
      </div>
    </div>
  );
};

export default RuleEditor;
