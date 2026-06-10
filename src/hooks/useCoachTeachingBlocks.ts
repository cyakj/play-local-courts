import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { CoachTeachingBlock } from '@/types/coachSchedule';
import { normalizeTime } from '@/types/coachSchedule';

export function useCoachTeachingBlocks(coachId: string | null) {
  const [blocks, setBlocks] = useState<CoachTeachingBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schemaUnavailable, setSchemaUnavailable] = useState(false);

  const load = useCallback(async () => {
    if (!coachId) return;
    setLoading(true);
    setError(null);
    setSchemaUnavailable(false);
    const { data, error: queryError } = await (supabase as any)
      .from('coach_teaching_blocks')
      .select('*')
      .eq('coach_id', coachId)
      .eq('is_active', true)
      .order('day_of_week')
      .order('start_time');

    if (queryError) {
      const missingTable = queryError.code === '42P01'
        || queryError.code === 'PGRST205'
        || queryError.message.includes('coach_teaching_blocks');
      if (missingTable) {
        setSchemaUnavailable(true);
        setBlocks([]);
        setLoading(false);
        return;
      }
      setError(queryError.message);
    }
    setBlocks((data ?? []).map((row: CoachTeachingBlock) => ({
      ...row,
      start_time: normalizeTime(row.start_time) ?? '09:00',
      end_time: normalizeTime(row.end_time) ?? '10:00',
      areas_served: row.areas_served ?? [],
    })));
    setLoading(false);
  }, [coachId]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (draft: CoachTeachingBlock[]) => {
    if (!coachId) throw new Error('Coach session is unavailable.');
    if (schemaUnavailable) {
      throw new Error('Schedule storage is not ready. Apply the coach_teaching_blocks migration.');
    }
    const payload = draft.map(block => ({
      day_of_week: block.day_of_week,
      start_time: block.start_time,
      end_time: block.end_time,
      location_type: block.location_type,
      facility_name: block.facility_name?.trim() || null,
      court_type: block.court_type?.trim() || null,
      travel_radius_miles: block.travel_radius_miles,
      areas_served: block.areas_served,
      travel_notes: block.travel_notes?.trim() || null,
      publicly_bookable: block.publicly_bookable,
    }));
    const { data, error: saveError } = await (supabase as any)
      .rpc('replace_own_coach_teaching_blocks', { blocks: payload });
    if (saveError) throw saveError;
    return (data ?? []).map((row: CoachTeachingBlock) => ({
      ...row,
      start_time: normalizeTime(row.start_time) ?? '09:00',
      end_time: normalizeTime(row.end_time) ?? '10:00',
      areas_served: row.areas_served ?? [],
    })) as CoachTeachingBlock[];
  }, [coachId, schemaUnavailable]);

  return { blocks, loading, error, schemaUnavailable, refresh: load, save };
}
