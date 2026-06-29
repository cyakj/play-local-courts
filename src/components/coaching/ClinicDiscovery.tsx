import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { SlidersHorizontal } from 'lucide-react-native';
import { ClinicCard, ClinicCardSkeleton, type ClinicCardData } from '@/components/coaching/ClinicCard';
import {
  ClinicFiltersSheet,
  DEFAULT_CLINIC_FILTERS,
  clinicActiveFilterCount,
  type ClinicFilters,
} from '@/components/coaching/ClinicFiltersSheet';
import { Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import {
  fetchForecastForLocation,
  isWithinWeatherWindow,
  resolveLocationCoords,
  type WeatherForecast,
} from '@/hooks/useWeather';

// ─── date helpers ─────────────────────────────────────────────────────────────

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}
function isoOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── geo helpers ──────────────────────────────────────────────────────────────

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── NTRP filter ranges ───────────────────────────────────────────────────────

const NTRP_RANGES: Record<string, [number, number]> = {
  '2.0-2.5': [2.0, 2.5],
  '3.0-3.5': [3.0, 3.5],
  '4.0-4.5': [4.0, 4.5],
  '5.0+':    [5.0, 99],
};

// ─── main component ───────────────────────────────────────────────────────────

export function ClinicDiscovery() {
  const { theme } = useTheme();
  const [raw, setRaw]             = useState<ClinicCardData[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [filters, setFilters]     = useState<ClinicFilters>(DEFAULT_CLINIC_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);

  // weather: keyed by location string → forecast map (date → WeatherData)
  const [weatherCache, setWeatherCache] = useState<Map<string, WeatherForecast>>(new Map());
  const weatherAbort = useRef<AbortController | null>(null);

  // user coordinates for distance
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  // ─── user location ──────────────────────────────────────────────────────────
  useEffect(() => {
    Location.requestForegroundPermissionsAsync()
      .then(({ status }) => {
        if (status !== 'granted') return null;
        return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      })
      .then(pos => {
        if (pos) setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      })
      .catch(() => {});
  }, []);

  // ─── data load ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: rows, error: err } = await (supabase as any)
        .from('coach_clinics')
        .select(
          'id, coach_id, name, date, start_time, duration_minutes, location, ' +
          'skill_min, skill_max, age_group, max_players',
        )
        .eq('status', 'published')
        .gte('date', isoToday())
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (err) throw err;
      const clinics: any[] = rows ?? [];
      if (clinics.length === 0) { setRaw([]); return; }

      const coachIds = [...new Set(clinics.map((c: any) => c.coach_id as string))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', coachIds);
      const nameMap = new Map<string, string>(
        (profiles ?? []).map((p: any) => [p.id as string, (p.full_name as string | null) ?? 'Coach']),
      );

      const clinicIds = clinics.map((c: any) => c.id as string);
      const { data: counts } = await (supabase as any).rpc('clinic_enrollment_counts', { clinic_ids: clinicIds });
      const countMap = new Map<string, number>(
        ((counts ?? []) as any[]).map((r: any) => [r.clinic_id as string, r.enrolled_count as number]),
      );

      setRaw(
        clinics.map((c: any): ClinicCardData => ({
          id:              c.id,
          name:            c.name,
          coachName:       nameMap.get(c.coach_id) ?? 'Coach',
          date:            c.date,
          startTime:       c.start_time,
          durationMinutes: c.duration_minutes,
          location:        c.location,
          skillMin:        c.skill_min != null ? Number(c.skill_min) : null,
          skillMax:        c.skill_max != null ? Number(c.skill_max) : null,
          ageGroup:        c.age_group,
          maxPlayers:      c.max_players,
          enrolledCount:   countMap.get(c.id) ?? 0,
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load clinics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // ─── weather fetch when raw list changes ────────────────────────────────────
  useEffect(() => {
    if (weatherAbort.current) weatherAbort.current.abort();
    const controller = new AbortController();
    weatherAbort.current = controller;

    const uniqueLocs = [
      ...new Set(raw.filter(c => isWithinWeatherWindow(c.date)).map(c => c.location)),
    ];
    if (uniqueLocs.length === 0) return;

    (async () => {
      const newCache = new Map<string, WeatherForecast>();
      for (const loc of uniqueLocs) {
        if (controller.signal.aborted) break;
        const forecast = await fetchForecastForLocation(loc, controller.signal);
        if (forecast) newCache.set(loc, forecast);
      }
      if (!controller.signal.aborted) setWeatherCache(newCache);
    })();

    return () => controller.abort();
  }, [raw]);

  // ─── filtered list ───────────────────────────────────────────────────────────
  const filtered = useMemo((): ClinicCardData[] => {
    let list = raw;

    // Date
    switch (filters.dateMode) {
      case 'today':
        list = list.filter(c => c.date === isoToday());
        break;
      case 'tomorrow':
        list = list.filter(c => c.date === isoOffset(1));
        break;
      case 'other':
        if (filters.otherDate) {
          list = list.filter(c => c.date === filters.otherDate);
        }
        break;
    }

    // Age group
    if (filters.ageGroup !== 'all') {
      list = list.filter(c => c.ageGroup === filters.ageGroup || c.ageGroup === 'all');
    }

    // Spots only
    if (filters.spotsOnly) {
      list = list.filter(c => c.enrolledCount < c.maxPlayers);
    }

    // NTRP level
    if (filters.ntrpPreset !== 'any') {
      const [lo, hi] = NTRP_RANGES[filters.ntrpPreset] ?? [0, 99];
      list = list.filter(c => {
        if (c.skillMin == null && c.skillMax == null) return true;
        const cMin = c.skillMin ?? 0;
        const cMax = c.skillMax ?? 99;
        return cMin <= hi && cMax >= lo;
      });
    }

    // Time of day
    if (filters.timeOfDay !== 'any') {
      list = list.filter(c => {
        const h = parseInt(c.startTime.slice(0, 2), 10);
        switch (filters.timeOfDay) {
          case 'morning':   return h >= 6  && h < 12;
          case 'afternoon': return h >= 12 && h < 18;
          case 'evening':   return h >= 18;
          default: return true;
        }
      });
    }

    // Clinic type — safe fallback: include all if clinicType not set on item
    if (filters.clinicType !== 'all') {
      list = list.filter(c => {
        const ct = (c as any).clinicType as string | null | undefined;
        return !ct || ct === filters.clinicType;
      });
    }

    // Distance — requires user coords
    if (filters.distanceMax !== null && userCoords) {
      list = list.filter(c => {
        const coords = resolveLocationCoords(c.location);
        const d = haversine(userCoords.lat, userCoords.lng, coords.lat, coords.lng);
        return d <= (filters.distanceMax as number);
      });
    }

    // Attach computed fields (distance, weather handled at render)
    if (userCoords) {
      list = list.map(c => {
        const coords = resolveLocationCoords(c.location);
        return { ...c, distanceMiles: haversine(userCoords.lat, userCoords.lng, coords.lat, coords.lng) };
      });
    }

    return list;
  }, [raw, filters, userCoords]);

  const activeCount = clinicActiveFilterCount(filters);

  return (
    <View style={styles.root}>
      {/* Filter bar */}
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterBtn, activeCount > 0 && styles.filterBtnActive]}
          onPress={() => setSheetOpen(true)}
          activeOpacity={0.8}>
          <SlidersHorizontal
            size={14}
            strokeWidth={2}
            color={activeCount > 0 ? Colors.cyan : theme.textSecondary}
          />
          <Text style={[styles.filterBtnLabel, activeCount > 0 && styles.filterBtnLabelActive]}>
            {activeCount > 0 ? `Filters (${activeCount})` : 'Filters'}
          </Text>
        </TouchableOpacity>

        {!loading && (
          <Text style={[styles.countTxt, { color: theme.textMuted }]}>
            {filtered.length === 0
              ? 'No clinics'
              : `${filtered.length} clinic${filtered.length === 1 ? '' : 's'}`}
          </Text>
        )}
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorTxt}>Failed to load clinics.</Text>
          <TouchableOpacity onPress={load}>
            <Text style={styles.retryTxt}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.skeletons}>
          <ClinicCardSkeleton />
          <ClinicCardSkeleton />
          <ClinicCardSkeleton />
          <ActivityIndicator color={Colors.cyan} style={{ marginTop: 8 }} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const inWindow = isWithinWeatherWindow(item.date);
            const weather = inWindow
              ? (weatherCache.get(item.location)?.[item.date] ?? null)
              : null;
            return (
              <View style={styles.cardWrap}>
                <ClinicCard
                  clinic={item}
                  onPress={() => router.push(`/clinic/${item.id}` as any)}
                  weather={weather}
                />
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No clinics found</Text>
              <Text style={[styles.emptyBody, { color: theme.textMuted }]}>
                {activeCount > 0
                  ? 'Try adjusting your filters.'
                  : 'No upcoming clinics are available yet.'}
              </Text>
              {activeCount > 0 && (
                <TouchableOpacity
                  style={[styles.clearBtn, { borderColor: theme.border, backgroundColor: theme.cardBg }]}
                  onPress={() => setFilters(DEFAULT_CLINIC_FILTERS)}
                  activeOpacity={0.8}>
                  <Text style={[styles.clearBtnLabel, { color: theme.textSecondary }]}>Clear Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={load} tintColor={Colors.cyan} />
          }
        />
      )}

      <ClinicFiltersSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        filters={filters}
        onApply={setFilters}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.pagePx,
    paddingBottom: 10,
  },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.chip, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: Colors.cardBg,
  },
  filterBtnActive: {
    backgroundColor: 'rgba(45,224,255,0.08)',
    borderColor: 'rgba(45,224,255,0.35)',
  },
  filterBtnLabel: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.label,
    color: Colors.fg2,
  },
  filterBtnLabelActive: { color: Colors.cyan },
  countTxt: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.label,
    marginLeft: 'auto' as any,
  },
  skeletons: {
    paddingHorizontal: Spacing.pagePx,
    gap: 16,
    marginTop: 4,
  },
  errorBanner: {
    margin: Spacing.pagePx,
    backgroundColor: 'rgba(255,92,107,0.10)',
    borderRadius: Radius.sm, borderWidth: 1,
    borderColor: 'rgba(255,92,107,0.25)',
    padding: 14, flexDirection: 'row',
    alignItems: 'center', gap: 10,
  },
  errorTxt: {
    flex: 1, fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.label, color: Colors.negative,
  },
  retryTxt: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.label, color: Colors.negative,
  },
  cardWrap: { paddingHorizontal: Spacing.pagePx },
  listContent: {
    gap: 16, paddingBottom: 100,
    maxWidth: MaxWidth, width: '100%', alignSelf: 'center',
  },
  empty: { paddingHorizontal: Spacing.pagePx, paddingTop: 60, alignItems: 'center', gap: 12 },
  emptyTitle: {
    fontFamily: FontFamily.spaceGroteskBold,
    fontSize: FontSize.sectionTitle,
  },
  emptyBody: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.body, textAlign: 'center',
  },
  clearBtn: {
    marginTop: 4, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: Radius.sm, borderWidth: 1,
  },
  clearBtnLabel: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.label,
  },
});
