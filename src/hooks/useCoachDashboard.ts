import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface CoachDashboardData {
  pendingCount: number;
  upcomingTodayCount: number;
  nextLesson: {
    playerName: string | null;
    lessonType: string;
    timeStart: string;
    timeEnd: string;
    date: string;
  } | null;
  lessonsThisMonth: number;
  activeStudents: number;
  estimatedRevenueThisMonth: number;
  avgResponseHours: number | null;
  avgRating: number | null;
  attendanceRate: number | null;
  completedCount: number;
  noShowCount: number;
}

export function useCoachDashboard() {
  const [data, setData]       = useState<CoachDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tickState, setTickState] = useState(0);

  const refresh = useCallback(() => setTickState(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const todayStr   = now.toISOString().slice(0, 10);
      const thirtyAgo  = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();

      const [
        pendingRes,
        todayRes,
        monthRes,
        activeStudentsRes,
        responseTimeRes,
        ratingRes,
        coachRes,
        attendanceRes,
      ] = await Promise.all([
        // Pending count
        supabase
          .from('lesson_requests')
          .select('id', { count: 'exact', head: true })
          .eq('coach_id', user.id)
          .eq('status', 'pending'),

        // Today's upcoming lessons
        supabase
          .from('lesson_requests')
          .select('id, player_id, lesson_type, confirmed_time_start, confirmed_time_end, preferred_time_start')
          .eq('coach_id', user.id)
          .in('status', ['approved', 'confirmed'])
          .eq('confirmed_date', todayStr)
          .order('confirmed_time_start', { ascending: true }),

        // This month's lessons (approved+confirmed+completed)
        supabase
          .from('lesson_requests')
          .select('id, duration_minutes, player_id')
          .eq('coach_id', user.id)
          .in('status', ['approved', 'confirmed', 'completed'])
          .gte('created_at', monthStart),

        // Active students last 30 days
        supabase
          .from('lesson_requests')
          .select('player_id')
          .eq('coach_id', user.id)
          .in('status', ['approved', 'confirmed', 'completed'])
          .gte('created_at', thirtyAgo),

        // Avg response time (last 30 days, responded requests)
        supabase
          .from('lesson_requests')
          .select('created_at, responded_at')
          .eq('coach_id', user.id)
          .not('responded_at', 'is', null)
          .gte('created_at', thirtyAgo),

        // Avg rating
        supabase
          .from('coach_reviews')
          .select('rating')
          .eq('coach_id', user.id),

        // Coach hourly_rate
        supabase
          .from('coaches')
          .select('hourly_rate')
          .eq('user_id', user.id)
          .single(),

        // Attendance (last 30 days)
        supabase
          .from('lesson_requests')
          .select('status, attendance_status')
          .eq('coach_id', user.id)
          .in('status', ['completed', 'no_show'])
          .gte('created_at', thirtyAgo),
      ]);

      if (cancelled) return;

      const pendingCount = pendingRes.count ?? 0;

      // Today's lessons + player names
      const todayRows = todayRes.data ?? [];
      const todayPlayerIds = [...new Set(todayRows.map(r => r.player_id as string))];
      let playerNameMap = new Map<string, string>();
      if (todayPlayerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', todayPlayerIds);
        if (!cancelled) {
          playerNameMap = new Map((profiles ?? []).map(p => [p.id as string, p.full_name as string ?? 'Player']));
        }
      }

      if (cancelled) return;

      const upcomingTodayCount = todayRows.length;
      const firstToday = todayRows[0] ?? null;
      const nextLesson = firstToday ? {
        playerName: playerNameMap.get(firstToday.player_id as string) ?? null,
        lessonType: firstToday.lesson_type as string,
        timeStart:  (firstToday.confirmed_time_start ?? firstToday.preferred_time_start) as string,
        timeEnd:    (firstToday.confirmed_time_end ?? '') as string,
        date:       todayStr,
      } : null;

      // Month stats
      const monthRows = monthRes.data ?? [];
      const lessonsThisMonth = monthRows.length;
      const activeStudents = new Set((activeStudentsRes.data ?? []).map(r => r.player_id as string)).size;

      const hourlyRate = (coachRes.data?.hourly_rate ?? 0) as number;
      const estimatedRevenueThisMonth = monthRows.reduce((sum, r) => {
        const hours = ((r.duration_minutes as number | null) ?? 60) / 60;
        return sum + hours * hourlyRate;
      }, 0);

      // Avg response time
      const responseRows = responseTimeRes.data ?? [];
      let avgResponseHours: number | null = null;
      if (responseRows.length > 0) {
        const totalHours = responseRows.reduce((sum, r) => {
          const created = new Date(r.created_at as string).getTime();
          const responded = new Date(r.responded_at as string).getTime();
          return sum + (responded - created) / 3600000;
        }, 0);
        avgResponseHours = Math.round((totalHours / responseRows.length) * 10) / 10;
      }

      // Avg rating
      const ratings = (ratingRes.data ?? []).map(r => r.rating as number);
      const avgRating = ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : null;

      // Attendance
      const attRows = attendanceRes.data ?? [];
      const completedCount = attRows.filter(r => r.status === 'completed').length;
      const noShowCount    = attRows.filter(r => r.status === 'no_show').length;
      const attTotal = completedCount + noShowCount;
      const attendanceRate = attTotal > 0 ? Math.round((completedCount / attTotal) * 100) : null;

      setData({
        pendingCount,
        upcomingTodayCount,
        nextLesson,
        lessonsThisMonth,
        activeStudents,
        estimatedRevenueThisMonth,
        avgResponseHours,
        avgRating,
        attendanceRate,
        completedCount,
        noShowCount,
      });
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel('coach-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lesson_requests' }, () => {
        if (!cancelled) load();
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [tickState]);

  return { data, loading, refresh };
}
