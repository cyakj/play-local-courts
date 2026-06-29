import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Clock3, X } from 'lucide-react-native';

import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { useTheme } from '@/context/ThemeContext';
import { formatTime } from '@/types/coachSchedule';

const HOURS = Array.from({ length: 12 }, (_, index) => String(index + 1));
const MINUTES = ['00', '15', '30', '45'];
const PERIODS = ['AM', 'PM'] as const;
const ITEM_HEIGHT = 52;
const VISIBLE_ROWS = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;
const WHEEL_PADDING = (WHEEL_HEIGHT - ITEM_HEIGHT) / 2;
const CYLINDER_SCALE = [1, 0.94, 0.88, 0.82] as const;
const CYLINDER_OPACITY = [1, 0.55, 0.24, 0.09] as const;

type Period = typeof PERIODS[number];

function parseTime(value: string) {
  const [hourValue = '0', minuteValue = '0'] = value.slice(0, 5).split(':');
  const rawMinutes = Number(hourValue) * 60 + Number(minuteValue);
  const snappedMinutes = Math.round(rawMinutes / 15) * 15;
  const normalizedMinutes = ((snappedMinutes % 1440) + 1440) % 1440;
  const hour24 = Math.floor(normalizedMinutes / 60);
  const minute = String(normalizedMinutes % 60).padStart(2, '0');
  return {
    hour: String(hour24 % 12 || 12),
    minute,
    period: (hour24 >= 12 ? 'PM' : 'AM') as Period,
  };
}

function toTime(hour: string, minute: string, period: Period): string {
  const hourNumber = Number(hour);
  const hour24 = period === 'PM' ? (hourNumber % 12) + 12 : hourNumber % 12;
  return `${String(hour24).padStart(2, '0')}:${minute}`;
}

function WheelColumn<T extends string>({
  values,
  selected,
  onSelect,
  accessibilityLabel,
}: {
  values: readonly T[];
  selected: T;
  onSelect: (value: T) => void;
  accessibilityLabel: string;
}) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const scrollRef = useRef<ScrollView>(null);
  const initialIndex = useRef(Math.max(0, values.indexOf(selected))).current;
  const [centeredIndex, setCenteredIndex] = useState(initialIndex);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: initialIndex * ITEM_HEIGHT, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [initialIndex]);

  function indexFromEvent(event: NativeSyntheticEvent<NativeScrollEvent>) {
    return Math.max(
      0,
      Math.min(values.length - 1, Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT)),
    );
  }

  function trackSelection(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setCenteredIndex(indexFromEvent(event));
  }

  function commitSelection(event: NativeSyntheticEvent<NativeScrollEvent>, animated = true) {
    const index = indexFromEvent(event);
    setCenteredIndex(index);
    onSelect(values[index]);
    scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated });
  }

  return (
    <View style={styles.wheelColumn} accessibilityLabel={accessibilityLabel}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="start"
        disableIntervalMomentum
        decelerationRate="fast"
        contentOffset={{ x: 0, y: initialIndex * ITEM_HEIGHT }}
        scrollEventThrottle={16}
        onScroll={trackSelection}
        onMomentumScrollEnd={commitSelection}
        onScrollEndDrag={event => {
          const velocity = Math.abs(event.nativeEvent.velocity?.y ?? 0);
          if (velocity < 0.05) commitSelection(event);
        }}
        contentContainerStyle={{ paddingVertical: WHEEL_PADDING }}>
        {values.map((value, index) => {
          const distance = Math.min(Math.abs(index - centeredIndex), 3) as 0 | 1 | 2 | 3;
          const centered = index === centeredIndex;
          return (
            <TouchableOpacity
              key={value}
              style={styles.wheelItem}
              activeOpacity={0.72}
              onPress={() => {
                setCenteredIndex(index);
                onSelect(value);
                scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
              }}>
              <Text
                style={[
                  styles.wheelItemText,
                  centered && styles.wheelItemTextSelected,
                  {
                    opacity: CYLINDER_OPACITY[distance],
                    transform: [{ scale: CYLINDER_SCALE[distance] }],
                  },
                ]}>
                {value}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function ScheduleTimePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  const [draft, setDraft] = useState(() => parseTime(value));

  function openPicker() {
    setDraft(parseTime(value));
    setSession(current => current + 1);
    setOpen(true);
  }

  return (
    <>
      <View style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${formatTime(value)}`}
          style={styles.trigger}
          onPress={openPicker}
          activeOpacity={0.76}>
          <Clock3 size={20} color={Colors.cyan} />
          <Text style={styles.triggerText}>{formatTime(value)}</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <View style={styles.header}>
              <Text style={styles.title}>{label}</Text>
              <TouchableOpacity
                accessibilityLabel="Close time picker"
                style={styles.closeButton}
                onPress={() => setOpen(false)}>
                <X size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.preview}>
              {draft.hour}:{draft.minute} {draft.period}
            </Text>

            <View style={styles.wheels}>
              <View pointerEvents="none" style={styles.selectionBand} />
              <WheelColumn
                key={`hour-${session}`}
                values={HOURS}
                selected={draft.hour}
                onSelect={hour => setDraft(current => ({ ...current, hour }))}
                accessibilityLabel="Hour"
              />
              <Text style={styles.separator}>:</Text>
              <WheelColumn
                key={`minute-${session}`}
                values={MINUTES}
                selected={draft.minute}
                onSelect={minute => setDraft(current => ({ ...current, minute }))}
                accessibilityLabel="Minute"
              />
              <WheelColumn
                key={`period-${session}`}
                values={PERIODS}
                selected={draft.period}
                onSelect={period => setDraft(current => ({ ...current, period }))}
                accessibilityLabel="AM or PM"
              />
            </View>

            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => {
                onChange(toTime(draft.hour, draft.minute, draft.period));
                setOpen(false);
              }}>
              <Text style={styles.applyLabel}>Set Time</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    field: { gap: 8 },
    label: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      color: theme.textMuted,
      letterSpacing: 1.2,
    },
    trigger: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      borderRadius: Radius.input,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.inputBg,
    },
    triggerText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: theme.textPrimary,
    },
    overlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.pagePx,
      backgroundColor: theme.backdrop,
    },
    dialog: {
      width: '100%',
      maxWidth: 390,
      gap: 16,
      padding: Spacing.cardPadding,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.sheetBg,
      ...theme.shadowSheet,
    },
    header: { flexDirection: 'row', alignItems: 'center' },
    title: {
      flex: 1,
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
    },
    closeButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
    preview: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: 30,
      textAlign: 'center',
      color: Colors.cyan,
    },
    wheels: {
      height: WHEEL_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      overflow: 'hidden',
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.inputBg,
      paddingHorizontal: 14,
    },
    selectionBand: {
      position: 'absolute',
      left: 10,
      right: 10,
      top: WHEEL_PADDING,
      height: ITEM_HEIGHT,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: Colors.cyan,
      backgroundColor: 'rgba(45,224,255,0.08)',
    },
    wheelColumn: {
      flex: 1,
      height: WHEEL_HEIGHT,
      overflow: 'hidden',
    },
    wheelItem: {
      height: ITEM_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: 3,
    },
    wheelItemText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: 19,
      color: theme.textSecondary,
    },
    wheelItemTextSelected: {
      fontFamily: FontFamily.manropeBold,
      fontSize: 26,
      color: theme.textPrimary,
    },
    separator: {
      width: 18,
      textAlign: 'center',
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: 24,
      color: theme.textPrimary,
      zIndex: 2,
    },
    applyButton: {
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.button,
      backgroundColor: Colors.blue,
    },
    applyLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: '#F5F8FF',
    },
  }), [theme]);
}
