import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Check } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

const NTRP_OPTIONS = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0];
const HAND_OPTIONS = ['Right', 'Left', 'Two-handed'] as const;
const MATCH_OPTIONS = ['Singles', 'Doubles', 'Both'] as const;
const TIME_OPTIONS = ['Morning', 'Afternoon', 'Evening', 'Weekend'] as const;
const VISIBILITY_OPTIONS = [
  { value: 'public',         label: 'Public'    },
  { value: 'community_only', label: 'Community' },
  { value: 'private',        label: 'Private'   },
] as const;

type HandOption = typeof HAND_OPTIONS[number] | null;
type MatchOption = typeof MATCH_OPTIONS[number] | null;
type VisibilityOption = 'public' | 'community_only' | 'private';

type OrigState = {
  fullName: string;
  ntrp: number | null;
  dominantHand: HandOption;
  bio: string;
  location: string;
  playTimes: string[];
  matchPref: MatchOption;
  visibility: VisibilityOption;
};

const EMPTY_ORIG: OrigState = {
  fullName: '', ntrp: null, dominantHand: null,
  bio: '', location: '', playTimes: [],
  matchPref: null, visibility: 'public',
};

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = useStyles(theme);

  const [fullName, setFullName]     = useState('');
  const [ntrp, setNtrp]             = useState<number | null>(null);
  const [dominantHand, setHand]     = useState<HandOption>(null);
  const [bio, setBio]               = useState('');
  const [location, setLocation]     = useState('');
  const [playTimes, setPlayTimes]   = useState<string[]>([]);
  const [matchPref, setMatchPref]   = useState<MatchOption>(null);
  const [visibility, setVisibility] = useState<VisibilityOption>('public');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [orig, setOrig]       = useState<OrigState>(EMPTY_ORIG);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from('profiles')
        .select('full_name, ntrp_rating, dominant_hand, bio, location, preferred_play_times, match_preference, profile_visibility')
        .eq('id', user.id)
        .single();

      const d = (data ?? {}) as Record<string, unknown>;
      const name    = (d.full_name as string)        ?? '';
      const rating  = (d.ntrp_rating as number)      ?? null;
      const hand    = (d.dominant_hand as HandOption) ?? null;
      const bioVal  = (d.bio as string)              ?? '';
      const loc     = (d.location as string)         ?? '';
      const times   = (d.preferred_play_times as string[]) ?? [];
      const match   = (d.match_preference as MatchOption)  ?? null;
      const vis     = ((d.profile_visibility as VisibilityOption) ?? 'public') as VisibilityOption;

      setFullName(name); setNtrp(rating); setHand(hand); setBio(bioVal);
      setLocation(loc); setPlayTimes(times); setMatchPref(match); setVisibility(vis);
      setOrig({ fullName: name, ntrp: rating, dominantHand: hand, bio: bioVal, location: loc, playTimes: times, matchPref: match, visibility: vis });
      setLoading(false);
    }
    load();
  }, []);

  const dirty = useMemo(() =>
    fullName !== orig.fullName ||
    ntrp !== orig.ntrp ||
    dominantHand !== orig.dominantHand ||
    bio !== orig.bio ||
    location !== orig.location ||
    JSON.stringify([...playTimes].sort()) !== JSON.stringify([...orig.playTimes].sort()) ||
    matchPref !== orig.matchPref ||
    visibility !== orig.visibility,
  [fullName, ntrp, dominantHand, bio, location, playTimes, matchPref, visibility, orig]);

  function toggleTime(t: string) {
    setPlayTimes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  async function handleSave() {
    if (!dirty) { router.back(); return; }
    const trimmed = fullName.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Please enter your full name.');
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { error } = await (supabase
      .from('profiles') as any)
      .update({
        full_name:            trimmed,
        ntrp_rating:          ntrp,
        dominant_hand:        dominantHand,
        bio:                  bio.trim() || null,
        location:             location.trim() || null,
        preferred_play_times: playTimes.length ? playTimes : null,
        match_preference:     matchPref,
        profile_visibility:   visibility,
      })
      .eq('id', user.id);

    setSaving(false);
    if (error) {
      Alert.alert('Error', 'Could not save profile. Please try again.');
    } else {
      router.back();
    }
  }

  const initials = fullName.trim().split(' ').filter(Boolean)
    .map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: theme.pageBg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 24) + 8, backgroundColor: theme.headerBg }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft color={Colors.white} size={20} strokeWidth={1.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity
          style={[styles.saveBtn, (!dirty || saving) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving || loading}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          {saving
            ? <Text style={styles.saveBtnText}>Saving...</Text>
            : <><Check size={14} color={Colors.white} strokeWidth={2.5} /><Text style={styles.saveBtnText}>Save</Text></>}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          {/* Avatar (initials only until storage is configured) */}
          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{loading ? '?' : initials}</Text>
            </View>
            <Text style={styles.avatarHint}>Profile photo coming soon</Text>
          </View>

          {/* Full Name */}
          <Text style={styles.label}>FULL NAME</Text>
          <View style={[styles.inputWrap, { borderColor: theme.border, backgroundColor: theme.inputBg }]}>
            <TextInput
              style={[styles.input, { color: theme.textPrimary }]}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your full name"
              placeholderTextColor={theme.textDisabled}
              autoCapitalize="words"
              autoComplete="name"
              editable={!loading}
            />
          </View>

          {/* NTRP Rating */}
          <Text style={[styles.label, styles.topGap]}>NTRP RATING</Text>
          <Text style={styles.hint}>Your self-assessed USTA skill level.</Text>
          <View style={styles.chipGrid}>
            {NTRP_OPTIONS.map(val => {
              const active = ntrp === val;
              return (
                <TouchableOpacity
                  key={val}
                  style={[styles.chip, active ? styles.chipActiveBlue : styles.chipInactive]}
                  onPress={() => setNtrp(active ? null : val)}
                  activeOpacity={0.7}>
                  <Text style={[styles.chipTxt, { color: active ? Colors.blue : theme.textSecondary }]}>
                    {val.toFixed(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Dominant Hand */}
          <Text style={[styles.label, styles.topGap]}>DOMINANT HAND</Text>
          <View style={styles.chipRow}>
            {HAND_OPTIONS.map(h => {
              const active = dominantHand === h;
              return (
                <TouchableOpacity
                  key={h}
                  style={[styles.chip, styles.chipFlex, active ? styles.chipActiveCyan : styles.chipInactive]}
                  onPress={() => setHand(active ? null : h)}
                  activeOpacity={0.7}>
                  <Text style={[styles.chipTxt, { color: active ? Colors.cyan : theme.textSecondary }]}>{h}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Match Format */}
          <Text style={[styles.label, styles.topGap]}>MATCH FORMAT</Text>
          <View style={styles.chipRow}>
            {MATCH_OPTIONS.map(m => {
              const active = matchPref === m;
              return (
                <TouchableOpacity
                  key={m}
                  style={[styles.chip, styles.chipFlex, active ? styles.chipActiveCyan : styles.chipInactive]}
                  onPress={() => setMatchPref(active ? null : m)}
                  activeOpacity={0.7}>
                  <Text style={[styles.chipTxt, { color: active ? Colors.cyan : theme.textSecondary }]}>{m}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Preferred Play Times */}
          <Text style={[styles.label, styles.topGap]}>PREFERRED PLAY TIMES</Text>
          <Text style={styles.hint}>Select all that apply.</Text>
          <View style={styles.chipRow}>
            {TIME_OPTIONS.map(t => {
              const active = playTimes.includes(t);
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.chip, styles.chipFlex, active ? styles.chipActiveVolt : styles.chipInactive]}
                  onPress={() => toggleTime(t)}
                  activeOpacity={0.7}>
                  <Text style={[styles.chipTxt, { color: active ? Colors.volt : theme.textSecondary }]}>{t}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Bio */}
          <Text style={[styles.label, styles.topGap]}>BIO</Text>
          <View style={[styles.inputWrap, styles.textAreaWrap, { borderColor: theme.border, backgroundColor: theme.inputBg }]}>
            <TextInput
              style={[styles.input, styles.textArea, { color: theme.textPrimary }]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell other players about yourself..."
              placeholderTextColor={theme.textDisabled}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={300}
              editable={!loading}
            />
          </View>
          <Text style={styles.charCount}>{bio.length}/300</Text>

          {/* Home Location */}
          <Text style={[styles.label, styles.topGap]}>HOME LOCATION</Text>
          <View style={[styles.inputWrap, { borderColor: theme.border, backgroundColor: theme.inputBg }]}>
            <TextInput
              style={[styles.input, { color: theme.textPrimary }]}
              value={location}
              onChangeText={setLocation}
              placeholder="City, neighborhood, or community"
              placeholderTextColor={theme.textDisabled}
              autoCapitalize="words"
              editable={!loading}
            />
          </View>

          {/* Profile Visibility */}
          <Text style={[styles.label, styles.topGap]}>PROFILE VISIBILITY</Text>
          <Text style={styles.hint}>Controls who can view your player profile.</Text>
          <View style={styles.chipRow}>
            {VISIBILITY_OPTIONS.map(({ value, label }) => {
              const active = visibility === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.chip, styles.chipFlex, active ? styles.chipActiveBlue : styles.chipInactive]}
                  onPress={() => setVisibility(value)}
                  activeOpacity={0.7}>
                  <Text style={[styles.chipTxt, { color: active ? Colors.blue : theme.textSecondary }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen: { flex: 1 },

    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.pagePx, paddingBottom: 14,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 18, color: Colors.white },
    saveBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 14, paddingVertical: 8,
      backgroundColor: Colors.blue, borderRadius: Radius.button,
    },
    saveBtnDisabled: { backgroundColor: 'rgba(45,107,255,0.35)' },
    saveBtnText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 13, color: Colors.white },

    content: { padding: Spacing.pagePx, paddingBottom: 60 },

    avatarRow: { alignItems: 'center', marginBottom: 32, gap: 10 },
    avatar: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: 'rgba(45,107,255,0.20)',
      borderWidth: 2, borderColor: 'rgba(45,107,255,0.40)',
      alignItems: 'center', justifyContent: 'center',
    },
    avatarText:  { fontFamily: FontFamily.spaceGroteskBold, fontSize: 26, color: Colors.blue },
    avatarHint:  { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, color: theme.textMuted },

    label: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.eyebrow,
      color: theme.textMuted, letterSpacing: 1.6, marginBottom: 10,
    },
    topGap: { marginTop: 28 },
    hint: {
      fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label,
      color: theme.textMuted, marginBottom: 14, lineHeight: 20,
    },
    charCount: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 10,
      color: theme.textMuted, textAlign: 'right', marginTop: 4,
    },

    inputWrap: { borderWidth: 1.5, borderRadius: Radius.sm, paddingHorizontal: 14, paddingVertical: 14 },
    textAreaWrap: { paddingVertical: 12 },
    input: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body },
    textArea: { minHeight: 88, lineHeight: 22 },

    chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    chipRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    chip: {
      borderWidth: 1.5, borderRadius: Radius.chip,
      paddingHorizontal: 16, paddingVertical: 10,
      minWidth: 60, alignItems: 'center',
    },
    chipFlex: { flex: 1, minWidth: 80 },
    chipTxt: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 13 },

    chipInactive:   { borderColor: theme.border, backgroundColor: theme.cardBg },
    chipActiveBlue: { borderColor: Colors.blue, backgroundColor: 'rgba(45,107,255,0.12)' },
    chipActiveCyan: { borderColor: Colors.cyan, backgroundColor: 'rgba(45,224,255,0.10)' },
    chipActiveVolt: { borderColor: Colors.volt, backgroundColor: 'rgba(214,255,61,0.10)' },
  }), [theme]);
}
