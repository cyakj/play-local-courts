import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAmenityRules } from '@/hooks/useAmenityRules';
import { toast } from 'sonner';
import BookingHoursSection from '@/components/rules/BookingHoursSection';
import DurationLimitsSection from '@/components/rules/DurationLimitsSection';
import BookingLimitsSection from '@/components/rules/BookingLimitsSection';
import GuestPoliciesSection from '@/components/rules/GuestPoliciesSection';
import PeakHoursSection from '@/components/rules/PeakHoursSection';
import AmenitySpecificSection from '@/components/rules/AmenitySpecificSection';
import AdminControlsSection from '@/components/rules/AdminControlsSection';
import CustomRulesSection from '@/components/rules/CustomRulesSection';
import RuleSummary from '@/components/RuleSummary';

const CMAmenityRules = () => {
  const { id: communityId, amenityId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [amenity, setAmenity] = useState<any>(null);
  const [loadingAmenity, setLoadingAmenity] = useState(true);

  useEffect(() => {
    if (!amenityId) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('courts')
        .select('id, name, court_type, hoa_id')
        .eq('id', amenityId)
        .maybeSingle();
      if (data) {
        setAmenity({ id: data.id, name: data.name, amenityType: data.court_type, hoaId: data.hoa_id });
      }
      setLoadingAmenity(false);
    };
    fetch();
  }, [amenityId]);

  // Pass hoaId from the amenity so CM users don't need hoaId on their profile
  const { rules, loading, saveRules } = useAmenityRules(amenityId || '', amenity?.hoaId);

  const [formData, setFormData] = useState({
    booking_start_time: '07:00',
    booking_end_time: '21:00',
    max_duration_minutes: 60,
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
    peak_max_duration_minutes: 30,
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
    custom_rules: '',
  });

  useEffect(() => {
    if (rules) {
      const r = rules as any;
      setFormData({
        booking_start_time: r.booking_start_time || '07:00',
        booking_end_time: r.booking_end_time || '21:00',
        max_duration_minutes: r.max_duration_minutes ?? 60,
        singles_duration_minutes: r.singles_duration_minutes ?? 60,
        doubles_duration_minutes: r.doubles_duration_minutes ?? 90,
        family_duration_minutes: r.family_duration_minutes ?? 120,
        group_duration_minutes: r.group_duration_minutes ?? 120,
        max_reservations_per_day: r.max_reservations_per_day || 1,
        max_reservations_per_week: r.max_reservations_per_week || 3,
        min_time_between_reservations: r.min_time_between_reservations || 0,
        advance_booking_days: r.advance_booking_days || 7,
        allow_guests: r.allow_guests ?? true,
        checkin_required_minutes: r.checkin_required_minutes || 15,
        min_cancellation_hours: r.min_cancellation_hours || 24,
        max_no_shows: r.max_no_shows || 3,
        no_show_restriction_days: r.no_show_restriction_days || 30,
        enable_peak_hours: r.enable_peak_hours ?? false,
        peak_start_time: r.peak_start_time || '17:00',
        peak_end_time: r.peak_end_time || '19:00',
        peak_max_duration_minutes: r.peak_max_duration_minutes ?? 30,
        peak_singles_duration_minutes: r.peak_singles_duration_minutes ?? 30,
        peak_doubles_duration_minutes: r.peak_doubles_duration_minutes ?? 45,
        peak_family_duration_minutes: r.peak_family_duration_minutes ?? 60,
        peak_group_duration_minutes: r.peak_group_duration_minutes ?? 60,
        requires_admin_approval: r.requires_admin_approval ?? false,
        security_deposit_required: r.security_deposit_required ?? false,
        security_deposit_amount: r.security_deposit_amount || 0,
        max_guest_count: r.max_guest_count || 4,
        requires_cleanup_agreement: r.requires_cleanup_agreement ?? false,
        allow_ball_machine: r.allow_ball_machine ?? false,
        singles_only: r.singles_only ?? false,
        doubles_only: r.doubles_only ?? false,
        requires_power_outlet: r.requires_power_outlet ?? false,
        no_lifeguard_acknowledgment: r.no_lifeguard_acknowledgment ?? false,
        custom_rules: r.custom_rules || '',
      });
    }
  }, [rules]);

  const handleSave = async () => {
    try {
      await saveRules(formData);
      toast.success(`Rules for ${amenity?.name} saved`);
    } catch {
      toast.error('Failed to save rules');
    }
  };

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (loadingAmenity || loading) {
    return (
      <div className="min-h-screen bg-cm-app-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-cm-cyan" />
      </div>
    );
  }

  if (!amenity) {
    return (
      <div className="min-h-screen bg-cm-app-bg flex items-center justify-center">
        <div className="text-cm-text-light">Amenity not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cm-app-bg">
      {/* Header */}
      <div className="bg-cm-navy text-white p-4 pb-5">
        <div className="flex items-center gap-3">
          <div
            onClick={() => navigate(`/cm/community/${communityId}?tab=amenities`)}
            className="bg-white/[0.12] rounded-[10px] w-9 h-9 flex items-center justify-center cursor-pointer min-h-[44px]"
          >
            <ArrowLeft className="h-4 w-4" />
          </div>
          <div>
            <div className="text-lg font-extrabold">Configure Rules</div>
            <div className="text-xs opacity-65">{amenity.name} • {amenity.amenityType}</div>
          </div>
        </div>
      </div>

      <div className="p-4 pb-32 space-y-4">
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
        <RuleSummary amenity={amenity} rules={formData} />
      </div>

      {/* Sticky save button */}
      <div className="fixed bottom-20 left-0 right-0 p-4 bg-cm-app-bg border-t border-cm-border">
        <div
          onClick={handleSave}
          className="bg-cm-navy text-white rounded-[10px] py-3 text-sm font-bold text-center cursor-pointer w-full min-h-[44px] flex items-center justify-center gap-2"
        >
          <Save className="h-4 w-4" />
          Save Rules
        </div>
      </div>
    </div>
  );
};

export default CMAmenityRules;
