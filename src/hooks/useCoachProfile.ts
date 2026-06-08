import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/types';

type CoachUpdate = Database['public']['Tables']['coaches']['Update'];

export interface CoachProfileData {
  id: string;
  userId: string;
  fullName: string | null;
  gender: string | null;
  businessName: string | null;
  bio: string | null;
  credentials: string | null;
  homeBase: string | null;
  hourlyRate: number | null;
  yearsExperience: number | null;
  levelsServed: string[] | null;
  sportsOffered: string[] | null;
  minimumNoticeHours: number | null;
  maxAdvanceBookingDays: number | null;
  primeTimeStart: string | null;
  primeTimeEnd: string | null;
  cancellationPolicyHours: number | null;
  profileImageUrl: string | null;
  isActive: boolean | null;
  lessonTypesOffered: string[] | null;
  defaultLocationMode: string | null;
  itfCertification: string | null;
  coachingLocationType: string;
  travelRadiusKm: number | null;
  travelAreas: string | null;
  travelNotes: string | null;
  facilityAddress: string | null;
  facilityNotes: string | null;
  courtType: string | null;
}

interface UseCoachProfileResult {
  profile: CoachProfileData | null;
  loading: boolean;
  saving: boolean;
  refresh: () => void;
  save: (updates: Partial<CoachProfileData>) => Promise<string | null>;
}

export function useCoachProfile(): UseCoachProfileResult {
  const [profile, setProfile]   = useState<CoachProfileData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [tickState, setTickState] = useState(0);

  const refresh = useCallback(() => setTickState(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const [coachRes, profileRes] = await Promise.all([
        supabase.from('coaches').select('*').eq('user_id', user.id).single(),
        supabase.from('profiles').select('full_name, gender').eq('id', user.id).single(),
      ]);

      if (cancelled) return;
      const data = coachRes.data;
      if (!data) { setLoading(false); return; }

      setProfile({
        id:                     data.id as string,
        userId:                 data.user_id as string,
        fullName:               (profileRes.data?.full_name as string | null) ?? null,
        gender:                 (profileRes.data?.gender as string | null) ?? null,
        businessName:           data.business_name as string | null,
        bio:                    data.bio as string | null,
        credentials:            data.credentials as string | null,
        homeBase:               data.home_base as string | null,
        hourlyRate:             data.hourly_rate as number | null,
        yearsExperience:        data.years_experience as number | null,
        levelsServed:           data.levels_served as string[] | null,
        sportsOffered:          data.sports_offered as string[] | null,
        minimumNoticeHours:     data.minimum_notice_hours as number | null,
        maxAdvanceBookingDays:  data.max_advance_booking_days as number | null,
        primeTimeStart:         data.prime_time_start as string | null,
        primeTimeEnd:           data.prime_time_end as string | null,
        cancellationPolicyHours: data.cancellation_policy_hours as number | null,
        profileImageUrl:        data.profile_image_url as string | null,
        isActive:               data.is_active as boolean | null,
        lessonTypesOffered:     data.lesson_types_offered as string[] | null,
        defaultLocationMode:    data.default_location_mode as string | null,
        itfCertification:       data.itf_certification as string | null,
        coachingLocationType:   (data.coaching_location_type as string) ?? 'facility_coach',
        travelRadiusKm:         data.travel_radius_km as number | null,
        travelAreas:            data.travel_areas as string | null,
        travelNotes:            data.travel_notes as string | null,
        facilityAddress:        data.facility_address as string | null,
        facilityNotes:          data.facility_notes as string | null,
        courtType:              data.court_type as string | null,
      });
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [tickState]);

  async function save(updates: Partial<CoachProfileData>): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 'Not authenticated';

    setSaving(true);

    const dbUpdates: CoachUpdate = {};
    if (updates.businessName !== undefined)           dbUpdates.business_name           = updates.businessName;
    if (updates.bio !== undefined)                    dbUpdates.bio                     = updates.bio;
    if (updates.credentials !== undefined)            dbUpdates.credentials             = updates.credentials;
    if (updates.homeBase !== undefined)               dbUpdates.home_base               = updates.homeBase;
    if (updates.hourlyRate !== undefined)             dbUpdates.hourly_rate             = updates.hourlyRate;
    if (updates.yearsExperience !== undefined)        dbUpdates.years_experience        = updates.yearsExperience;
    if (updates.levelsServed !== undefined)           dbUpdates.levels_served           = updates.levelsServed;
    if (updates.sportsOffered !== undefined)          dbUpdates.sports_offered          = updates.sportsOffered;
    if (updates.minimumNoticeHours !== undefined)     dbUpdates.minimum_notice_hours    = updates.minimumNoticeHours;
    if (updates.maxAdvanceBookingDays !== undefined)  dbUpdates.max_advance_booking_days = updates.maxAdvanceBookingDays;
    if (updates.primeTimeStart !== undefined)         dbUpdates.prime_time_start        = updates.primeTimeStart;
    if (updates.primeTimeEnd !== undefined)           dbUpdates.prime_time_end          = updates.primeTimeEnd;
    if (updates.cancellationPolicyHours !== undefined)dbUpdates.cancellation_policy_hours = updates.cancellationPolicyHours;
    if (updates.isActive !== undefined)               dbUpdates.is_active               = updates.isActive;
    if (updates.lessonTypesOffered !== undefined)     dbUpdates.lesson_types_offered    = updates.lessonTypesOffered;
    if (updates.defaultLocationMode !== undefined)    dbUpdates.default_location_mode   = updates.defaultLocationMode;
    if (updates.itfCertification !== undefined)       dbUpdates.itf_certification       = updates.itfCertification;
    if (updates.coachingLocationType !== undefined)   dbUpdates.coaching_location_type  = updates.coachingLocationType;
    if (updates.travelRadiusKm !== undefined)         dbUpdates.travel_radius_km        = updates.travelRadiusKm;
    if (updates.travelAreas !== undefined)            dbUpdates.travel_areas            = updates.travelAreas;
    if (updates.travelNotes !== undefined)            dbUpdates.travel_notes            = updates.travelNotes;
    if (updates.facilityAddress !== undefined)        dbUpdates.facility_address        = updates.facilityAddress;
    if (updates.facilityNotes !== undefined)          dbUpdates.facility_notes          = updates.facilityNotes;
    if (updates.courtType !== undefined)              dbUpdates.court_type              = updates.courtType;

    const { error } = await supabase
      .from('coaches')
      .update(dbUpdates)
      .eq('user_id', user.id);

    if (!error && (updates.gender !== undefined || updates.fullName !== undefined)) {
      const profileUpdate: { gender?: string | null; full_name?: string | null } = {};
      if (updates.gender   !== undefined) profileUpdate.gender    = updates.gender;
      if (updates.fullName !== undefined) profileUpdate.full_name = updates.fullName;
      await supabase.from('profiles').update(profileUpdate).eq('id', user.id);
    }

    setSaving(false);
    if (error) return error.message;
    refresh();
    return null;
  }

  return { profile, loading, saving, refresh, save };
}
