import { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LogOut } from 'lucide-react-native';
import { Header } from '@/components/ui/Header';
import { useTheme } from '@/context/ThemeContext';
import { useCoachProfile } from '@/hooks/useCoachProfile';
import { LessonPackagesManager } from '@/components/coach/LessonPackagesManager';
import { confirmAndSignOut } from '@/lib/authActions';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import type { ThemeTokens } from '@/constants/theme-tokens';

const NOTICE_OPTIONS = [1, 2, 4, 8, 12, 24, 48, 72];
const ADVANCE_OPTIONS = [7, 14, 21, 30, 60, 90];

const LEVEL_OPTIONS = [
  { value: 'beginner',         label: 'Beginner' },
  { value: 'intermediate',     label: 'Intermediate' },
  { value: 'high_performance', label: 'High Perf' },
];

const LESSON_TYPES = [
  { value: 'private_lesson',      label: 'Private Lesson'  },
  { value: 'semi_private_lesson', label: 'Semi-Private'    },
  { value: 'group_lesson',        label: 'Group Lesson'    },
  { value: 'hitting_partner',     label: 'Hitting Partner' },
];

const GENDER_OPTIONS = [
  { value: '',       label: 'Not specified' },
  { value: 'male',   label: 'Male'          },
  { value: 'female', label: 'Female'        },
];

const ITF_OPTIONS = [
  { value: 'none',  label: 'None'          },
  { value: 'itf_1', label: 'ITF L1'        },
  { value: 'itf_2', label: 'ITF L2'        },
  { value: 'itf_3', label: 'ITF L3'        },
  { value: 'ptr',   label: 'PTR Certified' },
];

const LOCATION_TYPE_OPTIONS = [
  { value: 'facility_coach',  label: 'Facility Coach'    },
  { value: 'traveling_coach', label: 'Traveling Coach'   },
  { value: 'facility_travel', label: 'Facility + Travel' },
];

const COURT_TYPE_OPTIONS = ['hard', 'clay', 'grass', 'indoor', 'outdoor'];

export default function CoachMeScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const { profile, loading, saving, error: profileError, refresh, save } = useCoachProfile();

  // Existing fields
  const [businessName,     setBusinessName]     = useState('');
  const [bio,              setBio]              = useState('');
  const [hourlyRate,       setHourlyRate]       = useState('');
  const [homeBase,         setHomeBase]         = useState('');
  const [yearsExperience,  setYearsExperience]  = useState('');

  // New fields
  const [fullName,             setFullName]             = useState('');
  const [gender,               setGender]               = useState('');
  const [itfCertification,     setItfCertification]     = useState('none');
  const [coachingLocationType, setCoachingLocationType] = useState('facility_coach');
  const [facilityAddress,      setFacilityAddress]      = useState('');
  const [facilityNotes,        setFacilityNotes]        = useState('');
  const [travelAreas,          setTravelAreas]          = useState('');
  const [travelNotes,          setTravelNotes]          = useState('');
  const [travelRadiusKm,       setTravelRadiusKm]       = useState('');
  const [courtType,            setCourtType]            = useState('');

  // Local chip state (moved from profile-direct reads)
  const [levelsServed,       setLevelsServed]       = useState<string[]>([]);
  const [lessonTypesOffered, setLessonTypesOffered] = useState<string[]>([]);
  const [minimumNoticeHours,     setMinimumNoticeHours]     = useState<number | null>(null);
  const [maxAdvanceBookingDays,  setMaxAdvanceBookingDays]  = useState<number | null>(null);

  const [signOutError, setSignOutError] = useState('');

  function handleSignOut() {
    setSignOutError('');
    confirmAndSignOut(setSignOutError);
  }

  const [initialized, setInitialized] = useState(false);

  // Initialize all state from profile on first load
  useMemo(() => {
    if (profile && !initialized) {
      setBusinessName(profile.businessName ?? '');
      setBio(profile.bio ?? '');
      setHourlyRate(profile.hourlyRate != null ? String(profile.hourlyRate) : '');
      setHomeBase(profile.homeBase ?? '');
      setYearsExperience(profile.yearsExperience != null ? String(profile.yearsExperience) : '');
      setFullName(profile.fullName ?? '');
      setGender(profile.gender ?? '');
      setItfCertification(profile.itfCertification ?? 'none');
      setCoachingLocationType(profile.coachingLocationType ?? 'facility_coach');
      setFacilityAddress(profile.facilityAddress ?? '');
      setFacilityNotes(profile.facilityNotes ?? '');
      setTravelAreas(profile.travelAreas ?? '');
      setTravelNotes(profile.travelNotes ?? '');
      setTravelRadiusKm(profile.travelRadiusKm != null ? String(profile.travelRadiusKm) : '');
      setCourtType(profile.courtType ?? '');
      setLevelsServed(profile.levelsServed ?? []);
      setLessonTypesOffered(profile.lessonTypesOffered ?? []);
      setMinimumNoticeHours(profile.minimumNoticeHours ?? null);
      setMaxAdvanceBookingDays(profile.maxAdvanceBookingDays ?? null);
      setInitialized(true);
    }
  }, [profile, initialized]);

  // isDirty — tracks unsaved changes
  const isDirty = useMemo(() => {
    if (!profile || !initialized) return false;
    return (
      fullName             !== (profile.fullName ?? '')             ||
      gender               !== (profile.gender ?? '')              ||
      itfCertification     !== (profile.itfCertification ?? 'none') ||
      coachingLocationType !== (profile.coachingLocationType ?? 'facility_coach') ||
      facilityAddress      !== (profile.facilityAddress ?? '')      ||
      travelAreas          !== (profile.travelAreas ?? '')          ||
      businessName         !== (profile.businessName ?? '')         ||
      bio                  !== (profile.bio ?? '')                  ||
      hourlyRate           !== (profile.hourlyRate != null ? String(profile.hourlyRate) : '') ||
      homeBase             !== (profile.homeBase ?? '')             ||
      yearsExperience      !== (profile.yearsExperience != null ? String(profile.yearsExperience) : '') ||
      JSON.stringify([...(levelsServed ?? [])].sort()) !==
        JSON.stringify([...(profile.levelsServed ?? [])].sort()) ||
      JSON.stringify([...(lessonTypesOffered ?? [])].sort()) !==
        JSON.stringify([...(profile.lessonTypesOffered ?? [])].sort())
    );
  }, [
    profile, initialized,
    fullName, gender, itfCertification, coachingLocationType,
    facilityAddress, travelAreas,
    businessName, bio, hourlyRate, homeBase, yearsExperience,
    levelsServed, lessonTypesOffered,
  ]);

  // Single save handler
  async function handleSave() {
    const rate   = parseFloat(hourlyRate);
    const years  = parseInt(yearsExperience, 10);
    const radius = parseInt(travelRadiusKm, 10);
    const err = await save({
      fullName:              fullName.trim() || null,
      businessName:          businessName.trim() || null,
      bio:                   bio.trim() || null,
      hourlyRate:            isNaN(rate)   ? null : rate,
      homeBase:              homeBase.trim() || null,
      yearsExperience:       isNaN(years)  ? null : years,
      facilityAddress:       facilityAddress.trim() || null,
      facilityNotes:         facilityNotes.trim() || null,
      travelAreas:           travelAreas.trim() || null,
      travelNotes:           travelNotes.trim() || null,
      travelRadiusKm:        isNaN(radius) ? null : radius,
      gender:                gender || null,
      itfCertification:      itfCertification === 'none' ? null : itfCertification,
      coachingLocationType,
      courtType:             courtType || null,
      levelsServed,
      lessonTypesOffered,
      minimumNoticeHours:    minimumNoticeHours ?? null,
      maxAdvanceBookingDays: maxAdvanceBookingDays ?? null,
    });
    if (err) Alert.alert('Error', err);
    else Alert.alert('Saved', 'Profile updated.');
  }

  function toggleLevel(val: string) {
    setLevelsServed(prev =>
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
    );
  }

  function toggleLessonType(val: string) {
    setLessonTypesOffered(prev =>
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
    );
  }

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.pageBg }]}>
        <Header variant="coach" />
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
        <View style={styles.footer}>
          {!!signOutError && (
            <View style={styles.signOutErrorBanner}>
              <Text style={styles.signOutErrorText}>Sign out failed: {signOutError}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
            <LogOut size={18} color={Colors.negative} strokeWidth={1.5} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.pageBg }]}>
        <Header variant="coach" />
        <View style={styles.loading}>
          <Text style={styles.loadingText}>
            {profileError ? `Couldn't load your profile: ${profileError}` : 'Coach profile not found.'}
          </Text>
          {!!profileError && (
            <TouchableOpacity style={styles.retryBtn} onPress={refresh} activeOpacity={0.8}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.footer}>
          {!!signOutError && (
            <View style={styles.signOutErrorBanner}>
              <Text style={styles.signOutErrorText}>Sign out failed: {signOutError}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
            <LogOut size={18} color={Colors.negative} strokeWidth={1.5} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.pageBg }]}>
      <Header variant="coach" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Profile section */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          <Text style={styles.sectionLabel}>PROFILE</Text>
          {isDirty && (
            <Text style={styles.unsavedBadge}>● UNSAVED</Text>
          )}
        </View>
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Business / Display Name</Text>
          <TextInput
            style={styles.input}
            value={businessName}
            onChangeText={setBusinessName}
            placeholder="e.g. Coach J · J Tennis"
            placeholderTextColor={Colors.fgDisabled}
          />

          <Text style={styles.fieldLabel}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your full name"
            placeholderTextColor="#5A6379"
          />

          <Text style={styles.fieldLabel}>Gender</Text>
          <View style={styles.chipWrap}>
            {GENDER_OPTIONS.map(g => (
              <TouchableOpacity
                key={g.value || 'ns'}
                style={[styles.chip, gender === g.value && styles.chipActive]}
                onPress={() => setGender(g.value)}
                activeOpacity={0.7}>
                <Text style={[styles.chipText, gender === g.value && styles.chipTextActive]}>
                  {g.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>ITF Certification</Text>
          <View style={styles.chipWrap}>
            {ITF_OPTIONS.map(c => (
              <TouchableOpacity
                key={c.value}
                style={[styles.chip, itfCertification === c.value && styles.chipActive]}
                onPress={() => setItfCertification(c.value)}
                activeOpacity={0.7}>
                <Text style={[styles.chipText, itfCertification === c.value && styles.chipTextActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Bio</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell players about yourself…"
            placeholderTextColor={Colors.fgDisabled}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <Text style={styles.fieldLabel}>Hourly Rate (USD)</Text>
          <TextInput
            style={styles.input}
            value={hourlyRate}
            onChangeText={setHourlyRate}
            placeholder="e.g. 80"
            placeholderTextColor={Colors.fgDisabled}
            keyboardType="numeric"
          />

          <Text style={styles.fieldLabel}>Years of Experience</Text>
          <TextInput
            style={styles.input}
            value={yearsExperience}
            onChangeText={setYearsExperience}
            placeholder="e.g. 5"
            placeholderTextColor={Colors.fgDisabled}
            keyboardType="numeric"
          />
        </View>

        {/* Skill levels */}
        <Text style={styles.sectionLabel}>SKILL LEVELS</Text>
        <View style={styles.chipWrap}>
          {LEVEL_OPTIONS.map(l => {
            const active = levelsServed.includes(l.value);
            return (
              <TouchableOpacity
                key={l.value}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggleLevel(l.value)}
                activeOpacity={0.7}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{l.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Lesson types */}
        <Text style={styles.sectionLabel}>LESSON TYPES</Text>
        <View style={styles.chipWrap}>
          {LESSON_TYPES.map(t => {
            const active = lessonTypesOffered.includes(t.value);
            return (
              <TouchableOpacity
                key={t.value}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggleLessonType(t.value)}
                activeOpacity={0.7}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Coaching location */}
        <Text style={styles.sectionLabel}>COACHING LOCATION</Text>
        <View style={styles.chipWrap}>
          {LOCATION_TYPE_OPTIONS.map(m => (
            <TouchableOpacity
              key={m.value}
              style={[styles.chip, coachingLocationType === m.value && styles.chipActive]}
              onPress={() => setCoachingLocationType(m.value)}
              activeOpacity={0.7}>
              <Text style={[styles.chipText, coachingLocationType === m.value && styles.chipTextActive]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {(coachingLocationType === 'facility_coach' || coachingLocationType === 'facility_travel') && (
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Facility Name</Text>
            <TextInput
              style={styles.input}
              value={homeBase}
              onChangeText={setHomeBase}
              placeholder="e.g. Sunset Park Courts"
              placeholderTextColor="#5A6379"
            />
            <Text style={styles.fieldLabel}>Address</Text>
            <TextInput
              style={styles.input}
              value={facilityAddress}
              onChangeText={setFacilityAddress}
              placeholder="Street address"
              placeholderTextColor="#5A6379"
            />
            <Text style={styles.fieldLabel}>Court Type</Text>
            <View style={styles.chipWrap}>
              {COURT_TYPE_OPTIONS.map(ct => (
                <TouchableOpacity
                  key={ct}
                  style={[styles.chip, courtType === ct && styles.chipActive]}
                  onPress={() => setCourtType(courtType === ct ? '' : ct)}
                  activeOpacity={0.7}>
                  <Text style={[styles.chipText, courtType === ct && styles.chipTextActive]}>
                    {ct.charAt(0).toUpperCase() + ct.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Facility Notes</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={facilityNotes}
              onChangeText={setFacilityNotes}
              placeholder="Parking, access instructions…"
              placeholderTextColor="#5A6379"
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>
        )}

        {(coachingLocationType === 'traveling_coach' || coachingLocationType === 'facility_travel') && (
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Radius (km)</Text>
            <TextInput
              style={styles.input}
              value={travelRadiusKm}
              onChangeText={setTravelRadiusKm}
              placeholder="e.g. 25"
              placeholderTextColor="#5A6379"
              keyboardType="numeric"
            />
            <Text style={styles.fieldLabel}>Areas Served</Text>
            <TextInput
              style={styles.input}
              value={travelAreas}
              onChangeText={setTravelAreas}
              placeholder="e.g. Downtown, West End"
              placeholderTextColor="#5A6379"
            />
            <Text style={styles.fieldLabel}>Travel Notes</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={travelNotes}
              onChangeText={setTravelNotes}
              placeholder="Any travel conditions…"
              placeholderTextColor="#5A6379"
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>
        )}

        {/* Booking window */}
        <Text style={styles.sectionLabel}>BOOKING WINDOW</Text>
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Minimum Notice</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
            {NOTICE_OPTIONS.map(h => {
              const active = minimumNoticeHours === h;
              return (
                <TouchableOpacity
                  key={h}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setMinimumNoticeHours(h)}
                  activeOpacity={0.7}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {h < 24 ? `${h}h` : `${h / 24}d`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Max Advance Booking</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
            {ADVANCE_OPTIONS.map(d => {
              const active = maxAdvanceBookingDays === d;
              return (
                <TouchableOpacity
                  key={d}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setMaxAdvanceBookingDays(d)}
                  activeOpacity={0.7}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{d} days</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Save all changes */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.btnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}>
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save All Changes'}</Text>
        </TouchableOpacity>

        {/* Lesson Packages */}
        <LessonPackagesManager />

        {/* Sign Out */}
        {!!signOutError && (
          <View style={styles.signOutErrorBanner}>
            <Text style={styles.signOutErrorText}>Sign out failed: {signOutError}</Text>
          </View>
        )}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <LogOut size={18} color={Colors.negative} strokeWidth={1.5} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Payment Settings — not yet available */}
      <View style={styles.footer}>
        <View style={styles.comingSoonCard}>
          <Text style={styles.comingSoonText}>Payment Settings</Text>
          <Text style={styles.comingSoonSub}>Coming in a future update</Text>
        </View>
      </View>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen: { flex: 1 },
    signOutBtn: {
      marginTop: 28,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: 'rgba(255,92,107,0.25)',
      backgroundColor: 'rgba(255,92,107,0.08)',
    },
    signOutText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: Colors.negative,
    },
    signOutErrorBanner: {
      marginTop: 28, borderRadius: Radius.card, padding: 12,
      backgroundColor: 'rgba(255,92,107,0.12)',
    },
    signOutErrorText: {
      fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label,
      color: Colors.negative, textAlign: 'center',
    },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.pagePx, gap: 16 },
    loadingText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
      textAlign: 'center',
    },
    retryBtn: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: Radius.button,
      borderWidth: 1,
      borderColor: Colors.blue,
    },
    retryBtnText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.blue,
    },
    content: {
      padding: Spacing.pagePx,
      paddingBottom: 20,
      gap: 10,
    },
    footer: {
      paddingHorizontal: Spacing.pagePx,
      paddingBottom: 16,
      gap: 10,
    },
    sectionLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      color: theme.textMuted,
      letterSpacing: 0.18,
    },
    unsavedBadge: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 9,
      color: Colors.volt,
      letterSpacing: 0.6,
    },
    card: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.cardPadding,
      gap: 8,
    },
    fieldLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    input: {
      backgroundColor: theme.border,
      borderRadius: Radius.sm,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textPrimary,
    },
    multilineInput: {
      minHeight: 60,
      textAlignVertical: 'top' as const,
    },
    saveBtn: {
      backgroundColor: Colors.blue,
      borderRadius: Radius.button,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 4,
    },
    btnDisabled: { opacity: 0.5 },
    saveBtnText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: '#FFFFFF',
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    optionRow: {
      gap: 8,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: Radius.chip,
      borderWidth: 1,
      borderColor: theme.border,
    },
    chipActive: {
      borderColor: Colors.blue,
      backgroundColor: 'rgba(45,107,255,0.15)',
    },
    chipText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    chipTextActive: {
      color: Colors.blue,
    },
    comingSoonCard: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: Spacing.cardPadding,
      paddingVertical: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      opacity: 0.45,
    },
    comingSoonText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textMuted,
    },
    comingSoonSub: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
      opacity: 0.6,
    },
  }), [theme]);
}
