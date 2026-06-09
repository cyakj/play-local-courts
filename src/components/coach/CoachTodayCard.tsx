import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { CalendarDays, Clock, AlertCircle } from 'lucide-react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

interface NextLesson {
  playerName: string | null;
  lessonType: string;
  timeStart: string;
  timeEnd: string;
}

interface Props {
  nextLesson: NextLesson | null;
  upcomingTodayCount: number;
  pendingCount: number;
}

const LESSON_TYPE_LABELS: Record<string, string> = {
  private_lesson:      'Private Lesson',
  semi_private_lesson: 'Semi-Private',
  group_lesson:        'Group Lesson',
  hitting_partner:     'Hitting Partner',
  group_clinic:        'Group Lesson',    // legacy
  practice_session:    'Hitting Partner', // legacy
  private:             'Private Lesson',
  'semi-private':      'Semi-Private',
  group:               'Group Lesson',
};

function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return `${h12}${m ? `:${String(m).padStart(2, '0')}` : ''}${ampm}`;
}

export function CoachTodayCard({ nextLesson, upcomingTodayCount, pendingCount }: Props) {
  const { theme } = useTheme();
  const styles = useStyles(theme);

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>TODAY</Text>

      {nextLesson ? (
        <View style={styles.nextLessonRow}>
          <Clock size={15} color={Colors.cyan} strokeWidth={1.8} />
          <View style={{ flex: 1 }}>
            <Text style={styles.nextLessonPlayer} numberOfLines={1}>
              {nextLesson.playerName ?? 'Player'}
            </Text>
            <Text style={styles.nextLessonMeta}>
              {LESSON_TYPE_LABELS[nextLesson.lessonType] ?? nextLesson.lessonType}
              {nextLesson.timeStart ? ` · ${fmtTime(nextLesson.timeStart)}` : ''}
              {nextLesson.timeEnd   ? ` – ${fmtTime(nextLesson.timeEnd)}` : ''}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.nextLessonRow}>
          <CalendarDays size={15} color={theme.textMuted} strokeWidth={1.8} />
          <Text style={styles.noLessonsText}>No lessons today</Text>
        </View>
      )}

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{upcomingTodayCount}</Text>
          <Text style={styles.statLabel}>TODAY</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, pendingCount > 0 && styles.statValueAmber]}>
            {pendingCount}
          </Text>
          <Text style={styles.statLabel}>PENDING</Text>
        </View>
        {pendingCount > 0 && (
          <TouchableOpacity
            style={styles.viewRequestsBtn}
            onPress={() => router.push('/(coach)/requests' as any)}
            activeOpacity={0.8}>
            <AlertCircle size={12} color='#FFFFFF' strokeWidth={2} />
            <Text style={styles.viewRequestsText}>View Requests</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.cardPadding,
      gap: 14,
    },
    eyebrow: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      color: Colors.cyan,
      letterSpacing: 0.18,
    },
    nextLessonRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    nextLessonPlayer: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
      letterSpacing: -0.2,
    },
    nextLessonMeta: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textSecondary,
      marginTop: 2,
    },
    noLessonsText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingTop: 14,
    },
    statItem: {
      alignItems: 'center',
      gap: 2,
    },
    statValue: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: 22,
      color: theme.textPrimary,
      letterSpacing: -0.4,
    },
    statValueAmber: {
      color: Colors.blue,
    },
    statLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 9,
      color: theme.textMuted,
      letterSpacing: 0.2,
    },
    divider: {
      width: 1,
      height: 28,
      backgroundColor: theme.border,
    },
    viewRequestsBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginLeft: 'auto',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: Radius.sm,
      backgroundColor: Colors.blue,
    },
    viewRequestsText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: '#FFFFFF',
    },
  }), [theme]);
}
