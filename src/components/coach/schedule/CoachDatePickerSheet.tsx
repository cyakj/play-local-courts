import { useMemo } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CalendarDays, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

interface MonthGroup {
  key: string;
  label: string;
  leading: number;
  dates: Date[];
}

export function CoachDatePickerSheet({
  visible,
  selectedDate,
  maxDays,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedDate: Date;
  maxDays: number;
  onSelect: (date: Date) => void;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const insets = useSafeAreaInsets();
  const today = useMemo(() => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    return value;
  }, [visible]);

  const months = useMemo<MonthGroup[]>(() => {
    const values = Array.from({ length: Math.max(maxDays, 1) + 1 }, (_, index) => {
      const date = new Date(today);
      date.setDate(date.getDate() + index);
      return date;
    });
    const grouped = new Map<string, Date[]>();
    values.forEach(date => {
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      grouped.set(key, [...(grouped.get(key) ?? []), date]);
    });
    return [...grouped.entries()].map(([key, dates]) => ({
      key,
      label: dates[0].toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      leading: dates[0].getDate() === 1 ? dates[0].getDay() : dates[0].getDay(),
      dates,
    }));
  }, [maxDays, today]);

  const selectedKey = dateKey(selectedDate);
  const todayKey = dateKey(today);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <CalendarDays size={22} color={Colors.cyan} />
              <View>
                <Text style={styles.title}>Select Date</Text>
                <Text style={styles.subtitle}>Choose within the next {maxDays} days.</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {months.map(month => (
              <View key={month.key} style={styles.month}>
                <Text style={styles.monthLabel}>{month.label}</Text>
                <View style={styles.weekdayRow}>
                  {WEEKDAYS.map((label, index) => (
                    <Text key={`${label}-${index}`} style={styles.weekday}>{label}</Text>
                  ))}
                </View>
                <View style={styles.grid}>
                  {Array.from({ length: month.leading }).map((_, index) => (
                    <View key={`blank-${index}`} style={styles.dayCell} />
                  ))}
                  {month.dates.map(date => {
                    const key = dateKey(date);
                    const selected = key === selectedKey;
                    const isToday = key === todayKey;
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[styles.dayCell, selected && styles.selectedDay]}
                        onPress={() => { onSelect(date); onClose(); }}
                        activeOpacity={0.75}>
                        <Text style={[
                          styles.dayText,
                          isToday && styles.todayText,
                          selected && styles.selectedDayText,
                        ]}>
                          {date.getDate()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.backdrop },
    sheet: {
      maxHeight: '88%',
      minHeight: '68%',
      backgroundColor: theme.sheetBg,
      borderTopLeftRadius: Radius.xl,
      borderTopRightRadius: Radius.xl,
      borderWidth: 1,
      borderColor: theme.border,
      ...theme.shadowSheet,
    },
    header: {
      minHeight: 76,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.pagePx,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    title: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
    },
    subtitle: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: 12,
      color: theme.textMuted,
    },
    closeButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
    content: { padding: Spacing.pagePx, gap: 28 },
    month: { gap: 12 },
    monthLabel: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
    },
    weekdayRow: { flexDirection: 'row' },
    weekday: {
      width: '14.2857%',
      textAlign: 'center',
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 11,
      color: theme.textMuted,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    dayCell: {
      width: '14.2857%',
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.sm,
    },
    selectedDay: { backgroundColor: Colors.blue },
    dayText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: theme.textSecondary,
    },
    todayText: { color: Colors.cyan },
    selectedDayText: { color: '#F5F8FF' },
  }), [theme]);
}
