import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface TimeHour {
  label: string;  // '6AM', '12PM', '9PM'
  start: string;  // '06:00'
  end: string;    // '07:00'
  hour: number;   // 6..21
}

export const HOURS: TimeHour[] = Array.from({ length: 16 }, (_, i) => {
  const h = 6 + i;
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return {
    label: `${h12}${period}`,
    start: `${String(h).padStart(2, '0')}:00`,
    end:   `${String(h + 1).padStart(2, '0')}:00`,
    hour:  h,
  };
});

export type CellMode = 'coach_facility' | 'traveling' | 'both';

export interface CoachAvailabilitySlot {
  id: string;
  coach_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location_mode: CellMode | null;
}

export interface CoachUnavailabilityBlock {
  id: string;
  coach_id: string;
  type: string;
  start_date: string;
  end_date: string;
  recurs_annually: boolean;
  title: string | null;
}

interface UseCoachAvailabilityResult {
  weeklySlots: CoachAvailabilitySlot[];
  unavailabilityBlocks: CoachUnavailabilityBlock[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  isAvailableOnDate: (date: Date, hour: TimeHour) => boolean;
  isBlockedOnDate: (date: Date) => boolean;
  hasScheduleForHourOnDay: (dayOfWeek: number, hour: TimeHour) => boolean;
}

function normTime(t: string): string {
  return t.slice(0, 5); // '09:00:00' → '09:00'
}

function isDateInBlock(date: Date, block: CoachUnavailabilityBlock): boolean {
  const month = date.getMonth() + 1;
  const day   = date.getDate();
  const year  = date.getFullYear();

  if (block.recurs_annually) {
    const [, bStartMonth, bStartDay] = block.start_date.split('-').map(Number);
    const [, bEndMonth,   bEndDay]   = block.end_date.split('-').map(Number);
    // Normalize to a comparison year (use the date's year)
    const dateVal  = month * 100 + day;
    const startVal = bStartMonth * 100 + bStartDay;
    const endVal   = bEndMonth   * 100 + bEndDay;
    if (startVal <= endVal) {
      return dateVal >= startVal && dateVal <= endVal;
    }
    // Wraps across year boundary (e.g. Dec 28 – Jan 3)
    return dateVal >= startVal || dateVal <= endVal;
  }

  const ts = new Date(`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`);
  const start = new Date(block.start_date);
  const end   = new Date(block.end_date);
  return ts >= start && ts <= end;
}

export function useCoachAvailability(
  coachId: string | null,
  lookaheadDays = 60,
): UseCoachAvailabilityResult {
  const [weeklySlots, setWeeklySlots] = useState<CoachAvailabilitySlot[]>([]);
  const [unavailabilityBlocks, setUnavailabilityBlocks] = useState<CoachUnavailabilityBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    if (!coachId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const lookaheadEnd = new Date();
      lookaheadEnd.setDate(lookaheadEnd.getDate() + lookaheadDays);
      const endStr = lookaheadEnd.toISOString().split('T')[0];

      const [slotsRes, blocksRes] = await Promise.all([
        supabase
          .from('coach_availability')
          .select('*')
          .eq('coach_id', coachId!)
          .order('start_time', { ascending: true }),
        supabase
          .from('coach_unavailability')
          .select('id, coach_id, type, start_date, end_date, recurs_annually, title')
          .eq('coach_id', coachId!)
          .or(`recurs_annually.eq.true,end_date.gte.${new Date().toISOString().split('T')[0]}`)
          .lte('start_date', endStr),
      ]);

      if (cancelled) return;

      if (slotsRes.error) {
        setError(slotsRes.error.message);
      } else {
        setWeeklySlots((slotsRes.data ?? []) as CoachAvailabilitySlot[]);
      }

      if (blocksRes.error) {
        setError(blocksRes.error.message);
      } else {
        setUnavailabilityBlocks((blocksRes.data ?? []) as CoachUnavailabilityBlock[]);
      }

      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [coachId, lookaheadDays, tick]);

  const hasScheduleForHourOnDay = useCallback(
    (dayOfWeek: number, hour: TimeHour): boolean => {
      return weeklySlots.some(
        s => s.day_of_week === dayOfWeek && normTime(s.start_time) === hour.start,
      );
    },
    [weeklySlots],
  );

  const isBlockedOnDate = useCallback(
    (date: Date): boolean => {
      return unavailabilityBlocks.some(b => isDateInBlock(date, b));
    },
    [unavailabilityBlocks],
  );

  const isAvailableOnDate = useCallback(
    (date: Date, hour: TimeHour): boolean => {
      return hasScheduleForHourOnDay(date.getDay(), hour) && !isBlockedOnDate(date);
    },
    [hasScheduleForHourOnDay, isBlockedOnDate],
  );

  return { weeklySlots, unavailabilityBlocks, loading, error, refresh, isAvailableOnDate, isBlockedOnDate, hasScheduleForHourOnDay };
}
