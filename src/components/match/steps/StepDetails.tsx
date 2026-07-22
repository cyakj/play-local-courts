// src/components/match/steps/StepDetails.tsx
import { useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';

interface Props {
  note: string;
  onNote: (v: string) => void;
  courtReserved: boolean;
  onCourtReserved: (v: boolean) => void;
}

const MAX_NOTE_LENGTH = 200;

// Tap feedback: scale(0.97) at 140ms with a snappy ease — matches DESIGN.md's
// documented Interaction Pattern ("Tap feedback: scale(0.97) at --t-fast with
// --ease-snap") and the Animated-driven treatment StepPreferences/StepPlayers
// use elsewhere in this same wizard. The Court Reserved row is a single,
// known affordance, so it gets one Animated.Value, matching StepPlayers's
// standalone add-row.
const EASE_SNAP = Easing.bezier(0.34, 1.56, 0.64, 1);
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function animatePressScale(value: Animated.Value, toValue: number) {
  Animated.timing(value, { toValue, duration: 140, easing: EASE_SNAP, useNativeDriver: true }).start();
}

export function StepDetails({ note, onNote, courtReserved, onCourtReserved }: Props) {
  const { theme } = useTheme();
  const [noteFocused, setNoteFocused] = useState(false);
  const toggleScale = useRef(new Animated.Value(1)).current;

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>MATCH NOTE</Text>
      {/* Corrected outline pattern: the border (and the web-only focus-ring
          suppression via outlineWidth: 0) lives on this single rounded
          container, not on an inner TextInput nested inside a separate
          bordered wrapper — the outline follows the field's own perimeter
          exactly, and there is no double ring on web. Mirrors the input-wrap
          convention already established in edit-profile.tsx and
          LocationAutocomplete.tsx (Radius.sm, 1.5px border, focus swap). */}
      <View
        style={[
          styles.noteField,
          { borderColor: theme.border, backgroundColor: theme.inputBg },
          noteFocused && styles.noteFieldFocused,
        ]}>
        <TextInput
          value={note}
          onChangeText={(t) => onNote(t.slice(0, MAX_NOTE_LENGTH))}
          onFocus={() => setNoteFocused(true)}
          onBlur={() => setNoteFocused(false)}
          style={[styles.noteInput, { color: theme.textPrimary }]}
          placeholder="Looking for strong baseliner."
          placeholderTextColor={theme.textDisabled}
          multiline
          textAlignVertical="top"
        />
      </View>
      <Text style={[styles.counter, { color: theme.textMuted }]}>{note.length}/{MAX_NOTE_LENGTH}</Text>

      <AnimatedTouchable
        style={[
          styles.toggleRow,
          { borderColor: theme.border, backgroundColor: theme.cardBg },
          { transform: [{ scale: toggleScale }] },
        ]}
        onPress={() => onCourtReserved(!courtReserved)}
        onPressIn={() => animatePressScale(toggleScale, 0.98)}
        onPressOut={() => animatePressScale(toggleScale, 1)}
        activeOpacity={0.85}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.toggleLabel, { color: theme.textPrimary }]}>Court Reserved</Text>
          <Text style={[styles.toggleCopy, { color: theme.textSecondary }]}>I already have a court booked.</Text>
        </View>
        <View style={[styles.toggleTrack, { backgroundColor: theme.borderStrong }, courtReserved && styles.toggleTrackActive]}>
          <View style={[styles.toggleThumb, courtReserved && styles.toggleThumbActive]} />
        </View>
      </AnimatedTouchable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.pagePx, gap: 10 },
  sectionLabel: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.eyebrow, letterSpacing: 1.2 },
  noteField: {
    borderWidth: 1.5,
    borderRadius: Radius.sm,
    padding: 14,
    minHeight: 110,
    outlineWidth: 0,
  } as any,
  noteFieldFocused: {
    borderColor: Colors.cyan,
    shadowColor: Colors.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 3,
  },
  noteInput: { flex: 1, fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, lineHeight: 22 },
  counter: { alignSelf: 'flex-end', fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.metadata },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
    minHeight: 64,
    borderWidth: 1,
    borderRadius: Radius.card,
    paddingHorizontal: 14,
  },
  toggleLabel: { fontFamily: FontFamily.manropeBold, fontSize: FontSize.body },
  toggleCopy: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, marginTop: 3 },
  toggleTrack: { width: 46, height: 28, borderRadius: 14, padding: 3 },
  toggleTrackActive: { backgroundColor: Colors.blue },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.white },
  toggleThumbActive: { transform: [{ translateX: 18 }] },
});
