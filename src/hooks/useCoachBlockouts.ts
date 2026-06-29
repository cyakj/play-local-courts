import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { CoachBlockout } from '@/types/coachSchedule';
import { isDraftId, normalizeTime } from '@/types/coachSchedule';

export function useCoachBlockouts(coachId: string | null) {
  const [blockouts, setBlockouts] = useState<CoachBlockout[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schemaUnavailable, setSchemaUnavailable] = useState(false);

  const load = useCallback(async () => {
    if (!coachId) return;
    setLoading(true);
    setError(null);
    setSchemaUnavailable(false);
    const { data, error: queryError } = await (supabase as any)
      .from('coach_blockouts')
      .select('*')
      .eq('coach_id', coachId)
      .order('created_at', { ascending: false });
    if (queryError) {
      const missingTable = queryError.code === '42P01'
        || queryError.code === 'PGRST205'
        || queryError.message.includes('coach_blockouts');
      if (missingTable) {
        setSchemaUnavailable(true);
        setBlockouts([]);
        setLoading(false);
        return;
      }
      setError(queryError.message);
    }
    setBlockouts((data ?? []).map((row: CoachBlockout) => ({
      ...row,
      start_time: normalizeTime(row.start_time),
      end_time: normalizeTime(row.end_time),
    })));
    setLoading(false);
  }, [coachId]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (
    draft: CoachBlockout[],
    original: CoachBlockout[],
  ) => {
    if (!coachId) throw new Error('Coach session is unavailable.');
    if (schemaUnavailable) {
      throw new Error('Schedule storage is not ready. Apply the coach scheduling migrations.');
    }
    const draftIds = new Set(draft.filter(row => !isDraftId(row.id)).map(row => row.id));
    const removedIds = original.filter(row => !draftIds.has(row.id)).map(row => row.id);

    if (removedIds.length) {
      const { error: removeError } = await (supabase as any)
        .from('coach_blockouts')
        .delete()
        .in('id', removedIds)
        .eq('coach_id', coachId);
      if (removeError) throw removeError;
    }

    for (const row of draft) {
      const payload = {
        coach_id: coachId,
        type: row.type,
        title: row.title?.trim() || null,
        days_of_week: row.specific_date ? null : row.days_of_week,
        start_time: row.start_time,
        end_time: row.end_time,
        specific_date: row.specific_date || null,
        visibility: 'show_as_unavailable',
      };
      const query = (supabase as any).from('coach_blockouts');
      const { error: saveError } = isDraftId(row.id)
        ? await query.insert(payload)
        : await query.update(payload).eq('id', row.id).eq('coach_id', coachId);
      if (saveError) throw saveError;
    }

    const { data, error: reloadError } = await (supabase as any)
      .from('coach_blockouts')
      .select('*')
      .eq('coach_id', coachId)
      .order('created_at', { ascending: false });
    if (reloadError) throw reloadError;
    return (data ?? []).map((row: CoachBlockout) => ({
      ...row,
      start_time: normalizeTime(row.start_time),
      end_time: normalizeTime(row.end_time),
    })) as CoachBlockout[];
  }, [coachId, schemaUnavailable]);

  return { blockouts, loading, error, schemaUnavailable, refresh: load, save };
}
