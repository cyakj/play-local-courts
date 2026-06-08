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
  availableDays: Set<number>; // 0=Sun … 6=Sat
}

export type DistanceFilterKm = 8 | 16 | 40 | 80 | null;
export type LevelFilter = 'beginner' | 'intermediate' | 'high_performance';
export type PriceRange = 'under75' | '75to100' | '100to150' | '150plus' | null;
export type AvailabilityFilter = 'today' | 'tomorrow' | 'this_week' | 'weekend' | null;

export interface CoachFilters {
  search:       string;
  distanceKm:   DistanceFilterKm;
  levels:       LevelFilter[];
  priceRange:   PriceRange;
  lessonTypes:  string[];       // multi-select — empty = no filter
  availability: AvailabilityFilter;
}

interface UseCoachDataResult {
  coaches: CoachWithProfile[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  favoriteIds: Set<string>;
  toggleFavorite: (coachUserId: string) => Promise<void>;
  playerHasCoordinates: boolean;
}

function getDaysForFilter(filter: AvailabilityFilter): Set<number> | null {
  if (!filter) return null;
  const now = new Date();
  const todayDow = now.getDay();

  if (filter === 'today')    return new Set([todayDow]);
  if (filter === 'tomorrow') return new Set([(todayDow + 1) % 7]);
  if (filter === 'weekend')  return new Set([0, 6]); // Sun, Sat

  if (filter === 'this_week') {
    const days = new Set<number>();
    for (let i = 0; i < 7; i++) {
      const d = (todayDow + i) % 7;
      days.add(d);
    }
    return days;
  }
  return null;
}

function matchesPriceRange(rate: number | null, range: PriceRange): boolean {
  if (!range) return true;
  if (rate == null) return true; // "Rate TBD" — include by default
  if (range === 'under75')  return rate < 75;
  if (range === '75to100')  return rate >= 75  && rate <= 100;
  if (range === '100to150') return rate >= 100 && rate <= 150;
  if (range === '150plus')  return rate > 150;
  return true;
}

export function useCoachData(filters: CoachFilters): UseCoachDataResult {
  const [allCoaches, setAllCoaches] = useState<CoachWithProfile[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playerHasCoordinates, setPlayerHasCoordinates] = useState(false);
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

      // Parallel: coaches + reviews + favorites + player profile
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
      const userIds = rawCoaches.map(c => c.user_id as string);

      // Parallel: profiles + coach_availability (days only)
      let profilesData: { id: string; full_name: string | null; avatar_url: string | null }[] = [];
      let availabilityData: { coach_id: string; day_of_week: number }[] = [];

      if (userIds.length > 0) {
        const [profilesRes, availRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .in('id', userIds),
          supabase
            .from('coach_availability')
            .select('coach_id, day_of_week')
            .in('coach_id', userIds),
        ]);
        if (!cancelled) {
          profilesData    = profilesRes.data ?? [];
          availabilityData = availRes.data ?? [];
        }
      }

      if (cancelled) return;

      // Build maps
      const ratingMap = new Map<string, { sum: number; count: number }>();
      for (const r of reviewsRes.data ?? []) {
        const key = r.coach_id as string;
        const cur = ratingMap.get(key) ?? { sum: 0, count: 0 };
        ratingMap.set(key, { sum: cur.sum + (r.rating as number), count: cur.count + 1 });
      }

      const profileMap = new Map(profilesData.map(p => [p.id, p]));

      // Build availability days map: coachUserId → Set<dow>
      const availMap = new Map<string, Set<number>>();
      for (const row of availabilityData) {
        const uid = row.coach_id as string;
        if (!availMap.has(uid)) availMap.set(uid, new Set());
        availMap.get(uid)!.add(row.day_of_week as number);
      }

      const favSet = new Set<string>((favRes.data ?? []).map(f => f.coach_id as string));
      setFavoriteIds(favSet);

      // Distance map via Haversine RPC
      const distanceMap = new Map<string, number>();
      const playerProfile = playerProfileRes.data;
      const hasCoords = playerProfile?.latitude != null && playerProfile?.longitude != null;
      setPlayerHasCoordinates(hasCoords);

      if (hasCoords) {
        const { data: nearData } = await supabase.rpc('get_coaches_near', {
          player_lat: playerProfile!.latitude,
          player_lng: playerProfile!.longitude,
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
        const uid     = c.user_id as string;
        const profile = profileMap.get(uid);
        const rating  = ratingMap.get(uid);
        return {
          id:              c.id as string,
          userId:          uid,
          businessName:    c.business_name as string | null,
          credentials:     c.credentials as string | null,
          yearsExperience: c.years_experience as number | null,
          sportsOffered:   (c.sports_offered as string[]) ?? [],
          homeBase:        c.home_base as string | null,
          willingToTravel: (c.willing_to_travel as boolean) ?? false,
          hourlyRate:      c.hourly_rate != null ? Number(c.hourly_rate) : null,
          bio:             c.bio as string | null,
          profileImageUrl: c.profile_image_url as string | null,
          levelsServed:    (c.levels_served as string[]) ?? [],
          latitude:        c.latitude as number | null,
          longitude:       c.longitude as number | null,
          fullName:        profile?.full_name ?? null,
          avatarUrl:       profile?.avatar_url ?? null,
          avgRating:       rating ? rating.sum / rating.count : null,
          reviewCount:     rating?.count ?? 0,
          distanceKm:      distanceMap.get(uid) ?? null,
          availableDays:   availMap.get(uid) ?? new Set(),
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
      if (error) setFavoriteIds(prev => { const n = new Set(prev); n.add(coachUserId); return n; });
    } else {
      const { error } = await supabase
        .from('coach_favorites')
        .insert({ player_id: user.id, coach_id: coachUserId });
      if (error) setFavoriteIds(prev => { const n = new Set(prev); n.delete(coachUserId); return n; });
    }
  }, [favoriteIds]);

  // ── Client-side filtering ──────────────────────────────────────────────────
  const coaches = allCoaches.filter(c => {
    // Search: name or home_base
    if (filters.search.trim()) {
      const q = filters.search.toLowerCase();
      const name = (c.businessName ?? c.fullName ?? '').toLowerCase();
      const base = (c.homeBase ?? '').toLowerCase();
      if (!name.includes(q) && !base.includes(q)) return false;
    }

    // Distance
    if (filters.distanceKm != null && c.distanceKm != null) {
      if (c.distanceKm > filters.distanceKm) return false;
    }

    // Levels
    if (filters.levels.length > 0) {
      if (!filters.levels.some(l => c.levelsServed.includes(l))) return false;
    }

    // Price range
    if (!matchesPriceRange(c.hourlyRate, filters.priceRange)) return false;

    // Lesson type — all coaches offer all types, so only filter when
    // the coach explicitly lists sports_offered that match, OR pass through
    // (since not all coaches populate this field yet)
    // → include all for now (no-op until coaches populate lesson_types_offered)

    // Availability
    if (filters.availability != null) {
      const requiredDays = getDaysForFilter(filters.availability);
      if (requiredDays) {
        const hasMatch = [...requiredDays].some(d => c.availableDays.has(d));
        if (!hasMatch) return false;
      }
    }

    return true;
  });

  return { coaches, loading, error, refresh, favoriteIds, toggleFavorite, playerHasCoordinates };
}
