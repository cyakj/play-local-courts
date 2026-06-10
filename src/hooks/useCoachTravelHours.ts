import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { CoachTravelHour } from '@/types/coachSchedule';
import { isDraftId, normalizeTime } from '@/types/coachSchedule';

export function useCoachTravelHours(coachId: string | null) {
  const [records, setRecords] = useState<CoachTravelHour[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!coachId) return;
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await (supabase as any)
      .from('coach_travel_hours')
      .select('*')
      .eq('coach_id', coachId)
      .eq('is_active', true)
      .order('created_at');
    if (queryError) setError(queryError.message);
    setRecords((data ?? []).map((row: CoachTravelHour) => ({
      ...row,
      areas_served: row.areas_served ?? [],
      days_of_week: row.days_of_week ?? [],
      start_time: normalizeTime(row.start_time) ?? '08:00',
      end_time: normalizeTime(row.end_time) ?? '12:00',
    })));
    setLoading(false);
  }, [coachId]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (
    draft: CoachTravelHour[],
    original: CoachTravelHour[],
  ) => {
    if (!coachId) throw new Error('Coach session is unavailable.');
    const draftIds = new Set(draft.filter(row => !isDraftId(row.id)).map(row => row.id));
    const removedIds = original.filter(row => !draftIds.has(row.id)).map(row => row.id);

    if (removedIds.length) {
      const { error: removeError } = await (supabase as any)
        .from('coach_travel_hours')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .in('id', removedIds)
        .eq('coach_id', coachId);
      if (removeError) throw removeError;
    }

    for (const row of draft) {
      const payload = {
        coach_id: coachId,
        travel_radius_miles: row.travel_radius_miles,
        areas_served: row.areas_served,
        days_of_week: row.days_of_week,
        start_time: row.start_time,
        end_time: row.end_time,
        publicly_bookable: row.publicly_bookable,
        travel_notes: row.travel_notes?.trim() || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      };
      const query = (supabase as any).from('coach_travel_hours');
      const { error: saveError } = isDraftId(row.id)
        ? await query.insert(payload)
        : await query.update(payload).eq('id', row.id).eq('coach_id', coachId);
      if (saveError) throw saveError;
    }
  }, [coachId]);

  return { records, loading, error, refresh: load, save };
}

