import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { CoachSchedulePrivateSettings } from '@/types/coachSchedule';

export function useCoachSchedulePrivateSettings(coachId: string | null) {
  const [settings, setSettings] = useState<CoachSchedulePrivateSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schemaUnavailable, setSchemaUnavailable] = useState(false);

  const load = useCallback(async () => {
    if (!coachId) return;
    setLoading(true);
    setError(null);
    setSchemaUnavailable(false);
    const { data, error: queryError } = await (supabase as any)
      .from('coach_schedule_private_settings')
      .select('coach_id, travel_base_address')
      .eq('coach_id', coachId)
      .maybeSingle();
    if (queryError) {
      const missingTable = queryError.code === '42P01'
        || queryError.code === 'PGRST205'
        || queryError.message.includes('coach_schedule_private_settings');
      if (missingTable) {
        setSchemaUnavailable(true);
        setSettings({ coach_id: coachId, travel_base_address: null });
        setLoading(false);
        return;
      }
      setError(queryError.message);
    }
    setSettings(data ?? { coach_id: coachId, travel_base_address: null });
    setLoading(false);
  }, [coachId]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (draft: CoachSchedulePrivateSettings) => {
    if (!coachId) throw new Error('Coach session is unavailable.');
    if (schemaUnavailable) {
      throw new Error('Schedule storage is not ready. Apply the coach scheduling migrations.');
    }
    const { error: saveError } = await (supabase as any)
      .from('coach_schedule_private_settings')
      .upsert({
        coach_id: coachId,
        travel_base_address: draft.travel_base_address?.trim() || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'coach_id' });
    if (saveError) throw saveError;
  }, [coachId, schemaUnavailable]);

  return { settings, loading, error, schemaUnavailable, refresh: load, save };
}
