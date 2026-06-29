import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { CoachGlobalHour } from '@/types/coachSchedule';
import { normalizeTime } from '@/types/coachSchedule';

export function useCoachGlobalHours(coachId: string | null) {
  const [hours, setHours] = useState<CoachGlobalHour[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schemaUnavailable, setSchemaUnavailable] = useState(false);

  const load = useCallback(async () => {
    if (!coachId) return;
    setLoading(true);
    setError(null);
    setSchemaUnavailable(false);
    const { data, error: queryError } = await (supabase as any)
      .from('coach_global_hours')
      .select('*')
      .eq('coach_id', coachId)
      .order('day_of_week');

    if (queryError) {
      const missingTable = queryError.code === '42P01'
        || queryError.code === 'PGRST205'
        || queryError.message.includes('coach_global_hours');
      if (missingTable) {
        setSchemaUnavailable(true);
        setHours([]);
        setLoading(false);
        return;
      }
      setError(queryError.message);
    }
    setHours((data ?? []).map((row: CoachGlobalHour) => ({
      ...row,
      start_time: normalizeTime(row.start_time) ?? '07:00',
      end_time: normalizeTime(row.end_time) ?? '20:00',
    })));
    setLoading(false);
  }, [coachId]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (draft: CoachGlobalHour[]) => {
    if (!coachId) throw new Error('Coach session is unavailable.');
    if (schemaUnavailable) {
      throw new Error('Schedule storage is not ready. Apply the coach scheduling migrations.');
    }
    const rows = draft.map(row => ({
      coach_id: coachId,
      day_of_week: row.day_of_week,
      start_time: row.start_time,
      end_time: row.end_time,
      is_closed: row.is_closed,
      updated_at: new Date().toISOString(),
    }));
    if (rows.length === 0) return;
    const { error: saveError } = await (supabase as any)
      .from('coach_global_hours')
      .upsert(rows, { onConflict: 'coach_id,day_of_week' });
    if (saveError) throw saveError;
  }, [coachId, schemaUnavailable]);

  return { hours, loading, error, schemaUnavailable, refresh: load, save };
}
