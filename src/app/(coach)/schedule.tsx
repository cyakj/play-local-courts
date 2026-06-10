import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import {
  CalendarDays,
  CalendarRange,
  Info,
  SlidersHorizontal,
} from 'lucide-react-native';
import { Header } from '@/components/ui/Header';
import { CoachDailyTimeline } from '@/components/coach/schedule/CoachDailyTimeline';
import { CoachDatePickerSheet } from '@/components/coach/schedule/CoachDatePickerSheet';
import { useCoachDailyTimeline, type TimelineItem } from '@/hooks/useCoachDailyTimeline';
import { useCoachProfile } from '@/hooks/useCoachProfile';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing } from '@/constants/design';
import type { ThemeTokens } from '@/constants/theme-tokens';
import type { CoachLessonRequest } from '@/hooks/useCoachRequests';

const KEY_ITEMS = [
  { code: 'L', label: 'Booked Lesson', color: Colors.positive, dark: true },
  { code: 'F', label: 'Open Facility Slot', color: Colors.blue, dark: false },
  { code: 'T', label: 'Open Travel Slot', color: Colors.volt, dark: true },
  { code: 'E', label: 'Open Either Slot', color: '#7A839A', dark: false },
  { code: 'U', label: 'Unavailable', color: '#333A4D', dark: false },
];

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date: Date, days: number): Date {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  value.setHours(0, 0, 0, 0);
  return value;
}

function dateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export default function CoachScheduleScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(startOfToday);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);
  const { profile: coachProfile } = useCoachProfile();
  const timeline = useCoachDailyTimeline(coachId, selectedDate);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCoachId(user?.id ?? null));
  }, []);

  const today = startOfToday();
  const tomorrow = addDays(today, 1);
  const selectedKey = dateKey(selectedDate);
  const maxAdvanceDays = Math.max(coachProfile?.maxAdvanceBookingDays ?? 60, 1);
  const selectedDateLabel = selectedDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  async function handleAccept(request: CoachLessonRequest) {
    const error = await timeline.accept(
      request.id,
      selectedKey,
      request.preferredTimeStart,
      request.preferredTimeEnd,
    );
    if (error) Alert.alert('Unable to accept request', error);
  }

  async function handleDecline(request: CoachLessonRequest) {
    Alert.alert(
      'Decline request?',
      `Decline the request from ${request.playerName ?? 'this player'}?`,
      [
        { text: 'Keep Request', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            const error = await timeline.decline(request.id);
            if (error) Alert.alert('Unable to decline request', error);
          },
        },
      ],
    );
  }

  async function handleCancelLesson(request: CoachLessonRequest, reason?: string) {
    const error = await timeline.cancelLesson(request.id, reason);
    if (error) Alert.alert('Unable to cancel lesson', error);
  }

  async function handleMarkComplete(request: CoachLessonRequest) {
    const error = await timeline.markComplete(request.id);
    if (error) Alert.alert('Unable to mark lesson complete', error);
  }

  function handleEditRule(item: Extract<TimelineItem, { kind: 'open' }>) {
    if (item.sourceKind === 'legacy') {
      Alert.alert('Legacy availability', 'This slot is managed by the existing player booking system.');
      return;
    }
    router.push({
      pathname: '/(coach)/schedule-settings',
      params: {
        day: String(selectedDate.getDay()),
        blockId: item.sourceIds[0],
      },
    } as any);
  }

  function handleEditUnavailable(item: Extract<TimelineItem, { kind: 'unavailable' }>) {
    if (item.sourceKind === 'legacy') {
      Alert.alert('Legacy unavailable time', 'This date range is managed by the existing player booking system.');
      return;
    }
    router.push({
      pathname: '/(coach)/schedule-settings',
      params: {
        day: String(selectedDate.getDay()),
        blockoutId: item.id.replace('blockout-', ''),
      },
    } as any);
  }

  async function handleRemoveUnavailable(item: Extract<TimelineItem, { kind: 'unavailable' }>) {
    if (item.sourceKind !== 'blockout') return;
    Alert.alert(
      'Remove unavailable time?',
      'This removes the unavailable time from your schedule rules.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const id = item.id.replace('blockout-', '');
            const { error } = await (supabase as any)
              .from('coach_blockouts')
              .delete()
              .eq('id', id)
              .eq('coach_id', coachId);
            if (error) Alert.alert('Unable to remove unavailable time', error.message);
            else await timeline.refreshRules();
          },
        },
      ],
    );
  }

  return (
    <View style={styles.screen}>
      <Header variant="coach" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.manageAvailabilityButton}
          onPress={() => router.push('/(coach)/schedule-settings' as any)}
          activeOpacity={0.78}>
          <SlidersHorizontal size={20} color={Colors.cyan} />
          <View style={styles.manageCopy}>
            <Text style={styles.manageAvailabilityLabel}>Manage Schedule</Text>
            <Text style={styles.manageAvailabilityBody}>
              Set coaching boundaries, teaching blocks, and unavailable times.
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryDate}>{selectedDateLabel}</Text>
          <View style={styles.metrics}>
            <Metric value={timeline.summary.lessons} label="Lessons" />
            <Metric value={timeline.summary.openSlots} label="Open Slots" />
            <Metric value={timeline.summary.unavailable} label="Unavailable Blocks" />
          </View>
        </View>

        <View style={styles.dateSelector}>
          <DateChip
            label="Today"
            active={selectedKey === dateKey(today)}
            onPress={() => setSelectedDate(today)}
          />
          <DateChip
            label="Tomorrow"
            active={selectedKey === dateKey(tomorrow)}
            onPress={() => setSelectedDate(tomorrow)}
          />
          <TouchableOpacity
            style={styles.calendarButton}
            onPress={() => setDatePickerOpen(true)}
            activeOpacity={0.78}>
            <CalendarDays size={20} color={Colors.cyan} />
            <Text style={styles.calendarButtonText}>Select Date</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.weekButton}
          onPress={() => router.push({
            pathname: '/(coach)/schedule-week',
            params: { date: selectedKey },
          } as any)}
          activeOpacity={0.78}>
          <CalendarRange size={20} color={Colors.cyan} />
          <Text style={styles.weekButtonText}>Week View</Text>
        </TouchableOpacity>

        <View style={styles.timelineHeading}>
          <View>
            <Text style={styles.eyebrow}>DAILY TIMELINE</Text>
            <Text style={styles.selectedDate}>{selectedDateLabel}</Text>
          </View>
          <TouchableOpacity style={styles.infoButton} onPress={() => setKeyOpen(value => !value)}>
            <Info size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {keyOpen && <ScheduleKey />}

        {!!timeline.error && <Text style={styles.error}>{timeline.error}</Text>}

        {!timeline.loading && timeline.items.length === 0 ? (
          <View style={styles.emptyState}>
            <CalendarDays size={42} color={theme.textMuted} />
            <Text style={styles.emptyTitle}>No lessons or open slots scheduled for this day.</Text>
          </View>
        ) : (
          <CoachDailyTimeline
            items={timeline.items}
            loading={timeline.loading}
            selectedDateLabel={selectedDateLabel}
            onAccept={handleAccept}
            onDecline={handleDecline}
            onCancelLesson={handleCancelLesson}
            onMarkComplete={handleMarkComplete}
            onEditRule={handleEditRule}
            onEditUnavailable={handleEditUnavailable}
            onRemoveUnavailable={handleRemoveUnavailable}
          />
        )}
      </ScrollView>

      <CoachDatePickerSheet
        visible={datePickerOpen}
        selectedDate={selectedDate}
        maxDays={maxAdvanceDays}
        onSelect={setSelectedDate}
        onClose={() => setDatePickerOpen(false)}
      />
    </View>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function DateChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  return (
    <TouchableOpacity
      style={[styles.dateChip, active && styles.dateChipActive]}
      onPress={onPress}
      activeOpacity={0.76}>
      <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ScheduleKey() {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  return (
    <View style={styles.key}>
      <View style={styles.keyGrid}>
        {KEY_ITEMS.map(item => (
          <View key={item.code} style={styles.keyItem}>
            <View style={[styles.keyCode, { backgroundColor: item.color }]}>
              <Text style={[styles.keyCodeText, item.dark && styles.keyCodeDark]}>{item.code}</Text>
            </View>
            <Text style={styles.keyLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.keyNote}>Private/internal availability is muted. Pending requests remain in Requests.</Text>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.pageBg },
    content: {
      width: '100%',
      maxWidth: MaxWidth,
      alignSelf: 'center',
      padding: Spacing.pagePx,
      paddingBottom: 110,
      gap: 20,
    },
    manageAvailabilityButton: {
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      borderRadius: Radius.button,
      borderWidth: 1,
      borderColor: theme.borderStrong,
      backgroundColor: theme.cardBg,
    },
    manageCopy: { flex: 1, gap: 2 },
    manageAvailabilityLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: theme.textPrimary,
    },
    manageAvailabilityBody: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: 12,
      lineHeight: 17,
      color: theme.textMuted,
    },
    summaryCard: {
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBg,
      padding: Spacing.cardPadding,
      gap: 16,
      ...theme.shadowCard,
    },
    summaryDate: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
    },
    metrics: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 },
    metric: { width: '50%', gap: 2 },
    metricValue: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.statValue,
      color: theme.textPrimary,
    },
    metricLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: 12,
      color: theme.textMuted,
    },
    dateSelector: { flexDirection: 'row', gap: 8 },
    dateChip: {
      flex: 1,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
      borderRadius: Radius.chip,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBg,
    },
    dateChipActive: {
      borderColor: Colors.cyan,
      backgroundColor: 'rgba(45,224,255,0.10)',
    },
    dateChipText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    dateChipTextActive: { color: Colors.cyan },
    calendarButton: {
      flex: 1.25,
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 8,
      borderRadius: Radius.chip,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBg,
    },
    weekButton: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: Radius.chip,
      borderWidth: 1,
      borderColor: 'rgba(45,224,255,0.32)',
      backgroundColor: 'rgba(45,224,255,0.08)',
    },
    calendarButtonText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    weekButtonText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.cyan,
    },
    timelineHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    eyebrow: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      letterSpacing: 1.4,
      color: Colors.cyan,
    },
    selectedDate: {
      marginTop: 4,
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.sectionTitle,
      color: theme.textPrimary,
    },
    infoButton: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
    },
    key: {
      padding: 16,
      gap: 14,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface2,
    },
    keyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    keyItem: { width: '47%', flexDirection: 'row', alignItems: 'center', gap: 8 },
    keyCode: {
      width: 30,
      height: 30,
      borderRadius: Radius.xs,
      alignItems: 'center',
      justifyContent: 'center',
    },
    keyCodeText: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 11,
      color: '#F5F8FF',
    },
    keyCodeDark: { color: '#0C0F18' },
    keyLabel: {
      flex: 1,
      fontFamily: FontFamily.manropeMedium,
      fontSize: 12,
      color: theme.textSecondary,
    },
    keyNote: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      lineHeight: 20,
      color: theme.textMuted,
    },
    error: {
      padding: 12,
      borderRadius: Radius.sm,
      backgroundColor: 'rgba(255,92,107,0.10)',
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: Colors.negative,
    },
    emptyState: {
      minHeight: 260,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
      padding: 24,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBg,
    },
    emptyTitle: {
      maxWidth: 290,
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      lineHeight: 24,
      textAlign: 'center',
      color: theme.textPrimary,
    },
  }), [theme]);
}
