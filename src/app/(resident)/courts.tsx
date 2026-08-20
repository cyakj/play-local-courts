import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  CalendarDays, Check, ChevronDown,
} from 'lucide-react-native';
import * as Location from 'expo-location';

import { supabase } from '@/lib/supabase';
import { sendNotificationEmail } from '@/lib/emailNotifications';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing,
} from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { TimeSlotWheel } from '@/components/ui/TimeSlotWheel';
import { CalendarPicker, formatDateLabel } from '@/components/ui/CalendarPicker';
import { useTheme } from '@/context/ThemeContext';
import { useCommunityName } from '@/hooks/useCommunityName';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { isCommunityMode, isTennisMode } from '@/config/productMode';

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
  hourlyTemp: number[];
  hourlyRain: number[];
}

type PlayabilityLevel = 'prime' | 'good' | 'caution' | 'rain' | 'storm';

interface Playability {
  level: PlayabilityLevel;
  conditions: string;
  accentColor: string;
  icon: 'sun' | 'cloud' | 'rain' | 'storm';
}

type ActiveTab = 'tennis' | 'amenities';
type TopLevelTab = 'hoa' | 'other';

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
  if (rain >= 20) return `${temp}°F · ${rain}%`;
  if (temp >= 95) return `${temp}°F · Heat`;
  if (temp >= 85) return `${temp}°F · Warm`;
  return `${temp}°F · Clear`;
}

function timeToMins(t: string): number {
  const parts = t.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function slotsOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return timeToMins(startA) < timeToMins(endB) && timeToMins(endA) > timeToMins(startB);
}

function getSlotWeatherIcon(hour: number, selectedDate: Date, now: Date, weather: WeatherData | null): 'sun' | 'cloud' | 'rain' | 'storm' | null {
  if (!weather || weather.hourlyRain.length === 0) return null;
  const idx = getHourlyIndex(selectedDate, hour, now);
  if (idx >= weather.hourlyRain.length) return null;
  const rain = weather.hourlyRain[idx] ?? 0;
  if (rain >= 70) return 'rain';
  if (rain >= 40) return 'cloud';
  if (rain >= 20) return 'cloud';
  return 'sun';
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

  if (weatherCode >= 95) return { level: 'storm', conditions: `${tempF}°F · Storm`, accentColor: Colors.negative, icon: 'storm' };
  if (weatherCode >= 51 || rainPct >= 60) return { level: 'rain', conditions: `${tempF}°F · ${rainPct}% Rain`, accentColor: Colors.negative, icon: 'rain' };
  if (weatherCode >= 45 || rainPct >= 40) return { level: 'caution', conditions: `${tempF}°F · ${rainPct}% Risk`, accentColor: Colors.volt, icon: 'cloud' };
  if (weatherCode === 3 || rainPct >= 20) return { level: 'good', conditions: `${tempF}°F · ${rainPct}% Rain`, accentColor: Colors.fg2, icon: 'cloud' };
  return { level: 'prime', conditions: `${tempF}°F · Clear`, accentColor: Colors.cyan, icon: 'sun' };
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
  const communityName = useCommunityName();
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
  const [topLevelTab, setTopLevelTab] = useState<TopLevelTab>('hoa');

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
  const [bookingError, setBookingError] = useState<string | null>(null);

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
    } catch { /* silently fail */ }
    finally { setScheduleLoading(false); }
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
    } catch { /* keep existing blocks */ }
    finally { setScheduleLoading(false); }
  }

  // ── Duration: tennis locked by play type; non-tennis user-selectable ─────────
  const isTennisBooking = useMemo(() => TENNIS_TYPES.has(bookingSheet?.courtType ?? ''), [bookingSheet]);

  const sheetDuration = useMemo(() => {
    if (isTennisBooking) {
      return sheetPlayType === 'singles'
        ? (sheetRules?.singles_duration_minutes ?? 60)
        : (sheetRules?.doubles_duration_minutes ?? 90);
    }
    if (sheetDurationOverride !== null) return sheetDurationOverride;
    return sheetRules?.singles_duration_minutes ?? 60;
  }, [sheetRules, sheetPlayType, sheetDurationOverride, isTennisBooking]);

  const availableDurations = useMemo(() => {
    if (isTennisBooking) return [];
    if (!sheetRules) return [60];
    const durations = new Set<number>();
    if (sheetRules.singles_duration_minutes) durations.add(sheetRules.singles_duration_minutes);
    if (sheetRules.doubles_duration_minutes) durations.add(sheetRules.doubles_duration_minutes);
    return Array.from(durations).sort((a, b) => a - b);
  }, [sheetRules, isTennisBooking]);

  // ── Time slots ──────────────────────────────────────────────────────────────
  const sheetTimeSlots = useMemo(() => {
    if (!bookingSheet) return [];
    const freshNow = new Date();
    const dateStr = sheetDate.toISOString().split('T')[0];

    // Merge bookings from two sources:
    // 1. bookingsByDate — all users' bookings fetched per-date (may be empty if query failed)
    // 2. userBookings   — current user's own bookings (always present from main load)
    const fromCache = (bookingsByDate[dateStr] ?? []).filter(b => b.court_id === bookingSheet.courtId);
    const ownForDate = userBookings
      .filter(b => b.court_id === bookingSheet.courtId && b.date === dateStr)
      .map(b => ({ court_id: b.court_id, start_time: b.start_time, end_time: b.end_time, user_id: userId } as TodayBooking));
    // Deduplicate: keep any own booking not already in cache (same start+end)
    const merged: TodayBooking[] = [...fromCache];
    for (const ob of ownForDate) {
      if (!merged.some(b => b.start_time === ob.start_time && b.end_time === ob.end_time)) {
        merged.push(ob);
      }
    }

    const startHour = sheetRules?.booking_start_time ? parseInt(sheetRules.booking_start_time.split(':')[0]) : 7;
    const endHour = sheetRules?.booking_end_time ? parseInt(sheetRules.booking_end_time.split(':')[0]) : 21;
    const endMins = endHour * 60;
    const isToday = sheetDate.toDateString() === freshNow.toDateString();
    const nowMins = freshNow.getHours() * 60 + freshNow.getMinutes();

    const slots: string[] = [];
    for (let h = startHour; h < endHour; h++) {
      for (let m = 0; m < 60; m += 30) {
        const slotStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        const slotStartMins = h * 60 + m;
        const slotEndMins = slotStartMins + sheetDuration;

        // Exclude slots that go past operating end
        if (slotEndMins > endMins) continue;
        // Exclude past slots for today
        if (isToday && slotStartMins <= nowMins) continue;
        // Exclude any slot that overlaps an existing booking or maintenance block
        const hasConflict = merged.some(b =>
          slotsOverlap(slotStr, getEndTime(slotStr, sheetDuration), b.start_time, b.end_time)
        );
        if (!hasConflict) slots.push(slotStr);
      }
    }
    return slots;
  }, [bookingSheet, sheetDate, bookingsByDate, sheetDuration, sheetRules, userBookings, userId]);

  // ── Confirm booking ─────────────────────────────────────────────────────────
  async function handleConfirm() {
    if (!userId || !bookingSheet || !sheetSelectedSlot) return;
    setConfirming(true);
    setBookingError(null);
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
      sendNotificationEmail({
        type: 'booking_confirmation',
        userId,
        courtName: bookingSheet.courtName,
        date: dateStr,
        startTime: `${sheetSelectedSlot}:00`,
        endTime: `${endTime}:00`,
        playType: sheetPlayType,
      });
      await fetchBookingsForDate(dateStr);
      await loadCourts();
      setTimeout(() => { setBookingSheet(null); setBookingSuccess(false); setBookingError(null); }, 1400);
    } else {
      setBookingError(error.message ?? 'Booking failed. Please try again.');
    }
  }

  // ── Filtered courts by active tab ───────────────────────────────────────────
  const tennisCourts = useMemo(() => courts.filter(c => TENNIS_TYPES.has(c.court_type)), [courts]);
  const amenityCourts = useMemo(() => courts.filter(c => !TENNIS_TYPES.has(c.court_type)), [courts]);
  const visibleCourts = isCommunityMode ? courts : (activeTab === 'tennis' ? tennisCourts : amenityCourts);

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
    if (openCount > 0) return `${openCount} ${isTennisMode && activeTab === 'tennis' ? 'court' : 'facilit'}${openCount > 1 ? (isTennisMode && activeTab === 'tennis' ? 's' : 'ies') : (isTennisMode && activeTab === 'tennis' ? '' : 'y')} open right now`;
    const first = sortedCourts[0];
    if (first && courtStatuses[first.id]) return `Next available: ${first.name} · ${courtStatuses[first.id].detailText}`;
    return null;
  }, [visibleCourts, openCount, sortedCourts, courtStatuses, courtsLoading, activeTab]);

  const todayUserBooking = useMemo(() => userBookings.find(b => b.date === now.toISOString().split('T')[0]) ?? null, [userBookings, now]);
  const upcomingCount = useMemo(() => userBookings.filter(b => b.date >= now.toISOString().split('T')[0]).length, [userBookings, now]);
  const playability = useMemo(() => weather ? getPlayability(weather) : null, [weather]);
  const showWeatherOnMain = isTennisMode && topLevelTab === 'hoa' && activeTab === 'tennis';

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <View testID="courts-screen" style={styles.screen}>
      <Header variant="resident" communityName={communityName} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.cyan} />}
        showsVerticalScrollIndicator={false}>

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <View testID="courts-hero" style={styles.hero}>
          <Text style={styles.heroLabel}>RESERVE</Text>
          <Text style={styles.heroTitle}>Reserve</Text>
          {isCommunityMode && communityName && (
            <Text style={styles.heroSubtitle}>Book an amenity at {communityName}</Text>
          )}
          {showWeatherOnMain && (
            <>
              <View style={styles.heroConditionsDivider} />
              {weatherLoading ? (
                <View testID="conditions-skeleton" style={styles.conditionsSkeleton} />
              ) : playability ? (
                <View testID="conditions-strip" style={styles.conditionsRow}>
                  <WeatherIcon type={playability.icon} color={playability.accentColor} size={14} />
                  <Text style={[styles.conditionsData, { color: playability.accentColor }]}>
                    {playability.conditions}
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </View>

        {/* ── Top-level: My HOA / Club · Other ─────────────────────────── */}
        {isTennisMode && (
          <View testID="top-tab-control" style={styles.topTabControl}>
            <TouchableOpacity
              testID="top-tab-hoa"
              style={[styles.topTabBtn, topLevelTab === 'hoa' && styles.topTabBtnActive]}
              onPress={() => setTopLevelTab('hoa')}
              activeOpacity={0.7}>
              <Text style={[styles.topTabText, topLevelTab === 'hoa' && styles.topTabTextActive]}>
                My HOA / Club
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="top-tab-other"
              style={[styles.topTabBtn, topLevelTab === 'other' && styles.topTabBtnActive]}
              onPress={() => setTopLevelTab('other')}
              activeOpacity={0.7}>
              <Text style={[styles.topTabText, topLevelTab === 'other' && styles.topTabTextActive]}>
                Other
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {topLevelTab === 'other' ? (
          /* ── Other: coming soon placeholder ──────────────────────────── */
          <View style={[styles.contentWrap, styles.otherEmpty]}>
            <MapPin color={Colors.fg3} size={48} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>Public courts coming soon</Text>
            <Text style={styles.emptySubtitle}>
              Public courts and clubs will be available in a future update.
            </Text>
          </View>
        ) : (
          <>
            {/* ── Tennis / Amenities Tab ────────────────────────────────── */}
            {isTennisMode && (
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
            )}

            {/* ── Content ──────────────────────────────────────────────── */}
            <View style={styles.contentWrap}>
              {courtsLoading ? (
                <View testID="intelligence-skeleton" style={styles.intelligenceSkeleton} />
              ) : intelligenceLine ? (
                <Text testID="intelligence-line" style={styles.intelligenceLine}>{intelligenceLine}</Text>
              ) : null}

              {courtsLoading ? (
                <>{[0, 1, 2].map(i => <View key={i} testID="court-skeleton" style={styles.courtCardSkeleton} />)}</>
              ) : sortedCourts.length === 0 ? (
                <View testID="empty-no-courts" style={styles.emptyState}>
                  <MapPin color={Colors.fg3} size={52} strokeWidth={1.5} />
                  <Text style={styles.emptyTitle}>{isTennisMode && activeTab === 'tennis' ? 'No courts available' : 'No amenities available'}</Text>
                  <Text style={styles.emptySubtitle}>Check back after your community adds {isTennisMode && activeTab === 'tennis' ? 'courts' : 'amenities'}.</Text>
                </View>
              ) : openCount === 0 && !courtsLoading && sortedCourts.length > 0 ? (
                <>
                  <View testID="empty-all-booked" style={styles.emptyState}>
                    <Clock color={Colors.fg3} size={52} strokeWidth={1.5} />
                    <Text style={styles.emptyTitle}>All {isTennisMode && activeTab === 'tennis' ? 'courts' : 'facilities'} busy right now</Text>
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
          </>
        )}
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
          isTennis={isTennisBooking}
          onDurationChange={(d) => { setSheetDurationOverride(d); setSheetSelectedSlot(null); }}
          weather={weather}
          confirming={confirming}
          success={bookingSuccess}
          bookingError={bookingError}
          onConfirm={handleConfirm}
          onClose={() => { setBookingSheet(null); setBookingError(null); }}
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
            {isOpen ? (isCommunityMode ? 'Reserve →' : 'Play Now →') : (s.detailText ? `${s.detailText} →` : 'Reserve →')}
          </Text>
        </TouchableOpacity>
      </View>
      {isMine ? (
        <View style={styles.myResBadgeRow}>
          <View style={styles.myResBadgePill}>
            <Text style={styles.myResBadgeText}>MY RESERVATION</Text>
          </View>
          <Text style={styles.myResBadgeTime}>
            {formatTime(isMyBooking!.start_time)}–{formatTime(isMyBooking!.end_time)}
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.courtStatusText}>{s.statusText}</Text>
          {s.detailText ? <Text style={styles.courtDetailText}>{s.detailText}</Text> : null}
        </>
      )}

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
  duration, availableDurations, isTennis, onDurationChange,
  weather, confirming, success, bookingError, onConfirm, onClose, insets,
}: {
  courtName: string; courtType: string; now: Date;
  sheetDate: Date; onSheetDateChange: (d: Date) => void;
  playType: 'singles' | 'doubles'; onPlayTypeChange: (t: 'singles' | 'doubles') => void;
  rules: AmenityRules | null; rulesLoading: boolean;
  timeSlots: string[]; selectedSlot: string | null; onSelectSlot: (s: string | null) => void;
  duration: number; availableDurations: number[]; isTennis: boolean; onDurationChange: (d: number) => void;
  weather: WeatherData | null;
  confirming: boolean; success: boolean; bookingError: string | null; onConfirm: () => void; onClose: () => void;
  insets: { bottom: number };
}) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const outdoor = isOutdoor(courtType);
  const [showCalendar, setShowCalendar] = useState(false);

  // Primary date buttons: Today + Tomorrow
  const primaryDates = useMemo(() => {
    const t = new Date(now); t.setHours(0, 0, 0, 0);
    const tom = new Date(t); tom.setDate(t.getDate() + 1);
    return [t, tom];
  }, [now]);

  // Calendar bounds: today → advance_booking_days from admin rules
  const calMinDate = useMemo(() => {
    const d = new Date(now); d.setHours(0, 0, 0, 0); return d;
  }, [now]);

  const calMaxDate = useMemo(() => {
    const advDays = rules?.advance_booking_days ?? 7;
    const d = new Date(now); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + advDays);
    return d;
  }, [rules, now]);

  const isMoreDate = useMemo(
    () => sheetDate.toDateString() !== primaryDates[0].toDateString() &&
          sheetDate.toDateString() !== primaryDates[1].toDateString(),
    [sheetDate, primaryDates]
  );

  const sheetIsToday = sheetDate.toDateString() === new Date().toDateString();

  // Weather data for the selected slot — shown in summary row
  const selectedSlotWx = useMemo(() => {
    if (!selectedSlot || !outdoor || !weather) return null;
    const [h] = selectedSlot.split(':').map(Number);
    return {
      icon: getSlotWeatherIcon(h, sheetDate, now, weather),
      label: getSlotWeatherLabel(h, sheetDate, now, weather),
    };
  }, [selectedSlot, outdoor, weather, sheetDate, now]);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={styles.sheetBackdrop} onPress={onClose} />
        <View testID="booking-sheet" style={styles.sheetContainer}>
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

          {/* Scrollable content */}
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetScrollContent}>

          {/* Date row: Today · Tomorrow · Dates (opens calendar) */}
          <View style={styles.dateRow} testID="sheet-date-row">
            {primaryDates.map((date, i) => {
              const isSelected = date.toDateString() === sheetDate.toDateString();
              return (
                <TouchableOpacity
                  key={i}
                  testID={i === 0 ? 'sheet-date-today' : 'sheet-date-1'}
                  style={[styles.sheetDateChip, styles.sheetDateChipFlex, isSelected && styles.sheetDateChipActive]}
                  onPress={() => { onSheetDateChange(date); setShowCalendar(false); }}
                  activeOpacity={0.7}>
                  <Text style={[styles.sheetDateChipText, isSelected && styles.sheetDateChipTextActive]}>
                    {formatDateLabel(date, now)}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              testID="sheet-date-more"
              style={[styles.sheetDateChip, styles.sheetDateChipFlex, (showCalendar || isMoreDate) && styles.sheetDateChipActive]}
              onPress={() => setShowCalendar(v => !v)}
              activeOpacity={0.7}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <CalendarDays
                  color={(showCalendar || isMoreDate) ? Colors.white : Colors.fg3}
                  size={13} strokeWidth={1.5} />
                <Text style={[styles.sheetDateChipText, (showCalendar || isMoreDate) && styles.sheetDateChipTextActive]}>
                  {isMoreDate ? formatDateLabel(sheetDate, now) : 'Dates'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Calendar picker (shows when Dates tapped, hides slots) */}
          {showCalendar && (
            <CalendarPicker
              selectedDate={sheetDate}
              onSelect={(d) => { onSheetDateChange(d); setShowCalendar(false); }}
              minDate={calMinDate}
              maxDate={calMaxDate}
              theme={theme}
              testID="booking-calendar"
            />
          )}

          {/* Play type — tennis only; duration for every other amenity ignores
              this value entirely, so showing it there was a dead control */}
          {!showCalendar && isTennis && (
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
          )}

          {/* Duration: informational for tennis, selector for non-tennis (hidden when calendar open) */}
          {!showCalendar && (
            isTennis ? (
              <View testID="duration-info" style={styles.durationInfoRow}>
                <Text style={styles.durationInfoText}>
                  {playType === 'singles' ? 'Singles' : 'Doubles'} · {duration} min
                </Text>
              </View>
            ) : availableDurations.length > 1 ? (
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
              </View>
            ) : null
          )}

          {/* Carousel wheel time-slot selector (hidden when calendar open) */}
          {!showCalendar && (
            rulesLoading ? (
              <ActivityIndicator color={Colors.cyan} style={{ marginVertical: 20 }} />
            ) : timeSlots.length === 0 ? (
              <View style={styles.noSlotsState} testID="no-slots-state">
                <Text style={styles.noSlotsText}>
                  {sheetIsToday ? 'No remaining times today' : 'No available times for this date'}
                </Text>
              </View>
            ) : (
              <TimeSlotWheel
                slots={timeSlots}
                selectedSlot={selectedSlot}
                onSelectSlot={onSelectSlot}
                weather={weather}
                outdoor={outdoor}
                sheetDate={sheetDate}
                now={now}
                theme={theme}
              />
            )
          )}

          </ScrollView>

          {/* Sticky confirm area — always visible at bottom of sheet */}
          <View style={[styles.sheetConfirmArea, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            {selectedSlot && !showCalendar && (
              <View testID="selected-time-summary" style={styles.slotSummary}>
                <Text style={styles.slotSummaryLine1} numberOfLines={1}>
                  {courtName}{isTennis ? ` · ${playType === 'singles' ? 'Singles' : 'Doubles'}` : ''} · {duration} min
                </Text>
                <View style={styles.slotSummaryRow2}>
                  <Text style={styles.slotSummaryLine2} numberOfLines={1}>
                    {sheetDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {'  ·  '}{formatTime(selectedSlot)}{' – '}{formatTime(getEndTime(selectedSlot, duration))}
                  </Text>
                  {selectedSlotWx?.icon && selectedSlotWx?.label && (
                    <View style={styles.slotSummaryWx}>
                      <WeatherIcon type={selectedSlotWx.icon} color={theme.cyanOnLight} size={12} />
                    </View>
                  )}
                </View>
              </View>
            )}
            {!!bookingError && (
              <Text testID="booking-error" style={styles.bookingErrorText}>{bookingError}</Text>
            )}
            <TouchableOpacity testID="confirm-booking-btn"
              style={[styles.confirmBtn, (!selectedSlot || confirming) && styles.confirmBtnDisabled, success && styles.confirmBtnSuccess]}
              onPress={onConfirm} disabled={!selectedSlot || confirming || success} activeOpacity={0.85}>
              {confirming ? <ActivityIndicator color={Colors.white} size="small" /> : (
                <Text style={styles.confirmBtnText}>
                  {success ? '✓ Booked!' : selectedSlot ? 'Confirm Reservation' : 'Select a time slot'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
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
  const [showSchedCalendar, setShowSchedCalendar] = useState(false);

  // Schedule calendar: 2 years back, advance_booking_days forward
  const schedCalMinDate = useMemo(() => {
    const d = new Date(now);
    d.setFullYear(d.getFullYear() - 2);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [now]);

  const schedCalMaxDate = useMemo(() => {
    const advDays = rules?.advance_booking_days ?? 7;
    const d = new Date(now); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + advDays);
    return d;
  }, [rules, now]);

  // Past dates are view-only — suppress Reserve CTA
  const isPastDate = useMemo(() => {
    const midnight = new Date(now); midnight.setHours(0, 0, 0, 0);
    const sel = new Date(scheduleDate); sel.setHours(0, 0, 0, 0);
    return sel < midnight;
  }, [scheduleDate, now]);

  const dateLabel = scheduleDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const START_HOUR = rules?.booking_start_time ? parseInt(rules.booking_start_time.split(':')[0]) : 7;
  const END_HOUR = rules?.booking_end_time ? parseInt(rules.booking_end_time.split(':')[0]) : 21;

  const timeBlocks = useMemo(() => {
    const blocks: Array<{ slotStr: string; label: string; type: 'available' | 'booked' | 'mine' | 'maintenance' }> = [];
    for (let h = START_HOUR; h < END_HOUR; h++) {
      const slotStr = `${h.toString().padStart(2, '0')}:00`;
      const slotEnd = `${(h + 1).toString().padStart(2, '0')}:00`;
      const isMaint = maintenance.some(mb => slotsOverlap(slotStr, slotEnd, mb.start_time, mb.end_time));
      const isMine = userId ? bookings.some(b => slotsOverlap(slotStr, slotEnd, b.start_time, b.end_time) && b.user_id === userId) : false;
      const isBooked = bookings.some(b => slotsOverlap(slotStr, slotEnd, b.start_time, b.end_time));
      blocks.push({
        slotStr,
        label: `${formatTime(slotStr)} – ${formatTime(slotEnd)}`,
        type: isMaint ? 'maintenance' : isMine ? 'mine' : isBooked ? 'booked' : 'available',
      });
    }
    return blocks;
  }, [bookings, maintenance, userId, START_HOUR, END_HOUR]);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={styles.sheetBackdrop} onPress={onClose} />
        <View testID="schedule-sheet" style={[styles.sheetContainer, styles.scheduleSheetContainer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View style={styles.sheetHandle} />

          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetCourtName}>{courtName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.sheetCloseBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X color={Colors.fg3} size={20} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>

          {/* Date selector button → expands calendar */}
          <TouchableOpacity
            testID="sched-date-btn"
            style={styles.schedDateBtn}
            onPress={() => setShowSchedCalendar(v => !v)}
            activeOpacity={0.7}>
            <CalendarDays color={theme.cyanOnLight} size={16} strokeWidth={1.5} />
            <Text style={styles.schedDateBtnText}>{dateLabel}</Text>
            <ChevronDown
              color={theme.textMuted}
              size={14}
              strokeWidth={1.5}
              style={showSchedCalendar ? { transform: [{ rotate: '180deg' }] } : undefined}
            />
          </TouchableOpacity>

          {/* Calendar (visible when date btn tapped; hides schedule) */}
          {showSchedCalendar && (
            <CalendarPicker
              selectedDate={scheduleDate}
              onSelect={(d) => { onDateChange(d); setShowSchedCalendar(false); }}
              minDate={schedCalMinDate}
              maxDate={schedCalMaxDate}
              theme={theme}
              testID="schedule-calendar"
            />
          )}

          {/* Schedule blocks — hidden while calendar is open */}
          {!showSchedCalendar && (loading ? (
            <ActivityIndicator color={Colors.cyan} style={{ marginVertical: 24 }} />
          ) : (
            <ScrollView testID="schedule-blocks" showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
              <View>
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
                        isPastDate ? (
                          <Text style={styles.scheduleBlockStatus}>OPEN</Text>
                        ) : (
                          <TouchableOpacity testID={`schedule-book-${block.slotStr}`} style={styles.scheduleBookBtn}
                            onPress={() => onBook(block.slotStr)} activeOpacity={0.7}>
                            <Text style={styles.scheduleBookBtnText}>Reserve →</Text>
                          </TouchableOpacity>
                        )
                      ) : (
                        <Text style={[
                          styles.scheduleBlockStatus,
                          isMaint && { color: Colors.negative },
                          isMine && { color: Colors.volt },
                        ]}>
                          {isMaint ? 'MAINTENANCE' : isMine ? 'MY RESERVATION' : 'BOOKED'}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
              {/* Legend */}
              <View testID="schedule-legend" style={styles.scheduleLegend}>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.positive }]} /><Text style={styles.legendText}>Available</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.volt }]} /><Text style={styles.legendText}>My Reservation</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: theme.borderStrong }]} /><Text style={styles.legendText}>Booked</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.negative }]} /><Text style={styles.legendText}>Maintenance</Text></View>
              </View>
            </ScrollView>
          ))}
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
  heroSubtitle: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, color: theme.textSecondary, marginTop: 4 },
  heroConditionsDivider: { height: 1, backgroundColor: 'rgba(45,224,255,0.15)', marginVertical: 12 },
  conditionsSkeleton: { height: 14, width: 200, backgroundColor: theme.surface2, borderRadius: 7 },
  conditionsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  conditionsData: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 12, letterSpacing: 0.4 },

  // Top-level HOA / Other selector
  topTabControl: { flexDirection: 'row', paddingHorizontal: Spacing.pagePx, paddingVertical: 10, gap: 8, backgroundColor: theme.pageBg },
  topTabBtn: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.chip, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface2 },
  topTabBtnActive: { backgroundColor: Colors.blue, borderColor: Colors.blue },
  topTabText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 14, color: theme.textSecondary },
  topTabTextActive: { color: Colors.white },

  tabControl: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: theme.pageBg },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: theme.cyanOnLight },
  tabBtnText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 14, color: theme.textMuted },
  tabBtnTextActive: { color: theme.cyanOnLight },

  contentWrap: { maxWidth: MaxWidth, width: '100%', alignSelf: 'center', paddingHorizontal: Spacing.pagePx, paddingTop: 16, gap: 12 },
  otherEmpty: { alignItems: 'center', paddingTop: 48 },
  intelligenceSkeleton: { height: 14, width: 160, backgroundColor: theme.surface2, borderRadius: 7 },
  intelligenceLine: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.eyebrow, color: theme.cyanOnLight, letterSpacing: 1.4 },

  courtCardSkeleton: { height: 104, backgroundColor: theme.surface2, borderRadius: Radius.card, borderLeftWidth: 3, borderLeftColor: theme.border },
  courtCard: { backgroundColor: theme.cardBg, borderRadius: Radius.card, padding: 20, borderWidth: 1, borderColor: theme.border, borderLeftWidth: 3, gap: 4, ...theme.shadowCard },
  courtCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  courtNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  cyanDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  courtName: { fontFamily: FontFamily.spaceGroteskBold, fontSize: FontSize.cardTitle, color: theme.textPrimary, flex: 1 },
  courtCta: { fontFamily: FontFamily.manropeSemiBold, fontSize: 14 },
  courtStatusText: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.eyebrow, color: theme.textSecondary, letterSpacing: 1.2 },
  courtDetailText: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.eyebrow, color: theme.textMuted, letterSpacing: 0.4, marginTop: 2 },
  myResBadgeRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, flexWrap: 'wrap' as const },
  myResBadgePill: {
    backgroundColor: Colors.positive + '22',
    borderWidth: 1,
    borderColor: Colors.positive + '60',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  myResBadgeText: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.eyebrow, color: Colors.positive, letterSpacing: 1.2, overflow: 'hidden' as const },
  myResBadgeTime: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.eyebrow, color: theme.textMuted, letterSpacing: 0.4 },
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
    borderWidth: 1, borderColor: theme.borderStrong,
    marginTop: 4, ...theme.shadowCard,
  },
  upcomingCardEyebrow: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 10, color: theme.cyanOnLight, letterSpacing: 1.4, marginBottom: 4 },
  upcomingCardTitle: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 18, color: theme.textPrimary, letterSpacing: -0.2 },

  // Sheets
  sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: theme.backdrop },
  sheetContainer: { backgroundColor: theme.sheetBg, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderTopWidth: 1, borderColor: theme.border, paddingTop: 12, maxHeight: '88%', ...theme.shadowSheet },
  sheetScrollContent: { paddingHorizontal: Spacing.pagePx, paddingBottom: 4 },
  sheetConfirmArea: { paddingHorizontal: Spacing.pagePx, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border, gap: 8 },
  bookingErrorText: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, color: Colors.negative, textAlign: 'center' as const },
  scheduleSheetContainer: { maxHeight: '85%' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, paddingHorizontal: Spacing.pagePx },
  sheetCourtName: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 20, color: theme.textPrimary },
  sheetCloseBtn: { width: 36, height: 36, backgroundColor: theme.surface2, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },

  // Date row: flex buttons (symmetrical, equal width)
  dateRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  sheetDateChip: { height: 40, alignSelf: 'center', paddingHorizontal: 12, borderRadius: Radius.chip, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface2, alignItems: 'center', justifyContent: 'center' },
  sheetDateChipFlex: { flex: 1 },
  sheetDateChipActive: { backgroundColor: Colors.blue, borderColor: Colors.blue },
  sheetDateChipText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 13, color: theme.textSecondary },
  sheetDateChipTextActive: { color: Colors.white },

  // Play type — equal-width chips
  playTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  playTypeChip: { flex: 1, height: 40, paddingHorizontal: 16, borderRadius: Radius.chip, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface2, alignItems: 'center', justifyContent: 'center' },
  playTypeChipActive: { backgroundColor: Colors.blue, borderColor: Colors.blue },
  playTypeText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 13, color: theme.textSecondary },
  playTypeTextActive: { color: Colors.white },

  // Duration
  durationInfoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: theme.surface2, borderRadius: Radius.sm, borderWidth: 1, borderColor: theme.border },
  durationInfoText: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 12, color: theme.cyanOnLight, letterSpacing: 0.8 },
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  durationChip: { height: 40, paddingHorizontal: 16, borderRadius: Radius.chip, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface2, alignItems: 'center', justifyContent: 'center' },
  durationChipActive: { backgroundColor: theme.selectedBg, borderColor: theme.selectedBorder },
  durationChipText: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 12, color: theme.textSecondary, letterSpacing: 0.3 },
  durationChipTextActive: { color: theme.selectedBorder },

  noSlotsState: { alignItems: 'center', paddingVertical: 24, marginBottom: 14 },
  noSlotsText: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, color: theme.textMuted },

  // Selected time summary — compact inline two-line
  slotSummary: { marginBottom: 8 },
  slotSummaryLine1: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: 13,
    color: theme.textPrimary,
    lineHeight: 18,
  },
  slotSummaryRow2: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, marginTop: 2 },
  slotSummaryLine2: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: 12,
    color: theme.textSecondary,
    flex: 1,
  },
  slotSummaryWx: { flexShrink: 0 },

  confirmBtn: { backgroundColor: Colors.blue, borderRadius: Radius.button, minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  confirmBtnDisabled: { backgroundColor: theme.surface2 },
  confirmBtnSuccess: { backgroundColor: Colors.positive },
  confirmBtnText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label, color: Colors.white },

  // Schedule sheet
  schedDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.surface2,
    borderRadius: Radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  schedDateBtnText: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: 14,
    color: theme.textPrimary,
    flex: 1,
  },

  scheduleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: theme.border, minHeight: 52 },
  scheduleRowAvail: { borderLeftWidth: 3, borderLeftColor: Colors.positive, paddingLeft: 10, backgroundColor: theme.schedAvailBg },
  scheduleRowBooked: { borderLeftWidth: 3, borderLeftColor: theme.border, paddingLeft: 10, opacity: 0.7 },
  scheduleRowMaint: { borderLeftWidth: 3, borderLeftColor: Colors.negative, paddingLeft: 10, backgroundColor: theme.schedMaintBg, opacity: 0.85 },
  scheduleRowMine: { borderLeftWidth: 3, borderLeftColor: Colors.volt, paddingLeft: 10, backgroundColor: theme.schedMineBg },
  scheduleRowLabel: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 12, color: theme.textMuted, letterSpacing: 0.3 },
  scheduleRowLabelAvail: { color: theme.textPrimary },
  scheduleRowLabelMaint: { color: Colors.negative },
  scheduleRowLabelMine: { color: theme.textPrimary },
  scheduleBookBtn: { backgroundColor: theme.selectedBg, borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: theme.selectedBorder },
  scheduleBookBtnText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 14, color: theme.selectedBorder },
  scheduleBlockStatus: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 10, color: theme.textMuted, letterSpacing: 1 },

  scheduleLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingVertical: 14, paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: theme.border, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: FontFamily.manropeMedium, fontSize: 12, color: theme.textMuted },
  }), [theme]);
}
