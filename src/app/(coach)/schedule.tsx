import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { Header } from '@/components/ui/Header';
import { CoachAvailabilityEditor } from '@/components/coach/CoachAvailabilityEditor';
import { CreateClinicSheet } from '@/components/coaching/CreateClinicSheet';
import { useCoachAvailability } from '@/hooks/useCoachAvailability';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing } from '@/constants/design';
import type { ThemeTokens } from '@/constants/theme-tokens';

function localDateStr(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

export default function CoachScheduleScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [createClinicOpen, setCreateClinicOpen] = useState(false);
  const [clinicCount, setClinicCount] = useState(0);
  const [clinicTick, setClinicTick] = useState(0);
  const { weeklySlots, error, refresh } = useCoachAvailability(coachId);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCoachId(user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!coachId) return;
    let cancelled = false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    (supabase as any)
      .from('coach_clinics')
      .select('id', { count: 'exact', head: true })
      .eq('coach_id', coachId)
      .gte('date', localDateStr(weekStart))
      .lte('date', localDateStr(weekEnd))
      .neq('status', 'canceled')
      .then(({ count }: { count: number | null }) => {
        if (!cancelled) setClinicCount(count ?? 0);
      });
    return () => { cancelled = true; };
  }, [coachId, clinicTick]);

  const totalSlots = weeklySlots.length;
  const activeDays = useMemo(
    () => new Set(weeklySlots.map(s => s.day_of_week)).size,
    [weeklySlots],
  );

  const todayStr = useMemo(() => localDateStr(new Date()), []);

  const handleClinicSaved = useCallback(() => {
    setCreateClinicOpen(false);
    setClinicTick(t => t + 1);
  }, []);

  return (
    <View style={styles.screen}>
      <Header variant="coach" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <View style={styles.topRow}>
          <View style={[styles.summaryCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <Metric value={totalSlots} label="WEEKLY SLOTS" theme={theme} />
            <View style={[styles.metricDivider, { backgroundColor: theme.border }]} />
            <Metric value={activeDays} label="ACTIVE DAYS" theme={theme} />
            <View style={[styles.metricDivider, { backgroundColor: theme.border }]} />
            <Metric value={clinicCount} label="CLINICS" theme={theme} />
          </View>
          <TouchableOpacity
            style={styles.clinicButton}
            onPress={() => setCreateClinicOpen(true)}
            activeOpacity={0.78}>
            <Plus size={20} color={Colors.cyan} />
            <Text style={styles.clinicLabel}>Clinic</Text>
          </TouchableOpacity>
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <CoachAvailabilityEditor slots={weeklySlots} onRefresh={refresh} />

      </ScrollView>

      <CreateClinicSheet
        visible={createClinicOpen}
        initial={{ date: todayStr }}
        onClose={() => setCreateClinicOpen(false)}
        onSaved={handleClinicSaved}
      />
    </View>
  );
}

function Metric({ value, label, theme }: { value: number; label: string; theme: ThemeTokens }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 3 }}>
      <Text style={{ fontFamily: FontFamily.spaceGroteskBold, fontSize: FontSize.statValue, color: theme.textPrimary }}>
        {value}
      </Text>
      <Text style={{ fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.eyebrow, color: theme.textMuted, letterSpacing: 0.18 }}>
        {label}
      </Text>
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
    topRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 10,
    },
    summaryCard: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 10,
      borderRadius: Radius.card,
      borderWidth: 1,
    },
    metricDivider: {
      width: 1,
      height: 32,
      marginHorizontal: 6,
    },
    clinicButton: {
      width: 72,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      borderRadius: Radius.button,
      borderWidth: 1,
      borderColor: 'rgba(45,224,255,0.32)',
      backgroundColor: 'rgba(45,224,255,0.08)',
    },
    clinicLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: 11,
      color: Colors.cyan,
    },
    error: {
      padding: 12,
      borderRadius: Radius.sm,
      backgroundColor: 'rgba(255,92,107,0.10)',
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: Colors.negative,
    },
  }), [theme]);
}
