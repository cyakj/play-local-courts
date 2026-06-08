import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import type { CoachStudent } from '@/hooks/useCoachStudents';

interface Props {
  student: CoachStudent;
  onPress: () => void;
}

export function CoachStudentRow({ student, onPress }: Props) {
  const { theme } = useTheme();
  const styles = useStyles(theme);

  const initials = (student.playerName ?? 'P')
    .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const lastDate = useMemo(() => {
    if (!student.lastLessonDate) return null;
    return new Date(student.lastLessonDate + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric',
    });
  }, [student.lastLessonDate]);

  const attendancePct = student.lessonCount > 0
    ? Math.round((student.completedCount / student.lessonCount) * 100)
    : null;

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.avatar}>
        <Text style={styles.avatarInitials}>{initials}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{student.playerName ?? 'Player'}</Text>
        <Text style={styles.meta}>
          {student.lessonCount} lesson{student.lessonCount !== 1 ? 's' : ''}
          {lastDate ? ` · Last ${lastDate}` : ''}
        </Text>
      </View>
      {attendancePct !== null && (
        <View style={[styles.attendanceDot, { backgroundColor: attendancePct >= 80 ? Colors.positive : Colors.negative }]} />
      )}
      <ChevronRight size={16} color={theme.textMuted} strokeWidth={1.8} />
    </TouchableOpacity>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.cardPadding,
    },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: 'rgba(45,107,255,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    avatarInitials: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: 15,
      color: Colors.blue,
    },
    info: { flex: 1, gap: 3 },
    name: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
      letterSpacing: -0.2,
    },
    meta: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    attendanceDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
  }), [theme]);
}
