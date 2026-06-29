import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Info, RotateCw, X } from 'lucide-react-native';
import { CoachWeekCalendar } from '@/components/coach/schedule/CoachWeekCalendar';
import { useCoachWeekTimeline, startOfWeek, type WeekScheduleItem } from '@/hooks/useCoachWeekTimeline';
import { supabase } from '@/lib/supabase';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

const KEY_ITEMS = [
  { code: 'L', label: 'Booked lesson', color: Colors.positive, dark: true },
  { code: 'C', label: 'Clinic', color: Colors.cyan, dark: true },
  { code: 'F', label: 'Facility', color: Colors.blue, dark: false },
  { code: 'T', label: 'Travel', color: Colors.volt, dark: true },
  { code: 'E', label: 'Empty / Either', color: '#7A839A', dark: false },
  { code: 'U', label: 'Unavailable', color: '#333A4D', dark: false },
];

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export default function CoachScheduleWeekScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const params = useLocalSearchParams<{ date?: string }>();
  const window = useWindowDimensions();
  const initialDate = useMemo(() => {
    const value = Array.isArray(params.date) ? params.date[0] : params.date;
    const parsed = value ? new Date(`${value}T12:00:00`) : new Date();
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [params.date]);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(initialDate));
  const [keyOpen, setKeyOpen] = useState(false);
  const week = useCoachWeekTimeline(coachId, weekStart);
  const isLandscape = window.width > window.height;

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCoachId(user?.id ?? null));
  }, []);

  useEffect(() => {
    ScreenOrientation.unlockAsync().catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  const weekEnd = addDays(weekStart, 6);
  const rangeLabel = `${weekStart.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })} - ${weekEnd.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;

  async function cancelLesson(item: Extract<WeekScheduleItem, { kind: 'lesson' }>) {
    const error = await week.cancelLesson(item.request.id);
    if (error) {
      Alert.alert('Unable to cancel lesson', error);
      return;
    }
    await week.refresh();
  }

  async function makeUnavailable(item: Extract<WeekScheduleItem, { kind: 'open' }>) {
    if (!coachId) return;
    const { error } = await (supabase as any).from('coach_blockouts').insert({
      coach_id: coachId,
      type: 'other',
      title: null,
      days_of_week: null,
      specific_date: item.date,
      start_time: item.start,
      end_time: item.end,
      visibility: 'show_as_unavailable',
    });
    if (error) {
      Alert.alert('Unable to make this time unavailable', error.message);
      return;
    }
    await week.refresh();
  }

  if (!isLandscape) {
    return (
      <View style={styles.rotationScreen}>
        <TouchableOpacity
          style={styles.rotationClose}
          onPress={() => router.replace('/(coach)/schedule' as any)}>
          <X size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <RotateCw size={48} color={Colors.cyan} />
        <Text style={styles.rotationTitle}>Week View</Text>
        <Text style={styles.rotationBody}>
          Rotate your device to view the weekly schedule grid.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => router.replace('/(coach)/schedule' as any)}>
          <X size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <View style={styles.titleCopy}>
          <Text style={styles.title}>Week View</Text>
          <Text style={styles.range}>{rangeLabel}</Text>
        </View>
        <View style={styles.weekControls}>
          <TouchableOpacity
            style={styles.weekButton}
            onPress={() => setWeekStart(addDays(weekStart, -7))}>
            <Text style={styles.weekButtonLabel}>Previous Week</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.currentWeekButton}
            onPress={() => setWeekStart(startOfWeek(new Date()))}>
            <Text style={styles.currentWeekLabel}>Current Week</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.weekButton}
            onPress={() => setWeekStart(addDays(weekStart, 7))}>
            <Text style={styles.weekButtonLabel}>Next Week</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => setKeyOpen(value => !value)}>
            <Info size={21} color={Colors.cyan} />
          </TouchableOpacity>
        </View>
      </View>

      {keyOpen && (
        <View style={styles.key}>
          {KEY_ITEMS.map(item => (
            <View key={item.code} style={styles.keyItem}>
              <View style={[styles.keyCode, { backgroundColor: item.color }]}>
                <Text style={[styles.keyCodeText, item.dark && styles.keyCodeDark]}>{item.code}</Text>
              </View>
              <Text style={styles.keyLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      )}

      {!!week.error && <Text style={styles.error}>{week.error}</Text>}
      {week.loading ? (
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Loading weekly schedule...</Text>
        </View>
      ) : (
        <CoachWeekCalendar
          days={week.days}
          itemsByDate={week.itemsByDate}
          onCancelLesson={cancelLesson}
          onMakeUnavailable={makeUnavailable}
        />
      )}
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.pageBg },
    rotationScreen: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
      padding: 28,
      backgroundColor: theme.pageBg,
    },
    rotationClose: {
      position: 'absolute',
      top: 48,
      left: 20,
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBg,
    },
    rotationTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.sectionTitle,
      color: theme.textPrimary,
    },
    rotationBody: {
      maxWidth: 360,
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      lineHeight: 24,
      textAlign: 'center',
      color: theme.textSecondary,
    },
    toolbar: {
      minHeight: 68,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: Spacing.s4,
      paddingTop: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.headerBg,
    },
    iconButton: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.sm,
    },
    titleCopy: { flex: 1 },
    title: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.sectionTitle,
      color: '#F5F8FF',
    },
    range: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: '#9AA3B8',
    },
    weekControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    weekButton: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: 12,
      borderRadius: Radius.button,
      borderWidth: 1,
      borderColor: theme.borderStrong,
      backgroundColor: theme.cardBg,
    },
    weekButtonLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: 12,
      color: theme.textSecondary,
    },
    currentWeekButton: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: 12,
      borderRadius: Radius.button,
      borderWidth: 1,
      borderColor: 'rgba(45,224,255,0.32)',
      backgroundColor: 'rgba(45,224,255,0.10)',
    },
    currentWeekLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: 12,
      color: Colors.cyan,
    },
    key: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      paddingHorizontal: Spacing.s4,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.bgElevated,
    },
    keyItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    keyCode: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.xs,
    },
    keyCodeText: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 10,
      color: '#F5F8FF',
    },
    keyCodeDark: { color: '#0C0F18' },
    keyLabel: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: 12,
      color: theme.textSecondary,
    },
    error: {
      padding: 10,
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.negative,
      backgroundColor: 'rgba(255,92,107,0.10)',
    },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    loadingText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textMuted,
    },
  }), [theme]);
}
