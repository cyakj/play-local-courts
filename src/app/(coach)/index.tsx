import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Header } from '@/components/ui/Header';
import { useTheme } from '@/context/ThemeContext';
import { useCoachDashboard } from '@/hooks/useCoachDashboard';
import { CoachTodayCard } from '@/components/coach/CoachTodayCard';
import { CoachDashboardKPI } from '@/components/coach/CoachDashboardKPI';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/design';
import type { ThemeTokens } from '@/constants/theme-tokens';

function fmtCurrency(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

function fmtRating(n: number | null): string {
  if (n === null) return '—';
  return n.toFixed(1);
}

function fmtHours(h: number | null): string {
  if (h === null) return '—';
  if (h < 1) return '< 1h';
  return `${h}h`;
}

export default function CoachDashboardScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const { data, loading } = useCoachDashboard();

  return (
    <View style={[styles.screen, { backgroundColor: theme.pageBg }]}>
      <Header variant="coach" />
      <ScrollView contentContainerStyle={styles.content}>
        {loading || !data ? (
          <View style={styles.skeletonWrap}>
            {[1, 2, 3, 4].map(i => (
              <View key={i} style={[styles.skeletonCard, { height: i === 1 ? 120 : 80 }]} />
            ))}
          </View>
        ) : (
          <>
            {/* Today section */}
            <CoachTodayCard
              nextLesson={data.nextLesson}
              upcomingTodayCount={data.upcomingTodayCount}
              pendingCount={data.pendingCount}
            />

            {/* Primary KPI grid */}
            <Text style={styles.sectionLabel}>THIS MONTH</Text>
            <View style={styles.kpiRow}>
              <CoachDashboardKPI
                label="Revenue"
                value={fmtCurrency(data.estimatedRevenueThisMonth)}
                sub="estimated"
                tint="green"
              />
              <CoachDashboardKPI
                label="Lessons"
                value={String(data.lessonsThisMonth)}
              />
            </View>
            <View style={styles.kpiRow}>
              <CoachDashboardKPI
                label="Students"
                value={String(data.activeStudents)}
                sub="last 30 days"
              />
              <CoachDashboardKPI
                label="Avg Rating"
                value={fmtRating(data.avgRating)}
                tint={data.avgRating && data.avgRating >= 4.5 ? 'green' : 'default'}
              />
            </View>

            {/* Requests + Response */}
            <Text style={styles.sectionLabel}>REQUESTS</Text>
            <View style={styles.kpiRow}>
              <CoachDashboardKPI
                label="Pending"
                value={String(data.pendingCount)}
                tint={data.pendingCount > 0 ? 'amber' : 'default'}
              />
              <CoachDashboardKPI
                label="Avg Response"
                value={fmtHours(data.avgResponseHours)}
                sub="last 30 days"
                tint={data.avgResponseHours !== null && data.avgResponseHours <= 4 ? 'green' : 'default'}
              />
            </View>

            {/* Attendance */}
            <Text style={styles.sectionLabel}>ATTENDANCE</Text>
            <View style={styles.kpiRow}>
              <CoachDashboardKPI
                label="Completed"
                value={String(data.completedCount)}
                tint="green"
              />
              <CoachDashboardKPI
                label="Attendance %"
                value={data.attendanceRate !== null ? `${data.attendanceRate}%` : '—'}
                tint={data.attendanceRate !== null && data.attendanceRate >= 90 ? 'green' : 'default'}
              />
            </View>
            <View style={styles.kpiRow}>
              <CoachDashboardKPI
                label="No-Shows"
                value={String(data.noShowCount)}
                tint={data.noShowCount > 0 ? 'red' : 'default'}
              />
              <View style={{ flex: 1 }} />
            </View>
          </>
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
      gap: Spacing.s3,
    },
    sectionLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      color: theme.textMuted,
      letterSpacing: 0.18,
      marginTop: Spacing.s3,
    },
    kpiRow: {
      flexDirection: 'row',
      gap: Spacing.s3,
    },
    skeletonWrap: { gap: Spacing.s3 },
    skeletonCard: {
      backgroundColor: theme.cardBg,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
  }), [theme]);
}
