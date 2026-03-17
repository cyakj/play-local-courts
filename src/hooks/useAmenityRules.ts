
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '../contexts/AuthContext';

interface AmenityRules {
  id?: string;
  hoa_id: string;
  amenity_id: string;
  booking_start_time?: string;
  booking_end_time?: string;
  singles_duration_minutes?: number;
  doubles_duration_minutes?: number;
  family_duration_minutes?: number;
  group_duration_minutes?: number;
  max_reservations_per_day?: number;
  max_reservations_per_week?: number;
  min_time_between_reservations?: number;
  advance_booking_days?: number;
  allow_guests?: boolean;
  checkin_required_minutes?: number;
  min_cancellation_hours?: number;
  max_no_shows?: number;
  no_show_restriction_days?: number;
  enable_peak_hours?: boolean;
  peak_start_time?: string;
  peak_end_time?: string;
  peak_singles_duration_minutes?: number;
  peak_doubles_duration_minutes?: number;
  peak_family_duration_minutes?: number;
  peak_group_duration_minutes?: number;
  requires_admin_approval?: boolean;
  security_deposit_required?: boolean;
  security_deposit_amount?: number;
  max_guest_count?: number;
  requires_cleanup_agreement?: boolean;
  allow_ball_machine?: boolean;
  singles_only?: boolean;
  doubles_only?: boolean;
  requires_power_outlet?: boolean;
  no_lifeguard_acknowledgment?: boolean;
  custom_rules?: string;
  updated_at?: string;
  created_at?: string;
}

export const useAmenityRules = (amenityId: string, hoaIdOverride?: string) => {
  const { currentUser } = useAuth();
  const [rules, setRules] = useState<AmenityRules | null>(null);
  const [loading, setLoading] = useState(true);

  const hoaId = hoaIdOverride || currentUser?.hoaId;

  useEffect(() => {
    if (hoaId && amenityId) {
      fetchRules();
    } else {
      setLoading(false);
    }
  }, [hoaId, amenityId]);

  const fetchRules = async () => {
    if (!hoaId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('amenity_rules')
        .select('*')
        .eq('hoa_id', hoaId)
        .eq('amenity_id', amenityId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching amenity rules:', error);
        return;
      }

      setRules(data);
    } catch (error) {
      console.error('Error fetching amenity rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveRules = async (ruleData: Partial<AmenityRules>) => {
    if (!hoaId) throw new Error('No HOA ID available');

    // Only include columns that exist in the DB schema
    const validColumns = new Set([
      'booking_start_time', 'booking_end_time', 'max_duration_minutes',
      'max_reservations_per_day', 'max_reservations_per_week',
      'min_time_between_reservations', 'advance_booking_days', 'allow_guests',
      'checkin_required_minutes', 'min_cancellation_hours', 'max_no_shows',
      'no_show_restriction_days', 'enable_peak_hours', 'peak_start_time',
      'peak_end_time', 'peak_max_duration_minutes', 'requires_admin_approval',
      'security_deposit_required', 'security_deposit_amount', 'max_guest_count',
      'requires_cleanup_agreement', 'allow_ball_machine', 'singles_only',
      'doubles_only', 'requires_power_outlet', 'no_lifeguard_acknowledgment',
      'custom_rules',
    ]);

    const filtered: Record<string, any> = {};
    for (const [key, value] of Object.entries(ruleData)) {
      if (validColumns.has(key)) {
        filtered[key] = value;
      }
    }

    const dataToSave = {
      hoa_id: hoaId,
      amenity_id: amenityId,
      ...filtered,
    };

    if (rules?.id) {
      const { error } = await supabase
        .from('amenity_rules')
        .update(dataToSave)
        .eq('id', rules.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('amenity_rules')
        .insert(dataToSave);
      if (error) throw error;
    }

    await fetchRules();
  };

  return {
    rules,
    loading,
    saveRules,
    refetch: fetchRules
  };
};
