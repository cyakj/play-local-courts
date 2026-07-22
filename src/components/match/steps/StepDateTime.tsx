// src/components/match/steps/StepDateTime.tsx
import { useMemo, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useHourlyWeather } from '@/hooks/useHourlyWeather';
import { CalendarPicker, formatDateLabel } from '@/components/ui/CalendarPicker';
import { TimeSlotWheel } from '@/components/ui/TimeSlotWheel';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';

const MAX_DAYS_AHEAD = 14;
const today = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();

const DURATIONS = [60, 90, 120];

interface Props {
  dateTime: { date: Date; time: string | null; durationMinutes: number };
  onChange: (date: Date, time: string, durationMinutes: number) => void;
  locationCity?: string;
}

// Tap feedback: scale(0.97) at 140ms with a snappy ease — matches DESIGN.md's
// documented Interaction Pattern ("Tap feedback: scale(0.97) at --t-fast with
// --ease-snap") and the Animated-driven treatment StepActivity/StepLocation
// use elsewhere in this same wizard.
const EASE_SNAP = Easing.bezier(0.34, 1.56, 0.64, 1);
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function animatePressScale(value: Animated.Value, toValue: number) {
  Animated.timing(value, { toValue, duration: 140, easing: EASE_SNAP, useNativeDriver: true }).start();
}

export function StepDateTime({ dateTime, onChange, locationCity }: Props) {
  const { theme } = useTheme();
  const [showCalendar, setShowCalendar] = useState(false);
  const { wheelWeather } = useHourlyWeather(locationCity ?? null);

  const primaryDates = useMemo(() => {
    const t = new Date(today);
    const tom = new Date(t); tom.setDate(t.getDate() + 1);
    return [t, tom];
  }, []);
  const calMaxDate = useMemo(() => { const d = new Date(today); d.setDate(d.getDate() + MAX_DAYS_AHEAD); return d; }, []);
  const isMoreDate = primaryDates.every(d => d.toDateString() !== dateTime.date.toDateString());

  // One press-scale Animated.Value per option, matching StepActivity's
  // "one Animated.Value per dot" pattern — transform-only so it's GPU-composited.
  const dateScales = useRef(primaryDates.map(() => new Animated.Value(1))).current;
  const calendarScale = useRef(new Animated.Value(1)).current;
  const durationScales = useRef(DURATIONS.map(() => new Animated.Value(1))).current;

  const timeSlots = useMemo(() => {
    const list: string[] = [];
    for (let h = 6; h < 22; h++) for (let m = 0; m < 60; m += 30) list.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    return list;
  }, []);

  function selectDate(d: Date) {
    onChange(d, dateTime.time ?? timeSlots[0], dateTime.durationMinutes);
    setShowCalendar(false);
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>DATE</Text>
      <View style={styles.segmentRow}>
        {primaryDates.map((d, i) => {
          const isSelected = d.toDateString() === dateTime.date.toDateString();
          const scale = dateScales[i];
          return (
            <AnimatedTouchable
              key={i}
              style={[
                styles.segment,
                { borderColor: isSelected ? Colors.blue : theme.border, backgroundColor: isSelected ? theme.selectedBg : theme.cardBg },
                { transform: [{ scale }] },
              ]}
              onPress={() => selectDate(d)}
              onPressIn={() => animatePressScale(scale, 0.97)}
              onPressOut={() => animatePressScale(scale, 1)}
              activeOpacity={0.85}>
              <Text style={[styles.segmentText, { color: isSelected ? Colors.blue : theme.textSecondary }]}>{formatDateLabel(d, today)}</Text>
            </AnimatedTouchable>
          );
        })}
        <AnimatedTouchable
          style={[
            styles.segment,
            { borderColor: (showCalendar || isMoreDate) ? Colors.blue : theme.border, backgroundColor: (showCalendar || isMoreDate) ? theme.selectedBg : theme.cardBg },
            { transform: [{ scale: calendarScale }] },
          ]}
          onPress={() => setShowCalendar(v => !v)}
          onPressIn={() => animatePressScale(calendarScale, 0.97)}
          onPressOut={() => animatePressScale(calendarScale, 1)}
          activeOpacity={0.85}>
          <Text style={[styles.segmentText, { color: (showCalendar || isMoreDate) ? Colors.blue : theme.textSecondary }]}>
            {isMoreDate ? formatDateLabel(dateTime.date, today) : 'Dates'}
          </Text>
        </AnimatedTouchable>
      </View>

      {showCalendar && (
        <CalendarPicker selectedDate={dateTime.date} onSelect={selectDate} minDate={today} maxDate={calMaxDate} theme={theme} />
      )}

      {!showCalendar && (
        <>
          <Text style={[styles.sectionLabel, { color: theme.textMuted, marginTop: 8 }]}>DURATION</Text>
          <View style={styles.segmentRow}>
            {DURATIONS.map((d, i) => {
              const isSelected = d === dateTime.durationMinutes;
              const scale = durationScales[i];
              return (
                <AnimatedTouchable
                  key={d}
                  style={[
                    styles.segment,
                    { borderColor: isSelected ? Colors.blue : theme.border, backgroundColor: isSelected ? theme.selectedBg : theme.cardBg },
                    { transform: [{ scale }] },
                  ]}
                  onPress={() => dateTime.time && onChange(dateTime.date, dateTime.time, d)}
                  onPressIn={() => animatePressScale(scale, 0.97)}
                  onPressOut={() => animatePressScale(scale, 1)}
                  activeOpacity={0.85}>
                  <Text style={[styles.segmentText, { color: isSelected ? Colors.blue : theme.textSecondary }]}>{d / 60} hr</Text>
                </AnimatedTouchable>
              );
            })}
          </View>
        </>
      )}

      {!showCalendar && (
        <TimeSlotWheel
          slots={timeSlots}
          selectedSlot={dateTime.time}
          onSelectSlot={(t) => { if (t) onChange(dateTime.date, t, dateTime.durationMinutes); }}
          weather={wheelWeather}
          outdoor
          sheetDate={dateTime.date}
          now={today}
          theme={theme}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.pagePx, gap: 10 },
  sectionLabel: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.eyebrow, letterSpacing: 1.2, marginBottom: 2 },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segment: { flex: 1, minHeight: 46, borderWidth: 1, borderRadius: Radius.chip, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label, textAlign: 'center' },
});
