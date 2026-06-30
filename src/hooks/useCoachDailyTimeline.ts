import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCoachAvailability } from '@/hooks/useCoachAvailability';
import { useCoachBlockouts } from '@/hooks/useCoachBlockouts';
import { useCoachGlobalHours } from '@/hooks/useCoachGlobalHours';
import { useCoachRequests, type CoachLessonRequest } from '@/hooks/useCoachRequests';
import { useCoachTeachingBlocks } from '@/hooks/useCoachTeachingBlocks';
import type { BlockoutType, CoachBlockout } from '@/types/coachSchedule';
import { supabase } from '@/lib/supabase';

export type TimelineItem =
  | { kind: 'lesson'; id: string; start: string; end: string; request: CoachLessonRequest }
  | { kind: 'pending'; id: string; start: string; end: string; request: CoachLessonRequest }
  | {
      kind: 'clinic';
      id: string;
      start: string;
      end: string;
      clinicId: string;
      name: string;
      status: 'draft' | 'published';
      enrolledCount: number;
      maxPlayers: number;
      location: string;
    }
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

interface ClinicDayItem {
  id: string;
  start: string;
  end: string;
  name: string;
  status: 'draft' | 'published';
  enrolledCount: number;
  maxPlayers: number;
  location: string;
}

function addMinutes(timeHHMM: string, mins: number): string {
  const [h, m] = timeHHMM.slice(0, 5).split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

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

  const [dayClinics, setDayClinics] = useState<ClinicDayItem[]>([]);
  const [clinicsLoading, setClinicsLoading] = useState(false);
  const clinicsTick = useRef(0);
  const [clinicsTickState, setClinicsTickState] = useState(0);

  const refreshClinics = useCallback(() => {
    clinicsTick.current += 1;
    setClinicsTickState(t => t + 1);
  }, []);

  const selectedKey = dateKey(selectedDate);
  const day = selectedDate.getDay();

  useEffect(() => {
    if (!coachId) { setDayClinics([]); return; }
    let cancelled = false;
    setClinicsLoading(true);
    (async () => {
      const { data: rows } = await (supabase as any)
        .from('coach_clinics')
        .select('id, name, start_time, duration_minutes, location, status, max_players')
        .eq('coach_id', coachId)
        .eq('date', selectedKey)
        .neq('status', 'canceled')
        .order('start_time', { ascending: true });
      if (cancelled) return;
      const clinicRows: any[] = rows ?? [];
      if (!clinicRows.length) { setDayClinics([]); setClinicsLoading(false); return; }
      const ids = clinicRows.map((r: any) => r.id as string);
      const { data: counts } = await (supabase as any)
        .rpc('clinic_enrollment_counts', { clinic_ids: ids });
      const countMap = new Map<string, number>(
        ((counts ?? []) as any[]).map((r: any) => [r.clinic_id as string, r.enrolled_count as number]),
      );
      if (cancelled) return;
      setDayClinics(clinicRows.map((r: any): ClinicDayItem => ({
        id:            r.id,
        start:         r.start_time.slice(0, 5),
        end:           addMinutes(r.start_time.slice(0, 5), r.duration_minutes as number),
        name:          r.name,
        status:        r.status,
        enrolledCount: countMap.get(r.id) ?? 0,
        maxPlayers:    r.max_players,
        location:      r.location,
      })));
      setClinicsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [coachId, selectedKey, clinicsTickState]);

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

    const clinicItems: TimelineItem[] = dayClinics.map(c => ({
      kind: 'clinic',
      id: `clinic-${c.id}`,
      start: c.start,
      end: c.end,
      clinicId: c.id,
      name: c.name,
      status: c.status,
      enrolledCount: c.enrolledCount,
      maxPlayers: c.maxPlayers,
      location: c.location,
    }));

    const blockers = [...lessons, ...unavailable, ...clinicItems].map(item => ({ start: item.start, end: item.end }));
    open = open.flatMap(item => subtractBlockers(item, blockers));

    return [...lessons, ...open, ...unavailable, ...clinicItems].sort((a, b) => {
      const timeOrder = a.start.localeCompare(b.start);
      if (timeOrder !== 0) return timeOrder;
      const priority = { unavailable: 0, lesson: 1, clinic: 2, pending: 3, open: 4 };
      return priority[a.kind] - priority[b.kind];
    });
  }, [
    blockouts.blockouts,
    dayClinics,
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
      || legacyAvailability.loading
      || clinicsLoading,
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
    refreshClinics,
    refreshRules,
    refreshLegacyAvailability: legacyAvailability.refresh,
  };
}
