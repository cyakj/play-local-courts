import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface CoachStudent {
  playerId: string;
  playerName: string | null;
  avatarUrl: string | null;
  lessonCount: number;
  completedCount: number;
  noShowCount: number;
  lastLessonDate: string | null;
  notes: string | null;
}

interface UseCoachStudentsResult {
  students: CoachStudent[];
  loading: boolean;
  refresh: () => void;
  saveNotes: (playerId: string, notes: string) => Promise<string | null>;
}

export function useCoachStudents(): UseCoachStudentsResult {
  const [students, setStudents] = useState<CoachStudent[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tickState, setTickState] = useState(0);

  const refresh = useCallback(() => setTickState(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: requests } = await supabase
        .from('lesson_requests')
        .select('player_id, status, confirmed_date, preferred_date, created_at')
        .eq('coach_id', user.id)
        .in('status', ['approved', 'confirmed', 'completed', 'no_show']);

      if (cancelled) return;

      const rows = requests ?? [];
      const playerIds = [...new Set(rows.map(r => r.player_id as string))];
      if (playerIds.length === 0) { setStudents([]); setLoading(false); return; }

      const [profilesRes, notesRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, avatar_url').in('id', playerIds),
        supabase.from('coach_student_notes').select('player_user_id, notes').eq('coach_user_id', user.id).in('player_user_id', playerIds),
      ]);

      if (cancelled) return;

      const profileMap = new Map((profilesRes.data ?? []).map(p => [
        p.id as string,
        { fullName: p.full_name as string | null, avatarUrl: p.avatar_url as string | null },
      ]));
      const notesMap = new Map((notesRes.data ?? []).map(n => [n.player_user_id as string, n.notes as string | null]));

      const studentMap = new Map<string, CoachStudent>();
      rows.forEach(r => {
        const pid = r.player_id as string;
        if (!studentMap.has(pid)) {
          const p = profileMap.get(pid);
          studentMap.set(pid, {
            playerId:       pid,
            playerName:     p?.fullName ?? null,
            avatarUrl:      p?.avatarUrl ?? null,
            lessonCount:    0,
            completedCount: 0,
            noShowCount:    0,
            lastLessonDate: null,
            notes:          notesMap.get(pid) ?? null,
          });
        }
        const s = studentMap.get(pid)!;
        s.lessonCount += 1;
        if (r.status === 'completed') s.completedCount += 1;
        if (r.status === 'no_show') s.noShowCount += 1;
        const d = (r.confirmed_date ?? r.preferred_date) as string | null;
        if (d && (!s.lastLessonDate || d > s.lastLessonDate)) s.lastLessonDate = d;
      });

      const sorted = [...studentMap.values()].sort((a, b) =>
        (b.lastLessonDate ?? '').localeCompare(a.lastLessonDate ?? ''),
      );

      setStudents(sorted);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [tickState]);

  async function saveNotes(playerId: string, notes: string): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 'Not authenticated';

    const { error } = await supabase
      .from('coach_student_notes')
      .upsert(
        { coach_user_id: user.id, player_user_id: playerId, notes, updated_at: new Date().toISOString() },
        { onConflict: 'coach_user_id,player_user_id' },
      );
    if (error) return error.message;
    refresh();
    return null;
  }

  return { students, loading, refresh, saveNotes };
}
