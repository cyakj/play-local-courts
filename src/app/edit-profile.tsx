import { useEffect, useMemo, useState } from 'react';
import {
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
import { platformAlert } from '@/lib/platformAlert';
import { Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { LocationAutocomplete } from '@/components/ui/LocationAutocomplete';
import type { LocationValue } from '@/lib/mapboxSearch';
import { isTennisMode } from '@/config/productMode';

const NTRP_OPTIONS = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0];
const HAND_OPTIONS = ['Right', 'Left', 'Two-handed'] as const;
const BACKHAND_OPTIONS = ['One-Handed', 'Two-Handed'] as const;
const PLAYING_STYLE_OPTIONS = ['Baseliner', 'All-Court', 'Serve & Volley', 'Counterpuncher'] as const;
const SURFACE_OPTIONS = ['Hard', 'Clay', 'Grass', 'Indoor'] as const;
const TENNIS_GOALS_OPTIONS = [
  'Improve Technique', 'Compete in Leagues', 'Stay Fit',
  'Meet New Players', 'Have Fun', 'Tournament Ready',
] as const;
const VISIBILITY_OPTIONS = [
  { value: 'public',         label: 'Public'    },
  { value: 'community_only', label: 'Community' },
  { value: 'private',        label: 'Private'   },
] as const;

type HandOption = typeof HAND_OPTIONS[number] | null;
type BackhandOption = typeof BACKHAND_OPTIONS[number] | null;
type VisibilityOption = 'public' | 'community_only' | 'private';

type OrigState = {
  fullName: string;
  ntrp: number | null;
  dominantHand: HandOption;
  backhand: BackhandOption;
  playingStyle: string | null;
  favoriteSurface: string | null;
  tennisGoals: string[];
  yearsPlaying: string;
  bio: string;
  location: LocationValue | null;
  visibility: VisibilityOption;
};

const EMPTY_ORIG: OrigState = {
  fullName: '', ntrp: null, dominantHand: null, backhand: null,
  playingStyle: null, favoriteSurface: null, tennisGoals: [], yearsPlaying: '',
  bio: '', location: null, visibility: 'public',
};

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = useStyles(theme);

  const [fullName, setFullName]             = useState('');
  const [ntrp, setNtrp]                     = useState<number | null>(null);
  const [dominantHand, setHand]             = useState<HandOption>(null);
  const [backhand, setBackhand]             = useState<BackhandOption>(null);
  const [playingStyle, setPlayingStyle]     = useState<string | null>(null);
  const [favoriteSurface, setSurface]       = useState<string | null>(null);
  const [tennisGoals, setTennisGoals]       = useState<string[]>([]);
  const [yearsPlaying, setYearsPlaying]     = useState('');
  const [bio, setBio]                       = useState('');
  const [location, setLocation]             = useState<LocationValue | null>(null);
  const [visibility, setVisibility]         = useState<VisibilityOption>('public');
  const [focusedField, setFocusedField]     = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [orig, setOrig]       = useState<OrigState>(EMPTY_ORIG);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from('profiles')
        .select('full_name, ntrp_rating, dominant_hand, backhand, playing_style, favorite_surface, tennis_goals, years_playing, bio, location, city, state_region, country, latitude, longitude, mapbox_place_id, profile_visibility')
        .eq('id', user.id)
        .single();

      const d = (data ?? {}) as Record<string, unknown>;
      const name     = (d.full_name as string)          ?? '';
      const rating   = (d.ntrp_rating as number)         ?? null;
      const hand     = (d.dominant_hand as HandOption)   ?? null;
      const bh       = (d.backhand as BackhandOption)    ?? null;
      const style    = (d.playing_style as string)       ?? null;
      const surface  = (d.favorite_surface as string)    ?? null;
      const goals    = (d.tennis_goals as string[])      ?? [];
      const years    = d.years_playing != null ? String(d.years_playing) : '';
      const bioVal   = (d.bio as string)                 ?? '';
      const placeId  = (d.mapbox_place_id as string)     ?? null;
      const loc: LocationValue | null = placeId ? {
        display_name:    (d.location as string) ?? '',
        city:            (d.city as string)          ?? null,
        state_region:    (d.state_region as string)   ?? null,
        country:         (d.country as string)        ?? null,
        latitude:        (d.latitude as number)       ?? 0,
        longitude:       (d.longitude as number)      ?? 0,
        mapbox_place_id: placeId,
      } : null;
      const vis      = ((d.profile_visibility as VisibilityOption) ?? 'public') as VisibilityOption;

      setFullName(name); setNtrp(rating); setHand(hand); setBackhand(bh);
      setPlayingStyle(style); setSurface(surface); setTennisGoals(goals); setYearsPlaying(years);
      setBio(bioVal); setLocation(loc); setVisibility(vis);
      setOrig({
        fullName: name, ntrp: rating, dominantHand: hand, backhand: bh,
        playingStyle: style, favoriteSurface: surface, tennisGoals: goals, yearsPlaying: years,
        bio: bioVal, location: loc, visibility: vis,
      });
      setLoading(false);
    }
    load();
  }, []);

  const dirty = useMemo(() =>
    fullName !== orig.fullName ||
    ntrp !== orig.ntrp ||
    dominantHand !== orig.dominantHand ||
    backhand !== orig.backhand ||
    playingStyle !== orig.playingStyle ||
    favoriteSurface !== orig.favoriteSurface ||
    JSON.stringify([...tennisGoals].sort()) !== JSON.stringify([...orig.tennisGoals].sort()) ||
    yearsPlaying !== orig.yearsPlaying ||
    bio !== orig.bio ||
    (location?.mapbox_place_id ?? null) !== (orig.location?.mapbox_place_id ?? null) ||
    visibility !== orig.visibility,
  [fullName, ntrp, dominantHand, backhand, playingStyle, favoriteSurface, tennisGoals, yearsPlaying, bio, location, visibility, orig]);

  function toggleGoal(g: string) {
    setTennisGoals(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  }

  async function handleSave() {
    if (!dirty) { router.back(); return; }
    const trimmed = fullName.trim();
    if (!trimmed) {
      platformAlert('Name required', 'Please enter your full name.');
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const parsedYears = yearsPlaying.trim() ? parseInt(yearsPlaying, 10) : null;

    const { error } = await (supabase
      .from('profiles') as any)
      .update({
        full_name:         trimmed,
        ntrp_rating:       ntrp,
        dominant_hand:     dominantHand,
        backhand:          backhand,
        playing_style:     playingStyle,
        favorite_surface:  favoriteSurface,
        tennis_goals:      tennisGoals.length ? tennisGoals : null,
        years_playing:     Number.isFinite(parsedYears) ? parsedYears : null,
        bio:               bio.trim() || null,
        location:          location?.display_name    ?? null,
        city:              location?.city             ?? null,
        state_region:      location?.state_region      ?? null,
        country:           location?.country           ?? null,
        latitude:          location?.latitude          ?? null,
        longitude:         location?.longitude         ?? null,
        mapbox_place_id:   location?.mapbox_place_id   ?? null,
        profile_visibility: visibility,
      })
      .eq('id', user.id);

    setSaving(false);
    if (error) {
      platformAlert('Error', 'Could not save profile. Please try again.');
    } else {
      router.back();
    }
  }

  const initials = fullName.trim().split(' ').filter(Boolean)
    .map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  function inputStyle(field: string) {
    return [
      styles.inputWrap,
      { borderColor: theme.border, backgroundColor: theme.inputBg },
      focusedField === field && styles.inputWrapFocused,
    ];
  }

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
          <View style={inputStyle('fullName')}>
            <TextInput
              style={[styles.input, { color: theme.textPrimary }]}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your full name"
              placeholderTextColor={theme.textDisabled}
              autoCapitalize="words"
              autoComplete="name"
              editable={!loading}
              onFocus={() => setFocusedField('fullName')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          {/* Tennis-only fields — NTRP, hand, style, surface, goals, years playing.
              Hidden in Community mode: an HOA resident profile has no tennis-player
              concepts (see edit-profile.tsx Finding 3, community-mode-ia fix wave). */}
          {isTennisMode && (
          <>
          {/* NTRP Rating */}
          <View style={[styles.labelRow, styles.topGap]}>
            <Text style={styles.label}>NTRP RATING</Text>
            <InfoTooltip
              label="NTRP Rating"
              text="Your self-assessed USTA skill level, from 1.0 (beginner) to 7.0 (world-class). Used to match you with players of a similar level."
            />
          </View>
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

          {/* Backhand */}
          <Text style={[styles.label, styles.topGap]}>BACKHAND</Text>
          <View style={styles.chipRow}>
            {BACKHAND_OPTIONS.map(b => {
              const active = backhand === b;
              return (
                <TouchableOpacity
                  key={b}
                  style={[styles.chip, styles.chipFlex, active ? styles.chipActiveCyan : styles.chipInactive]}
                  onPress={() => setBackhand(active ? null : b)}
                  activeOpacity={0.7}>
                  <Text style={[styles.chipTxt, { color: active ? Colors.cyan : theme.textSecondary }]} numberOfLines={1}>
                    {b}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Playing Style */}
          <View style={[styles.labelRow, styles.topGap]}>
            <Text style={styles.label}>PLAYING STYLE</Text>
            <InfoTooltip
              label="Playing Style"
              text="How you typically approach a point — helps other players and coaches understand your game."
            />
          </View>
          <View style={styles.chipRow}>
            {PLAYING_STYLE_OPTIONS.map(s => {
              const active = playingStyle === s;
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, styles.chipFlex, active ? styles.chipActiveCyan : styles.chipInactive]}
                  onPress={() => setPlayingStyle(active ? null : s)}
                  activeOpacity={0.7}>
                  <Text style={[styles.chipTxt, { color: active ? Colors.cyan : theme.textSecondary }]} numberOfLines={1}>
                    {s}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Favorite Surface */}
          <Text style={[styles.label, styles.topGap]}>FAVORITE SURFACE</Text>
          <View style={styles.chipRow}>
            {SURFACE_OPTIONS.map(s => {
              const active = favoriteSurface === s;
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, styles.chipFlex, active ? styles.chipActiveBlue : styles.chipInactive]}
                  onPress={() => setSurface(active ? null : s)}
                  activeOpacity={0.7}>
                  <Text style={[styles.chipTxt, { color: active ? Colors.blue : theme.textSecondary }]}>{s}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Tennis Goals */}
          <Text style={[styles.label, styles.topGap]}>TENNIS GOALS</Text>
          <Text style={styles.hint}>Select all that apply.</Text>
          <View style={styles.chipRow}>
            {TENNIS_GOALS_OPTIONS.map(g => {
              const active = tennisGoals.includes(g);
              return (
                <TouchableOpacity
                  key={g}
                  style={[styles.chip, styles.chipFlex, active ? styles.chipActiveCyan : styles.chipInactive]}
                  onPress={() => toggleGoal(g)}
                  activeOpacity={0.7}>
                  <Text style={[styles.chipTxt, { color: active ? Colors.cyan : theme.textSecondary }]} numberOfLines={1}>
                    {g}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Years Playing */}
          <Text style={[styles.label, styles.topGap]}>YEARS PLAYING</Text>
          <View style={inputStyle('yearsPlaying')}>
            <TextInput
              style={[styles.input, { color: theme.textPrimary }]}
              value={yearsPlaying}
              onChangeText={t => setYearsPlaying(t.replace(/[^0-9]/g, ''))}
              placeholder="e.g. 5"
              placeholderTextColor={theme.textDisabled}
              keyboardType="number-pad"
              maxLength={2}
              editable={!loading}
              onFocus={() => setFocusedField('yearsPlaying')}
              onBlur={() => setFocusedField(null)}
            />
          </View>
          </>
          )}

          {/* Bio */}
          <Text style={[styles.label, styles.topGap]}>BIO</Text>
          <View style={[inputStyle('bio'), styles.textAreaWrap]}>
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
              onFocus={() => setFocusedField('bio')}
              onBlur={() => setFocusedField(null)}
            />
          </View>
          <Text style={styles.charCount}>{bio.length}/300</Text>

          {/* Home Location */}
          <Text style={[styles.label, styles.topGap]}>HOME LOCATION</Text>
          <Text style={styles.hint}>Search and select your city or neighborhood.</Text>
          <LocationAutocomplete
            value={location}
            onChange={setLocation}
            disabled={loading}
          />

          {/* Profile Visibility */}
          <View style={[styles.labelRow, styles.topGap]}>
            <Text style={styles.label}>PROFILE VISIBILITY</Text>
            <InfoTooltip
              label="Profile Visibility"
              text="Public: any TenisX member can view your profile. Community: only members of your HOA community can view it. Private: only you can view it."
            />
          </View>
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

    avatarRow: { alignItems: 'center', marginBottom: 24, gap: 8 },
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
      color: theme.textMuted, letterSpacing: 1.6, marginBottom: 8,
    },
    labelRow: {
      flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8,
    },
    topGap: { marginTop: 20 },
    hint: {
      fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label,
      color: theme.textMuted, marginBottom: 10, lineHeight: 18,
    },
    charCount: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 10,
      color: theme.textMuted, textAlign: 'right', marginTop: 4,
    },

    inputWrap: {
      borderWidth: 1.5, borderRadius: Radius.sm, paddingHorizontal: 14, paddingVertical: 14,
      outlineWidth: 0,
    } as any,
    inputWrapFocused: { borderColor: Colors.blue, borderWidth: 1.5 },
    textAreaWrap: { paddingVertical: 12 },
    input: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body },
    textArea: { minHeight: 88, lineHeight: 22 },

    chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    chipRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    chip: {
      borderWidth: 1.5, borderRadius: Radius.chip,
      paddingHorizontal: 14, paddingVertical: 10,
      minWidth: 60, alignItems: 'center', justifyContent: 'center',
    },
    chipFlex: { flex: 1, minWidth: 90 },
    chipTxt: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 13, textAlign: 'center' },

    chipInactive:   { borderColor: theme.border, backgroundColor: theme.cardBg },
    chipActiveBlue: { borderColor: Colors.blue, backgroundColor: 'rgba(45,107,255,0.12)' },
    chipActiveCyan: { borderColor: Colors.cyan, backgroundColor: 'rgba(45,224,255,0.10)' },
  }), [theme]);
}
