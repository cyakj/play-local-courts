// src/components/match/steps/StepPreferences.tsx
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import type { GenderPreference, MatchVisibility, PlayFormat, SkillPreference } from '@/hooks/createMatchDraft';

interface Props {
  playFormat: PlayFormat | null;
  visibility: MatchVisibility;
  onVisibility: (v: MatchVisibility) => void;
  genderPreference: GenderPreference;
  onGenderPreference: (v: GenderPreference) => void;
  skillPreference: SkillPreference;
  onSkillPreference: (v: Partial<SkillPreference>) => void;
}

const VISIBILITY_OPTIONS: MatchVisibility[] = ['public', 'invite_only'];
const RATING_SYSTEMS = ['none', 'utr', 'ntrp'] as const;

// Tap feedback: scale(0.97) at 140ms with a snappy ease — matches DESIGN.md's
// documented Interaction Pattern ("Tap feedback: scale(0.97) at --t-fast with
// --ease-snap") and the Animated-driven treatment StepActivity/StepLocation/
// StepDateTime use elsewhere in this same wizard. Fixed-length option sets
// (visibility, rating system) get one Animated.Value per item, matching
// StepActivity's "one Animated.Value per dot" pattern; the gender row is a
// variable-length set (3 or 4 options depending on play format) so it follows
// StepLocation's dynamic-list convention and stays plain TouchableOpacity.
const EASE_SNAP = Easing.bezier(0.34, 1.56, 0.64, 1);
// Progressive-disclosure entrance — DESIGN.md's "Card entrance: fade +
// translateY(8px) → 0 at --t-base with --ease-signal" — applied to the
// advanced rating-range panel when it expands.
const EASE_SIGNAL = Easing.bezier(0.22, 1, 0.36, 1);
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function animatePressScale(value: Animated.Value, toValue: number) {
  Animated.timing(value, { toValue, duration: 140, easing: EASE_SNAP, useNativeDriver: true }).start();
}

export function StepPreferences({ playFormat, visibility, onVisibility, genderPreference, onGenderPreference, skillPreference, onSkillPreference }: Props) {
  const { theme } = useTheme();
  const [advancedOpen, setAdvancedOpen] = useState(skillPreference.ratingSystem !== 'none');

  const genderOptions: { value: GenderPreference; label: string }[] = [
    { value: 'all', label: 'Any' },
    { value: 'men', label: 'Men' },
    { value: 'women', label: 'Women' },
    ...(playFormat === 'doubles' ? [{ value: 'mixed' as const, label: 'Mixed' }] : []),
  ];

  const visibilityScales = useRef(VISIBILITY_OPTIONS.map(() => new Animated.Value(1))).current;
  const ratingScales = useRef(RATING_SYSTEMS.map(() => new Animated.Value(1))).current;
  const advancedToggleScale = useRef(new Animated.Value(1)).current;
  const chevronRotation = useRef(new Animated.Value(skillPreference.ratingSystem !== 'none' ? 1 : 0)).current;
  const panelEntrance = useRef(new Animated.Value(skillPreference.ratingSystem !== 'none' ? 1 : 0)).current;

  function toggleAdvanced() {
    const next = !advancedOpen;
    setAdvancedOpen(next);
    Animated.timing(chevronRotation, { toValue: next ? 1 : 0, duration: 140, easing: EASE_SNAP, useNativeDriver: true }).start();
    Animated.timing(panelEntrance, { toValue: next ? 1 : 0, duration: 220, easing: EASE_SIGNAL, useNativeDriver: true }).start();
  }

  // Rating-range fields (min/max/enforcement) surface conditionally within the
  // already-open advanced panel — animate that inner reveal too, so switching
  // from "Any level" to a rated system doesn't pop the fields in abruptly.
  const rangeFieldsOpacity = useRef(new Animated.Value(skillPreference.ratingSystem !== 'none' ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(rangeFieldsOpacity, {
      toValue: skillPreference.ratingSystem !== 'none' ? 1 : 0,
      duration: 220,
      easing: EASE_SIGNAL,
      useNativeDriver: true,
    }).start();
  }, [skillPreference.ratingSystem]);

  const chevronRotate = chevronRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>VISIBILITY</Text>
      <View style={styles.row}>
        {VISIBILITY_OPTIONS.map((v, i) => {
          const active = visibility === v;
          const scale = visibilityScales[i];
          return (
            <AnimatedTouchable
              key={v}
              style={[
                styles.segment,
                { borderColor: active ? Colors.blue : theme.border, backgroundColor: active ? theme.selectedBg : theme.cardBg },
                { transform: [{ scale }] },
              ]}
              onPress={() => onVisibility(v)}
              onPressIn={() => animatePressScale(scale, 0.97)}
              onPressOut={() => animatePressScale(scale, 1)}
              activeOpacity={0.85}>
              <Text style={[styles.segmentText, { color: active ? Colors.blue : theme.textSecondary }]}>{v === 'public' ? 'Public' : 'Invite-only'}</Text>
            </AnimatedTouchable>
          );
        })}
      </View>
      <Text style={[styles.helperText, { color: theme.textSecondary }]}>
        {visibility === 'public' ? 'Eligible players can discover and request to join.' : 'Only people you invite can see or join this.'}
      </Text>

      <Text style={[styles.sectionLabel, { color: theme.textMuted, marginTop: 20 }]}>PLAYER PREFERENCES</Text>
      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Gender</Text>
      <View style={styles.row}>
        {genderOptions.map(opt => {
          const active = genderPreference === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.segment, { borderColor: active ? Colors.blue : theme.border, backgroundColor: active ? theme.selectedBg : theme.cardBg }]}
              onPress={() => onGenderPreference(opt.value)}
              activeOpacity={0.85}>
              <Text style={[styles.segmentText, { color: active ? Colors.blue : theme.textSecondary }]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <AnimatedTouchable
        style={[
          styles.advancedToggle,
          { borderColor: theme.border, backgroundColor: theme.cardBg },
          { transform: [{ scale: advancedToggleScale }] },
        ]}
        onPress={toggleAdvanced}
        onPressIn={() => animatePressScale(advancedToggleScale, 0.98)}
        onPressOut={() => animatePressScale(advancedToggleScale, 1)}
        activeOpacity={0.85}>
        <View>
          <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Rating range</Text>
          <Text style={[styles.advancedSubtext, { color: theme.textMuted }]}>
            {skillPreference.ratingSystem === 'none' ? 'Open to any level' : `${skillPreference.ratingSystem.toUpperCase()} preferred`}
          </Text>
        </View>
        <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
          <ChevronDown size={18} color={theme.textMuted} />
        </Animated.View>
      </AnimatedTouchable>

      {advancedOpen && (
        <Animated.View
          style={[
            styles.advancedPanel,
            { borderColor: theme.border, backgroundColor: theme.bgElevated },
            {
              opacity: panelEntrance,
              transform: [{ translateY: panelEntrance.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
            },
          ]}>
          <View style={styles.row}>
            {RATING_SYSTEMS.map((sys, i) => {
              const active = skillPreference.ratingSystem === sys;
              const scale = ratingScales[i];
              return (
                <AnimatedTouchable
                  key={sys}
                  style={[
                    styles.segment,
                    { borderColor: active ? Colors.blue : theme.border, backgroundColor: active ? theme.selectedBg : theme.cardBg },
                    { transform: [{ scale }] },
                  ]}
                  onPress={() => onSkillPreference({ ratingSystem: sys })}
                  onPressIn={() => animatePressScale(scale, 0.97)}
                  onPressOut={() => animatePressScale(scale, 1)}
                  activeOpacity={0.85}>
                  <Text style={[styles.segmentText, { color: active ? Colors.blue : theme.textSecondary }]}>{sys === 'none' ? 'Any level' : sys.toUpperCase()}</Text>
                </AnimatedTouchable>
              );
            })}
          </View>

          {skillPreference.ratingSystem !== 'none' && (
            <Animated.View style={{ opacity: rangeFieldsOpacity }}>
              <View style={[styles.row, { marginTop: 14 }]}>
                <TextInput
                  style={[styles.numberInput, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.textPrimary }]}
                  keyboardType="decimal-pad"
                  placeholder="Min"
                  placeholderTextColor={theme.textDisabled}
                  value={skillPreference.minimum?.toString() ?? ''}
                  onChangeText={(t) => onSkillPreference({ minimum: t ? Number(t) : null })}
                />
                <TextInput
                  style={[styles.numberInput, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.textPrimary }]}
                  keyboardType="decimal-pad"
                  placeholder="Max"
                  placeholderTextColor={theme.textDisabled}
                  value={skillPreference.maximum?.toString() ?? ''}
                  onChangeText={(t) => onSkillPreference({ maximum: t ? Number(t) : null })}
                />
              </View>
              <TouchableOpacity
                style={styles.strictRow}
                onPress={() => onSkillPreference({ enforcement: skillPreference.enforcement === 'strict' ? 'preference' : 'strict' })}
                activeOpacity={0.85}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary, flex: 1 }]}>Restrict requests to this range</Text>
                <Switch
                  value={skillPreference.enforcement === 'strict'}
                  onValueChange={(v) => onSkillPreference({ enforcement: v ? 'strict' : 'preference' })}
                  trackColor={{ false: theme.borderStrong, true: Colors.blue }}
                  thumbColor={Colors.white}
                />
              </TouchableOpacity>
            </Animated.View>
          )}
        </Animated.View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.pagePx, gap: 8 },
  sectionLabel: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.eyebrow, letterSpacing: 1.2, marginBottom: 4 },
  fieldLabel: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label },
  helperText: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, marginTop: 4 },
  row: { flexDirection: 'row', gap: 8, marginTop: 6 },
  segment: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: Radius.chip, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  segmentText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 13, textAlign: 'center' },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    borderWidth: 1,
    borderRadius: Radius.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
  },
  advancedSubtext: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.metadata, marginTop: 2 },
  advancedPanel: { marginTop: 10, borderWidth: 1, borderRadius: Radius.card, padding: 16, gap: 4 },
  numberInput: { flex: 1, minHeight: 46, borderWidth: 1, borderRadius: Radius.input, paddingHorizontal: 14, fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body },
  strictRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingVertical: 6 },
});
