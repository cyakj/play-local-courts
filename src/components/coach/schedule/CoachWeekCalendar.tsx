import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type LayoutRectangle,
} from 'react-native';
import { router } from 'expo-router';
import { MessageCircle, Pencil, RotateCcw, X } from 'lucide-react-native';
import { formatLabel } from '@/lib/formatLabel';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import type { WeekScheduleItem } from '@/hooks/useCoachWeekTimeline';
import { formatTime } from '@/types/coachSchedule';
import { LessonWeather } from '@/components/weather/LessonWeather';
import { RescheduleLessonSheet } from './LessonActionSheets';

const START_HOUR = 7;
const END_HOUR = 20;
const HOUR_HEIGHT = 62;
const DAY_WIDTH = 104;
const TIME_WIDTH = 62;

function dateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function minutes(value: string): number {
  const [hour, minute] = value.slice(0, 5).split(':').map(Number);
  return hour * 60 + minute;
}

function itemColor(item: WeekScheduleItem): { background: string; foreground: string; code: string } {
  if (item.kind === 'lesson') {
    return { background: Colors.positive, foreground: '#08140E', code: 'L' };
  }
  if (item.kind === 'unavailable') {
    return { background: '#333A4D', foreground: '#F5F8FF', code: 'U' };
  }
  if (item.kind === 'clinic') {
    return { background: Colors.cyan, foreground: '#0C0F18', code: 'C' };
  }
  if (item.slotType === 'facility') {
    return { background: Colors.blue, foreground: '#F5F8FF', code: 'F' };
  }
  if (item.slotType === 'travel') {
    return { background: Colors.volt, foreground: '#11140A', code: 'T' };
  }
  return { background: '#7A839A', foreground: '#F5F8FF', code: 'E' };
}

function itemTitle(item: WeekScheduleItem): string {
  if (item.kind === 'lesson') return item.request.playerName ?? 'Booked lesson';
  if (item.kind === 'unavailable') return 'Unavailable';
  if (item.kind === 'clinic') return item.name;
  if (item.slotType === 'facility') return item.facilityName ?? 'Facility';
  if (item.slotType === 'travel') return `${item.travelRadiusMiles ?? 0} mi travel`;
  return 'Either';
}

export function CoachWeekCalendar({
  days,
  itemsByDate,
  onCancelLesson,
  onMakeUnavailable,
}: {
  days: Date[];
  itemsByDate: Map<string, WeekScheduleItem[]>;
  onCancelLesson: (item: Extract<WeekScheduleItem, { kind: 'lesson' }>) => Promise<void>;
  onMakeUnavailable: (item: Extract<WeekScheduleItem, { kind: 'open' }>) => Promise<void>;
}) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const window = useWindowDimensions();
  const [selection, setSelection] = useState<{
    item: WeekScheduleItem;
    anchor: LayoutRectangle;
  } | null>(null);
  const [rescheduleRequest, setRescheduleRequest] =
    useState<Extract<WeekScheduleItem, { kind: 'lesson' }>['request'] | null>(null);
  const itemRefs = useRef(new Map<string, View>());

  function openPopover(item: WeekScheduleItem) {
    const node = itemRefs.current.get(item.id);
    node?.measureInWindow((x, y, width, height) => {
      setSelection({ item, anchor: { x, y, width, height } });
    });
  }

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.calendar}>
          <View style={styles.headerRow}>
            <View style={styles.timeHeader} />
            {days.map(date => (
              <View key={dateKey(date)} style={styles.dayHeader}>
                <Text style={styles.dayName}>
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </Text>
                <Text style={styles.dayNumber}>{date.getDate()}</Text>
              </View>
            ))}
          </View>

          <ScrollView
            style={[styles.verticalScroll, { maxHeight: Math.max(220, window.height - 150) }]}
            showsVerticalScrollIndicator>
            <View style={styles.gridRow}>
              <View style={styles.timeColumn}>
                {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => (
                  <View key={index} style={styles.timeCell}>
                    <Text style={styles.timeLabel}>
                      {formatTime(`${String(START_HOUR + index).padStart(2, '0')}:00`)}
                    </Text>
                  </View>
                ))}
              </View>

              {days.map(date => {
                const key = dateKey(date);
                const items = itemsByDate.get(key) ?? [];
                return (
                  <View key={key} style={styles.dayColumn}>
                    {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => (
                      <View key={index} style={styles.gridCell} />
                    ))}
                    {items.map(item => {
                      const start = Math.max(minutes(item.start), START_HOUR * 60);
                      const end = Math.min(minutes(item.end), (END_HOUR + 1) * 60);
                      if (end <= start) return null;
                      const top = ((start - START_HOUR * 60) / 60) * HOUR_HEIGHT + 2;
                      const height = Math.max(((end - start) / 60) * HOUR_HEIGHT - 4, 34);
                      const colors = itemColor(item);
                      return (
                        <TouchableOpacity
                          key={item.id}
                          ref={node => {
                            if (node) itemRefs.current.set(item.id, node as unknown as View);
                          }}
                          style={[
                            styles.scheduleBlock,
                            {
                              top,
                              height,
                              backgroundColor: colors.background,
                              opacity: (item.kind === 'open' && !item.publiclyBookable) || (item.kind === 'clinic' && item.status === 'draft') ? 0.58 : 1,
                            },
                          ]}
                          onPress={() => openPopover(item)}
                          activeOpacity={0.82}>
                          <Text style={[styles.blockCode, { color: colors.foreground }]}>
                            {colors.code}
                          </Text>
                          <Text
                            style={[styles.blockTitle, { color: colors.foreground }]}
                            numberOfLines={2}>
                            {itemTitle(item)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </ScrollView>

      <SlotPopover
        selection={selection}
        onClose={() => setSelection(null)}
        onCancelLesson={onCancelLesson}
        onMakeUnavailable={onMakeUnavailable}
        onReschedule={request => setRescheduleRequest(request)}
      />
      <RescheduleLessonSheet
        request={rescheduleRequest}
        onClose={() => setRescheduleRequest(null)}
      />
    </>
  );
}

function SlotPopover({
  selection,
  onClose,
  onCancelLesson,
  onMakeUnavailable,
  onReschedule,
}: {
  selection: { item: WeekScheduleItem; anchor: LayoutRectangle } | null;
  onClose: () => void;
  onCancelLesson: (item: Extract<WeekScheduleItem, { kind: 'lesson' }>) => Promise<void>;
  onMakeUnavailable: (item: Extract<WeekScheduleItem, { kind: 'open' }>) => Promise<void>;
  onReschedule: (request: Extract<WeekScheduleItem, { kind: 'lesson' }>['request']) => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const window = useWindowDimensions();
  if (!selection) return null;
  const { item, anchor } = selection;
  const width = Math.min(340, window.width - 24);
  const left = Math.max(12, Math.min(anchor.x + anchor.width / 2 - width / 2, window.width - width - 12));
  const maxPopoverHeight = window.height - 80;
  const showBelow = anchor.y + anchor.height + 12 + Math.min(maxPopoverHeight, 320) < window.height - 12;
  const top = showBelow
    ? anchor.y + anchor.height + 12
    : Math.max(12, anchor.y - Math.min(maxPopoverHeight, 320) - 12);

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.popoverBackdrop} onPress={onClose} activeOpacity={1}>
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.popover, { width, left, top, maxHeight: maxPopoverHeight }]}>
          <View style={styles.popoverHeader}>
            <View style={[styles.popoverCode, { backgroundColor: itemColor(item).background }]}>
              <Text style={[styles.popoverCodeText, { color: itemColor(item).foreground }]}>
                {itemColor(item).code}
              </Text>
            </View>
            <View style={styles.popoverHeading}>
              <Text style={styles.popoverTitle}>{itemTitle(item)}</Text>
              <Text style={styles.popoverTime}>
                {formatTime(item.start)} - {formatTime(item.end)}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {item.kind === 'lesson' && (
            <>
              <Text style={styles.detail}>
                {formatLabel(item.request.lessonType)}
                {item.request.durationMinutes ? ` · ${item.request.durationMinutes} minutes` : ''}
              </Text>
              <Text style={styles.detail}>
                {item.request.facilityName ?? item.request.locationPreference ?? 'Location not set'}
              </Text>
              <LessonWeather
                date={item.date}
                time={item.start}
                location={item.request.facilityName ?? item.request.locationNote}
              />
              <PopoverAction
                label="Reschedule Lesson"
                primary
                icon={<RotateCcw size={18} color="#F5F8FF" />}
                onPress={() => {
                  onClose();
                  setTimeout(() => onReschedule(item.request), 0);
                }}
              />
              <PopoverAction
                label="Message Student"
                icon={<MessageCircle size={18} color={theme.textSecondary} />}
                onPress={() => {
                  onClose();
                  setTimeout(() => router.push({
                    pathname: '/messages',
                    params: { partner: item.request.playerId },
                  } as any), 0);
                }}
              />
              <PopoverAction
                label="View Full Details"
                onPress={() => {
                  onClose();
                  router.push({
                    pathname: '/(coach)/schedule',
                    params: { date: item.date },
                  } as any);
                }}
              />
              <PopoverAction
                label="Cancel Lesson"
                destructive
                onPress={() => Alert.alert(
                  'Cancel lesson?',
                  'The student will be notified. The slot will not be promoted or automatically refilled.',
                  [
                    { text: 'Keep Lesson', style: 'cancel' },
                    {
                      text: 'Cancel Lesson',
                      style: 'destructive',
                      onPress: async () => {
                        await onCancelLesson(item);
                        onClose();
                      },
                    },
                  ],
                )}
              />
            </>
          )}

          {item.kind === 'open' && (
            <>
              <Text style={styles.detail}>
                {item.slotType === 'facility'
                  ? `Facility: ${item.facilityName ?? 'Not specified'}`
                  : item.slotType === 'travel'
                    ? `Travel: ${item.travelRadiusMiles ?? 0} mile radius`
                    : 'Facility or travel'}
              </Text>
              {!!item.areasServed.length && (
                <Text style={styles.detail}>Areas: {item.areasServed.join(', ')}</Text>
              )}
              <Text style={styles.detail}>
                {item.publiclyBookable ? 'Public and bookable' : 'Private / internal'}
              </Text>
              <PopoverAction
                label="Edit Slot"
                primary
                icon={<Pencil size={18} color="#F5F8FF" />}
                onPress={() => router.push({
                  pathname: '/(coach)/schedule-settings',
                  params: {
                    day: String(new Date(`${item.date}T12:00:00`).getDay()),
                    blockId: item.sourceId,
                  },
                } as any)}
              />
              <PopoverAction
                label="Make Unavailable"
                onPress={async () => {
                  await onMakeUnavailable(item);
                  onClose();
                }}
              />
              <PopoverAction
                label="View Rule"
                onPress={() => router.push({
                  pathname: '/(coach)/schedule-settings',
                  params: {
                    day: String(new Date(`${item.date}T12:00:00`).getDay()),
                    blockId: item.sourceId,
                  },
                } as any)}
              />
            </>
          )}

          {item.kind === 'unavailable' && (
            <>
              <Text style={styles.detail}>Players only see this time as unavailable.</Text>
              <PopoverAction
                label="Edit Unavailable Time"
                primary
                icon={<Pencil size={18} color="#F5F8FF" />}
                onPress={() => {
                  if (item.sourceKind === 'legacy') {
                    Alert.alert('Legacy unavailable time', 'This date range is managed by the existing booking system.');
                    return;
                  }
                  router.push({
                    pathname: '/(coach)/schedule-settings',
                    params: {
                      day: String(new Date(`${item.date}T12:00:00`).getDay()),
                      blockoutId: item.id.replace('blockout-', ''),
                    },
                  } as any);
                }}
              />
            </>
          )}

          {item.kind === 'clinic' && (
            <>
              <Text style={styles.detail}>
                {item.enrolledCount}/{item.maxPlayers} enrolled · {item.location}
              </Text>
              {item.status === 'draft' && (
                <Text style={[styles.detail, { color: Colors.volt }]}>Draft — not visible to players</Text>
              )}
              <PopoverAction
                label="View Clinics"
                primary
                onPress={() => {
                  onClose();
                  router.push('/(coach)/clinics' as any);
                }}
              />
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function PopoverAction({
  label,
  icon,
  primary,
  destructive,
  onPress,
}: {
  label: string;
  icon?: React.ReactNode;
  primary?: boolean;
  destructive?: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  return (
    <TouchableOpacity
      style={[
        styles.popoverAction,
        primary && styles.popoverActionPrimary,
        destructive && styles.popoverActionDestructive,
      ]}
      onPress={onPress}
      activeOpacity={0.78}>
      {icon}
      <Text style={[
        styles.popoverActionText,
        primary && styles.popoverActionTextPrimary,
        destructive && styles.popoverActionTextDestructive,
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    calendar: { minWidth: TIME_WIDTH + DAY_WIDTH * 7 },
    headerRow: { height: 58, flexDirection: 'row', backgroundColor: theme.bgElevated },
    timeHeader: { width: TIME_WIDTH, borderRightWidth: 1, borderRightColor: theme.border },
    dayHeader: {
      width: DAY_WIDTH,
      alignItems: 'center',
      justifyContent: 'center',
      borderRightWidth: 1,
      borderRightColor: theme.border,
    },
    dayName: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 11,
      color: theme.textMuted,
      textTransform: 'uppercase',
    },
    dayNumber: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: 18,
      color: theme.textPrimary,
    },
    verticalScroll: { maxHeight: 620 },
    gridRow: { flexDirection: 'row' },
    timeColumn: { width: TIME_WIDTH },
    timeCell: {
      height: HOUR_HEIGHT,
      paddingTop: 6,
      paddingRight: 8,
      alignItems: 'flex-end',
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
    },
    timeLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 10,
      color: theme.textMuted,
    },
    dayColumn: { width: DAY_WIDTH, position: 'relative' },
    gridCell: {
      height: HOUR_HEIGHT,
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBg,
    },
    scheduleBlock: {
      position: 'absolute',
      left: 4,
      right: 4,
      zIndex: 2,
      padding: 6,
      borderRadius: Radius.xs,
      overflow: 'hidden',
    },
    blockCode: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 10,
    },
    blockTitle: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: 11,
      lineHeight: 14,
    },
    popoverBackdrop: { flex: 1, backgroundColor: 'rgba(8,10,17,0.28)' },
    popover: {
      position: 'absolute',
      gap: 10,
      padding: 16,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.borderStrong,
      backgroundColor: theme.sheetBg,
      ...theme.shadowSheet,
    },
    popoverHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    popoverCode: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.xs,
    },
    popoverCodeText: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 12,
    },
    popoverHeading: { flex: 1, gap: 2 },
    popoverTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
    },
    popoverTime: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 11,
      color: Colors.cyan,
    },
    closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    detail: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      lineHeight: 20,
      color: theme.textSecondary,
    },
    popoverAction: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: Radius.button,
      borderWidth: 1,
      borderColor: theme.borderStrong,
    },
    popoverActionPrimary: { backgroundColor: Colors.blue, borderColor: Colors.blue },
    popoverActionDestructive: { borderColor: Colors.negative },
    popoverActionText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    popoverActionTextPrimary: { color: '#F5F8FF' },
    popoverActionTextDestructive: { color: Colors.negative },
  }), [theme]);
}
