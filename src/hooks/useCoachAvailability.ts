import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface TimeBand {
  label: string;
  start: string; // 'HH:MM'
  end: string;
}

export const TIME_BANDS: TimeBand[] = [
  { label: 'MORNING',   start: '06:00', end: '12:00' },
  { label: 'AFTERNOON', start: '12:00', end: '17:00' },
  { label: 'EVENING',   start: '17:00', end: '21:00' },
];

export interface CoachAvailabilitySlot {
  id: string;
  coach_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
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
  isAvailableOnDate: (date: Date, band: TimeBand) => boolean;
  isBlockedOnDate: (date: Date) => boolean;
  hasScheduleForBandOnDay: (dayOfWeek: number, band: TimeBand) => boolean;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function overlaps(slotStart: string, slotEnd: string, bandStart: string, bandEnd: string): boolean {
  return timeToMinutes(slotStart) < timeToMinutes(bandEnd) &&
         timeToMinutes(slotEnd)   > timeToMinutes(bandStart);
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
          .eq('coach_id', coachId),
        supabase
          .from('coach_unavailability')
          .select('id, coach_id, type, start_date, end_date, recurs_annually, title')
          .eq('coach_id', coachId)
          .or(`recurs_annually.eq.true,end_date.gte.${new Date().toISOString().split('T')[0]}`)
          .lte('start_date', endStr),
      ]);

      if (cancelled) return;

      if (slotsRes.error) {
        setError(slotsRes.error.message);
      } else {
        setWeeklySlots(slotsRes.data ?? []);
      }

      if (blocksRes.error) {
        setError(blocksRes.error.message);
      } else {
        setUnavailabilityBlocks(blocksRes.data ?? []);
      }

      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [coachId, lookaheadDays]);

  const hasScheduleForBandOnDay = useCallback(
    (dayOfWeek: number, band: TimeBand): boolean => {
      return weeklySlots.some(
        s => s.day_of_week === dayOfWeek && overlaps(s.start_time, s.end_time, band.start, band.end),
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
    (date: Date, band: TimeBand): boolean => {
      const dow = date.getDay(); // 0=Sun
      return hasScheduleForBandOnDay(dow, band) && !isBlockedOnDate(date);
    },
    [hasScheduleForBandOnDay, isBlockedOnDate],
  );

  return { weeklySlots, unavailabilityBlocks, loading, error, isAvailableOnDate, isBlockedOnDate, hasScheduleForBandOnDay };
}
