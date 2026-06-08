import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import type { ScheduledLesson } from '@/hooks/useCoachSchedule';

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const LESSON_TYPE_SHORT: Record<string, string> = {
  private_lesson:      'Private',
  semi_private_lesson: 'Semi',
  group_clinic:        'Group',
  practice_session:    'Practice',
  private:             'Private',
  'semi-private':      'Semi',
  group:               'Group',
};

const STATUS_TINT: Record<string, string> = {
  approved:  'rgba(45,107,255,0.20)',
  confirmed: 'rgba(45,224,255,0.15)',
  completed: 'rgba(122,131,154,0.15)',
  no_show:   'rgba(255,92,107,0.15)',
};
const STATUS_BORDER: Record<string, string> = {
  approved:  'rgba(45,107,255,0.40)',
  confirmed: 'rgba(45,224,255,0.40)',
  completed: 'rgba(122,131,154,0.30)',
  no_show:   'rgba(255,92,107,0.40)',
};

function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return `${h12}${m ? `:${String(m).padStart(2, '0')}` : ''}${ampm}`;
}

interface Props {
  weekStart: Date;
  lessonsByDate: Record<string, ScheduledLesson[]>;
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
}

export function CoachWeekView({ weekStart, lessonsByDate, selectedDate, onSelectDate }: Props) {
  const { theme } = useTheme();
  const styles = useStyles(theme);

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const selectedStr = selectedDate.toISOString().slice(0, 10);
  const selectedLessons = lessonsByDate[selectedStr] ?? [];

  return (
    <View style={styles.container}>
      {/* Day selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
        {days.map(d => {
          const dateStr = d.toISOString().slice(0, 10);
          const isSelected = dateStr === selectedStr;
          const hasLessons = (lessonsByDate[dateStr] ?? []).length > 0;
          const isToday = dateStr === new Date().toISOString().slice(0, 10);
          return (
            <TouchableOpacity
              key={dateStr}
              style={[styles.dayCell, isSelected && styles.dayCellActive]}
              onPress={() => onSelectDate(d)}
              activeOpacity={0.7}>
              <Text style={[styles.dayLabel, isSelected && styles.dayLabelActive, isToday && !isSelected && styles.dayLabelToday]}>
                {DAY_LABELS[d.getDay()]}
              </Text>
              <Text style={[styles.dayNum, isSelected && styles.dayNumActive]}>
                {d.getDate()}
              </Text>
              {hasLessons && <View style={[styles.dot, isSelected && styles.dotActive]} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Lessons for selected day */}
      {selectedLessons.length === 0 ? (
        <View style={styles.emptyDay}>
          <Text style={styles.emptyText}>No lessons scheduled</Text>
        </View>
      ) : (
        <View style={styles.lessonList}>
          {selectedLessons.map(l => (
            <View
              key={l.id}
              style={[styles.lessonBlock, { backgroundColor: STATUS_TINT[l.status] ?? STATUS_TINT.approved, borderColor: STATUS_BORDER[l.status] ?? STATUS_BORDER.approved }]}>
              <View style={styles.lessonBlockInner}>
                <Text style={styles.lessonTime}>
                  {fmtTime(l.timeStart)}{l.timeEnd ? ` – ${fmtTime(l.timeEnd)}` : ''}
                </Text>
                <Text style={styles.lessonPlayer} numberOfLines={1}>{l.playerName ?? 'Player'}</Text>
              </View>
              <Text style={styles.lessonType}>{LESSON_TYPE_SHORT[l.lessonType] ?? l.lessonType}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    container: { gap: 12 },
    dayRow: {
      gap: 6,
      paddingHorizontal: 2,
    },
    dayCell: {
      width: 44,
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: Radius.sm,
      gap: 4,
    },
    dayCellActive: {
      backgroundColor: Colors.blue,
    },
    dayLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 9,
      color: theme.textMuted,
      letterSpacing: 0.1,
    },
    dayLabelActive: {
      color: '#FFFFFF',
    },
    dayLabelToday: {
      color: Colors.cyan,
    },
    dayNum: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: 16,
      color: theme.textSecondary,
    },
    dayNumActive: {
      color: '#FFFFFF',
    },
    dot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: Colors.cyan,
    },
    dotActive: {
      backgroundColor: 'rgba(255,255,255,0.8)',
    },
    emptyDay: {
      paddingVertical: 20,
      alignItems: 'center',
    },
    emptyText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
    },
    lessonList: { gap: 8 },
    lessonBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: Radius.sm,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    lessonBlockInner: { flex: 1, gap: 2 },
    lessonTime: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textPrimary,
    },
    lessonPlayer: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    lessonType: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 9,
      color: theme.textMuted,
      letterSpacing: 0.1,
    },
  }), [theme]);
}
