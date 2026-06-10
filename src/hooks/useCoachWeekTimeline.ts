import { useMemo } from 'react';
import { useCoachAvailability } from '@/hooks/useCoachAvailability';
import { useCoachBlockouts } from '@/hooks/useCoachBlockouts';
import { useCoachGlobalHours } from '@/hooks/useCoachGlobalHours';
import { useCoachRequests, type CoachLessonRequest } from '@/hooks/useCoachRequests';
import { useCoachTeachingBlocks } from '@/hooks/useCoachTeachingBlocks';
import type { BlockoutType, CoachBlockout } from '@/types/coachSchedule';

export type WeekScheduleItem =
  | {
      kind: 'lesson';
      id: string;
      date: string;
      start: string;
      end: string;
      request: CoachLessonRequest;
    }
  | {
      kind: 'open';
      id: string;
      date: string;
      start: string;
      end: string;
      slotType: 'facility' | 'travel' | 'flexible';
      publiclyBookable: boolean;
      sourceId: string;
      facilityName: string | null;
      courtType: string | null;
      travelRadiusMiles: number | null;
      areasServed: string[];
    }
  | {
      kind: 'unavailable';
      id: string;
      date: string;
      start: string;
      end: string;
      type: BlockoutType | 'legacy_unavailability';
      internalNote: string | null;
      sourceKind: 'blockout' | 'legacy';
    };

function dateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function time(value: string | null | undefined, fallback: string): string {
  return value?.slice(0, 5) ?? fallback;
}

function matchesBlockoutDate(blockout: CoachBlockout, date: Date, key: string): boolean {
  if (blockout.specific_date) return blockout.specific_date === key;
  return blockout.days_of_week?.includes(date.getDay()) ?? false;
}

function matchesLegacyUnavailable(
  date: Date,
  block: { start_date: string; end_date: string; recurs_annually: boolean },
): boolean {
  const key = dateKey(date);
  if (!block.recurs_annually) return key >= block.start_date && key <= block.end_date;
  const monthDay = key.slice(5);
  const start = block.start_date.slice(5);
  const end = block.end_date.slice(5);
  return start <= end ? monthDay >= start && monthDay <= end : monthDay >= start || monthDay <= end;
}

function subtractBlockers(
  item: Extract<WeekScheduleItem, { kind: 'open' }>,
  blockers: { start: string; end: string }[],
): Extract<WeekScheduleItem, { kind: 'open' }>[] {
  const fragments = [...blockers]
    .sort((a, b) => a.start.localeCompare(b.start))
    .reduce<{ start: string; end: string }[]>((current, blocker) => (
      current.flatMap(fragment => {
        if (blocker.end <= fragment.start || blocker.start >= fragment.end) return [fragment];
        const next: { start: string; end: string }[] = [];
        if (fragment.start < blocker.start) next.push({ start: fragment.start, end: blocker.start });
        if (blocker.end < fragment.end) next.push({ start: blocker.end, end: fragment.end });
        return next;
      })
    ), [{ start: item.start, end: item.end }]);

  return fragments.map(fragment => ({
    ...item,
    id: `${item.id}-${fragment.start}-${fragment.end}`,
    start: fragment.start,
    end: fragment.end,
  }));
}

export function startOfWeek(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const offset = date.getDay() === 0 ? -6 : 1 - date.getDay();
  date.setDate(date.getDate() + offset);
  return date;
}

export function useCoachWeekTimeline(coachId: string | null, weekStart: Date) {
  const requests = useCoachRequests();
  const boundaries = useCoachGlobalHours(coachId);
  const teachingBlocks = useCoachTeachingBlocks(coachId);
  const blockouts = useCoachBlockouts(coachId);
  const legacyAvailability = useCoachAvailability(coachId);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + index);
      return date;
    }),
    [weekStart],
  );

  const itemsByDate = useMemo(() => new Map(days.map(date => {
    const key = dateKey(date);
    const day = date.getDay();
    const boundary = boundaries.hours.find(item => item.day_of_week === day);

    const lessons: WeekScheduleItem[] = requests.upcoming
      .filter(request => (request.confirmedDate ?? request.preferredDate) === key)
      .map(request => ({
        kind: 'lesson',
        id: `lesson-${request.id}`,
        date: key,
        start: time(request.confirmedTimeStart ?? request.preferredTimeStart, '00:00'),
        end: time(request.confirmedTimeEnd ?? request.preferredTimeEnd, '23:59'),
        request,
      }));

    const unavailable: WeekScheduleItem[] = blockouts.blockouts
      .filter(blockout => matchesBlockoutDate(blockout, date, key))
      .map(blockout => ({
        kind: 'unavailable',
        id: `blockout-${blockout.id}`,
        date: key,
        start: time(blockout.start_time, '00:00'),
        end: time(blockout.end_time, '23:59'),
        type: blockout.type,
        internalNote: blockout.title,
        sourceKind: 'blockout',
      }));

    legacyAvailability.unavailabilityBlocks
      .filter(block => matchesLegacyUnavailable(date, block))
      .forEach(block => unavailable.push({
        kind: 'unavailable',
        id: `legacy-${block.id}`,
        date: key,
        start: '00:00',
        end: '23:59',
        type: 'legacy_unavailability',
        internalNote: block.title,
        sourceKind: 'legacy',
      }));

    let open: Extract<WeekScheduleItem, { kind: 'open' }>[] = boundary && !boundary.is_closed
      ? teachingBlocks.blocks
        .filter(block =>
          block.day_of_week === day
          && block.is_active
          && block.start_time >= boundary.start_time
          && block.end_time <= boundary.end_time,
        )
        .map(block => ({
          kind: 'open',
          id: `teaching-${block.id}`,
          date: key,
          start: block.start_time,
          end: block.end_time,
          slotType: block.location_type === 'either' ? 'flexible' : block.location_type,
          publiclyBookable: block.publicly_bookable,
          sourceId: block.id,
          facilityName: block.facility_name,
          courtType: block.court_type,
          travelRadiusMiles: block.travel_radius_miles,
          areasServed: block.areas_served,
        }))
      : [];

    const blockers = [...lessons, ...unavailable].map(item => ({
      start: item.start,
      end: item.end,
    }));
    open = open.flatMap(item => subtractBlockers(item, blockers));

    return [
      key,
      [...open, ...lessons, ...unavailable].sort((a, b) => a.start.localeCompare(b.start)),
    ] as const;
  })), [
    blockouts.blockouts,
    boundaries.hours,
    days,
    legacyAvailability.unavailabilityBlocks,
    requests.upcoming,
    teachingBlocks.blocks,
  ]);

  return {
    days,
    itemsByDate,
    loading: requests.loading
      || boundaries.loading
      || teachingBlocks.loading
      || blockouts.loading
      || legacyAvailability.loading,
    error: requests.error
      || boundaries.error
      || teachingBlocks.error
      || blockouts.error
      || legacyAvailability.error,
    cancelLesson: requests.cancelLesson,
    refresh: async () => {
      requests.refresh();
      await Promise.all([
        boundaries.refresh(),
        teachingBlocks.refresh(),
        blockouts.refresh(),
      ]);
    },
  };
}
