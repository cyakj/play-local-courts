// src/components/match/steps/StepReview.tsx
import { useRef } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import type {
  ActivityType, CreateMatchStep, GenderPreference, MatchInvitee, MatchLocation, MatchVisibility, PlayFormat, SkillPreference,
} from '@/hooks/createMatchDraft';

interface Props {
  activityType: ActivityType | null;
  playFormat: PlayFormat | null;
  location: MatchLocation | null;
  date: Date;
  time: string | null;
  durationMinutes: number;
  players: MatchInvitee[];
  visibility: MatchVisibility;
  genderPreference: GenderPreference;
  skillPreference: SkillPreference;
  note: string;
  courtReserved: boolean;
  onEditStep: (step: CreateMatchStep) => void;
  submitting: boolean;
  submitError: string | null;
  onSubmit: () => void;
}

// Tap feedback: scale(0.97) at 140ms with a snappy ease — matches DESIGN.md's
// documented Interaction Pattern ("Tap feedback: scale(0.97) at --t-fast with
// --ease-snap") and the Animated-driven treatment every other step in this
// wizard uses (StepActivity/StepLocation/StepDateTime/StepPlayers/
// StepPreferences/StepDetails). The review rows are a fixed, known-length set
// (one per prior step), so they get one Animated.Value per row, matching
// StepActivity's "one Animated.Value per option" pattern; the submit CTA is a
// single affordance, so it gets its own value, matching StepDetails' toggle
// and StepPlayers' add-row.
const EASE_SNAP = Easing.bezier(0.34, 1.56, 0.64, 1);
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function animatePressScale(value: Animated.Value, toValue: number) {
  Animated.timing(value, { toValue, duration: 140, easing: EASE_SNAP, useNativeDriver: true }).start();
}

function formatTime(value: string) {
  const [h, m] = value.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function StepReview(props: Props) {
  const { theme } = useTheme();

  const rows: { step: CreateMatchStep; label: string; value: string }[] = [
    { step: 'activity', label: 'Activity', value: `${props.activityType === 'practice_hit' ? 'Practice / Hit' : 'Match'} · ${props.playFormat === 'doubles' ? 'Doubles' : 'Singles'}` },
    { step: 'location', label: 'Location', value: props.location?.name ?? 'Not set' },
    { step: 'datetime', label: 'Date & Time', value: props.time ? `${props.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${formatTime(props.time)} · ${props.durationMinutes} min` : 'Not set' },
    { step: 'players', label: 'Players', value: props.players.length ? props.players.map(p => p.name).join(', ') : 'None invited yet' },
    { step: 'preferences', label: 'Preferences', value: `${props.visibility === 'invite_only' ? 'Invite-only' : 'Public'} · ${props.genderPreference === 'all' ? 'Any gender' : props.genderPreference} · ${props.skillPreference.ratingSystem === 'none' ? 'Any level' : `${props.skillPreference.ratingSystem.toUpperCase()} ${props.skillPreference.minimum ?? ''}-${props.skillPreference.maximum ?? ''}`}` },
    { step: 'details', label: 'Details', value: `${props.note.trim() || 'No note'}${props.courtReserved ? ' · Court reserved' : ''}` },
  ];

  const rowScales = useRef(rows.map(() => new Animated.Value(1))).current;
  const submitScale = useRef(new Animated.Value(1)).current;

  return (
    <View style={styles.wrap}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>REVIEW & CONFIRM</Text>
        {rows.map((row, i) => {
          const scale = rowScales[i];
          return (
            <AnimatedTouchable
              key={row.step}
              style={[
                styles.row,
                { borderColor: theme.border, backgroundColor: theme.cardBg },
                { transform: [{ scale }] },
              ]}
              onPress={() => props.onEditStep(row.step)}
              onPressIn={() => animatePressScale(scale, 0.98)}
              onPressOut={() => animatePressScale(scale, 1)}
              activeOpacity={0.85}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: theme.textMuted }]}>{row.label}</Text>
                <Text style={[styles.rowValue, { color: theme.textPrimary }]} numberOfLines={2}>{row.value}</Text>
              </View>
              <ChevronRight size={20} color={theme.textMuted} />
            </AnimatedTouchable>
          );
        })}
        {!!props.submitError && (
          <View style={[styles.errorBanner, { backgroundColor: 'rgba(255,92,107,0.12)', borderColor: 'rgba(255,92,107,0.25)' }]}>
            <Text style={styles.errorText}>{props.submitError}</Text>
          </View>
        )}
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        <AnimatedTouchable
          style={[
            styles.submitBtn,
            props.submitting && styles.submitBtnDisabled,
            { transform: [{ scale: submitScale }] },
          ]}
          onPress={props.onSubmit}
          onPressIn={() => !props.submitting && animatePressScale(submitScale, 0.97)}
          onPressOut={() => animatePressScale(submitScale, 1)}
          disabled={props.submitting}
          activeOpacity={0.85}>
          <Text style={styles.submitBtnText}>{props.submitting ? 'Creating…' : 'Create Match'}</Text>
        </AnimatedTouchable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  content: { padding: Spacing.pagePx, gap: 10 },
  sectionLabel: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.eyebrow, letterSpacing: 1.2, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 72, borderWidth: 1, borderRadius: Radius.card, padding: 14 },
  rowLabel: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.eyebrow, letterSpacing: 1.2 },
  rowValue: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body, marginTop: 4 },
  errorBanner: { borderWidth: 1, borderRadius: Radius.card, padding: 12, marginTop: 4 },
  errorText: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, color: Colors.negative, textAlign: 'center' },
  footer: { padding: Spacing.pagePx, borderTopWidth: 1 },
  submitBtn: { minHeight: 54, backgroundColor: Colors.blue, borderRadius: Radius.button, alignItems: 'center', justifyContent: 'center' },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: Colors.white, fontFamily: FontFamily.manropeBold, fontSize: FontSize.body },
});
