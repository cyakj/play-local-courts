import { useMemo } from 'react';
import { useCoachAvailability } from '@/hooks/useCoachAvailability';
import { useCoachBlockouts } from '@/hooks/useCoachBlockouts';
import { useCoachGlobalHours } from '@/hooks/useCoachGlobalHours';
import { useCoachRequests, type CoachLessonRequest } from '@/hooks/useCoachRequests';
import { useCoachTeachingBlocks } from '@/hooks/useCoachTeachingBlocks';
import type { BlockoutType, CoachBlockout } from '@/types/coachSchedule';

export type TimelineItem =
  | { kind: 'lesson'; id: string; start: string; end: string; request: CoachLessonRequest }
  | { kind: 'pending'; id: string; start: string; end: string; request: CoachLessonRequest }
  | {
      kind: 'open';
      id: string;
      start: string;
      end: string;
      slotType: 'facility' | 'travel' | 'flexible';
      publiclyBookable: boolean;
      sourceKind: 'teaching' | 'legacy';
      sourceIds: string[];
      facilityName?: string;
      facilityAddress?: string | null;
      travelRadiusMiles?: number | null;
      areasServed?: string[];
    }
  | {
      kind: 'unavailable';
      id: string;
      start: string;
      end: string;
      type: BlockoutType | 'legacy_unavailability';
      internalNote: string | null;
      sourceKind: 'blockout' | 'legacy';
    };

type OpenTimelineItem = Extract<TimelineItem, { kind: 'open' }>;

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

function subtractBlockers(
  item: OpenTimelineItem,
  blockers: { start: string; end: string }[],
): OpenTimelineItem[] {
  const fragments = blockers
    .sort((a, b) => a.start.localeCompare(b.start))
    .reduce<{ start: string; end: string }[]>((current, blocker) => (
      current.flatMap(fragment => {
        if (blocker.end <= fragment.start || blocker.start >= fragment.end) return [fragment];
        const next: { start: string; end: string }[] = [];
        if (fragment.start < blocker.start) {
          next.push({ start: fragment.start, end: blocker.start });
        }
        if (blocker.end < fragment.end) {
          next.push({ start: blocker.end, end: fragment.end });
        }
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

function isDateInLegacyBlock(
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

function matchesBlockoutDate(blockout: CoachBlockout, selectedDate: Date, selectedKey: string): boolean {
  if (blockout.specific_date) return blockout.specific_date === selectedKey;
  return blockout.days_of_week?.includes(selectedDate.getDay()) ?? false;
}

function withinBoundary(
  start: string,
  end: string,
  boundary: { start_time: string; end_time: string; is_closed: boolean } | undefined,
): boolean {
  if (!boundary || boundary.is_closed) return false;
  return start >= boundary.start_time.slice(0, 5) && end <= boundary.end_time.slice(0, 5);
}

export function useCoachDailyTimeline(coachId: string | null, selectedDate: Date) {
  const requests = useCoachRequests();
  const globalHours = useCoachGlobalHours(coachId);
  const teachingBlocks = useCoachTeachingBlocks(coachId);
  const blockouts = useCoachBlockouts(coachId);
  const legacyAvailability = useCoachAvailability(coachId);

  const selectedKey = dateKey(selectedDate);
  const day = selectedDate.getDay();

  const items = useMemo<TimelineItem[]>(() => {
    const lessons: TimelineItem[] = requests.upcoming
      .filter(request => (request.confirmedDate ?? request.preferredDate) === selectedKey)
      .map(request => ({
        kind: 'lesson',
        id: `lesson-${request.id}`,
        start: time(request.confirmedTimeStart ?? request.preferredTimeStart, '00:00'),
        end: time(request.confirmedTimeEnd ?? request.preferredTimeEnd, '23:59'),
        request,
      }));

    const unavailable: TimelineItem[] = blockouts.blockouts
      .filter(blockout => matchesBlockoutDate(blockout, selectedDate, selectedKey))
      .map(blockout => ({
        kind: 'unavailable',
        id: `blockout-${blockout.id}`,
        start: time(blockout.start_time, '00:00'),
        end: time(blockout.end_time, '23:59'),
        type: blockout.type,
        internalNote: blockout.title,
        sourceKind: 'blockout',
      }));

    legacyAvailability.unavailabilityBlocks
      .filter(block => isDateInLegacyBlock(selectedDate, block))
      .forEach(block => unavailable.push({
        kind: 'unavailable',
        id: `legacy-block-${block.id}`,
        start: '00:00',
        end: '23:59',
        type: 'legacy_unavailability',
        internalNote: block.title,
        sourceKind: 'legacy',
      }));

    const boundary = globalHours.hours.find(item => item.day_of_week === day);
    let open: OpenTimelineItem[] = teachingBlocks.blocks
      .filter(item =>
        item.day_of_week === day
        && item.is_active
        && withinBoundary(item.start_time, item.end_time, boundary),
      )
      .map(item => ({
        kind: 'open',
        id: `teaching-${item.id}`,
        start: item.start_time,
        end: item.end_time,
        slotType: item.location_type === 'either' ? 'flexible' : item.location_type,
        publiclyBookable: item.publicly_bookable,
        sourceKind: 'teaching',
        sourceIds: [item.id],
        facilityName: item.facility_name ?? undefined,
        travelRadiusMiles: item.travel_radius_miles,
        areasServed: item.areas_served,
      }));

    const blockers = [...lessons, ...unavailable].map(item => ({ start: item.start, end: item.end }));
    open = open.flatMap(item => subtractBlockers(item, blockers));

    return [...lessons, ...open, ...unavailable].sort((a, b) => {
      const timeOrder = a.start.localeCompare(b.start);
      if (timeOrder !== 0) return timeOrder;
      const priority = { unavailable: 0, lesson: 1, pending: 2, open: 3 };
      return priority[a.kind] - priority[b.kind];
    });
  }, [
    blockouts.blockouts,
    day,
    globalHours.hours,
    legacyAvailability.unavailabilityBlocks,
    legacyAvailability.weeklySlots,
    requests.upcoming,
    selectedDate,
    selectedKey,
    teachingBlocks.blocks,
  ]);

  const summary = useMemo(() => ({
    lessons: items.filter(item => item.kind === 'lesson').length,
    openSlots: items.filter(item => item.kind === 'open').length,
    unavailable: items.filter(item => item.kind === 'unavailable').length,
  }), [items]);

  const refreshRules = async () => {
    await Promise.all([
      globalHours.refresh(),
      teachingBlocks.refresh(),
      blockouts.refresh(),
    ]);
  };

  return {
    items,
    summary,
    loading: requests.loading
      || globalHours.loading
      || teachingBlocks.loading
      || blockouts.loading
      || legacyAvailability.loading,
    error: requests.error
      || globalHours.error
      || teachingBlocks.error
      || blockouts.error
      || legacyAvailability.error,
    weeklySlots: legacyAvailability.weeklySlots,
    accept: requests.accept,
    decline: requests.decline,
    cancelLesson: requests.cancelLesson,
    markComplete: requests.markComplete,
    markNoShow: requests.markNoShow,
    refreshRequests: requests.refresh,
    refreshRules,
    refreshLegacyAvailability: legacyAvailability.refresh,
  };
}
