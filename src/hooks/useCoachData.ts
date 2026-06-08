import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export interface CoachWithProfile {
  id: string;
  userId: string;
  businessName: string | null;
  credentials: string | null;
  yearsExperience: number | null;
  sportsOffered: string[];
  homeBase: string | null;
  willingToTravel: boolean;
  hourlyRate: number | null;
  bio: string | null;
  profileImageUrl: string | null;
  levelsServed: string[];
  latitude: number | null;
  longitude: number | null;
  fullName: string | null;
  avatarUrl: string | null;
  avgRating: number | null;
  reviewCount: number;
  distanceKm: number | null;
}

export type DistanceFilterKm = 8 | 16 | 40 | 80 | null; // 5/10/25/50 mi | any
export type LevelFilter = 'beginner' | 'intermediate' | 'high_performance';

export interface CoachFilters {
  search: string;
  distanceKm: DistanceFilterKm;
  levels: LevelFilter[];
}

interface UseCoachDataResult {
  coaches: CoachWithProfile[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  favoriteIds: Set<string>;
  toggleFavorite: (coachUserId: string) => Promise<void>;
}

export function useCoachData(filters: CoachFilters): UseCoachDataResult {
  const [allCoaches, setAllCoaches] = useState<CoachWithProfile[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshKey = useRef(0);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    refreshKey.current += 1;
    setTick(t => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Parallel fetch: coaches + reviews + favorites + player profile (for distance)
      const [coachesRes, reviewsRes, favRes, playerProfileRes] = await Promise.all([
        supabase
          .from('coaches')
          .select('id, user_id, business_name, credentials, years_experience, sports_offered, home_base, willing_to_travel, hourly_rate, bio, profile_image_url, levels_served, latitude, longitude')
          .eq('is_active', true)
          .limit(50),
        supabase
          .from('coach_reviews')
          .select('coach_id, rating'),
        supabase
          .from('coach_favorites')
          .select('coach_id')
          .eq('player_id', user.id),
        supabase
          .from('profiles')
          .select('latitude, longitude')
          .eq('id', user.id)
          .single(),
      ]);

      if (cancelled) return;
      if (coachesRes.error) { setError(coachesRes.error.message); setLoading(false); return; }

      const rawCoaches = coachesRes.data ?? [];
      const userIds = rawCoaches.map(c => c.user_id);

      // Fetch profiles for coaches
      let profilesData: { id: string; full_name: string | null; avatar_url: string | null }[] = [];
      if (userIds.length > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds);
        if (!cancelled) profilesData = data ?? [];
      }

      if (cancelled) return;

      // Build rating map
      const ratingMap = new Map<string, { sum: number; count: number }>();
      for (const r of reviewsRes.data ?? []) {
        const key = r.coach_id as string;
        const cur = ratingMap.get(key) ?? { sum: 0, count: 0 };
        ratingMap.set(key, { sum: cur.sum + (r.rating as number), count: cur.count + 1 });
      }

      // Build profile map
      const profileMap = new Map(profilesData.map(p => [p.id, p]));

      // Build favorites set
      const favSet = new Set<string>((favRes.data ?? []).map(f => f.coach_id as string));
      setFavoriteIds(favSet);

      // Distance map: call RPC if player has coordinates
      const distanceMap = new Map<string, number>();
      const playerProfile = playerProfileRes.data;
      if (playerProfile?.latitude != null && playerProfile?.longitude != null) {
        const { data: nearData } = await supabase.rpc('get_coaches_near', {
          player_lat: playerProfile.latitude,
          player_lng: playerProfile.longitude,
          radius_km: 200,
        });
        if (!cancelled) {
          for (const row of nearData ?? []) {
            distanceMap.set(row.coach_user_id as string, row.distance_km as number);
          }
        }
      }

      if (cancelled) return;

      const merged: CoachWithProfile[] = rawCoaches.map(c => {
        const profile = profileMap.get(c.user_id);
        const rating = ratingMap.get(c.user_id);
        return {
          id: c.id as string,
          userId: c.user_id as string,
          businessName: c.business_name as string | null,
          credentials: c.credentials as string | null,
          yearsExperience: c.years_experience as number | null,
          sportsOffered: (c.sports_offered as string[]) ?? [],
          homeBase: c.home_base as string | null,
          willingToTravel: (c.willing_to_travel as boolean) ?? false,
          hourlyRate: c.hourly_rate != null ? Number(c.hourly_rate) : null,
          bio: c.bio as string | null,
          profileImageUrl: c.profile_image_url as string | null,
          levelsServed: (c.levels_served as string[]) ?? [],
          latitude: c.latitude as number | null,
          longitude: c.longitude as number | null,
          fullName: profile?.full_name ?? null,
          avatarUrl: profile?.avatar_url ?? null,
          avgRating: rating ? rating.sum / rating.count : null,
          reviewCount: rating?.count ?? 0,
          distanceKm: distanceMap.get(c.user_id) ?? null,
        };
      });

      setAllCoaches(merged);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [tick]);

  const toggleFavorite = useCallback(async (coachUserId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const isFav = favoriteIds.has(coachUserId);
    // Optimistic update
    setFavoriteIds(prev => {
      const next = new Set(prev);
      if (isFav) next.delete(coachUserId); else next.add(coachUserId);
      return next;
    });

    if (isFav) {
      const { error } = await supabase
        .from('coach_favorites')
        .delete()
        .eq('player_id', user.id)
        .eq('coach_id', coachUserId);
      if (error) {
        // Rollback
        setFavoriteIds(prev => { const next = new Set(prev); next.add(coachUserId); return next; });
      }
    } else {
      const { error } = await supabase
        .from('coach_favorites')
        .insert({ player_id: user.id, coach_id: coachUserId });
      if (error) {
        setFavoriteIds(prev => { const next = new Set(prev); next.delete(coachUserId); return next; });
      }
    }
  }, [favoriteIds]);

  // Apply client-side filters
  const coaches = allCoaches.filter(c => {
    // Search: name or home_base
    if (filters.search.trim()) {
      const q = filters.search.toLowerCase();
      const name = (c.businessName ?? c.fullName ?? '').toLowerCase();
      const base = (c.homeBase ?? '').toLowerCase();
      if (!name.includes(q) && !base.includes(q)) return false;
    }

    // Distance filter (only applied when coach has coordinates)
    if (filters.distanceKm != null && c.distanceKm != null) {
      if (c.distanceKm > filters.distanceKm) return false;
    }

    // Level filter
    if (filters.levels.length > 0) {
      const hasLevel = filters.levels.some(l => c.levelsServed.includes(l));
      if (!hasLevel) return false;
    }

    return true;
  });

  return { coaches, loading, error, refresh, favoriteIds, toggleFavorite };
}
