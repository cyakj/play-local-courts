import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily, FontSize, Radius } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { supabase } from '@/lib/supabase';
import type { LegacyScheduleDraft } from '@/types/coachSchedule';
import { DAY_NAMES, formatTime } from '@/types/coachSchedule';
import { SectionCard } from './SectionCard';

interface LessonPreview {
  id: string;
  day: number;
  start: string;
  status: string;
}

interface PreviewItem {
  id: string;
  code: 'F' | 'T' | 'E' | 'B' | 'L' | 'P';
  label: string;
  start: string;
  public: boolean;
}

const previewItemStyles = {
  F: 'itemF',
  T: 'itemT',
  E: 'itemE',
  B: 'itemB',
  L: 'itemL',
  P: 'itemP',
} as const;

function overlaps(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA < endB && startB < endA;
}

export function SchedulePreview({ coachId, draft }: { coachId: string; draft: LegacyScheduleDraft }) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const [lessons, setLessons] = useState<LessonPreview[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('lesson_requests')
        .select('id, status, confirmed_date, preferred_date, confirmed_time_start, preferred_time_start')
        .eq('coach_id', coachId)
        .in('status', ['pending', 'approved', 'confirmed']);
      if (cancelled) return;
      setLessons((data ?? []).map(row => {
        const date = (row.confirmed_date ?? row.preferred_date) as string | null;
        return {
          id: row.id as string,
          day: date ? new Date(`${date}T12:00:00`).getDay() : -1,
          start: ((row.confirmed_time_start ?? row.preferred_time_start) as string | null)?.slice(0, 5) ?? '',
          status: row.status as string,
        };
      }).filter(row => row.day >= 0));
    })();
    return () => { cancelled = true; };
  }, [coachId]);

  const byDay = useMemo(() => DAY_NAMES.map((_, day) => {
    const facilities = draft.facilityHours.filter(item => item.days_of_week.includes(day));
    const travels = draft.travelHours.filter(item => item.days_of_week.includes(day));
    const flexibleFacilityIds = new Set<string>();
    const flexibleTravelIds = new Set<string>();
    const items: PreviewItem[] = [];

    facilities.forEach(facility => {
      travels.forEach(travel => {
        if (overlaps(facility.start_time, facility.end_time, travel.start_time, travel.end_time)) {
          flexibleFacilityIds.add(facility.id);
          flexibleTravelIds.add(travel.id);
          items.push({
            id: `either-${facility.id}-${travel.id}`,
            code: 'E',
            label: `${formatTime(
              facility.start_time > travel.start_time ? facility.start_time : travel.start_time,
            )} flexible`,
            start: facility.start_time > travel.start_time ? facility.start_time : travel.start_time,
            public: facility.publicly_bookable && travel.publicly_bookable,
          });
        }
      });
    });

    facilities.filter(item => !flexibleFacilityIds.has(item.id)).forEach(item => items.push({
      id: item.id,
      code: 'F',
      label: `${formatTime(item.start_time)} ${item.facility_name}`,
      start: item.start_time,
      public: item.publicly_bookable,
    }));
    travels.filter(item => !flexibleTravelIds.has(item.id)).forEach(item => items.push({
      id: item.id,
      code: 'T',
      label: `${formatTime(item.start_time)} travel`,
      start: item.start_time,
      public: item.publicly_bookable,
    }));
    draft.blockouts
      .filter(item => {
        if (item.days_of_week?.includes(day)) return true;
        if (!item.specific_date) return false;
        return new Date(`${item.specific_date}T12:00:00`).getDay() === day;
      })
      .forEach(item => items.push({
        id: item.id,
        code: 'B',
        label: `${formatTime(item.start_time)} unavailable`,
        start: item.start_time ?? '',
        public: true,
      }));
    lessons.filter(item => item.day === day).forEach(item => items.push({
      id: item.id,
      code: item.status === 'pending' ? 'P' : 'L',
      label: `${formatTime(item.start)} ${item.status === 'pending' ? 'pending request' : 'lesson'}`,
      start: item.start,
      public: false,
    }));

    return items.sort((a, b) => a.start.localeCompare(b.start));
  }), [draft, lessons]);

  return (
    <SectionCard
      title="Weekly Schedule Preview"
      description="Preview of your weekly coaching schedule based on the rules above.">
      <Text style={styles.summary}>
        This preview combines your coaching boundaries, facility rules, travel rules, unavailable times, booked lessons, and pending requests.
      </Text>
      <View style={styles.preview}>
        {byDay.map((items, day) => (
          <View key={DAY_NAMES[day]} style={styles.dayRow}>
            <Text style={styles.dayLabel}>{DAY_NAMES[day].slice(0, 3).toUpperCase()}</Text>
            <View style={styles.items}>
              {items.length === 0 ? (
                <Text style={styles.empty}>No layered hours</Text>
              ) : items.slice(0, 5).map(item => (
                <View
                  key={item.id}
                  style={[
                    styles.previewItem,
                    styles[previewItemStyles[item.code]],
                    item.public ? styles.publicItem : styles.privateItem,
                  ]}>
                  <Text style={[styles.code, item.code === 'T' || item.code === 'E' || item.code === 'P' ? styles.darkCode : null]}>
                    {item.code}
                  </Text>
                  <Text style={styles.itemLabel} numberOfLines={1}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </SectionCard>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    summary: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      lineHeight: 20,
      color: theme.textSecondary,
    },
    preview: { gap: 9 },
    dayRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    dayLabel: {
      width: 32,
      paddingTop: 7,
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 9,
      color: theme.textMuted,
    },
    items: { flex: 1, gap: 5 },
    empty: {
      paddingVertical: 7,
      fontFamily: FontFamily.manropeMedium,
      fontSize: 12,
      color: theme.textDisabled,
    },
    previewItem: {
      minHeight: 34,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: Radius.xs,
      paddingHorizontal: 9,
      borderWidth: 1,
    },
    publicItem: { borderWidth: 2, borderColor: Colors.cyan },
    privateItem: { borderColor: theme.border, opacity: 0.62 },
    itemF: { backgroundColor: Colors.blue },
    itemT: { backgroundColor: Colors.volt },
    itemE: { backgroundColor: Colors.cyan },
    itemB: { backgroundColor: '#5A6379' },
    itemL: { backgroundColor: '#0F1F3D' },
    itemP: { backgroundColor: '#FF8C42' },
    code: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 10,
      color: '#FFFFFF',
    },
    darkCode: { color: '#0C0F18' },
    itemLabel: {
      flex: 1,
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: 11,
      color: '#FFFFFF',
    },
  }), [theme]);
}
