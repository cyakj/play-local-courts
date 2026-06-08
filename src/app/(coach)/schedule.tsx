import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Header } from '@/components/ui/Header';
import { useTheme } from '@/context/ThemeContext';
import { useCoachSchedule } from '@/hooks/useCoachSchedule';
import { useCoachAvailability } from '@/hooks/useCoachAvailability';
import { CoachWeekView } from '@/components/coach/CoachWeekView';
import { CoachAvailabilityEditor } from '@/components/coach/CoachAvailabilityEditor';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/design';
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

  useMemo(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCoachId(user.id);
    });
  }, []);

  const { lessonsByDate, loading: schedLoading, refresh: refreshSchedule } = useCoachSchedule(weekStart);
  const { weeklySlots, loading: slotsLoading, hasScheduleForBandOnDay } = useCoachAvailability(coachId);

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
      <ScrollView contentContainerStyle={styles.content}>
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

        {/* Availability editor */}
        <CoachAvailabilityEditor
          slots={weeklySlots}
          onRefresh={refreshSchedule}
        />
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
    weekNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    navBtn: {
      width: 36,
      height: 36,
      borderRadius: 8,
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
  }), [theme]);
}
