import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface ScheduledLesson {
  id: string;
  playerId: string;
  playerName: string | null;
  lessonType: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  status: string;
  durationMinutes: number | null;
}

interface UseCoachScheduleResult {
  lessonsByDate: Record<string, ScheduledLesson[]>;
  loading: boolean;
  refresh: () => void;
}

export function useCoachSchedule(weekStart: Date): UseCoachScheduleResult {
  const [lessonsByDate, setLessonsByDate] = useState<Record<string, ScheduledLesson[]>>({});
  const [loading, setLoading] = useState(true);
  const [tickState, setTickState] = useState(0);

  const refresh = useCallback(() => setTickState(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const startStr = weekStart.toISOString().slice(0, 10);
      const endDate = new Date(weekStart);
      endDate.setDate(endDate.getDate() + 6);
      const endStr = endDate.toISOString().slice(0, 10);

      const { data } = await supabase
        .from('lesson_requests')
        .select('id, player_id, lesson_type, confirmed_date, confirmed_time_start, confirmed_time_end, preferred_date, preferred_time_start, preferred_time_end, status, duration_minutes')
        .eq('coach_id', user.id)
        .in('status', ['approved', 'confirmed', 'completed', 'no_show'])
        .or(`confirmed_date.gte.${startStr},preferred_date.gte.${startStr}`)
        .or(`confirmed_date.lte.${endStr},preferred_date.lte.${endStr}`)
        .order('confirmed_time_start', { ascending: true });

      if (cancelled) return;

      const rows = data ?? [];
      const playerIds = [...new Set(rows.map(r => r.player_id as string))];
      let nameMap = new Map<string, string>();
      if (playerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', playerIds);
        if (!cancelled) {
          nameMap = new Map((profiles ?? []).map(p => [p.id as string, p.full_name as string ?? 'Player']));
        }
      }

      if (cancelled) return;

      const grouped: Record<string, ScheduledLesson[]> = {};
      rows.forEach(r => {
        const date = (r.confirmed_date ?? r.preferred_date) as string;
        if (!date) return;
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push({
          id:              r.id as string,
          playerId:        r.player_id as string,
          playerName:      nameMap.get(r.player_id as string) ?? null,
          lessonType:      r.lesson_type as string,
          date,
          timeStart:       (r.confirmed_time_start ?? r.preferred_time_start) as string,
          timeEnd:         (r.confirmed_time_end ?? r.preferred_time_end) as string,
          status:          (r.status ?? 'approved') as string,
          durationMinutes: r.duration_minutes as number | null,
        });
      });

      setLessonsByDate(grouped);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [weekStart, tickState]);

  return { lessonsByDate, loading, refresh };
}
