import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { sendNotificationEmail } from '@/lib/emailNotifications';

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
  preferredTimeStart: string | null;
  preferredTimeEnd: string | null;
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
  accept: (id: string, confirmedDate: string, confirmedStart: string | null, confirmedEnd: string | null) => Promise<string | null>;
  decline: (id: string, reason?: string) => Promise<string | null>;
  markComplete: (id: string) => Promise<string | null>;
  markNoShow: (id: string) => Promise<string | null>;
  cancelLesson: (id: string) => Promise<string | null>;
}

const PENDING_STATUSES  = ['pending'];
const UPCOMING_STATUSES = ['approved', 'confirmed'];
const PAST_STATUSES     = ['completed', 'declined', 'expired', 'cancelled', 'coach_cancelled', 'no_show'];

// Returns the lesson start datetime for upcoming/past classification.
// For approved/confirmed lessons uses confirmed date+time if set, else preferred.
function lessonStartDt(r: CoachLessonRequest): Date {
  const d = r.confirmedDate ?? r.preferredDate;
  const t = r.confirmedTimeStart ?? r.preferredTimeStart;
  const raw = new Date(`${d}T${t ?? '00:00:00'}`);
  return isNaN(raw.getTime()) ? new Date(0) : raw;
}

// Returns the preferred start datetime for pending expiry classification.
// If no time is set, uses end-of-day so the request stays visible until the date passes.
function pendingStartDt(r: CoachLessonRequest): Date {
  const t = r.preferredTimeStart ?? '23:59:59';
  const raw = new Date(`${r.preferredDate}T${t}`);
  return isNaN(raw.getTime()) ? new Date(0) : raw;
}

export function useCoachRequests(): UseCoachRequestsResult {
  const [requests, setRequests] = useState<CoachLessonRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [tickState, setTickState] = useState(0);
  const tick = useRef(0);

  const refresh = useCallback(() => {
    tick.current += 1;
    setTickState(t => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data, error: fetchErr } = await supabase
        .from('lesson_requests')
        .select('id, player_id, lesson_type, duration_minutes, skill_level, preferred_date, preferred_dates, preferred_time_start, preferred_time_end, confirmed_date, confirmed_time_start, confirmed_time_end, location_preference, location_note, facility_name, notes, status, attendance_status, expires_at, created_at, responded_at')
        .eq('coach_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (cancelled) return;
      if (fetchErr) { setError(fetchErr.message); setLoading(false); return; }

      const rows = data ?? [];
      const playerIds = [...new Set(rows.map(r => r.player_id as string))];

      let playerMap = new Map<string, { fullName: string | null; avatarUrl: string | null }>();
      if (playerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', playerIds);
        if (!cancelled) {
          playerMap = new Map((profiles ?? []).map(p => [
            p.id as string,
            { fullName: p.full_name as string | null, avatarUrl: p.avatar_url as string | null },
          ]));
        }
      }

      if (cancelled) return;

      const merged: CoachLessonRequest[] = rows.map(r => {
        const p = playerMap.get(r.player_id as string);
        return {
          id:                r.id as string,
          playerId:          r.player_id as string,
          playerName:        p?.fullName ?? null,
          playerAvatarUrl:   p?.avatarUrl ?? null,
          lessonType:        r.lesson_type as string,
          durationMinutes:   r.duration_minutes as number | null,
          skillLevel:        r.skill_level as string,
          preferredDate:     r.preferred_date as string,
          preferredDates:    r.preferred_dates as string[] | null,
          preferredTimeStart: r.preferred_time_start as string | null,
          preferredTimeEnd:  r.preferred_time_end as string | null,
          confirmedDate:     r.confirmed_date as string | null,
          confirmedTimeStart: r.confirmed_time_start as string | null,
          confirmedTimeEnd:  r.confirmed_time_end as string | null,
          locationPreference: r.location_preference as string | null,
          locationNote:      r.location_note as string | null,
          facilityName:      r.facility_name as string | null,
          notes:             r.notes as string | null,
          status:            (r.status ?? 'pending') as string,
          attendanceStatus:  r.attendance_status as string | null,
          expiresAt:         r.expires_at as string | null,
          createdAt:         r.created_at as string | null,
          respondedAt:       r.responded_at as string | null,
        };
      });

      // Auto-expire pending requests whose preferred lesson time has passed.
      // Handles null preferred_time_start: treat as end-of-day (23:59:59).
      const now = new Date();
      const toExpire = merged.filter(r => {
        if (r.status !== 'pending') return false;
        const t = r.preferredTimeStart ?? '23:59:59';
        const lessonDt = new Date(`${r.preferredDate}T${t}`);
        return !isNaN(lessonDt.getTime()) && lessonDt < now;
      });

      if (toExpire.length > 0 && !cancelled) {
        const ids = toExpire.map(r => r.id);
        supabase
          .from('lesson_requests')
          .update({ status: 'expired', responded_at: new Date().toISOString() })
          .in('id', ids)
          .then(async ({ error: expErr }) => {
            if (expErr) return;
            const { data: { user: coachUser } } = await supabase.auth.getUser();
            if (!coachUser) return;
            for (const req of toExpire) {
              // Notify player
              sendNotificationEmail({
                type: 'lesson_expired',
                userId: req.playerId,
                coachName: undefined,
                lessonType: req.lessonType,
                date: req.preferredDate,
                startTime: req.preferredTimeStart ?? undefined,
                endTime: req.preferredTimeEnd ?? undefined,
              });
              // Notify coach
              sendNotificationEmail({
                type: 'lesson_expired_coach',
                userId: coachUser.id,
                playerId: req.playerId,
                lessonType: req.lessonType,
                date: req.preferredDate,
                startTime: req.preferredTimeStart ?? undefined,
                endTime: req.preferredTimeEnd ?? undefined,
              });
            }
          });
        // Update local state immediately so expired rows move to "past"
        for (const req of toExpire) {
          req.status = 'expired';
        }
      }

      setRequests(merged);
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel(`coach-requests-rt-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lesson_requests' }, () => {
        if (!cancelled) load();
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [tickState]);

  async function accept(id: string, confirmedDate: string, confirmedStart: string | null, confirmedEnd: string | null): Promise<string | null> {
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

    // Notify the player — fire and forget
    void (async () => {
      const [{ data: lesson }, { data: auth }] = await Promise.all([
        supabase.from('lesson_requests').select('player_id, lesson_type').eq('id', id).single(),
        supabase.auth.getUser(),
      ]);
      if (!lesson) return;
      const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', auth.user?.id ?? '').single();
      sendNotificationEmail({
        type: 'lesson_confirmation',
        userId: (lesson as any).player_id,
        coachName: (prof as any)?.full_name ?? 'Your Coach',
        lessonType: (lesson as any).lesson_type,
        date: confirmedDate,
        startTime: confirmedStart ?? undefined,
        endTime: confirmedEnd ?? undefined,
      });
    })();

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

    // Notify the player — fire and forget
    void (async () => {
      const [{ data: lesson }, { data: auth }] = await Promise.all([
        supabase.from('lesson_requests').select('player_id, lesson_type, preferred_date').eq('id', id).single(),
        supabase.auth.getUser(),
      ]);
      if (!lesson) return;
      const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', auth.user?.id ?? '').single();
      sendNotificationEmail({
        type: 'lesson_declined',
        userId: (lesson as any).player_id,
        coachName: (prof as any)?.full_name ?? 'Your Coach',
        lessonType: (lesson as any).lesson_type,
        date: (lesson as any).preferred_date,
        cancellationReason: reason,
      });
    })();

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

  async function cancelLesson(id: string): Promise<string | null> {
    const { data, error: e } = await supabase
      .from('lesson_requests')
      .update({
        status: 'coach_cancelled',
        cancelled_by: 'coach',
        responded_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id');
    if (e) return e.message;
    // If RLS silently blocked the update, data will be empty
    if (!data || data.length === 0) return 'Could not cancel lesson — please try again.';

    // Notify the player — fire and forget
    void (async () => {
      const [{ data: lesson }, { data: auth }] = await Promise.all([
        supabase.from('lesson_requests').select('player_id, lesson_type, confirmed_date, preferred_date, confirmed_time_start, preferred_time_start, confirmed_time_end, preferred_time_end').eq('id', id).single(),
        supabase.auth.getUser(),
      ]);
      if (!lesson) return;
      const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', auth.user?.id ?? '').single();
      sendNotificationEmail({
        type: 'lesson_cancelled',
        userId: (lesson as any).player_id,
        coachName: (prof as any)?.full_name ?? 'Your Coach',
        lessonType: (lesson as any).lesson_type,
        date: (lesson as any).confirmed_date ?? (lesson as any).preferred_date,
        startTime: (lesson as any).confirmed_time_start ?? (lesson as any).preferred_time_start ?? undefined,
        endTime: (lesson as any).confirmed_time_end ?? (lesson as any).preferred_time_end ?? undefined,
      });
    })();

    refresh();
    return null;
  }

  // Filter at render time so the lists update immediately as time passes.
  const nowForFilter = new Date();
  const pending  = requests.filter(r =>
    PENDING_STATUSES.includes(r.status) && pendingStartDt(r) >= nowForFilter
  );
  const upcoming = requests.filter(r =>
    UPCOMING_STATUSES.includes(r.status) && lessonStartDt(r) > nowForFilter
  );
  const past = requests.filter(r =>
    PAST_STATUSES.includes(r.status) ||
    (UPCOMING_STATUSES.includes(r.status) && lessonStartDt(r) <= nowForFilter) ||
    (PENDING_STATUSES.includes(r.status) && pendingStartDt(r) < nowForFilter)
  );

  return { pending, upcoming, past, loading, error, refresh, accept, decline, markComplete, markNoShow, cancelLesson };
}
