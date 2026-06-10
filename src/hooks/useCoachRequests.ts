import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export interface CoachLessonRequest {
  id: string;
  playerId: string;
  playerName: string | null;
  playerAvatarUrl: string | null;
  lessonType: string;
  durationMinutes: number | null;
  skillLevel: string;
  preferredDate: string;
  preferredDates: string[] | null;
  preferredTimeStart: string;
  preferredTimeEnd: string;
  confirmedDate: string | null;
  confirmedTimeStart: string | null;
  confirmedTimeEnd: string | null;
  locationPreference: string | null;
  locationNote: string | null;
  facilityName: string | null;
  notes: string | null;
  status: string;
  attendanceStatus: string | null;
  expiresAt: string | null;
  createdAt: string | null;
  respondedAt: string | null;
}

interface UseCoachRequestsResult {
  pending: CoachLessonRequest[];
  upcoming: CoachLessonRequest[];
  past: CoachLessonRequest[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  accept: (id: string, confirmedDate: string, confirmedStart: string, confirmedEnd: string) => Promise<string | null>;
  decline: (id: string, reason?: string) => Promise<string | null>;
  markComplete: (id: string) => Promise<string | null>;
  markNoShow: (id: string) => Promise<string | null>;
  cancelLesson: (id: string, reason?: string) => Promise<string | null>;
}

const PENDING_STATUSES  = ['pending'];
const UPCOMING_STATUSES = ['approved', 'confirmed'];
const PAST_STATUSES     = ['completed', 'declined', 'expired', 'cancelled', 'coach_cancelled', 'no_show'];

export function useCoachRequests(): UseCoachRequestsResult {
  const [requests, setRequests] = useState<CoachLessonRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [tickState, setTickState] = useState(0);
  const tick = useRef(0);
  const mounted = useRef(true);
  const channelName = useRef(
    `coach-requests-realtime-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  );

  const refresh = useCallback(() => {
    tick.current += 1;
    setTickState(t => t + 1);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!mounted.current) return;
    if (!user) { setLoading(false); return; }

    const { data, error: fetchErr } = await supabase
      .from('lesson_requests')
      .select('id, player_id, lesson_type, duration_minutes, skill_level, preferred_date, preferred_dates, preferred_time_start, preferred_time_end, confirmed_date, confirmed_time_start, confirmed_time_end, location_preference, location_note, facility_name, notes, status, attendance_status, expires_at, created_at, responded_at')
      .eq('coach_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200);

    if (!mounted.current) return;
    if (fetchErr) {
      setError(fetchErr.message);
      setLoading(false);
      return;
    }

    const rows = data ?? [];
    const playerIds = [...new Set(rows.map(r => r.player_id as string))];

    let playerMap = new Map<string, { fullName: string | null; avatarUrl: string | null }>();
    if (playerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', playerIds);
      if (mounted.current) {
        playerMap = new Map((profiles ?? []).map(p => [
          p.id as string,
          { fullName: p.full_name as string | null, avatarUrl: p.avatar_url as string | null },
        ]));
      }
    }

    if (!mounted.current) return;

    setRequests(rows.map(r => {
      const p = playerMap.get(r.player_id as string);
      return {
        id: r.id as string,
        playerId: r.player_id as string,
        playerName: p?.fullName ?? null,
        playerAvatarUrl: p?.avatarUrl ?? null,
        lessonType: r.lesson_type as string,
        durationMinutes: r.duration_minutes as number | null,
        skillLevel: r.skill_level as string,
        preferredDate: r.preferred_date as string,
        preferredDates: r.preferred_dates as string[] | null,
        preferredTimeStart: r.preferred_time_start as string,
        preferredTimeEnd: r.preferred_time_end as string,
        confirmedDate: r.confirmed_date as string | null,
        confirmedTimeStart: r.confirmed_time_start as string | null,
        confirmedTimeEnd: r.confirmed_time_end as string | null,
        locationPreference: r.location_preference as string | null,
        locationNote: r.location_note as string | null,
        facilityName: r.facility_name as string | null,
        notes: r.notes as string | null,
        status: (r.status ?? 'pending') as string,
        attendanceStatus: r.attendance_status as string | null,
        expiresAt: r.expires_at as string | null,
        createdAt: r.created_at as string | null,
        respondedAt: r.responded_at as string | null,
      };
    }));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load, tickState]);

  useEffect(() => {
    mounted.current = true;
    const channel = supabase
      .channel(channelName.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lesson_requests' }, () => {
        refresh();
      })
      .subscribe();

    return () => {
      mounted.current = false;
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  async function accept(id: string, confirmedDate: string, confirmedStart: string, confirmedEnd: string): Promise<string | null> {
    const { error: e } = await supabase
      .from('lesson_requests')
      .update({
        status: 'approved',
        confirmed_date: confirmedDate,
        confirmed_time_start: confirmedStart,
        confirmed_time_end: confirmedEnd,
        responded_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (e) return e.message;
    refresh();
    return null;
  }

  async function decline(id: string, reason?: string): Promise<string | null> {
    const { error: e } = await supabase
      .from('lesson_requests')
      .update({
        status: 'declined',
        cancellation_reason: reason ?? null,
        responded_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (e) return e.message;
    refresh();
    return null;
  }

  async function markComplete(id: string): Promise<string | null> {
    const { error: e } = await supabase
      .from('lesson_requests')
      .update({
        status: 'completed',
        attendance_status: 'attended',
        review_eligible_at: new Date().toISOString(),
        attendance_marked_at: new Date().toISOString(),
        attendance_marked_by: 'coach',
      })
      .eq('id', id);
    if (e) return e.message;
    refresh();
    return null;
  }

  async function markNoShow(id: string): Promise<string | null> {
    const { error: e } = await supabase
      .from('lesson_requests')
      .update({
        status: 'no_show',
        attendance_status: 'no_show',
        attendance_marked_at: new Date().toISOString(),
        attendance_marked_by: 'coach',
      })
      .eq('id', id);
    if (e) return e.message;
    refresh();
    return null;
  }

  async function cancelLesson(id: string, reason?: string): Promise<string | null> {
    const { error: e } = await supabase
      .from('lesson_requests')
      .update({
        status: 'coach_cancelled',
        cancelled_by: 'coach',
        cancellation_reason: reason?.trim() || null,
      })
      .eq('id', id);
    if (e) return e.message;
    refresh();
    return null;
  }

  const pending  = requests.filter(r => PENDING_STATUSES.includes(r.status));
  const upcoming = requests.filter(r => UPCOMING_STATUSES.includes(r.status));
  const past     = requests.filter(r => PAST_STATUSES.includes(r.status));

  return { pending, upcoming, past, loading, error, refresh, accept, decline, markComplete, markNoShow, cancelLesson };
}
