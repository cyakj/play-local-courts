import { useMemo } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { X, RotateCcw } from 'lucide-react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import type { ScheduledLesson } from '@/hooks/useCoachSchedule';
import type { CoachAvailabilitySlot } from '@/hooks/useCoachAvailability';

const DAY_LABELS  = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const LESSON_TYPE_SHORT: Record<string, string> = {
  private_lesson:      'Private',
  semi_private_lesson: 'Semi',
  group_clinic:        'Group',
  practice_session:    'Practice',
  private:             'Private',
  'semi-private':      'Semi',
  group:               'Group',
};

const STATUS_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  approved:  { bg: 'rgba(45,107,255,0.20)',  border: 'rgba(45,107,255,0.50)',  label: 'UPCOMING' },
  confirmed: { bg: 'rgba(45,224,255,0.18)',  border: 'rgba(45,224,255,0.45)',  label: 'CONFIRMED' },
  completed: { bg: 'rgba(47,217,139,0.15)',  border: 'rgba(47,217,139,0.35)',  label: 'DONE' },
  no_show:   { bg: 'rgba(255,92,107,0.15)',  border: 'rgba(255,92,107,0.40)',  label: 'NO SHOW' },
};

const AVAIL_COLORS = {
  bg: 'rgba(214,255,61,0.08)',
  border: 'rgba(214,255,61,0.25)',
};

function fmtTime(t: string | null | undefined): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return `${h12}${m ? `:${String(m).padStart(2, '0')}` : ''}${ampm}`;
}

function normalizeTime(t: string): string {
  return t.slice(0, 5);
}

interface Props {
  visible: boolean;
  onClose: () => void;
  weekStart: Date;
  lessonsByDate: Record<string, ScheduledLesson[]>;
  availabilitySlots: CoachAvailabilitySlot[];
}

export function CoachWeeklyScheduleModal({
  visible,
  onClose,
  weekStart,
  lessonsByDate,
  availabilitySlots,
}: Props) {
  const { theme } = useTheme();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const styles = useStyles(theme, isLandscape);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [weekStart],
  );

  const weekLabel = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${weekStart.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
  }, [weekStart]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
      testID="weekly-schedule-modal"
    >
      <View style={[styles.container, { backgroundColor: theme.pageBg }]}>
        {/* Header — always visible */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Weekly Schedule</Text>
          <Text style={[styles.weekLabel, { color: theme.textSecondary }]}>{weekLabel}</Text>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeBtn, { borderColor: theme.border }]}
            activeOpacity={0.7}
            accessibilityLabel="Close weekly schedule"
            testID="weekly-schedule-close-btn"
          >
            <X size={16} color={theme.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Portrait hint */}
        {!isLandscape && (
          <View style={styles.rotateHint}>
            <RotateCcw size={28} color={Colors.cyan} strokeWidth={1.8} />
            <Text style={styles.rotateTitle}>Rotate for best view</Text>
            <Text style={styles.rotateBody}>
              Turn your phone to landscape for the full weekly schedule grid.
            </Text>
            <Text style={styles.rotateSubtitle}>Portrait preview below</Text>
          </View>
        )}

        {/* Grid — horizontal scroll for all 7 days */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.gridOuter}
          testID="weekly-schedule-grid"
        >
          {days.map((day, i) => {
            const dateStr = day.toISOString().slice(0, 10);
            const lessons = (lessonsByDate[dateStr] ?? [])
              .slice()
              .sort((a, b) => (a.timeStart ?? '').localeCompare(b.timeStart ?? ''));
            const dayOfWeek = day.getDay();
            const avSlots = availabilitySlots
              .filter(s => s.day_of_week === dayOfWeek)
              .slice()
              .sort((a, b) => normalizeTime(a.start_time).localeCompare(normalizeTime(b.start_time)));

            const isToday = dateStr === new Date().toISOString().slice(0, 10);

            return (
              <View key={dateStr} style={[styles.dayCol, { borderRightColor: theme.border }, i === 6 && styles.dayColLast]}>
                {/* Day header */}
                <View style={[styles.dayHeader, isToday && styles.dayHeaderToday]}>
                  <Text style={[styles.dayHeaderLabel, isToday && styles.dayHeaderLabelToday]}>
                    {DAY_LABELS[dayOfWeek]}
                  </Text>
                  <Text style={[styles.dayHeaderNum, isToday && styles.dayHeaderNumToday]}>
                    {day.getDate()}
                  </Text>
                </View>

                {/* Availability blocks */}
                <View style={styles.dayBody}>
                  {avSlots.map(s => (
                    <View
                      key={s.id}
                      style={[styles.block, { backgroundColor: AVAIL_COLORS.bg, borderColor: AVAIL_COLORS.border }]}
                    >
                      <Text style={[styles.blockTime, { color: Colors.volt }]}>
                        {fmtTime(normalizeTime(s.start_time))} – {fmtTime(normalizeTime(s.end_time))}
                      </Text>
                      <Text style={[styles.blockLabel, { color: Colors.volt }]}>AVAILABLE</Text>
                    </View>
                  ))}

                  {/* Lesson blocks */}
                  {lessons.map(l => {
                    const colors = STATUS_COLORS[l.status] ?? STATUS_COLORS.approved;
                    return (
                      <View
                        key={l.id}
                        style={[styles.block, { backgroundColor: colors.bg, borderColor: colors.border }]}
                        testID={`lesson-block-${l.id}`}
                      >
                        <Text style={[styles.blockTime, { color: theme.textPrimary }]}>
                          {fmtTime(l.timeStart)}{l.timeEnd ? ` – ${fmtTime(l.timeEnd)}` : ''}
                        </Text>
                        <Text style={[styles.blockPlayer, { color: theme.textSecondary }]} numberOfLines={1}>
                          {l.playerName ?? 'Player'}
                        </Text>
                        <Text style={[styles.blockType, { color: theme.textMuted }]}>
                          {LESSON_TYPE_SHORT[l.lessonType] ?? l.lessonType} · {colors.label}
                        </Text>
                      </View>
                    );
                  })}

                  {avSlots.length === 0 && lessons.length === 0 && (
                    <Text style={[styles.emptyDay, { color: theme.textMuted }]}>—</Text>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Legend */}
        <View style={[styles.legend, { borderTopColor: theme.border }]}>
          {Object.entries(STATUS_COLORS).map(([, v]) => (
            <View key={v.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: v.border }]} />
              <Text style={[styles.legendText, { color: theme.textMuted }]}>{v.label}</Text>
            </View>
          ))}
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: AVAIL_COLORS.border }]} />
            <Text style={[styles.legendText, { color: theme.textMuted }]}>AVAILABLE</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const Colors2 = { volt: '#D6FF3D' } as const;

function useStyles(theme: ThemeTokens, isLandscape: boolean) {
  return useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1 },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: Spacing.pagePx,
          paddingTop: 52,
          paddingBottom: 14,
          borderBottomWidth: 1,
          gap: 10,
        },
        headerTitle: {
          fontFamily: FontFamily.spaceGroteskBold,
          fontSize: FontSize.cardTitle,
          letterSpacing: -0.2,
          flex: 1,
        },
        weekLabel: {
          fontFamily: FontFamily.manropeMedium,
          fontSize: FontSize.label,
        },
        closeBtn: {
          width: 32,
          height: 32,
          borderRadius: Radius.sm,
          borderWidth: 1,
          alignItems: 'center',
          justifyContent: 'center',
        },
        rotateHint: {
          alignItems: 'center',
          paddingVertical: 20,
          paddingHorizontal: Spacing.pagePx,
          gap: 8,
        },
        rotateTitle: {
          fontFamily: FontFamily.spaceGroteskBold,
          fontSize: FontSize.cardTitle,
          color: Colors.cyan,
          letterSpacing: -0.2,
        },
        rotateBody: {
          fontFamily: FontFamily.manropeMedium,
          fontSize: FontSize.body,
          color: '#9AA3B8',
          textAlign: 'center',
          lineHeight: 22,
        },
        rotateSubtitle: {
          fontFamily: FontFamily.jetbrainsMonoSemiBold,
          fontSize: FontSize.eyebrow,
          color: '#7A839A',
          letterSpacing: 0.18,
          textTransform: 'uppercase' as const,
        },
        gridOuter: {
          flexDirection: 'row',
          paddingBottom: 12,
        },
        dayCol: {
          width: isLandscape ? 140 : 120,
          borderRightWidth: 1,
        },
        dayColLast: { borderRightWidth: 0 },
        dayHeader: {
          alignItems: 'center',
          paddingVertical: 10,
          backgroundColor: 'rgba(22,26,38,0.8)',
        },
        dayHeaderToday: {
          backgroundColor: 'rgba(45,107,255,0.12)',
        },
        dayHeaderLabel: {
          fontFamily: FontFamily.jetbrainsMonoSemiBold,
          fontSize: 9,
          color: '#7A839A',
          letterSpacing: 0.3,
        },
        dayHeaderLabelToday: { color: Colors.blue },
        dayHeaderNum: {
          fontFamily: FontFamily.spaceGroteskBold,
          fontSize: 17,
          color: '#9AA3B8',
          marginTop: 2,
        },
        dayHeaderNumToday: { color: Colors.blue },
        dayBody: {
          paddingHorizontal: 6,
          paddingTop: 8,
          gap: 6,
        },
        block: {
          borderRadius: Radius.chip,
          borderWidth: 1,
          paddingHorizontal: 8,
          paddingVertical: 7,
          gap: 2,
        },
        blockTime: {
          fontFamily: FontFamily.jetbrainsMonoSemiBold,
          fontSize: 9,
          letterSpacing: 0.1,
        },
        blockPlayer: {
          fontFamily: FontFamily.manropeSemiBold,
          fontSize: 11,
        },
        blockLabel: {
          fontFamily: FontFamily.jetbrainsMonoSemiBold,
          fontSize: 8,
          letterSpacing: 0.2,
        },
        blockType: {
          fontFamily: FontFamily.jetbrainsMonoSemiBold,
          fontSize: 8,
          letterSpacing: 0.1,
        },
        emptyDay: {
          fontFamily: FontFamily.manropeMedium,
          fontSize: FontSize.label,
          textAlign: 'center',
          paddingTop: 12,
        },
        legend: {
          flexDirection: 'row',
          flexWrap: 'wrap' as const,
          gap: 10,
          paddingHorizontal: Spacing.pagePx,
          paddingVertical: 12,
          borderTopWidth: 1,
        },
        legendItem: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
        },
        legendDot: {
          width: 8,
          height: 8,
          borderRadius: 4,
        },
        legendText: {
          fontFamily: FontFamily.jetbrainsMonoSemiBold,
          fontSize: 9,
          letterSpacing: 0.2,
        },
      }),
    [theme, isLandscape],
  );
}
