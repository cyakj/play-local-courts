
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
}

export const useAmenityRules = (amenityId: string) => {
  const { currentUser } = useAuth();
  const [rules, setRules] = useState<AmenityRules | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser?.hoaId && amenityId) {
      fetchRules();
    }
  }, [currentUser?.hoaId, amenityId]);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('amenity_rules')
        .select('*')
        .eq('hoa_id', currentUser?.hoaId)
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
    if (!currentUser?.hoaId) throw new Error('User not authenticated');

    const dataToSave = {
      hoa_id: currentUser.hoaId,
      amenity_id: amenityId,
      ...ruleData
    };

    if (rules?.id) {
      // Update existing rules
      const { error } = await supabase
        .from('amenity_rules')
        .update(dataToSave)
        .eq('id', rules.id);

      if (error) throw error;
    } else {
      // Create new rules
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
