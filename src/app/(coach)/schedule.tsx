import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Header } from '@/components/ui/Header';
import { useTheme } from '@/context/ThemeContext';
import { useCoachSchedule } from '@/hooks/useCoachSchedule';
import { useCoachAvailability } from '@/hooks/useCoachAvailability';
import { CoachWeekView } from '@/components/coach/CoachWeekView';
import { CoachAvailabilityEditor } from '@/components/coach/CoachAvailabilityEditor';
import { CoachWeeklyScheduleModal } from '@/components/coach/CoachWeeklyScheduleModal';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { supabase } from '@/lib/supabase';

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export default function CoachScheduleScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [coachId, setCoachId] = useState<string | null>(null);
  const [showWeeklyModal, setShowWeeklyModal] = useState(false);

  useMemo(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCoachId(user.id);
    });
  }, []);

  const { lessonsByDate, loading: schedLoading, refresh: refreshSchedule } = useCoachSchedule(weekStart);
  const { weeklySlots, loading: slotsLoading, error: slotsError, refresh: refreshSlots } = useCoachAvailability(coachId);

  function prevWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
    setSelectedDate(d);
  }

  function nextWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
    setSelectedDate(d);
  }

  const weekLabel = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    const startFmt = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endFmt   = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${startFmt} – ${endFmt}`;
  }, [weekStart]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.pageBg }]}>
      <Header variant="coach" />
      {/* Weekly schedule read-only modal */}
      <CoachWeeklyScheduleModal
        visible={showWeeklyModal}
        onClose={() => setShowWeeklyModal(false)}
        weekStart={weekStart}
        lessonsByDate={lessonsByDate}
        availabilitySlots={weeklySlots}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* View Weekly Schedule button */}
        <TouchableOpacity
          style={styles.weeklyBtn}
          onPress={() => setShowWeeklyModal(true)}
          activeOpacity={0.85}
          testID="view-weekly-schedule-btn"
        >
          <CalendarDays size={15} color={Colors.cyan} strokeWidth={2} />
          <Text style={styles.weeklyBtnText}>View Weekly Schedule</Text>
        </TouchableOpacity>

        {/* Week nav */}
        <View style={styles.weekNav}>
          <TouchableOpacity onPress={prevWeek} style={styles.navBtn} activeOpacity={0.7}>
            <ChevronLeft size={18} color={theme.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.weekLabel}>{weekLabel}</Text>
          <TouchableOpacity onPress={nextWeek} style={styles.navBtn} activeOpacity={0.7}>
            <ChevronRight size={18} color={theme.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Week view */}
        <CoachWeekView
          weekStart={weekStart}
          lessonsByDate={lessonsByDate}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />

        {/* Availability block editor */}
        {slotsLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={Colors.blue} />
            <Text style={styles.loadingText}>Loading availability…</Text>
          </View>
        ) : slotsError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>Could not load availability.</Text>
            <Text style={styles.errorDetail}>{slotsError}</Text>
            <TouchableOpacity onPress={refreshSlots} activeOpacity={0.7}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <CoachAvailabilityEditor
            slots={weeklySlots}
            onRefresh={refreshSlots}
          />
        )}
      </ScrollView>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen: { flex: 1 },
    content: {
      padding: Spacing.pagePx,
      paddingBottom: 100,
      gap: 20,
    },
    weeklyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 13,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: 'rgba(45,224,255,0.30)',
      backgroundColor: 'rgba(45,224,255,0.07)',
    },
    weeklyBtnText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.cyan,
    },
    weekNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    navBtn: {
      width: 36,
      height: 36,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    weekLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 20,
    },
    loadingText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
    },
    errorCard: {
      backgroundColor: 'rgba(255,92,107,0.08)',
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: 'rgba(255,92,107,0.2)',
      padding: 20,
      alignItems: 'center',
      gap: 8,
    },
    errorText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.negative,
    },
    errorDetail: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
      textAlign: 'center',
    },
    retryText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.blue,
      marginTop: 4,
    },
  }), [theme]);
}
