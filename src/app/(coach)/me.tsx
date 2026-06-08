import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { LogOut, ChevronRight } from 'lucide-react-native';
import { Header } from '@/components/ui/Header';
import { useTheme } from '@/context/ThemeContext';
import { useCoachProfile } from '@/hooks/useCoachProfile';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { supabase } from '@/lib/supabase';

const NOTICE_OPTIONS = [1, 2, 4, 8, 12, 24, 48, 72];
const ADVANCE_OPTIONS = [7, 14, 21, 30, 60, 90];

const LEVEL_OPTIONS = [
  { value: 'beginner',         label: 'Beginner' },
  { value: 'intermediate',     label: 'Intermediate' },
  { value: 'high_performance', label: 'High Perf' },
];

const LESSON_TYPES = [
  { value: 'private_lesson',      label: 'Private'        },
  { value: 'semi_private_lesson', label: 'Semi-Private'   },
  { value: 'group_lesson',        label: 'Group'          },
  { value: 'hitting_partner',     label: 'Hitting Partner'},
  { value: 'match_play',          label: 'Match Play'     },
  { value: 'junior_development',  label: 'Junior Dev'     },
  { value: 'adult_beginner',      label: 'Adult Beginner' },
  { value: 'advanced_training',   label: 'Advanced'       },
];

const LOCATION_MODE_OPTIONS = [
  { value: 'coach_facility', label: 'My Facility'   },
  { value: 'traveling',      label: 'Travels to You'},
  { value: 'both',           label: 'Either'        },
];

export default function CoachMeScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const { profile, loading, saving, save } = useCoachProfile();

  const [businessName, setBusinessName]     = useState('');
  const [bio, setBio]                       = useState('');
  const [hourlyRate, setHourlyRate]         = useState('');
  const [homeBase, setHomeBase]             = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [initialized, setInitialized]       = useState(false);

  useMemo(() => {
    if (profile && !initialized) {
      setBusinessName(profile.businessName ?? '');
      setBio(profile.bio ?? '');
      setHourlyRate(profile.hourlyRate != null ? String(profile.hourlyRate) : '');
      setHomeBase(profile.homeBase ?? '');
      setYearsExperience(profile.yearsExperience != null ? String(profile.yearsExperience) : '');
      setInitialized(true);
    }
  }, [profile, initialized]);

  async function handleSaveProfile() {
    const rate  = parseFloat(hourlyRate);
    const years = parseInt(yearsExperience, 10);
    const err = await save({
      businessName:    businessName.trim() || null,
      bio:             bio.trim() || null,
      hourlyRate:      isNaN(rate)  ? null : rate,
      homeBase:        homeBase.trim() || null,
      yearsExperience: isNaN(years) ? null : years,
    });
    if (err) Alert.alert('Error', err);
    else Alert.alert('Saved', 'Profile updated.');
  }

  async function toggleLevel(val: string) {
    if (!profile) return;
    const current = profile.levelsServed ?? [];
    const next = current.includes(val) ? current.filter(v => v !== val) : [...current, val];
    await save({ levelsServed: next });
  }

  async function toggleLessonType(val: string) {
    if (!profile) return;
    const current = profile.lessonTypesOffered ?? [];
    const next = current.includes(val) ? current.filter(v => v !== val) : [...current, val];
    await save({ lessonTypesOffered: next });
  }

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try { await supabase.auth.signOut(); } catch {}
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  if (loading || !profile) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.pageBg }]}>
        <Header variant="coach" />
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.pageBg }]}>
      <Header variant="coach" />
      <ScrollView contentContainerStyle={styles.content}>

        {/* Profile section */}
        <Text style={styles.sectionLabel}>PROFILE</Text>
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Business / Display Name</Text>
          <TextInput
            style={styles.input}
            value={businessName}
            onChangeText={setBusinessName}
            placeholder="e.g. Coach J · J Tennis"
            placeholderTextColor={Colors.fgDisabled}
          />

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

          <Text style={styles.fieldLabel}>Home Base / Location</Text>
          <TextInput
            style={styles.input}
            value={homeBase}
            onChangeText={setHomeBase}
            placeholder="e.g. Sunset Park Courts"
            placeholderTextColor={Colors.fgDisabled}
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

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={handleSaveProfile}
            disabled={saving}
            activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Profile'}</Text>
          </TouchableOpacity>
        </View>

        {/* Skill levels */}
        <Text style={styles.sectionLabel}>SKILL LEVELS</Text>
        <View style={styles.chipWrap}>
          {LEVEL_OPTIONS.map(l => {
            const active = (profile.levelsServed ?? []).includes(l.value);
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
            const active = (profile.lessonTypesOffered ?? []).includes(t.value);
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

        {/* Default location */}
        <Text style={styles.sectionLabel}>DEFAULT LOCATION</Text>
        <View style={styles.chipWrap}>
          {LOCATION_MODE_OPTIONS.map(m => {
            const active = (profile.defaultLocationMode ?? 'coach_facility') === m.value;
            return (
              <TouchableOpacity
                key={m.value}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => save({ defaultLocationMode: m.value })}
                activeOpacity={0.7}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{m.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Booking window */}
        <Text style={styles.sectionLabel}>BOOKING WINDOW</Text>
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Minimum Notice</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
            {NOTICE_OPTIONS.map(h => {
              const active = profile.minimumNoticeHours === h;
              return (
                <TouchableOpacity
                  key={h}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => save({ minimumNoticeHours: h })}
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
              const active = profile.maxAdvanceBookingDays === d;
              return (
                <TouchableOpacity
                  key={d}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => save({ maxAdvanceBookingDays: d })}
                  activeOpacity={0.7}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{d} days</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <LogOut size={16} color={Colors.negative} strokeWidth={1.8} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Coming soon */}
        <View style={styles.comingSoonCard}>
          <Text style={styles.comingSoonText}>Payment Settings — Coming Soon</Text>
        </View>
        <View style={styles.comingSoonCard}>
          <Text style={styles.comingSoonText}>Lesson Packages — Coming Soon</Text>
        </View>

      </ScrollView>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen: { flex: 1 },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    loadingText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
    },
    content: {
      padding: Spacing.pagePx,
      paddingBottom: 100,
      gap: 10,
    },
    sectionLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      color: theme.textMuted,
      letterSpacing: 0.18,
      marginTop: 10,
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
      minHeight: 80,
      textAlignVertical: 'top',
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
    signOutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 10,
      paddingVertical: 14,
      borderRadius: Radius.button,
      borderWidth: 1,
      borderColor: 'rgba(255,92,107,0.30)',
    },
    signOutText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: Colors.negative,
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
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
    },
  }), [theme]);
}
