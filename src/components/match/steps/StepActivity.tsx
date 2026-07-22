// src/components/match/steps/StepActivity.tsx
import { useRef } from 'react';
import { Alert, Animated, Easing, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import type { ActivityType, PlayFormat } from '@/hooks/createMatchDraft';

interface Props {
  activity: { activityType: ActivityType | null; playFormat: PlayFormat | null; organizerIsPlaying: boolean };
  onActivityType: (v: ActivityType) => void;
  onPlayFormat: (v: PlayFormat) => void;
  onOrganizerPlaying: (v: boolean) => void;
  wouldDropInviteesFor: (nextFormat: PlayFormat, nextOrganizerPlaying: boolean) => boolean;
}

const ACTIVITY_OPTIONS: { value: ActivityType; label: string; copy: string }[] = [
  { value: 'match', label: 'Match', copy: 'Scored play' },
  { value: 'practice_hit', label: 'Practice / Hit', copy: 'Rallying, drills, hitting' },
];
const FORMAT_OPTIONS: { value: PlayFormat; label: string }[] = [
  { value: 'singles', label: 'Singles' },
  { value: 'doubles', label: 'Doubles' },
];

// Tap feedback: scale(0.97) at 140ms with a snappy ease — matches DESIGN.md's
// documented Interaction Pattern ("Tap feedback: scale(0.97) at --t-fast with
// --ease-snap") and the Animated-driven treatment StepProgress uses elsewhere
// in this same wizard.
const EASE_SNAP = Easing.bezier(0.34, 1.56, 0.64, 1);
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function animatePressScale(value: Animated.Value, toValue: number) {
  Animated.timing(value, { toValue, duration: 140, easing: EASE_SNAP, useNativeDriver: true }).start();
}

export function StepActivity({ activity, onActivityType, onPlayFormat, onOrganizerPlaying, wouldDropInviteesFor }: Props) {
  const { theme } = useTheme();

  // One press-scale Animated.Value per option, matching StepProgress's
  // "one Animated.Value per dot" pattern — transform-only so it's GPU-composited.
  const activityScales = useRef(ACTIVITY_OPTIONS.map(() => new Animated.Value(1))).current;
  const formatScales = useRef(FORMAT_OPTIONS.map(() => new Animated.Value(1))).current;

  function handlePlayFormat(value: PlayFormat) {
    if (wouldDropInviteesFor(value, activity.organizerIsPlaying)) {
      Alert.alert(
        'Remove invited players?',
        'Switching to this format means you can invite fewer players. Players beyond the new limit will be removed.',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Switch', style: 'destructive', onPress: () => onPlayFormat(value) }],
      );
      return;
    }
    onPlayFormat(value);
  }

  function handleOrganizerPlaying(value: boolean) {
    // SET_ORGANIZER_PLAYING re-clamps players the same way SET_PLAY_FORMAT does
    // (e.g. turning "I'm playing" on with an already-full doubles invite list
    // drops the last invitee to make room) — gate it with the same confirmation
    // so that path can't silently drop a selection either.
    if (activity.playFormat && wouldDropInviteesFor(activity.playFormat, value)) {
      Alert.alert(
        'Remove invited players?',
        'This leaves room for fewer invited players. Players beyond the new limit will be removed.',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Continue', style: 'destructive', onPress: () => onOrganizerPlaying(value) }],
      );
      return;
    }
    onOrganizerPlaying(value);
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>ACTIVITY</Text>
      {ACTIVITY_OPTIONS.map((opt, i) => {
        const active = activity.activityType === opt.value;
        const scale = activityScales[i];
        return (
          <AnimatedTouchable
            key={opt.value}
            style={[
              styles.card,
              { borderColor: active ? Colors.blue : theme.border, backgroundColor: active ? theme.selectedBg : theme.cardBg },
              { transform: [{ scale }] },
            ]}
            onPress={() => onActivityType(opt.value)}
            onPressIn={() => animatePressScale(scale, 0.97)}
            onPressOut={() => animatePressScale(scale, 1)}
            activeOpacity={0.85}>
            <Text style={[styles.cardLabel, { color: active ? Colors.blue : theme.textPrimary }]}>{opt.label}</Text>
            <Text style={[styles.cardCopy, { color: theme.textSecondary }]}>{opt.copy}</Text>
          </AnimatedTouchable>
        );
      })}

      <Text style={[styles.sectionLabel, { color: theme.textMuted, marginTop: 20 }]}>PLAY FORMAT</Text>
      <View style={styles.row}>
        {FORMAT_OPTIONS.map((opt, i) => {
          const active = activity.playFormat === opt.value;
          const scale = formatScales[i];
          return (
            <AnimatedTouchable
              key={opt.value}
              style={[
                styles.segment,
                { borderColor: active ? Colors.blue : theme.border, backgroundColor: active ? theme.selectedBg : theme.cardBg },
                { transform: [{ scale }] },
              ]}
              onPress={() => handlePlayFormat(opt.value)}
              onPressIn={() => animatePressScale(scale, 0.97)}
              onPressOut={() => animatePressScale(scale, 1)}
              activeOpacity={0.85}>
              <Text style={[styles.segmentText, { color: active ? Colors.blue : theme.textSecondary }]}>{opt.label}</Text>
            </AnimatedTouchable>
          );
        })}
      </View>

      <View style={[styles.toggleCard, { borderColor: theme.border, backgroundColor: theme.cardBg }]}>
        <Text style={[styles.toggleLabel, { color: theme.textPrimary }]}>I'm playing in this one</Text>
        <Switch
          value={activity.organizerIsPlaying}
          onValueChange={handleOrganizerPlaying}
          trackColor={{ false: theme.borderStrong, true: Colors.blue }}
          thumbColor={Colors.white}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.pagePx, gap: 10 },
  sectionLabel: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.eyebrow, letterSpacing: 1.2, marginBottom: 4 },
  card: { borderWidth: 1, borderRadius: Radius.card, padding: 16, gap: 4 },
  cardLabel: { fontFamily: FontFamily.manropeBold, fontSize: FontSize.body },
  cardCopy: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label },
  row: { flexDirection: 'row', gap: 8 },
  segment: { flex: 1, minHeight: 48, borderWidth: 1, borderRadius: Radius.chip, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    borderWidth: 1,
    borderRadius: Radius.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
  },
  toggleLabel: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body, flex: 1, marginRight: 12 },
});
