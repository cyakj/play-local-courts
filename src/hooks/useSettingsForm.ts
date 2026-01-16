import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { isValidZipCode } from '@/lib/zipCodeUtils';

export interface ProfileFormData {
  fullName: string;
  dateOfBirth: string;
  gender: string;
  bio: string;
  homeCourtId: string;
  utrRating: number | null;
  ntrpRating: number | null;
  wtnRating: number | null;
  zipCode: string;
  avatarUrl: string;
  phoneNumber: string;
}

export interface PrivacyFormData {
  locationVisible: boolean;
  showExactDistance: boolean;
  publicProfile: boolean;
  hideContactUntilConfirmed: boolean;
  showActivityStatus: boolean;
}

export interface CoachFormData {
  businessName: string;
  credentials: string;
  yearsExperience: number;
  sportsOffered: string[];
  homeBase: string;
  willingToTravel: boolean;
  hourlyRate: number;
  coachBio: string;
  profileImageUrl: string;
}

export const useSettingsForm = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isCoach, setIsCoach] = useState(false);

  const initialDataRef = useRef<{
    profile: ProfileFormData;
    privacy: PrivacyFormData;
    coach: CoachFormData;
  } | null>(null);

  const [profile, setProfile] = useState<ProfileFormData>({
    fullName: '',
    dateOfBirth: '',
    gender: '',
    bio: '',
    homeCourtId: '',
    utrRating: null,
    ntrpRating: null,
    wtnRating: null,
    zipCode: '',
    avatarUrl: '',
    phoneNumber: '',
  });

  const [privacy, setPrivacy] = useState<PrivacyFormData>({
    locationVisible: true,
    showExactDistance: true,
    publicProfile: true,
    hideContactUntilConfirmed: false,
    showActivityStatus: true,
  });

  const [coach, setCoach] = useState<CoachFormData>({
    businessName: '',
    credentials: 'None',
    yearsExperience: 0,
    sportsOffered: [],
    homeBase: '',
    willingToTravel: false,
    hourlyRate: 0,
    coachBio: '',
    profileImageUrl: '',
  });

  const loadData = useCallback(async () => {
    if (!currentUser) return;

    try {
      // Load profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') throw profileError;

      if (profileData) {
        const profileFormData: ProfileFormData = {
          fullName: profileData.full_name || '',
          dateOfBirth: profileData.date_of_birth || '',
          gender: profileData.gender || '',
          bio: profileData.bio || '',
          homeCourtId: profileData.home_court_id || '',
          utrRating: profileData.utr_rating,
          ntrpRating: profileData.ntrp_rating,
          wtnRating: profileData.wtn_rating,
          zipCode: profileData.zip_code || '',
          avatarUrl: profileData.avatar_url || '',
          phoneNumber: profileData.phone_number || '',
        };

        const privacyFormData: PrivacyFormData = {
          locationVisible: profileData.location_visible !== false,
          showExactDistance: profileData.show_exact_distance !== false,
          publicProfile: true,
          hideContactUntilConfirmed: profileData.hide_contact_until_confirmed === true,
          showActivityStatus: profileData.show_activity_status !== false,
        };

        setProfile(profileFormData);
        setPrivacy(privacyFormData);

        // Check if user is a coach
        const { data: coachData } = await supabase
          .from('coaches')
          .select('*')
          .eq('user_id', currentUser.id)
          .maybeSingle();

        if (coachData) {
          setIsCoach(true);
          const coachFormData: CoachFormData = {
            businessName: coachData.business_name || '',
            credentials: coachData.credentials || 'None',
            yearsExperience: coachData.years_experience || 0,
            sportsOffered: coachData.sports_offered || [],
            homeBase: coachData.home_base || '',
            willingToTravel: coachData.willing_to_travel || false,
            hourlyRate: coachData.hourly_rate || 0,
            coachBio: coachData.bio || '',
            profileImageUrl: coachData.profile_image_url || '',
          };
          setCoach(coachFormData);

          initialDataRef.current = {
            profile: profileFormData,
            privacy: privacyFormData,
            coach: coachFormData,
          };
        } else {
          initialDataRef.current = {
            profile: profileFormData,
            privacy: privacyFormData,
            coach: coach,
          };
        }
      }
    } catch (error) {
      console.error('Error loading settings data:', error);
      toast({
        title: "Error",
        description: "Failed to load settings",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [currentUser, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Track changes
  useEffect(() => {
    if (!initialDataRef.current) return;

    const hasProfileChanges = JSON.stringify(profile) !== JSON.stringify(initialDataRef.current.profile);
    const hasPrivacyChanges = JSON.stringify(privacy) !== JSON.stringify(initialDataRef.current.privacy);
    const hasCoachChanges = isCoach && JSON.stringify(coach) !== JSON.stringify(initialDataRef.current.coach);

    setHasChanges(hasProfileChanges || hasPrivacyChanges || hasCoachChanges);
  }, [profile, privacy, coach, isCoach]);

  const saveChanges = async () => {
    if (!currentUser) return false;

    // Validate ZIP code
    if (profile.zipCode && !isValidZipCode(profile.zipCode)) {
      toast({
        title: "Invalid ZIP Code",
        description: "Please enter a valid 5-digit US ZIP code",
        variant: "destructive"
      });
      return false;
    }

    setSaving(true);
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: profile.fullName,
          date_of_birth: profile.dateOfBirth || null,
          gender: profile.gender || null,
          bio: profile.bio || null,
          home_court_id: profile.homeCourtId || null,
          utr_rating: profile.utrRating,
          ntrp_rating: profile.ntrpRating,
          wtn_rating: profile.wtnRating,
          zip_code: profile.zipCode || null,
          phone_number: profile.phoneNumber || null,
          location_visible: privacy.locationVisible,
          show_exact_distance: privacy.showExactDistance,
          hide_contact_until_confirmed: privacy.hideContactUntilConfirmed,
          show_activity_status: privacy.showActivityStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentUser.id);

      if (profileError) throw profileError;

      // Update coach profile if applicable
      if (isCoach) {
        const { error: coachError } = await supabase
          .from('coaches')
          .update({
            business_name: coach.businessName || null,
            credentials: coach.credentials,
            years_experience: coach.yearsExperience,
            sports_offered: coach.sportsOffered,
            home_base: coach.homeBase || null,
            willing_to_travel: coach.willingToTravel,
            hourly_rate: coach.hourlyRate || null,
            bio: coach.coachBio || null,
            profile_image_url: coach.profileImageUrl || null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', currentUser.id);

        if (coachError) throw coachError;
      }

      // Update initial data reference
      initialDataRef.current = {
        profile: { ...profile },
        privacy: { ...privacy },
        coach: { ...coach },
      };

      setHasChanges(false);
      toast({
        title: "Success",
        description: "Settings saved successfully"
      });
      return true;
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive"
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const discardChanges = () => {
    if (initialDataRef.current) {
      setProfile(initialDataRef.current.profile);
      setPrivacy(initialDataRef.current.privacy);
      setCoach(initialDataRef.current.coach);
      setHasChanges(false);
    }
  };

  return {
    loading,
    saving,
    hasChanges,
    isCoach,
    profile,
    setProfile,
    privacy,
    setPrivacy,
    coach,
    setCoach,
    saveChanges,
    discardChanges,
    reload: loadData,
  };
};
