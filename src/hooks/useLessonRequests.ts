import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export interface LessonRequest {
  id: string;
  coachId: string;
  coachName: string | null;
  coachAvatarUrl: string | null;
  coachBusinessName: string | null;
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
  status: string;
  attendanceStatus: string | null;
  reviewEligibleAt: string | null;
  expiresAt: string | null;
  location: string | null;
  notes: string | null;
  createdAt: string | null;
}

interface UseLessonRequestsResult {
  requests: LessonRequest[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useLessonRequests(): UseLessonRequestsResult {
  const [requests, setRequests] = useState<LessonRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tick = useRef(0);
  const [tickState, setTickState] = useState(0);

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
        .select('id, coach_id, lesson_type, duration_minutes, skill_level, preferred_date, preferred_dates, preferred_time_start, preferred_time_end, confirmed_date, confirmed_time_start, confirmed_time_end, status, attendance_status, review_eligible_at, expires_at, location, notes, created_at')
        .eq('player_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (cancelled) return;

      if (fetchErr) {
        setError(fetchErr.message);
        setLoading(false);
        return;
      }

      const rows = data ?? [];
      const coachIds = [...new Set(rows.map(r => r.coach_id as string))];

      // Fetch coach rows + profiles
      let coachProfiles: { userId: string; businessName: string | null; fullName: string | null; avatarUrl: string | null }[] = [];
      if (coachIds.length > 0) {
        const [coachesRes, profilesRes] = await Promise.all([
          supabase
            .from('coaches')
            .select('user_id, business_name')
            .in('user_id', coachIds),
          supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .in('id', coachIds),
        ]);

        if (!cancelled) {
          const businessMap = new Map((coachesRes.data ?? []).map(c => [c.user_id as string, c.business_name as string | null]));
          const profileMap  = new Map((profilesRes.data ?? []).map(p => [p.id as string, { fullName: p.full_name as string | null, avatarUrl: p.avatar_url as string | null }]));

          coachProfiles = coachIds.map(uid => ({
            userId:       uid,
            businessName: businessMap.get(uid) ?? null,
            fullName:     profileMap.get(uid)?.fullName ?? null,
            avatarUrl:    profileMap.get(uid)?.avatarUrl ?? null,
          }));
        }
      }

      if (cancelled) return;

      const profileMap = new Map(coachProfiles.map(p => [p.userId, p]));

      const merged: LessonRequest[] = rows.map(r => {
        const cp = profileMap.get(r.coach_id as string);
        return {
          id:                 r.id as string,
          coachId:            r.coach_id as string,
          coachName:          cp?.businessName ?? cp?.fullName ?? null,
          coachAvatarUrl:     cp?.avatarUrl ?? null,
          coachBusinessName:  cp?.businessName ?? null,
          lessonType:         r.lesson_type as string,
          durationMinutes:    r.duration_minutes as number | null,
          skillLevel:         r.skill_level as string,
          preferredDate:      r.preferred_date as string,
          preferredDates:     r.preferred_dates as string[] | null,
          preferredTimeStart: r.preferred_time_start as string,
          preferredTimeEnd:   r.preferred_time_end as string,
          confirmedDate:      r.confirmed_date as string | null,
          confirmedTimeStart: r.confirmed_time_start as string | null,
          confirmedTimeEnd:   r.confirmed_time_end as string | null,
          status:             r.status as string,
          attendanceStatus:   r.attendance_status as string | null,
          reviewEligibleAt:   r.review_eligible_at as string | null,
          expiresAt:          r.expires_at as string | null,
          location:           r.location as string | null,
          notes:              r.notes as string | null,
          createdAt:          r.created_at as string | null,
        };
      });

      setRequests(merged);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [tickState]);

  return { requests, loading, error, refresh };
}
