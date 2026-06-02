import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  MapPin, Clock, Sun, Cloud, CloudRain, Zap, X, ChevronRight,
  CalendarDays, Check, ChevronDown, ChevronUp,
} from 'lucide-react-native';
import * as Location from 'expo-location';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing,
} from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

// ─── Constants ────────────────────────────────────────────────────────────────

const OUTDOOR_TYPES = new Set(['tennis', 'pickleball', 'basketball', 'pool', 'outdoor']);
const TENNIS_TYPES = new Set(['tennis']);

function isOutdoor(courtType: string): boolean {
  return OUTDOOR_TYPES.has(courtType.toLowerCase());
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Court {
  id: string;
  name: string;
  court_type: string;
  hoa_id: string;
}

interface TodayBooking {
  court_id: string;
  start_time: string;
  end_time: string;
  user_id?: string;
}

interface MaintenanceBlock {
  start_time: string;
  end_time: string;
  description: string | null;
}

interface UserBooking {
  id: string;
  court_id: string;
  date: string;
  start_time: string;
  end_time: string;
  courts: { name: string } | null;
}

interface AmenityRules {
  booking_start_time: string | null;
  booking_end_time: string | null;
  singles_duration_minutes: number | null;
  doubles_duration_minutes: number | null;
  advance_booking_days: number | null;
  min_cancellation_hours: number | null;
}

interface CourtStatus {
  status: 'open' | 'soon' | 'booked';
  statusText: string;
  detailText: string;
}

interface WeatherData {
  tempF: number;
  rainPct: number;
  weatherCode: number;
  hourlyTemp: number[];  // 5 days × 24h = 120 values
  hourlyRain: number[];  // same
}

type PlayabilityLevel = 'prime' | 'good' | 'caution' | 'rain' | 'storm';

interface Playability {
  level: PlayabilityLevel;
  verdict: string;
  conditions: string;
  accentColor: string;
  icon: 'sun' | 'cloud' | 'rain' | 'storm';
}

type ActiveTab = 'tennis' | 'amenities';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function getEndTime(start: string, durationMins: number): string {
  const [h, m] = start.split(':').map(Number);
  const endDec = h + m / 60 + durationMins / 60;
  const endH = Math.floor(endDec);
  const endM = Math.round((endDec % 1) * 60);
  return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
}

function formatDateLabel(date: Date, now: Date): string {
  if (date.toDateString() === now.toDateString()) return 'Today';
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getHourlyIndex(selectedDate: Date, hour: number, now: Date): number {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const selStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
  const dayDiff = Math.round((selStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, dayDiff * 24 + hour);
}

function getSlotWeatherLabel(hour: number, selectedDate: Date, now: Date, weather: WeatherData | null): string | null {
  if (!weather || weather.hourlyTemp.length === 0) return null;
  const idx = getHourlyIndex(selectedDate, hour, now);
  if (idx >= weather.hourlyTemp.length) return null;
  const temp = Math.round(weather.hourlyTemp[idx] ?? 0);
  const rain = weather.hourlyRain[idx] ?? 0;
  if (rain >= 70) return `${temp}°F · Rain`;
  if (rain >= 40) return `${temp}°F · Rain Risk`;
  if (rain >= 20) return `${temp}°F · Low Rain`;
  if (temp >= 95) return `${temp}°F · Extreme Heat`;
  if (temp >= 85) return `${temp}°F · Warm`;
  return `${temp}°F · Clear`;
}

function getAllowedBookingDates(rule: AmenityRules | null, referenceDate: Date, minDays = 1): Date[] {
  const maxDays = Math.max(minDays, rule?.advance_booking_days ?? 7);
  const limit = Math.min(maxDays, 14);
  const dates: Date[] = [];
  for (let i = 0; i < limit; i++) {
    const d = new Date(referenceDate);
    d.setDate(referenceDate.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function computeCourtStatus(courtId: string, now: Date, bookingsByDate: Record<string, TodayBooking[]>): CourtStatus {
  const dateStr = now.toISOString().split('T')[0];
  const bookings = (bookingsByDate[dateStr] ?? []).filter(b => b.court_id === courtId);
  const nowStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:00`;

  const active = bookings.find(b => b.start_time <= nowStr && b.end_time > nowStr);
  if (active) {
    let freeAt = active.end_time;
    let changed = true;
    while (changed) {
      changed = false;
      for (const b of bookings) {
        if (b.start_time <= freeAt && b.end_time > freeAt) { freeAt = b.end_time; changed = true; }
      }
    }
    return { status: 'booked', statusText: 'BOOKED', detailText: `Opens ${formatTime(freeAt)}` };
  }

  const next = bookings.filter(b => b.start_time > nowStr).sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
  if (next) {
    const [nh, nm] = next.start_time.split(':').map(Number);
    const minsUntil = (nh * 60 + nm) - (now.getHours() * 60 + now.getMinutes());
    if (minsUntil <= 30) return { status: 'soon', statusText: 'OPEN', detailText: `Booked at ${formatTime(next.start_time)}` };
    return { status: 'open', statusText: 'OPEN NOW', detailText: `Available until ${formatTime(next.start_time)}` };
  }
  return { status: 'open', statusText: 'OPEN NOW', detailText: 'Available all day' };
}

function getPlayability(data: WeatherData, hour?: number, selectedDate?: Date, now?: Date): Playability {
  let tempF = data.tempF;
  let rainPct = data.rainPct;
  let weatherCode = data.weatherCode;

  if (hour !== undefined && selectedDate && now && data.hourlyTemp.length > 0) {
    const idx = getHourlyIndex(selectedDate, hour, now);
    if (idx < data.hourlyTemp.length) {
      tempF = Math.round(data.hourlyTemp[idx]);
      rainPct = data.hourlyRain[idx] ?? data.rainPct;
      weatherCode = 0;
      if (rainPct >= 60) weatherCode = 61;
      else if (rainPct >= 40) weatherCode = 51;
    }
  }

  if (weatherCode >= 95) return { level: 'storm', verdict: 'Postpone Play', conditions: `${tempF}°F · Storm`, accentColor: Colors.negative, icon: 'storm' };
  if (weatherCode >= 51 || rainPct >= 60) return { level: 'rain', verdict: 'Outdoor Play Not Recommended', conditions: `${tempF}°F · ${rainPct}% Rain`, accentColor: Colors.negative, icon: 'rain' };
  if (weatherCode >= 45 || rainPct >= 40) return { level: 'caution', verdict: 'Playable with Caution', conditions: `${tempF}°F · ${rainPct}% Rain Risk`, accentColor: Colors.volt, icon: 'cloud' };
  if (weatherCode === 3 || rainPct >= 20) return { level: 'good', verdict: 'Good Conditions', conditions: `${tempF}°F · ${rainPct}% Rain`, accentColor: Colors.fg2, icon: 'cloud' };
  return { level: 'prime', verdict: 'Prime Playing Conditions', conditions: `${tempF}°F · ${rainPct}% Rain`, accentColor: Colors.cyan, icon: 'sun' };
}

async function fetchWeather(lat: number, lon: number): Promise<WeatherData | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode&hourly=precipitation_probability,temperature_2m&temperature_unit=fahrenheit&timezone=auto&forecast_days=5`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const tempF = Math.round(json.current?.temperature_2m ?? 72);
    const weatherCode = json.current?.weathercode ?? 0;
    const hourlyRain: number[] = json.hourly?.precipitation_probability ?? [];
    const hourlyTempRaw: number[] = json.hourly?.temperature_2m ?? [];
    const hourlyTemp = hourlyTempRaw.map((t: number) => Math.round(t));
    const nowHour = new Date().getHours();
    const next3 = hourlyRain.slice(nowHour, nowHour + 3);
    const rainPct = next3.length > 0 ? Math.round(next3.reduce((a: number, b: number) => a + b, 0) / next3.length) : 0;
    return { tempF, rainPct, weatherCode, hourlyTemp, hourlyRain };
  } catch { return null; }
}

function WeatherIcon({ type, color, size }: { type: 'sun' | 'cloud' | 'rain' | 'storm'; color: string; size: number }) {
  if (type === 'sun') return <Sun color={color} size={size} strokeWidth={1.5} />;
  if (type === 'rain') return <CloudRain color={color} size={size} strokeWidth={1.5} />;
  if (type === 'storm') return <Zap color={color} size={size} strokeWidth={1.5} />;
  return <Cloud color={color} size={size} strokeWidth={1.5} />;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CourtsScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const insets = useSafeAreaInsets();
  const now = useMemo(() => new Date(), []);

  // ── Core state ──────────────────────────────────────────────────────────────
  const [userId, setUserId] = useState('');
  const [courts, setCourts] = useState<Court[]>([]);
  const [bookingsByDate, setBookingsByDate] = useState<Record<string, TodayBooking[]>>({});
  const [userBookings, setUserBookings] = useState<UserBooking[]>([]);
  const [courtsLoading, setCourtsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('tennis');

  // ── Booking sheet state ──────────────────────────────────────────────────────
  const [bookingSheet, setBookingSheet] = useState<{ courtId: string; courtName: string; courtType: string } | null>(null);
  const [sheetDate, setSheetDate] = useState<Date>(new Date());
  const [sheetRules, setSheetRules] = useState<AmenityRules | null>(null);
  const [sheetRulesLoading, setSheetRulesLoading] = useState(false);
  const [sheetPlayType, setSheetPlayType] = useState<'singles' | 'doubles'>('singles');
  const [sheetDurationOverride, setSheetDurationOverride] = useState<number | null>(null);
  const [sheetSelectedSlot, setSheetSelectedSlot] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // ── Schedule sheet state ──────────────────────────────────────────────────────
  const [scheduleSheet, setScheduleSheet] = useState<{ courtId: string; courtName: string; courtType: string } | null>(null);
  const [scheduleDate, setScheduleDate] = useState<Date>(new Date());
  const [maintenanceBlocks, setMaintenanceBlocks] = useState<MaintenanceBlock[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleRules, setScheduleRules] = useState<AmenityRules | null>(null);

  // ── Weather ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadWeather() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { setWeatherLoading(false); return; }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
        const data = await fetchWeather(loc.coords.latitude, loc.coords.longitude);
        setWeather(data);
      } catch { /* silently fail */ }
      finally { setWeatherLoading(false); }
    }
    loadWeather();
  }, []);

  // ── Load courts + bookings ──────────────────────────────────────────────────
  async function loadCourts() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) { setCourtsLoading(false); return; }
      setUserId(user.id);

      const { data: memberships } = await supabase.from('hoa_memberships').select('hoa_id').eq('user_id', user.id).eq('status', 'approved');
      const hoaIds = (memberships ?? []).map((m: { hoa_id: string }) => m.hoa_id);
      if (hoaIds.length === 0) { setCourts([]); setCourtsLoading(false); return; }

      const [courtsRes, userBookingsRes] = await Promise.all([
        supabase.from('courts').select('id, name, court_type, hoa_id').in('hoa_id', hoaIds),
        supabase.from('bookings').select('id, court_id, date, start_time, end_time, courts(name)').eq('user_id', user.id).gte('date', now.toISOString().split('T')[0]).neq('status', 'cancelled').order('date').order('start_time').limit(10),
      ]);

      const fetchedCourts: Court[] = courtsRes.data ?? [];
      setCourts(fetchedCourts);
      setUserBookings((userBookingsRes.data ?? []) as UserBooking[]);

      if (fetchedCourts.length > 0) {
        await fetchBookingsForDate(now.toISOString().split('T')[0], fetchedCourts.map(c => c.id));
      }
    } catch { /* silently fail */ }
    finally { setCourtsLoading(false); }
  }

  async function fetchBookingsForDate(dateStr: string, courtIds?: string[]) {
    const ids = courtIds ?? courts.map(c => c.id);
    if (ids.length === 0) return;
    const { data } = await supabase.from('bookings').select('court_id, start_time, end_time, user_id').in('court_id', ids).eq('date', dateStr).neq('status', 'cancelled');
    setBookingsByDate(prev => ({ ...prev, [dateStr]: (data ?? []) as TodayBooking[] }));
  }

  useEffect(() => { loadCourts(); }, []);
  useFocusEffect(useCallback(() => { loadCourts(); }, []));

  async function onRefresh() {
    setRefreshing(true);
    await loadCourts();
    setRefreshing(false);
  }

  // ── Booking sheet open ──────────────────────────────────────────────────────
  async function openBookingSheet(court: Court, preselectedSlot?: string) {
    const today = new Date();
    setSheetDate(today);
    setBookingSheet({ courtId: court.id, courtName: court.name, courtType: court.court_type });
    setSheetSelectedSlot(preselectedSlot ?? null);
    setSheetPlayType('singles');
    setSheetDurationOverride(null);
    setBookingSuccess(false);
    setSheetRules(null);
    setSheetRulesLoading(true);

    const dateStr = today.toISOString().split('T')[0];
    await Promise.all([
      fetchBookingsForDate(dateStr, [court.id]),
      (async () => {
        try {
          const { data } = await supabase.from('amenity_rules').select('booking_start_time, booking_end_time, singles_duration_minutes, doubles_duration_minutes, advance_booking_days, min_cancellation_hours').eq('amenity_id', court.id).maybeSingle();
          setSheetRules(data ?? null);
        } catch { setSheetRules(null); }
      })(),
    ]);
    setSheetRulesLoading(false);
  }

  async function onSheetDateChange(date: Date) {
    setSheetDate(date);
    setSheetSelectedSlot(null);
    const dateStr = date.toISOString().split('T')[0];
    if (!bookingsByDate[dateStr] && bookingSheet) {
      await fetchBookingsForDate(dateStr, [bookingSheet.courtId]);
    }
  }

  // ── Open schedule sheet ─────────────────────────────────────────────────────
  async function openScheduleSheet(court: Court) {
    const today = new Date();
    setScheduleDate(today);
    setScheduleSheet({ courtId: court.id, courtName: court.name, courtType: court.court_type });
    setMaintenanceBlocks([]);
    setScheduleRules(null);
    setScheduleLoading(true);
    try {
      const dateStr = today.toISOString().split('T')[0];
      await fetchBookingsForDate(dateStr, [court.id]);
      const maintRes = await supabase
        .from('court_maintenance')
        .select('start_time, end_time, description')
        .eq('court_id', court.id)
        .eq('date', dateStr);
      setMaintenanceBlocks((maintRes.data ?? []) as MaintenanceBlock[]);
      const rulesRes = await supabase
        .from('amenity_rules')
        .select('booking_start_time, booking_end_time, singles_duration_minutes, doubles_duration_minutes, advance_booking_days, min_cancellation_hours')
        .eq('amenity_id', court.id)
        .maybeSingle();
      setScheduleRules(rulesRes.data ?? null);
    } catch {
      // Silently fail — sheet will show empty blocks
    } finally {
      setScheduleLoading(false);
    }
  }

  async function onScheduleDateChange(date: Date) {
    if (!scheduleSheet) return;
    setScheduleDate(date);
    setScheduleLoading(true);
    try {
      const dateStr = date.toISOString().split('T')[0];
      await fetchBookingsForDate(dateStr, [scheduleSheet.courtId]);
      const maintRes = await supabase
        .from('court_maintenance')
        .select('start_time, end_time, description')
        .eq('court_id', scheduleSheet.courtId)
        .eq('date', dateStr);
      setMaintenanceBlocks((maintRes.data ?? []) as MaintenanceBlock[]);
    } catch {
      // keep existing blocks
    } finally {
      setScheduleLoading(false);
    }
  }

  // ── Duration: user-overridable, defaults from play type + rules ─────────────
  const sheetDuration = useMemo(() => {
    if (sheetDurationOverride !== null) return sheetDurationOverride;
    if (!sheetRules) return 60;
    return sheetPlayType === 'singles'
      ? (sheetRules.singles_duration_minutes ?? 60)
      : (sheetRules.doubles_duration_minutes ?? 90);
  }, [sheetRules, sheetPlayType, sheetDurationOverride]);

  const availableDurations = useMemo(() => {
    const max = sheetRules
      ? Math.max(sheetRules.singles_duration_minutes ?? 60, sheetRules.doubles_duration_minutes ?? 90)
      : 90;
    return [30, 60, 90].filter(d => d <= max);
  }, [sheetRules]);

  // ── Time slots — uses fresh Date() so past slots are always correct ─────────
  const sheetTimeSlots = useMemo(() => {
    if (!bookingSheet) return [];
    const freshNow = new Date();
    const dateStr = sheetDate.toISOString().split('T')[0];
    const courtBookings = (bookingsByDate[dateStr] ?? []).filter(b => b.court_id === bookingSheet.courtId);
    const startHour = sheetRules?.booking_start_time ? parseInt(sheetRules.booking_start_time.split(':')[0]) : 7;
    const endHour = sheetRules?.booking_end_time ? parseInt(sheetRules.booking_end_time.split(':')[0]) : 21;
    const isToday = sheetDate.toDateString() === freshNow.toDateString();
    const nowStr = `${freshNow.getHours().toString().padStart(2, '0')}:${freshNow.getMinutes().toString().padStart(2, '0')}:00`;
    const slots: string[] = [];
    for (let h = startHour; h < endHour; h++) {
      for (let m = 0; m < 60; m += 30) {
        const slotStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        const slotEnd = getEndTime(slotStr, sheetDuration);
        if (slotEnd > `${endHour.toString().padStart(2, '0')}:00`) continue;
        if (isToday && slotStr + ':00' <= nowStr) continue;
        const hasConflict = courtBookings.some(b => slotStr + ':00' < b.end_time && slotEnd + ':00' > b.start_time);
        if (!hasConflict) slots.push(slotStr);
      }
    }
    return slots;
  }, [bookingSheet, sheetDate, bookingsByDate, sheetDuration, sheetRules]);

  // ── Confirm booking ─────────────────────────────────────────────────────────
  async function handleConfirm() {
    if (!userId || !bookingSheet || !sheetSelectedSlot) return;
    setConfirming(true);
    const dateStr = sheetDate.toISOString().split('T')[0];
    const endTime = getEndTime(sheetSelectedSlot, sheetDuration);
    const { error } = await supabase.from('bookings').insert({
      court_id: bookingSheet.courtId, user_id: userId, date: dateStr,
      start_time: `${sheetSelectedSlot}:00`, end_time: `${endTime}:00`,
      play_type: sheetPlayType, status: 'confirmed',
    });
    setConfirming(false);
    if (!error) {
      setBookingSuccess(true);
      await fetchBookingsForDate(dateStr);
      await loadCourts();
      setTimeout(() => { setBookingSheet(null); setBookingSuccess(false); }, 1200);
    }
  }

  // ── Filtered courts by active tab ───────────────────────────────────────────
  const tennisCourts = useMemo(() => courts.filter(c => TENNIS_TYPES.has(c.court_type)), [courts]);
  const amenityCourts = useMemo(() => courts.filter(c => !TENNIS_TYPES.has(c.court_type)), [courts]);
  const visibleCourts = activeTab === 'tennis' ? tennisCourts : amenityCourts;

  // ── Court statuses ──────────────────────────────────────────────────────────
  const courtStatuses = useMemo(() => {
    const map: Record<string, CourtStatus> = {};
    for (const court of courts) { map[court.id] = computeCourtStatus(court.id, now, bookingsByDate); }
    return map;
  }, [courts, now, bookingsByDate]);

  const sortedCourts = useMemo(() => [...visibleCourts].sort((a, b) => {
    const order = { open: 0, soon: 1, booked: 2 };
    return (order[courtStatuses[a.id]?.status ?? 'booked'] ?? 2) - (order[courtStatuses[b.id]?.status ?? 'booked'] ?? 2);
  }), [visibleCourts, courtStatuses]);

  const openCount = useMemo(() => visibleCourts.filter(c => courtStatuses[c.id]?.status === 'open').length, [visibleCourts, courtStatuses]);

  const intelligenceLine = useMemo(() => {
    if (courtsLoading || visibleCourts.length === 0) return null;
    if (openCount > 0) return `${openCount} ${activeTab === 'tennis' ? 'court' : 'facilit'}${openCount > 1 ? (activeTab === 'tennis' ? 's' : 'ies') : (activeTab === 'tennis' ? '' : 'y')} open right now`;
    const first = sortedCourts[0];
    if (first && courtStatuses[first.id]) return `Next available: ${first.name} · ${courtStatuses[first.id].detailText}`;
    return null;
  }, [visibleCourts, openCount, sortedCourts, courtStatuses, courtsLoading, activeTab]);

  const todayUserBooking = useMemo(() => userBookings.find(b => b.date === now.toISOString().split('T')[0]) ?? null, [userBookings, now]);
  const upcomingCount = useMemo(() => userBookings.filter(b => b.date >= now.toISOString().split('T')[0]).length, [userBookings, now]);
  const playability = useMemo(() => weather ? getPlayability(weather) : null, [weather]);
  const showWeatherOnMain = activeTab === 'tennis';

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <View testID="courts-screen" style={styles.screen}>
      <Header variant="resident" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.cyan} />}
        showsVerticalScrollIndicator={false}>

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <View testID="courts-hero" style={styles.hero}>
          <Text style={styles.heroLabel}>COURTS</Text>
          <Text style={styles.heroTitle}>Find a Court</Text>
          {showWeatherOnMain && (
            <>
              <View style={styles.heroConditionsDivider} />
              {weatherLoading ? (
                <View testID="conditions-skeleton" style={styles.conditionsSkeleton} />
              ) : playability ? (
                <View testID="conditions-strip" style={styles.conditionsRow}>
                  <WeatherIcon type={playability.icon} color={playability.accentColor} size={14} />
                  <Text style={[styles.conditionsVerdict, { color: playability.accentColor }]}>{playability.verdict}</Text>
                  <Text style={styles.conditionsDetail}>· {playability.conditions}</Text>
                </View>
              ) : null}
            </>
          )}
        </View>

        {/* ── Tennis / Amenities Tab ────────────────────────────────────── */}
        <View testID="tab-control" style={styles.tabControl}>
          <TouchableOpacity
            testID="tab-tennis"
            style={[styles.tabBtn, activeTab === 'tennis' && styles.tabBtnActive]}
            onPress={() => setActiveTab('tennis')} activeOpacity={0.7}>
            <Text style={[styles.tabBtnText, activeTab === 'tennis' && styles.tabBtnTextActive]}>Tennis</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="tab-amenities"
            style={[styles.tabBtn, activeTab === 'amenities' && styles.tabBtnActive]}
            onPress={() => setActiveTab('amenities')} activeOpacity={0.7}>
            <Text style={[styles.tabBtnText, activeTab === 'amenities' && styles.tabBtnTextActive]}>Amenities</Text>
          </TouchableOpacity>
        </View>

        {/* ── Content ──────────────────────────────────────────────────── */}
        <View style={styles.contentWrap}>
          {courtsLoading ? (
            <View testID="intelligence-skeleton" style={styles.intelligenceSkeleton} />
          ) : intelligenceLine ? (
            <Text testID="intelligence-line" style={styles.intelligenceLine}>{intelligenceLine}</Text>
          ) : null}

          {/* Court cards */}
          {courtsLoading ? (
            <>{[0, 1, 2].map(i => <View key={i} testID="court-skeleton" style={styles.courtCardSkeleton} />)}</>
          ) : sortedCourts.length === 0 ? (
            <View testID="empty-no-courts" style={styles.emptyState}>
              <MapPin color={Colors.fg3} size={52} strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>{activeTab === 'tennis' ? 'No courts available' : 'No amenities available'}</Text>
              <Text style={styles.emptySubtitle}>Check back after your community adds {activeTab === 'tennis' ? 'courts' : 'amenities'}.</Text>
            </View>
          ) : openCount === 0 && !courtsLoading && sortedCourts.length > 0 ? (
            <>
              <View testID="empty-all-booked" style={styles.emptyState}>
                <Clock color={Colors.fg3} size={52} strokeWidth={1.5} />
                <Text style={styles.emptyTitle}>All {activeTab === 'tennis' ? 'courts' : 'facilities'} busy right now</Text>
                {sortedCourts[0] && courtStatuses[sortedCourts[0].id] && (
                  <Text style={styles.emptySubtitle}>{sortedCourts[0].name} · {courtStatuses[sortedCourts[0].id].detailText}</Text>
                )}
                {sortedCourts[0] && (
                  <TouchableOpacity testID="reserve-next-cta" style={styles.reserveBtn} onPress={() => openBookingSheet(sortedCourts[0])} activeOpacity={0.8}>
                    <Text style={styles.reserveBtnText}>Reserve Next Slot</Text>
                  </TouchableOpacity>
                )}
              </View>
              {sortedCourts.map(court => (
                <CourtCard key={court.id} court={court} status={courtStatuses[court.id]}
                  isMyBooking={todayUserBooking?.court_id === court.id ? todayUserBooking : null}
                  onBook={() => openBookingSheet(court)}
                  onSchedule={() => openScheduleSheet(court)}
                  onReport={() => router.push({ pathname: '/(resident)/report', params: { courtId: court.id, courtName: court.name, facilityType: court.court_type, returnTo: '/(resident)/courts' } } as any)} />
              ))}
            </>
          ) : (
            sortedCourts.map(court => (
              <CourtCard key={court.id} court={court} status={courtStatuses[court.id]}
                isMyBooking={todayUserBooking?.court_id === court.id ? todayUserBooking : null}
                onBook={() => openBookingSheet(court)}
                onSchedule={() => openScheduleSheet(court)}
                onReport={() => router.push({ pathname: '/(resident)/report', params: { courtId: court.id, courtName: court.name, facilityType: court.court_type, returnTo: '/(resident)/courts' } } as any)} />
            ))
          )}

          {!courtsLoading && userBookings.length > 0 && (
            <TouchableOpacity testID="upcoming-link" style={styles.upcomingCard} onPress={() => router.push('/my-reservations')} activeOpacity={0.8}>
              <View style={{ flex: 1 }}>
                <Text style={styles.upcomingCardEyebrow}>RESERVATIONS</Text>
                <Text style={styles.upcomingCardTitle}>
                  {`Upcoming Reservations${upcomingCount > 0 ? ` (${upcomingCount})` : ''}`}
                </Text>
              </View>
              <ChevronRight color={Colors.cyan} size={20} strokeWidth={1.5} />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* ── Booking Sheet ───────────────────────────────────────────────── */}
      {bookingSheet && (
        <BookingSheet
          courtName={bookingSheet.courtName}
          courtType={bookingSheet.courtType}
          now={now}
          sheetDate={sheetDate}
          onSheetDateChange={onSheetDateChange}
          playType={sheetPlayType}
          onPlayTypeChange={t => { setSheetPlayType(t); setSheetSelectedSlot(null); }}
          rules={sheetRules}
          rulesLoading={sheetRulesLoading}
          timeSlots={sheetTimeSlots}
          selectedSlot={sheetSelectedSlot}
          onSelectSlot={setSheetSelectedSlot}
          duration={sheetDuration}
          availableDurations={availableDurations}
          onDurationChange={(d) => { setSheetDurationOverride(d); setSheetSelectedSlot(null); }}
          weather={weather}
          confirming={confirming}
          success={bookingSuccess}
          onConfirm={handleConfirm}
          onClose={() => setBookingSheet(null)}
          insets={insets}
        />
      )}

      {/* ── Schedule Sheet ──────────────────────────────────────────────── */}
      {scheduleSheet && (
        <ScheduleSheet
          courtName={scheduleSheet.courtName}
          courtType={scheduleSheet.courtType}
          now={now}
          scheduleDate={scheduleDate}
          onDateChange={onScheduleDateChange}
          rules={scheduleRules}
          bookings={(bookingsByDate[scheduleDate.toISOString().split('T')[0]] ?? []).filter(b => b.court_id === scheduleSheet.courtId)}
          maintenance={maintenanceBlocks}
          loading={scheduleLoading}
          userId={userId}
          onBook={(slot) => { setScheduleSheet(null); openBookingSheet({ id: scheduleSheet.courtId, name: scheduleSheet.courtName, court_type: scheduleSheet.courtType, hoa_id: '' }, slot); }}
          onClose={() => setScheduleSheet(null)}
          insets={insets}
        />
      )}
    </View>
  );
}

// ─── CourtCard ────────────────────────────────────────────────────────────────

function CourtCard({ court, status, isMyBooking, onBook, onSchedule, onReport }: {
  court: Court; status: CourtStatus | undefined; isMyBooking: UserBooking | null;
  onBook: () => void; onSchedule: () => void; onReport: () => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const s = status ?? { status: 'booked' as const, statusText: 'CHECKING', detailText: '' };
  const isOpen = s.status === 'open';
  const isMine = !!isMyBooking;
  const borderColor = isMine ? Colors.volt : isOpen ? Colors.cyan : theme.border;

  return (
    <TouchableOpacity testID={`court-card-${court.id}`} style={[styles.courtCard, { borderLeftColor: borderColor }]} onPress={onBook} activeOpacity={0.8}>
      <View style={styles.courtCardTop}>
        <View style={styles.courtNameRow}>
          {isOpen && <View style={[styles.cyanDot, { backgroundColor: Colors.cyan }]} />}
          <Text style={styles.courtName}>{court.name}</Text>
        </View>
        <TouchableOpacity testID={`court-cta-${court.id}`} onPress={onBook} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.7}>
          <Text style={[styles.courtCta, { color: isOpen ? Colors.cyan : Colors.fg3 }]}>
            {isOpen ? 'Play Now →' : (s.detailText ? `${s.detailText} →` : 'Reserve →')}
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.courtStatusText}>
        {isMine ? `MY RESERVATION · ${formatTime(isMyBooking!.start_time)}–${formatTime(isMyBooking!.end_time)}` : s.statusText}
      </Text>
      {!isMine && s.detailText ? <Text style={styles.courtDetailText}>{s.detailText}</Text> : null}

      {/* Secondary actions */}
      <View style={styles.courtSecondaryDivider} />
      <View style={styles.courtSecondaryRow}>
        <TouchableOpacity testID={`view-schedule-${court.id}`} style={styles.secondaryAction} onPress={onSchedule} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
          <CalendarDays color={Colors.fg3} size={14} strokeWidth={1.5} />
          <Text style={styles.secondaryActionText}>View Schedule</Text>
        </TouchableOpacity>
        <TouchableOpacity testID={`report-issue-${court.id}`} style={styles.secondaryAction} onPress={onReport} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
          <Text style={styles.secondaryActionText}>Report Issue</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ─── BookingSheet ─────────────────────────────────────────────────────────────

const BookingSheet = memo(function BookingSheet({
  courtName, courtType, now, sheetDate, onSheetDateChange,
  playType, onPlayTypeChange, rules, rulesLoading,
  timeSlots, selectedSlot, onSelectSlot,
  duration, availableDurations, onDurationChange,
  weather, confirming, success, onConfirm, onClose, insets,
}: {
  courtName: string; courtType: string; now: Date;
  sheetDate: Date; onSheetDateChange: (d: Date) => void;
  playType: 'singles' | 'doubles'; onPlayTypeChange: (t: 'singles' | 'doubles') => void;
  rules: AmenityRules | null; rulesLoading: boolean;
  timeSlots: string[]; selectedSlot: string | null; onSelectSlot: (s: string | null) => void;
  duration: number; availableDurations: number[]; onDurationChange: (d: number) => void;
  weather: WeatherData | null;
  confirming: boolean; success: boolean; onConfirm: () => void; onClose: () => void;
  insets: { bottom: number };
}) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const outdoor = isOutdoor(courtType);
  const [showMoreDates, setShowMoreDates] = useState(false);

  // minDays=3 ensures Today + Tomorrow + "More Dates" always appear even if rules restrict booking window
  const allDateChips = useMemo(() => getAllowedBookingDates(rules, now, 3), [rules, now]);

  const primaryDates = allDateChips.slice(0, 2);
  const moreDates = allDateChips.slice(2);
  const selectedMoreDate = moreDates.find(d => d.toDateString() === sheetDate.toDateString()) ?? null;

  // Conditions banner: use 9am proxy for the selected date forecast
  const sheetPlayability = useMemo(() => {
    if (!weather || !outdoor) return null;
    return getPlayability(weather, 9, sheetDate, now);
  }, [weather, outdoor, sheetDate, now]);

  const sheetIsToday = sheetDate.toDateString() === new Date().toDateString();

  const confirmLabel = selectedSlot
    ? `Confirm · ${formatTime(selectedSlot)} → ${formatTime(getEndTime(selectedSlot, duration))}`
    : 'Select a time slot';

  function renderDateChip(date: Date, testId: string) {
    const isSelected = date.toDateString() === sheetDate.toDateString();
    return (
      <TouchableOpacity
        key={testId}
        testID={testId}
        style={[styles.sheetDateChip, isSelected && styles.sheetDateChipActive]}
        onPress={() => { onSheetDateChange(date); setShowMoreDates(false); }}
        activeOpacity={0.7}>
        <Text style={[styles.sheetDateChipText, isSelected && styles.sheetDateChipTextActive]}>
          {formatDateLabel(date, now)}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={styles.sheetBackdrop} onPress={onClose} />
        <View testID="booking-sheet" style={[styles.sheetContainer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View style={styles.sheetHandle} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetCourtName}>{courtName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.sheetCloseBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X color={Colors.fg3} size={20} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>

          {/* Date: Today · Tomorrow · More Dates ▼ */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sheetDateScroll} contentContainerStyle={styles.sheetDateContent} testID="sheet-date-scroll">
            {primaryDates.map((date, i) =>
              renderDateChip(date, i === 0 ? 'sheet-date-today' : 'sheet-date-1')
            )}

            {moreDates.length > 0 && !showMoreDates && (
              selectedMoreDate
                ? renderDateChip(selectedMoreDate, 'sheet-date-selected-more')
                : (
                  <TouchableOpacity
                    testID="sheet-date-more"
                    style={styles.sheetDateChip}
                    onPress={() => setShowMoreDates(true)}
                    activeOpacity={0.7}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={styles.sheetDateChipText}>More Dates</Text>
                      <ChevronDown color={Colors.fg3} size={12} strokeWidth={1.5} />
                    </View>
                  </TouchableOpacity>
                )
            )}

            {showMoreDates && moreDates.map((date, i) =>
              renderDateChip(date, `sheet-date-${i + 2}`)
            )}

            {showMoreDates && (
              <TouchableOpacity
                testID="sheet-date-less"
                style={styles.sheetDateChip}
                onPress={() => setShowMoreDates(false)}
                activeOpacity={0.7}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={styles.sheetDateChipText}>Less</Text>
                  <ChevronUp color={Colors.fg3} size={12} strokeWidth={1.5} />
                </View>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Conditions for selected date (outdoor only) */}
          {outdoor && sheetPlayability && (
            <View testID="sheet-conditions" style={styles.sheetConditionsRow}>
              <WeatherIcon type={sheetPlayability.icon} color={sheetPlayability.accentColor} size={13} />
              <Text style={[styles.sheetConditionsText, { color: sheetPlayability.accentColor }]}>{sheetPlayability.verdict}</Text>
              <Text style={styles.sheetConditionsDetail}>· {sheetPlayability.conditions}</Text>
            </View>
          )}

          {/* Play type */}
          <View style={styles.playTypeRow}>
            {(['singles', 'doubles'] as const).map(type => (
              <TouchableOpacity key={type} testID={`play-type-${type}`}
                style={[styles.playTypeChip, playType === type && styles.playTypeChipActive]}
                onPress={() => onPlayTypeChange(type)} activeOpacity={0.7}>
                <Text style={[styles.playTypeText, playType === type && styles.playTypeTextActive]}>
                  {type === 'singles' ? 'Singles' : 'Doubles'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Duration selector */}
          <View testID="duration-selector" style={styles.durationRow}>
            {availableDurations.map(d => (
              <TouchableOpacity
                key={d}
                testID={`duration-${d}`}
                style={[styles.durationChip, duration === d && styles.durationChipActive]}
                onPress={() => onDurationChange(d)}
                activeOpacity={0.7}>
                <Text style={[styles.durationChipText, duration === d && styles.durationChipTextActive]}>
                  {d} min
                </Text>
              </TouchableOpacity>
            ))}
            {availableDurations.length === 1 && (
              <Text style={styles.durationHint}>Fixed duration</Text>
            )}
          </View>

          {/* Vertical time slot list */}
          {rulesLoading ? (
            <ActivityIndicator color={Colors.cyan} style={{ marginVertical: 20 }} />
          ) : timeSlots.length === 0 ? (
            <View style={styles.noSlotsState} testID="no-slots-state">
              <Text style={styles.noSlotsText}>
                {sheetIsToday ? 'No remaining times today' : 'No available times for this date'}
              </Text>
            </View>
          ) : (
            <ScrollView testID="time-slots-scroll" style={styles.slotsScroll} showsVerticalScrollIndicator={false}>
              {timeSlots.map(slot => {
                const [h] = slot.split(':').map(Number);
                const weatherLabel = outdoor ? getSlotWeatherLabel(h, sheetDate, now, weather) : null;
                const isSelected = slot === selectedSlot;
                return (
                  <TouchableOpacity
                    key={slot}
                    testID={`slot-${slot}`}
                    style={[styles.slotRow, isSelected && styles.slotRowSelected]}
                    onPress={() => onSelectSlot(isSelected ? null : slot)}
                    activeOpacity={0.7}>
                    <Text style={[styles.slotRowTime, isSelected && styles.slotRowTimeSelected]}>
                      {formatTime(slot)}
                    </Text>
                    {weatherLabel ? (
                      <Text testID={`slot-weather-${slot}`} style={[styles.slotRowWeather, isSelected && styles.slotRowWeatherSelected]}>
                        {weatherLabel}
                      </Text>
                    ) : <View style={{ flex: 1 }} />}
                    <View style={[styles.slotRowSelectBtn, isSelected && styles.slotRowSelectBtnActive]}>
                      {isSelected
                        ? <Check color={Colors.cyan} size={14} strokeWidth={2} />
                        : <Text style={styles.slotRowSelectText}>Select</Text>
                      }
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <TouchableOpacity testID="confirm-booking-btn"
            style={[styles.confirmBtn, (!selectedSlot || confirming) && styles.confirmBtnDisabled, success && styles.confirmBtnSuccess]}
            onPress={onConfirm} disabled={!selectedSlot || confirming || success} activeOpacity={0.85}>
            {confirming ? <ActivityIndicator color={Colors.white} size="small" /> : (
              <Text style={styles.confirmBtnText}>{success ? '✓ Booked!' : confirmLabel}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
});

// ─── ScheduleSheet ────────────────────────────────────────────────────────────

function ScheduleSheet({ courtName, courtType, now, scheduleDate, onDateChange, rules, bookings, maintenance, loading, userId, onBook, onClose, insets }: {
  courtName: string; courtType: string; now: Date; scheduleDate: Date;
  onDateChange: (d: Date) => void; rules: AmenityRules | null;
  bookings: TodayBooking[]; maintenance: MaintenanceBlock[]; loading: boolean;
  userId: string; onBook: (slot: string) => void; onClose: () => void; insets: { bottom: number };
}) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const START_HOUR = 7;
  const END_HOUR = 21;
  const dateLabel = scheduleDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const [showMoreSchedDates, setShowMoreSchedDates] = useState(false);

  const schedDateChips = useMemo(() => getAllowedBookingDates(rules, now, 3), [rules, now]);
  const primarySchedDates = schedDateChips.slice(0, 2);
  const moreSchedDates = schedDateChips.slice(2);
  const selectedMoreSchedDate = moreSchedDates.find(d => d.toDateString() === scheduleDate.toDateString()) ?? null;

  const timeBlocks = useMemo(() => {
    const blocks: Array<{ slotStr: string; label: string; type: 'available' | 'booked' | 'mine' | 'maintenance' }> = [];
    for (let h = START_HOUR; h < END_HOUR; h++) {
      for (let m = 0; m < 60; m += 60) {
        const slotStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        const slotEnd = `${(h + 1).toString().padStart(2, '0')}:00`;
        const slotFull = slotStr + ':00';
        const slotEndFull = slotEnd + ':00';
        const isMaint = maintenance.some(mb => mb.start_time < slotEndFull && mb.end_time > slotFull);
        const isMine = userId ? bookings.some(b => b.start_time < slotEndFull && b.end_time > slotFull && b.user_id === userId) : false;
        const isBooked = bookings.some(b => b.start_time < slotEndFull && b.end_time > slotFull);
        blocks.push({
          slotStr,
          label: `${formatTime(slotStr)} – ${formatTime(slotEnd)}`,
          type: isMaint ? 'maintenance' : isMine ? 'mine' : isBooked ? 'booked' : 'available',
        });
      }
    }
    return blocks;
  }, [bookings, maintenance, userId]);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={styles.sheetBackdrop} onPress={onClose} />
        <View testID="schedule-sheet" style={[styles.sheetContainer, styles.scheduleSheetContainer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View style={styles.sheetHandle} />

          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetCourtName}>{courtName}</Text>
              <Text style={styles.sheetDateLabel}>{dateLabel}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.sheetCloseBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X color={Colors.fg3} size={20} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>

          {/* Date picker — same window as booking */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sheetDateScroll} contentContainerStyle={styles.sheetDateContent} testID="schedule-date-scroll">
            {primarySchedDates.map((date, i) => {
              const isSelected = date.toDateString() === scheduleDate.toDateString();
              return (
                <TouchableOpacity
                  key={i === 0 ? 'sched-today' : 'sched-1'}
                  testID={i === 0 ? 'sched-date-today' : 'sched-date-1'}
                  style={[styles.sheetDateChip, isSelected && styles.sheetDateChipActive]}
                  onPress={() => { onDateChange(date); setShowMoreSchedDates(false); }}
                  activeOpacity={0.7}>
                  <Text style={[styles.sheetDateChipText, isSelected && styles.sheetDateChipTextActive]}>
                    {formatDateLabel(date, now)}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {moreSchedDates.length > 0 && !showMoreSchedDates && (
              selectedMoreSchedDate ? (
                <TouchableOpacity
                  key="sched-selected-more"
                  testID="sched-date-selected-more"
                  style={[styles.sheetDateChip, styles.sheetDateChipActive]}
                  onPress={() => setShowMoreSchedDates(true)}
                  activeOpacity={0.7}>
                  <Text style={[styles.sheetDateChipText, styles.sheetDateChipTextActive]}>
                    {formatDateLabel(selectedMoreSchedDate, now)}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  testID="sched-date-more"
                  style={styles.sheetDateChip}
                  onPress={() => setShowMoreSchedDates(true)}
                  activeOpacity={0.7}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={styles.sheetDateChipText}>More Dates</Text>
                    <ChevronDown color={Colors.fg3} size={12} strokeWidth={1.5} />
                  </View>
                </TouchableOpacity>
              )
            )}
            {showMoreSchedDates && moreSchedDates.map((date, i) => {
              const isSelected = date.toDateString() === scheduleDate.toDateString();
              return (
                <TouchableOpacity
                  key={`sched-more-${i}`}
                  testID={`sched-date-${i + 2}`}
                  style={[styles.sheetDateChip, isSelected && styles.sheetDateChipActive]}
                  onPress={() => { onDateChange(date); setShowMoreSchedDates(false); }}
                  activeOpacity={0.7}>
                  <Text style={[styles.sheetDateChipText, isSelected && styles.sheetDateChipTextActive]}>
                    {formatDateLabel(date, now)}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {showMoreSchedDates && (
              <TouchableOpacity
                testID="sched-date-less"
                style={styles.sheetDateChip}
                onPress={() => setShowMoreSchedDates(false)}
                activeOpacity={0.7}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={styles.sheetDateChipText}>Less</Text>
                  <ChevronUp color={Colors.fg3} size={12} strokeWidth={1.5} />
                </View>
              </TouchableOpacity>
            )}
          </ScrollView>

          {loading ? (
            <ActivityIndicator color={Colors.cyan} style={{ marginVertical: 24 }} />
          ) : (
            <ScrollView testID="schedule-blocks" showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
              {timeBlocks.map((block, i) => {
                const isAvail = block.type === 'available';
                const isMaint = block.type === 'maintenance';
                const isMine = block.type === 'mine';
                const isBooked = block.type === 'booked';
                return (
                  <View key={i} testID={`schedule-block-${block.type}`}
                    style={[
                      styles.scheduleRow,
                      isAvail && styles.scheduleRowAvail,
                      isBooked && styles.scheduleRowBooked,
                      isMaint && styles.scheduleRowMaint,
                      isMine && styles.scheduleRowMine,
                    ]}>
                    <Text style={[
                      styles.scheduleRowLabel,
                      isAvail && styles.scheduleRowLabelAvail,
                      isMaint && styles.scheduleRowLabelMaint,
                      isMine && styles.scheduleRowLabelMine,
                    ]}>{block.label}</Text>
                    {isAvail ? (
                      <TouchableOpacity testID={`schedule-book-${block.slotStr}`} style={styles.scheduleBookBtn}
                        onPress={() => onBook(block.slotStr)} activeOpacity={0.7}>
                        <Text style={styles.scheduleBookBtnText}>Play Now →</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={[
                        styles.scheduleBlockStatus,
                        isMaint && { color: Colors.negative },
                        isMine && { color: Colors.volt },
                      ]}>{isMaint ? 'MAINTENANCE' : isMine ? 'MY RESERVATION' : 'RESERVED'}</Text>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* Legend — distinct colors */}
          <View testID="schedule-legend" style={styles.scheduleLegend}>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.cyan }]} /><Text style={styles.legendText}>Available</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.volt }]} /><Text style={styles.legendText}>My Reservation</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.borderStrong }]} /><Text style={styles.legendText}>Reserved</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.negative }]} /><Text style={styles.legendText}>Maintenance</Text></View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.pageBg },
  body: { paddingBottom: 108 },

  hero: { backgroundColor: theme.heroBg, paddingHorizontal: Spacing.pagePx, paddingTop: 8, paddingBottom: 20 },
  heroLabel: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.eyebrow, color: Colors.cyan, letterSpacing: 2.2, marginBottom: 4 },
  heroTitle: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 28, color: theme.textPrimary, lineHeight: 32, letterSpacing: -0.4 },
  heroConditionsDivider: { height: 1, backgroundColor: 'rgba(45,224,255,0.15)', marginVertical: 12 },
  conditionsSkeleton: { height: 14, width: 200, backgroundColor: theme.surface2, borderRadius: 7 },
  conditionsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  conditionsVerdict: { fontFamily: FontFamily.manropeSemiBold, fontSize: 13 },
  conditionsDetail: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.eyebrow, color: theme.textMuted, letterSpacing: 0.3 },

  tabControl: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: theme.pageBg },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: Colors.cyan },
  tabBtnText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 14, color: theme.textMuted },
  tabBtnTextActive: { color: Colors.cyan },

  contentWrap: { maxWidth: MaxWidth, width: '100%', alignSelf: 'center', paddingHorizontal: Spacing.pagePx, paddingTop: 16, gap: 12 },
  intelligenceSkeleton: { height: 14, width: 160, backgroundColor: theme.surface2, borderRadius: 7 },
  intelligenceLine: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.eyebrow, color: Colors.cyan, letterSpacing: 1.4 },

  courtCardSkeleton: { height: 104, backgroundColor: theme.surface2, borderRadius: Radius.card, borderLeftWidth: 3, borderLeftColor: theme.border },
  courtCard: { backgroundColor: theme.cardBg, borderRadius: Radius.card, padding: 20, borderWidth: 1, borderColor: theme.border, borderLeftWidth: 3, gap: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 3 },
  courtCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  courtNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  cyanDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  courtName: { fontFamily: FontFamily.spaceGroteskBold, fontSize: FontSize.cardTitle, color: theme.textPrimary, flex: 1 },
  courtCta: { fontFamily: FontFamily.manropeSemiBold, fontSize: 14 },
  courtStatusText: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.eyebrow, color: theme.textSecondary, letterSpacing: 1.2 },
  courtDetailText: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.eyebrow, color: theme.textMuted, letterSpacing: 0.4, marginTop: 2 },
  courtSecondaryDivider: { height: 1, backgroundColor: theme.border, marginTop: 10, marginBottom: 8 },
  courtSecondaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  secondaryAction: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 44, paddingHorizontal: 2 },
  secondaryActionText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 12, color: theme.textMuted },

  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyTitle: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 20, color: theme.textPrimary, marginTop: 8, textAlign: 'center' },
  emptySubtitle: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, color: theme.textMuted, textAlign: 'center', paddingHorizontal: 8 },
  reserveBtn: { backgroundColor: Colors.blue, borderRadius: Radius.button, paddingHorizontal: 24, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  reserveBtnText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label, color: Colors.white },

  upcomingCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.cardBg, borderRadius: Radius.card,
    paddingHorizontal: 20, paddingVertical: 16,
    borderWidth: 1, borderColor: 'rgba(45,224,255,0.25)',
    marginTop: 4,
  },
  upcomingCardEyebrow: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 10, color: Colors.cyan, letterSpacing: 1.4, marginBottom: 4 },
  upcomingCardTitle: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 18, color: theme.textPrimary, letterSpacing: -0.2 },

  // Sheets
  sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: theme.backdrop },
  sheetContainer: { backgroundColor: theme.sheetBg, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderTopWidth: 1, borderColor: theme.border, paddingHorizontal: Spacing.pagePx, paddingTop: 12, maxHeight: '85%' },
  scheduleSheetContainer: { maxHeight: '80%' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  sheetCourtName: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 20, color: theme.textPrimary },
  sheetDateLabel: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.eyebrow, color: theme.textMuted, letterSpacing: 0.8, marginTop: 3 },
  sheetCloseBtn: { width: 36, height: 36, backgroundColor: theme.surface2, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },

  // Date chips
  sheetDateScroll: { minHeight: 50, marginBottom: 8 },
  sheetDateContent: { gap: 8, alignItems: 'center', paddingVertical: 6 },
  sheetDateChip: { height: 40, alignSelf: 'center', paddingHorizontal: 12, borderRadius: Radius.pill, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface2, alignItems: 'center', justifyContent: 'center' },
  sheetDateChipActive: { backgroundColor: Colors.blue, borderColor: Colors.blue },
  sheetDateChipText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 13, color: theme.textSecondary },
  sheetDateChipTextActive: { color: Colors.white },

  sheetConditionsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: theme.surface2, borderRadius: Radius.sm },
  sheetConditionsText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 13 },
  sheetConditionsDetail: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.eyebrow, color: theme.textMuted, letterSpacing: 0.3 },

  // Play type
  playTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  playTypeChip: { height: 36, paddingHorizontal: 16, borderRadius: Radius.pill, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface2, alignItems: 'center', justifyContent: 'center' },
  playTypeChipActive: { backgroundColor: Colors.blue, borderColor: Colors.blue },
  playTypeText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 13, color: theme.textSecondary },
  playTypeTextActive: { color: Colors.white },

  // Duration selector
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  durationChip: { height: 36, paddingHorizontal: 14, borderRadius: Radius.pill, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface2, alignItems: 'center', justifyContent: 'center' },
  durationChipActive: { backgroundColor: 'rgba(45,224,255,0.12)', borderColor: Colors.cyan },
  durationChipText: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 12, color: theme.textSecondary, letterSpacing: 0.3 },
  durationChipTextActive: { color: Colors.cyan },
  durationHint: { fontFamily: FontFamily.manropeMedium, fontSize: 12, color: theme.textMuted, marginLeft: 4 },

  slotsScroll: { maxHeight: 240, marginBottom: 14 },

  // Vertical slot rows
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.sm,
    marginBottom: 4,
    backgroundColor: theme.surface2,
    borderWidth: 1,
    borderColor: theme.border,
  },
  slotRowSelected: {
    backgroundColor: 'rgba(45,224,255,0.10)',
    borderColor: Colors.cyan,
  },
  slotRowTime: {
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: 14,
    color: theme.textSecondary,
    letterSpacing: 0.3,
    minWidth: 72,
  },
  slotRowTimeSelected: { color: Colors.cyan },
  slotRowWeather: {
    flex: 1,
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: 12,
    color: theme.textMuted,
    letterSpacing: 0.2,
    paddingHorizontal: 8,
  },
  slotRowWeatherSelected: { color: 'rgba(45,224,255,0.7)' },
  slotRowSelectBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.xs,
    backgroundColor: theme.surface2,
    borderWidth: 1,
    borderColor: theme.border,
    minWidth: 60,
    alignItems: 'center',
  },
  slotRowSelectBtnActive: {
    backgroundColor: 'rgba(45,224,255,0.12)',
    borderColor: Colors.cyan,
  },
  slotRowSelectText: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: 12,
    color: theme.textMuted,
  },

  noSlotsState: { alignItems: 'center', paddingVertical: 24, marginBottom: 14 },
  noSlotsText: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, color: theme.textMuted },

  confirmBtn: { backgroundColor: Colors.blue, borderRadius: Radius.button, minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  confirmBtnDisabled: { backgroundColor: theme.surface2 },
  confirmBtnSuccess: { backgroundColor: Colors.positive },
  confirmBtnText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label, color: Colors.white },

  // Schedule sheet — distinct colors per state
  scheduleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: theme.border, minHeight: 52 },
  scheduleRowAvail: { borderLeftWidth: 3, borderLeftColor: Colors.cyan, paddingLeft: 10 },
  scheduleRowBooked: { borderLeftWidth: 3, borderLeftColor: theme.borderStrong, paddingLeft: 10, opacity: 0.7 },
  scheduleRowMaint: { borderLeftWidth: 3, borderLeftColor: Colors.negative, paddingLeft: 10, opacity: 0.7 },
  scheduleRowMine: { borderLeftWidth: 3, borderLeftColor: Colors.volt, paddingLeft: 10 },
  scheduleRowLabel: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 12, color: theme.textMuted, letterSpacing: 0.3 },
  scheduleRowLabelAvail: { color: theme.textPrimary },
  scheduleRowLabelMaint: { color: Colors.negative },
  scheduleRowLabelMine: { color: Colors.volt },
  scheduleBookBtn: { backgroundColor: 'rgba(45,224,255,0.12)', borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(45,224,255,0.3)' },
  scheduleBookBtnText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 14, color: Colors.cyan },
  scheduleBlockStatus: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 10, color: theme.textMuted, letterSpacing: 1 },

  scheduleLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingVertical: 14, paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: theme.border },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: FontFamily.manropeMedium, fontSize: 12, color: theme.textMuted },
  }), [theme]);
}
