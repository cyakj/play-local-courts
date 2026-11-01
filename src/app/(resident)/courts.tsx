import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  MapPin, Clock, Sun, Cloud, CloudRain, Zap, X, ChevronRight,
  CalendarDays, Check, ChevronDown, Lock, History,
} from 'lucide-react-native';
import * as Location from 'expo-location';

import { supabase } from '@/lib/supabase';
import { sendNotificationEmail } from '@/lib/emailNotifications';
import {
  Availability, Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing,
} from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { TimeSlotWheel } from '@/components/ui/TimeSlotWheel';
import { buildScheduleRows } from '@/lib/scheduleRows';
import { communityMinutesNow, communityToday } from '@/lib/communityTime';
import { communityDate, currentWindowStartDate, ownLabel, reservationKind, selectCurrentReservations, toSlotReservation } from '@/lib/reservationState';
import { ReservationBadge } from '@/components/ui/ReservationBadge';
import { ReservationLegend } from '@/components/ui/ReservationLegend';
import { useNow } from '@/hooks/useNow';
import { RequestLedger } from '@/lib/requestLedger';
import { gateAvailability } from '@/lib/availabilityGate';
import { computeSlots, isSelectable, revalidateSelection, toDateKey, toMins, type SlotInfo } from '@/lib/slotAvailability';
import { CalendarPicker, formatDateLabel } from '@/components/ui/CalendarPicker';
import { useScrollToTopOnTabEnter } from '@/hooks/useScrollToTopOnTabEnter';
import { useTheme } from '@/context/ThemeContext';
import { useCommunityName } from '@/hooks/useCommunityName';
import { useActiveCommunity } from '@/hooks/useActiveCommunity';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { isCommunityMode, isTennisMode } from '@/config/productMode';

// ─── Constants ────────────────────────────────────────────────────────────────

const OUTDOOR_TYPES = new Set(['tennis', 'pickleball', 'basketball', 'pool', 'outdoor']);
const TENNIS_TYPES = new Set(['tennis']);
// Must match the RAISE EXCEPTION message in enforce_amenity_booking_rules()
// (supabase/migrations/..._greens_v1_enforce_blockout_conflicts.sql) exactly.
// Statuses that occupy an amenity's time and count toward limits (matches enforce_amenity_booking_rules).
const ACTIVE_BOOKING_STATUSES = ['confirmed', 'pending'];
const BOOKING_CACHE_MS = 30 * 1000;
const BLOCKOUT_CONFLICT_MESSAGE = 'This time is unavailable because the amenity is blocked for maintenance';

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
  status?: string;
}

interface MaintenanceBlock {
  date: string;
  end_date: string | null;
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
  status: string;
  courts: { name: string; hoa_id?: string } | null;
}

interface AmenityRules {
  booking_start_time: string | null;
  booking_end_time: string | null;
  singles_duration_minutes: number | null;
  doubles_duration_minutes: number | null;
  advance_booking_days: number | null;
  min_cancellation_hours: number | null;
  max_duration_minutes?: number | null;
  max_reservations_per_day?: number | null;
  requires_admin_approval?: boolean | null;
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

/** "Times outside 7 AM - 9 PM are not offered" - closed hours are not 'blocked'. */
function hoursNoteFor(rules: AmenityRules | null): string | null {
  if (!rules?.booking_start_time || !rules?.booking_end_time) return null;
  return `Open for booking ${formatTime(rules.booking_start_time)} - ${formatTime(rules.booking_end_time)}. Times outside these hours are not offered.`;
}

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

// BlockoutSheet writes ranges as a single row (date = start, end_date = end,
// null for a single day) — never one row per day — so any date-scoped
// maintenance query must range-check, not exact-match `date`.
function isMaintenanceActiveOnDate(block: MaintenanceBlock, dateStr: string): boolean {
  const end = block.end_date ?? block.date;
  return block.date <= dateStr && dateStr <= end;
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
  // Community clock, not the phone's. Only reservations that are not over occupy time.
  const dateStr = communityToday(now);
  const nowMinsC = communityMinutesNow(now);
  const bookings = (bookingsByDate[dateStr] ?? []).filter(b => b.court_id === courtId && !toSlotReservation(b, dateStr, null, now).ended);
  const nowStr = `${Math.floor(nowMinsC / 60).toString().padStart(2, '0')}:${(nowMinsC % 60).toString().padStart(2, '0')}:00`;

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
    const minsUntil = (nh * 60 + nm) - nowMinsC;
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
  const scrollRef = useScrollToTopOnTabEnter('courts');
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const insets = useSafeAreaInsets();
  const communityName = useCommunityName();
  // Ticking community clock (30 s, focus, app resume) + quiet refetch (60 s / resume): court status, "My Reservation" badges and
  // approvals never freeze at the time the screen mounted.
  const refreshQuietRef = useRef<() => void>(() => undefined);
  const refreshQuiet = useCallback(() => refreshQuietRef.current(), []);
  const now = useNow({ onRefresh: refreshQuiet });

  // ── Core state ──────────────────────────────────────────────────────────────
  const [userId, setUserId] = useState('');
  const { community: activeCommunity } = useActiveCommunity();
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
  const [sheetDate, setSheetDate] = useState<Date>(() => communityDate());
  const [sheetRules, setSheetRules] = useState<AmenityRules | null>(null);
  const [sheetRulesLoading, setSheetRulesLoading] = useState(false);
  const [sheetPlayType, setSheetPlayType] = useState<'singles' | 'doubles'>('singles');
  const [sheetDurationOverride, setSheetDurationOverride] = useState<number | null>(null);
  const [sheetSelectedSlot, setSheetSelectedSlot] = useState<string | null>(null);
  const [sheetMaintenanceAll, setSheetMaintenanceAll] = useState<MaintenanceBlock[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingPending, setBookingPending] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // ── Schedule sheet state ──────────────────────────────────────────────────────
  const [scheduleSheet, setScheduleSheet] = useState<{ courtId: string; courtName: string; courtType: string } | null>(null);
  // Sheets are bound to the community they were opened in.
  const sheetGen = useRef(0);
  useEffect(() => {
    sheetGen.current += 1;
    setBookingSheet(null);
    setScheduleSheet(null);
    setSheetSelectedSlot(null);
  }, [activeCommunity?.hoaId]);
  const [scheduleDate, setScheduleDate] = useState<Date>(() => communityDate());
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
  // The account the most recent loadCourts() ran for. A slower load for a PREVIOUS account must not publish over the current one
  // (signed out / switched account while its requests were in flight).
  const loadingUserRef = useRef<string | null>(null);
  // One generation per load (account AND community): an older load can never publish over a newer one.
  const loadGenRef = useRef(0);
  async function loadCourts() {
    const myGen = ++loadGenRef.current;
    let uid: string | null = null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) { loadingUserRef.current = null; setCourtsLoading(false); return; }
      uid = user.id;
      loadingUserRef.current = uid;
      const current = () => loadingUserRef.current === uid && loadGenRef.current === myGen;
      setUserId(user.id);

      const { data: memberships } = await supabase.from('hoa_memberships').select('hoa_id').eq('user_id', user.id).eq('status', 'approved');
      if (!current()) return;
      const hoaIds = (memberships ?? []).map((m: { hoa_id: string }) => m.hoa_id);
      if (hoaIds.length === 0) { setCourts([]); setCourtsLoading(false); return; }

      // Own bookings are paged until the result is complete (the count shown to the resident must not be truncated).
      const loadOwnBookings = async () => {
        const rows: unknown[] = [];
        for (let from = 0; from < 1000; from += 100) {
          const page = await supabase.from('bookings').select('id, court_id, date, start_time, end_time, status, courts!inner(name, hoa_id)').eq('user_id', user.id).in('courts.hoa_id', activeCommunity ? [activeCommunity.hoaId] : hoaIds).gte('date', currentWindowStartDate(now)).in('status', ACTIVE_BOOKING_STATUSES).order('date').order('start_time').range(from, from + 99);
          if (page.error) return { data: rows.length ? rows : null, error: page.error };
          rows.push(...(page.data ?? []));
          if ((page.data ?? []).length < 100) break;
        }
        return { data: rows, error: null };
      };
      const [courtsRes, userBookingsRes] = await Promise.all([
        supabase.from('courts').select('id, name, court_type, hoa_id').in('hoa_id', hoaIds),
        loadOwnBookings(),
      ]);
      if (!current()) return;

      const fetchedCourts: Court[] = courtsRes.data ?? [];
      setCourts(fetchedCourts);
      setUserBookings((userBookingsRes.data ?? []) as UserBooking[]);

      if (fetchedCourts.length > 0) {
        await fetchBookingsForDate(communityToday(now), fetchedCourts.map(c => c.id));
      }
    } catch { /* silently fail */ }
    finally { if (loadGenRef.current === myGen && (uid === null || loadingUserRef.current === uid)) setCourtsLoading(false); }
  }

  // Which (date, court) pairs have actually been fetched. A date key can be cached for court A only; court B on the same
  // date must still be fetched, and a fetch for one court must not wipe another court's cached rows.
  // key -> when it was fetched. A date is re-fetched when its entry is older than BOOKING_CACHE_MS, so a booking made or
  // cancelled elsewhere shows up when the resident revisits that date.
  const fetchedBookings = useRef(new Map<string, number>());
  // Per date+court outcome of the booking fetch: 'ok' loaded; 'stale' loaded earlier but the latest refresh failed (data kept,
  // flagged); 'error' never loaded. A date with nothing loaded must NOT be drawn as "all free".
  const [bookingLoad, setBookingLoad] = useState<Record<string, 'ok' | 'stale' | 'error'>>({});
  // Decides whether a response may still be applied (account/community changed, or a newer request for the key started).
  const bookingLedger = useRef(new RequestLedger());
  async function fetchBookingsForDate(dateStr: string, courtIds?: string[]) {
    const ids = courtIds ?? courts.map(c => c.id);
    if (ids.length === 0) return;
    const ticket = bookingLedger.current.begin(ids.map(id => `${dateStr}:${id}`));
    // Only reservations that occupy time: the DB trigger and exclusion constraint count confirmed + pending (a
    // rejected or cancelled request frees its interval and does not count toward the daily limit).
    const { data, error } = await supabase.from('bookings').select('court_id, start_time, end_time, user_id, status').in('court_id', ids).eq('date', dateStr).in('status', ACTIVE_BOOKING_STATUSES);
    const liveKeys = bookingLedger.current.live(ticket);
    if (liveKeys.length === 0) return; // superseded or belongs to a previous account/community
    const liveIds = ids.filter(id => liveKeys.includes(`${dateStr}:${id}`));
    if (error) { // keep what we had, but never let it pass as current: stale if it had loaded once, else an error
      setBookingLoad(prev => { const next = { ...prev }; for (const id of liveIds) { const k = `${dateStr}:${id}`; next[k] = next[k] === 'ok' || next[k] === 'stale' ? 'stale' : 'error'; } return next; });
      return;
    }
    setBookingLoad(prev => { const next = { ...prev }; for (const id of liveIds) next[`${dateStr}:${id}`] = 'ok'; return next; });
    for (const id of liveIds) fetchedBookings.current.set(`${dateStr}:${id}`, Date.now());
    setBookingsByDate(prev => ({
      ...prev,
      [dateStr]: [...(prev[dateStr] ?? []).filter(b => !liveIds.includes(b.court_id)), ...((data ?? []) as TodayBooking[]).filter(b => liveIds.includes(b.court_id))],
    }));
  }

  // Cached reservations belong to one account in one community: drop them when either changes.
  useEffect(() => {
    bookingLedger.current.reset(); // responses still in flight for the previous account/community are now ignored
    setBookingsByDate({});
    setBookingLoad({});
    fetchedBookings.current.clear();
  }, [userId, activeCommunity?.hoaId]);

  useEffect(() => { loadCourts(); }, [activeCommunity?.hoaId]);
  // Always the LATEST loadCourts (it depends on the active community and the clock), never the first render's.
  const loadCoursRefLatest = useRef(loadCourts);
  loadCoursRefLatest.current = loadCourts;
  useFocusEffect(useCallback(() => { void loadCoursRefLatest.current(); }, []));
  // Periodic / resume refresh: besides today's data, re-fetch the date and court a sheet is showing, so a request that an
  // administrator approved or rejected is reconciled on a future date too (the fetch replaces that court's cached rows).
  refreshQuietRef.current = () => {
    void loadCourts();
    if (bookingSheet) void fetchBookingsForDate(toDateKey(sheetDate), [bookingSheet.courtId]);
    if (scheduleSheet) void fetchBookingsForDate(toDateKey(scheduleDate), [scheduleSheet.courtId]);
  };

  async function onRefresh() {
    setRefreshing(true);
    await loadCourts();
    setRefreshing(false);
  }

  // ── Booking sheet open ──────────────────────────────────────────────────────
  async function fetchMaintenanceForSheet(courtId: string, isStale: () => boolean = () => false) {
    try {
      // Not date-filtered server-side — a blockout row can span a date
      // range (end_date), so every candidate row is fetched once and
      // range-checked per-date client-side via isMaintenanceActiveOnDate.
      const { data } = await supabase.from('court_maintenance').select('date, end_date, start_time, end_time, description').eq('court_id', courtId);
      if (isStale()) return;
      setSheetMaintenanceAll((data ?? []) as MaintenanceBlock[]);
    } catch { if (!isStale()) setSheetMaintenanceAll([]); }
  }

  async function openBookingSheet(court: Court, preselectedSlot?: string) {
    // Opening another sheet, closing, or switching community supersedes every outstanding sheet load.
    const myGen = ++sheetGen.current;
    const isStale = () => sheetGen.current !== myGen;
    const today = communityDate();
    setSheetDate(today);
    setBookingSheet({ courtId: court.id, courtName: court.name, courtType: court.court_type });
    setSheetSelectedSlot(preselectedSlot ?? null);
    setSheetPlayType('singles');
    setSheetDurationOverride(null);
    setBookingSuccess(false);
    setBookingPending(false);
    setSheetRules(null);
    setSheetMaintenanceAll([]);
    setSheetRulesLoading(true);

    const dateStr = toDateKey(today);
    await Promise.all([
      fetchBookingsForDate(dateStr, [court.id]),
      (async () => {
        try {
          const { data } = await supabase.from('amenity_rules').select('booking_start_time, booking_end_time, singles_duration_minutes, doubles_duration_minutes, advance_booking_days, min_cancellation_hours, max_duration_minutes, max_reservations_per_day, requires_admin_approval').eq('amenity_id', court.id).maybeSingle();
          if (!isStale()) setSheetRules(data ?? null);
        } catch { if (!isStale()) setSheetRules(null); }
      })(),
      fetchMaintenanceForSheet(court.id, isStale),
    ]);
    if (!isStale()) setSheetRulesLoading(false);
  }

  async function onSheetDateChange(date: Date) {
    setSheetDate(date);
    setSheetSelectedSlot(null);
    const dateStr = toDateKey(date);
    if (bookingSheet) setBookingLoad(prev => (prev[`${dateStr}:${bookingSheet.courtId}`] === 'error' ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== `${dateStr}:${bookingSheet.courtId}`)) : prev));
    const fetchedAt = bookingSheet ? fetchedBookings.current.get(`${dateStr}:${bookingSheet.courtId}`) : undefined;
    if (bookingSheet && (fetchedAt === undefined || Date.now() - fetchedAt > BOOKING_CACHE_MS)) {
      await fetchBookingsForDate(dateStr, [bookingSheet.courtId]);
    }
  }

  // ── Open schedule sheet ─────────────────────────────────────────────────────
  async function openScheduleSheet(court: Court) {
    const myGen = ++sheetGen.current;
    const isStale = () => sheetGen.current !== myGen;
    const today = communityDate();
    setScheduleDate(today);
    setScheduleSheet({ courtId: court.id, courtName: court.name, courtType: court.court_type });
    setMaintenanceBlocks([]);
    setScheduleRules(null);
    setScheduleLoading(true);
    try {
      const dateStr = toDateKey(today);
      await fetchBookingsForDate(dateStr, [court.id]);
      // Fetched once for the whole court, not scoped to a single `date` —
      // BlockoutSheet writes a multi-day range as one row (date=start,
      // end_date=end), so an exact `.eq('date', dateStr)` match only ever
      // caught the range's first day. Filtered per-date below instead.
      const maintRes = await supabase
        .from('court_maintenance')
        .select('date, end_date, start_time, end_time, description')
        .eq('court_id', court.id);
      if (isStale()) return;
      setMaintenanceBlocks((maintRes.data ?? []) as MaintenanceBlock[]);
      const rulesRes = await supabase
        .from('amenity_rules')
        .select('booking_start_time, booking_end_time, singles_duration_minutes, doubles_duration_minutes, advance_booking_days, min_cancellation_hours')
        .eq('amenity_id', court.id)
        .maybeSingle();
      if (isStale()) return;
      setScheduleRules(rulesRes.data ?? null);
    } catch { /* silently fail */ }
    finally { if (!isStale()) setScheduleLoading(false); }
  }

  async function onScheduleDateChange(date: Date) {
    if (!scheduleSheet) return;
    setScheduleDate(date);
    setScheduleLoading(true);
    try {
      // Maintenance rows for this court are already fully loaded (see
      // openScheduleSheet) and re-filtered per-date in scheduleMaintenanceForDate
      // below — only bookings need refetching per selected date.
      await fetchBookingsForDate(toDateKey(date), [scheduleSheet.courtId]);
    } catch { /* keep existing bookings cache */ }
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

  // The cap the database enforces (enforce_amenity_booking_rules, migration 20260922005928): tennis uses the
  // singles/doubles duration for the chosen play type; every other amenity uses max_duration_minutes (default 60).
  const sheetDurationCap = useMemo(() => {
    if (isTennisBooking) {
      return sheetPlayType === 'doubles' ? (sheetRules?.doubles_duration_minutes ?? 90) : (sheetRules?.singles_duration_minutes ?? 60);
    }
    return sheetRules?.max_duration_minutes ?? 60;
  }, [isTennisBooking, sheetPlayType, sheetRules]);

  // ── Time slots ──────────────────────────────────────────────────────────────
  const sheetTimeSlots = useMemo<SlotInfo[]>(() => {
    if (!bookingSheet) return [];
    const freshNow = new Date();
    const dateStr = toDateKey(sheetDate);
    if (dateStr < communityToday(freshNow)) return []; // a past day (e.g. the sheet stayed open across community midnight) offers nothing

    // Reservations from two sources: every resident's bookings fetched per date (may be empty if that query failed),
    // plus the current resident's own bookings (always present from the main load). Ownership, approval (pending) and
    // time (ended) are separate: an ended booking is never "yours" here, a pending one is amber, and both still count
    // toward the database daily cap.
    const fromCache = (bookingsByDate[dateStr] ?? []).filter(b => b.court_id === bookingSheet.courtId);
    const reservations = fromCache.map(b => toSlotReservation(b, dateStr, userId, freshNow));
    for (const ob of userBookings.filter(b => b.court_id === bookingSheet.courtId && b.date === dateStr)) {
      const own = toSlotReservation({ ...ob, user_id: userId }, dateStr, userId, freshNow);
      const i = reservations.findIndex(r => r.start_time === ob.start_time && r.end_time === ob.end_time && r.ownForCap);
      if (i < 0) reservations.push(own); else reservations[i] = own; // the own-bookings load is authoritative for status
    }
    // Admin-scheduled maintenance/blockouts block the slot too (also enforced server-side by a trigger).
    const blocks = sheetMaintenanceAll
      .filter(b => isMaintenanceActiveOnDate(b, dateStr))
      .map(b => ({ start_time: b.start_time, end_time: b.end_time }));

    return computeSlots({
      openMins: sheetRules?.booking_start_time ? toMins(sheetRules.booking_start_time) : 7 * 60,
      closeMins: sheetRules?.booking_end_time ? toMins(sheetRules.booking_end_time) : 21 * 60,
      durationMins: sheetDuration,
      isToday: communityToday(freshNow) === dateStr,
      nowMins: communityMinutesNow(freshNow),
      reservations,
      blocks,
      limits: { maxPerDay: sheetRules?.max_reservations_per_day ?? null, maxDurationMins: sheetDurationCap },
    });
  }, [bookingSheet, sheetDate, bookingsByDate, sheetDuration, sheetDurationCap, sheetRules, userBookings, userId, sheetMaintenanceAll, now]);

  // ── Confirm booking ─────────────────────────────────────────────────────────
  // Synchronous re-entrancy guard: React state (`confirming`) updates after the tap, so a fast double tap could
  // otherwise submit twice. The DB exclusion constraint still backstops this server-side.
  const confirmInFlight = useRef(false);
  async function handleConfirm() {
    if (confirmInFlight.current) return;
    confirmInFlight.current = true;
    try { await handleConfirmInner(); } finally { confirmInFlight.current = false; }
  }

  async function handleConfirmInner() {
    if (!userId || !bookingSheet || !sheetSelectedSlot) return;
    // The amenity must still belong to the active community (it may have changed while the sheet was open).
    if (!scopedCourts.some(c => c.id === bookingSheet.courtId)) {
      setBookingError('This amenity is not part of your active community. Close this sheet and try again.');
      return;
    }
    // Capture the sheet generation: if the community changes (or another sheet opens) while this request is in flight,
    // its outcome must not touch the newer sheet.
    const myGen = sheetGen.current;
    const isStale = () => sheetGen.current !== myGen;
    setConfirming(true);
    setBookingError(null);
    const dateStr = toDateKey(sheetDate);
    const endTime = getEndTime(sheetSelectedSlot, sheetDuration);

    // Revalidate against FRESH data (not the sheet's cached copy): someone may have booked it, or management may have
    // blocked it, since the sheet opened. A failed lookup falls through - the database remains the authority.
    let freshOutcome: string | null = null;
    try {
      const [bk, mt] = await Promise.all([
        supabase.from('bookings').select('start_time, end_time, user_id, status').eq('court_id', bookingSheet.courtId).eq('date', dateStr).in('status', ACTIVE_BOOKING_STATUSES),
        supabase.from('court_maintenance').select('date, end_date, start_time, end_time').eq('court_id', bookingSheet.courtId),
      ]);
      if (isStale()) { setConfirming(false); return; }
      if (!bk.error && !mt.error) {
        const nowD = new Date();
        const fresh = dateStr < communityToday(nowD) ? 'gone' : revalidateSelection(sheetSelectedSlot, {
          openMins: sheetRules?.booking_start_time ? toMins(sheetRules.booking_start_time) : 7 * 60,
          closeMins: sheetRules?.booking_end_time ? toMins(sheetRules.booking_end_time) : 21 * 60,
          limits: { maxPerDay: sheetRules?.max_reservations_per_day ?? null, maxDurationMins: sheetDurationCap },
          durationMins: sheetDuration,
          isToday: communityToday(nowD) === dateStr,
          nowMins: communityMinutesNow(nowD),
          reservations: (bk.data ?? []).map((b: any) => toSlotReservation(b, dateStr, userId, nowD)),
          blocks: ((mt.data ?? []) as MaintenanceBlock[]).filter(b => isMaintenanceActiveOnDate(b, dateStr)).map(b => ({ start_time: b.start_time, end_time: b.end_time })),
        });
        if (fresh !== 'available') freshOutcome = fresh;
      }
    } catch { /* fall through to the server-side checks */ }
    // Whatever happened above (including a lookup that threw), a superseded sheet must never submit.
    if (isStale()) { setConfirming(false); return; }
    if (freshOutcome) {
      setConfirming(false);
      setSheetSelectedSlot(null);
      setBookingError(
        freshOutcome === 'blocked' ? 'That time is no longer available because the amenity is blocked. Please pick another.'
        : freshOutcome === 'limit' ? 'You have reached the reservation limit for this amenity.'
        : 'That time was just taken. Please pick another.');
      await fetchBookingsForDate(dateStr);
      await fetchMaintenanceForSheet(bookingSheet.courtId, isStale);
      return;
    }
    const { data, error } = await supabase.from('bookings').insert({
      court_id: bookingSheet.courtId, user_id: userId, date: dateStr,
      start_time: `${sheetSelectedSlot}:00`, end_time: `${endTime}:00`,
      play_type: sheetPlayType, status: 'confirmed',
    }).select('status').single();
    setConfirming(false);
    if (isStale()) return; // the booking itself was submitted; only the UI feedback is dropped
    if (!error) {
      // A DB trigger forces status to 'pending' when the amenity is
      // configured with requires_admin_approval — the client always
      // requests 'confirmed', but the persisted row is authoritative.
      if (data?.status === 'pending') {
        setBookingPending(true);
      } else {
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
      }
      await fetchBookingsForDate(dateStr);
      await loadCourts();
      setTimeout(() => { if (isStale()) return; setBookingSheet(null); setBookingSuccess(false); setBookingPending(false); setBookingError(null); }, 1400);
    } else if (error.code === '23P01') {
      setBookingError('That time slot was just taken — please pick another.');
      await fetchBookingsForDate(dateStr);
      await loadCourts();
    } else if (error.message === BLOCKOUT_CONFLICT_MESSAGE) {
      // A maintenance blockout can be created by an admin while this sheet
      // is open with stale slot data — refetch bookings AND maintenance so
      // the now-blocked time disappears instead of letting the resident
      // retry the same request.
      setBookingError('This time is unavailable because the amenity is blocked for maintenance.');
      await fetchBookingsForDate(dateStr);
      await loadCourts();
      await fetchMaintenanceForSheet(bookingSheet.courtId, isStale);
    } else {
      setBookingError(error.message ?? 'Booking failed. Please try again.');
    }
  }

  // ── Filtered courts by active tab ───────────────────────────────────────────
  // loadCourts fetches every approved community; only the ACTIVE community's amenities are shown or actionable.
  const scopedCourts = useMemo(
    () => (activeCommunity ? courts.filter(c => c.hoa_id === activeCommunity.hoaId) : []), // nothing actionable until resolved
    [courts, activeCommunity],
  );
  const tennisCourts = useMemo(() => scopedCourts.filter(c => TENNIS_TYPES.has(c.court_type)), [scopedCourts]);
  const amenityCourts = useMemo(() => scopedCourts.filter(c => !TENNIS_TYPES.has(c.court_type)), [scopedCourts]);
  const visibleCourts = isCommunityMode ? scopedCourts : (activeTab === 'tennis' ? tennisCourts : amenityCourts);

  const courtStatuses = useMemo(() => {
    const map: Record<string, CourtStatus> = {};
    for (const court of courts) {
      // Never present an unloaded or failed day as "open all day": no entry renders as CHECKING, a failure as UNKNOWN.
      const gated = gateAvailability(
        bookingLoad[`${communityToday(now)}:${court.id}`],
        () => computeCourtStatus(court.id, now, bookingsByDate),
        { status: 'booked', statusText: 'UNKNOWN', detailText: 'Availability could not be loaded' } as CourtStatus,
      );
      if (gated) map[court.id] = gated;
    }
    return map;
  }, [courts, now, bookingsByDate, bookingLoad]);

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

  const scheduleMaintenanceForDate = useMemo(() => {
    const dateStr = toDateKey(scheduleDate);
    return maintenanceBlocks.filter(b => isMaintenanceActiveOnDate(b, dateStr));
  }, [maintenanceBlocks, scheduleDate]);

  // Only reservations that are not over, in the ACTIVE community, count as the resident's current ones.
  const currentUserBookings = useMemo(() => {
    const scoped = new Set(scopedCourts.map(c => c.id));
    return selectCurrentReservations(userBookings.filter(b => scoped.has(b.court_id)), now);
  }, [userBookings, scopedCourts, now]);
  // The booking to flag on a court card: today's (community date) current booking; one that has ended is history.
  const todayUserBookings = useMemo(() => currentUserBookings.filter(b => b.date === communityToday(now)), [currentUserBookings, now]);
  const upcomingCount = currentUserBookings.length;
  const playability = useMemo(() => weather ? getPlayability(weather) : null, [weather]);
  const showWeatherOnMain = isTennisMode && topLevelTab === 'hoa' && activeTab === 'tennis';

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <View testID="courts-screen" style={styles.screen}>
      <Header variant="resident" communityName={communityName} />

      <ScrollView ref={scrollRef}
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
                      isMyBooking={todayUserBookings.find(b => b.court_id === court.id) ?? null} now={now}
                      onBook={() => openBookingSheet(court)}
                      onSchedule={() => openScheduleSheet(court)}
                      onReport={() => router.push({ pathname: '/report', params: { courtId: court.id, courtName: court.name, facilityType: court.court_type, returnTo: '/(resident)/courts' } } as any)} />
                  ))}
                </>
              ) : (
                sortedCourts.map(court => (
                  <CourtCard key={court.id} court={court} status={courtStatuses[court.id]}
                    isMyBooking={todayUserBookings.find(b => b.court_id === court.id) ?? null} now={now}
                    onBook={() => openBookingSheet(court)}
                    onSchedule={() => openScheduleSheet(court)}
                    onReport={() => router.push({ pathname: '/report', params: { courtId: court.id, courtName: court.name, facilityType: court.court_type, returnTo: '/(resident)/courts' } } as any)} />
                ))
              )}

              {!courtsLoading && currentUserBookings.length > 0 && (
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
          availabilityStatus={bookingSheet ? (bookingLoad[`${toDateKey(sheetDate)}:${bookingSheet.courtId}`] ?? 'loading') : 'loading'}
          onRetryAvailability={() => { if (bookingSheet) void fetchBookingsForDate(toDateKey(sheetDate), [bookingSheet.courtId]); }}
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
          pending={bookingPending}
          bookingError={bookingError}
          onConfirm={handleConfirm}
          onClose={() => { sheetGen.current += 1; setBookingSheet(null); setBookingError(null); }}
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
          bookings={(bookingsByDate[toDateKey(scheduleDate)] ?? []).filter(b => b.court_id === scheduleSheet.courtId)}
          maintenance={scheduleMaintenanceForDate}
          loading={scheduleLoading}
          availabilityStatus={bookingLoad[`${toDateKey(scheduleDate)}:${scheduleSheet.courtId}`] ?? 'loading'}
          onRetryAvailability={() => { void onScheduleDateChange(scheduleDate); }}
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

function CourtCard({ court, status, isMyBooking, now, onBook, onSchedule, onReport }: {
  court: Court; status: CourtStatus | undefined; isMyBooking: UserBooking | null; now: Date;
  onBook: () => void; onSchedule: () => void; onReport: () => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const s = status ?? { status: 'booked' as const, statusText: 'CHECKING', detailText: '' };
  const isOpen = s.status === 'open';
  const isMine = !!isMyBooking;
  const myKind = isMyBooking ? reservationKind(isMyBooking, now) : null;
  const borderColor = isMine ? (myKind === 'pending' ? Availability.minePending : Availability.mine) : isOpen ? Colors.cyan : theme.border;

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
          <View testID="court-my-reservation" style={styles.myResBadgePill}>
            <ReservationBadge kind={myKind!} label={ownLabel(myKind!)} testID="court-reservation-badge" />
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
  playType, onPlayTypeChange, rules, rulesLoading, availabilityStatus, onRetryAvailability,
  timeSlots, selectedSlot, onSelectSlot,
  duration, availableDurations, isTennis, onDurationChange,
  weather, confirming, success, pending, bookingError, onConfirm, onClose, insets,
}: {
  courtName: string; courtType: string; now: Date;
  sheetDate: Date; onSheetDateChange: (d: Date) => void;
  playType: 'singles' | 'doubles'; onPlayTypeChange: (t: 'singles' | 'doubles') => void;
  rules: AmenityRules | null; rulesLoading: boolean;
  availabilityStatus: 'loading' | 'ok' | 'stale' | 'error'; onRetryAvailability: () => void;
  timeSlots: SlotInfo[]; selectedSlot: string | null; onSelectSlot: (s: string | null) => void;
  duration: number; availableDurations: number[]; isTennis: boolean; onDurationChange: (d: number) => void;
  weather: WeatherData | null;
  confirming: boolean; success: boolean; pending: boolean; bookingError: string | null; onConfirm: () => void; onClose: () => void;
  insets: { bottom: number };
}) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const outdoor = isOutdoor(courtType);
  const [showCalendar, setShowCalendar] = useState(false);
  // Sheet height comes from the window, never from a device constant. Normal phones/desktop: fixed top, a flexible
  // middle that holds the ONLY scroller (the wheel), fixed bottom. If the window is so short that the fixed parts
  // cannot fit (landscape phones), the body scrolls instead and the confirm area stays pinned: nothing is clipped.
  const { height: winH } = useWindowDimensions();
  const constrained = winH < 520;
  const sheetH = Math.round(Math.min(winH * 0.92, 760));
  const Body: any = constrained ? ScrollView : View;
  // While a confirmation is in flight the date, play type, duration and wheel are frozen: the request was built from
  // the selection at tap time and the screen must keep showing exactly that selection until the outcome arrives.
  const frozen = confirming ? ({ pointerEvents: 'none' } as const) : null;
  const bodyProps = constrained
    ? { style: [{ flex: 1 }, frozen], showsVerticalScrollIndicator: false, keyboardShouldPersistTaps: 'handled', contentContainerStyle: styles.sheetScrollContent }
    : { style: [styles.sheetBody, frozen] };
  // Background page must not scroll behind the open sheet (web).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Primary date buttons: Today + Tomorrow
  const primaryDates = useMemo(() => {
    const t = communityDate(now);
    const tom = new Date(t); tom.setDate(t.getDate() + 1);
    return [t, tom];
  }, [now]);

  // Calendar bounds: today → advance_booking_days from admin rules
  const calMinDate = useMemo(() => {
    return communityDate(now);
  }, [now]);

  const calMaxDate = useMemo(() => {
    const advDays = rules?.advance_booking_days ?? 7;
    const d = communityDate(now);
    d.setDate(d.getDate() + advDays);
    return d;
  }, [rules, now]);

  const isMoreDate = useMemo(
    () => sheetDate.toDateString() !== primaryDates[0].toDateString() &&
          sheetDate.toDateString() !== primaryDates[1].toDateString(),
    [sheetDate, primaryDates]
  );

  const sheetIsToday = toDateKey(sheetDate) === communityToday(now);

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
        <View testID="booking-sheet" style={[styles.sheetContainer, { height: sheetH, maxHeight: sheetH }]}>
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

          {/* Body: fixed controls on top, flexible middle (wheel), confirm area pinned below */}
          <Body {...bodyProps}>

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

          {/* Flexible middle: the wheel (or the date calendar) takes all remaining height */}
          <View testID="sheet-middle" style={constrained ? { height: 52 * 3 + 56 } : { flex: 1, minHeight: 0 }}>
            {showCalendar ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <CalendarPicker
                  selectedDate={sheetDate}
                  onSelect={(d) => { onSheetDateChange(d); setShowCalendar(false); }}
                  minDate={calMinDate}
                  maxDate={calMaxDate}
                  theme={theme}
                  testID="booking-calendar"
                />
              </ScrollView>
            ) : rulesLoading || availabilityStatus === 'loading' ? (
              <ActivityIndicator testID="availability-loading" color={Colors.cyan} style={{ marginVertical: 20 }} />
            ) : availabilityStatus === 'error' ? (
              <View style={styles.noSlotsState} testID="availability-error">
                <Text style={styles.noSlotsText}>Could not load this date's reservations.</Text>
                <TouchableOpacity testID="availability-retry" onPress={onRetryAvailability} style={{ marginTop: 12, minHeight: 44, justifyContent: 'center' }}>
                  <Text style={styles.noSlotsText}>Tap to retry</Text>
                </TouchableOpacity>
              </View>
            ) : timeSlots.length === 0 ? (
              <View style={styles.noSlotsState} testID="no-slots-state">
                <Text style={styles.noSlotsText}>
                  {sheetIsToday ? 'No remaining times today' : 'No available times for this date'}
                </Text>
              </View>
            ) : (
              <>
                {availabilityStatus === 'stale' && (
                  <TouchableOpacity testID="availability-stale" onPress={onRetryAvailability} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
                    <Text style={styles.allUnavailableText}>Could not refresh this date, so these times may be out of date. Tap to retry.</Text>
                  </TouchableOpacity>
                )}
                {!timeSlots.some(isSelectable) && (
                  <Text testID="all-unavailable-note" style={styles.allUnavailableText}>
                    {timeSlots.some(s => s.state === 'limit')
                      ? 'You have reached the reservation limit for this amenity on this date.'
                      : 'Every time on this date is already reserved or blocked.'}
                  </Text>
                )}
                <TimeSlotWheel
                  fill
                  slots={timeSlots}
                  selectedSlot={selectedSlot}
                  onSelectSlot={onSelectSlot}
                  weather={weather}
                  outdoor={outdoor}
                  sheetDate={sheetDate}
                  now={now}
                  theme={theme}
                />
                <ReservationLegend theme={theme} variant="picker" hoursNote={hoursNoteFor(rules)} />
              </>
            )}
          </View>

          </Body>

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
            {!!rules?.requires_admin_approval && !success && (
              <Text testID="booking-approval-notice" style={styles.approvalNoticeText}>
                This amenity needs administrator approval. Your request is not confirmed until it is approved.
              </Text>
            )}
            <TouchableOpacity testID="confirm-booking-btn"
              style={[styles.confirmBtn, (!selectedSlot || confirming) && styles.confirmBtnDisabled, (success || pending) && styles.confirmBtnSuccess]}
              onPress={onConfirm} disabled={!selectedSlot || confirming || success || pending} activeOpacity={0.85}>
              {confirming ? <ActivityIndicator color={Colors.white} size="small" /> : (
                <Text style={styles.confirmBtnText}>
                  {success ? '✓ Booked!' : pending ? '✓ Submitted — Pending Approval' : selectedSlot ? (rules?.requires_admin_approval ? 'Request Reservation' : 'Confirm Reservation') : 'Select a time slot'}
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

function ScheduleSheet({ courtName, courtType, now, scheduleDate, onDateChange, rules, bookings, maintenance, loading, availabilityStatus, onRetryAvailability, userId, onBook, onClose, insets }: {
  courtName: string; courtType: string; now: Date; scheduleDate: Date;
  onDateChange: (d: Date) => void; rules: AmenityRules | null;
  bookings: TodayBooking[]; maintenance: MaintenanceBlock[]; loading: boolean;
  availabilityStatus: 'loading' | 'ok' | 'stale' | 'error'; onRetryAvailability: () => void;
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
    const d = communityDate(now);
    d.setDate(d.getDate() + advDays);
    return d;
  }, [rules, now]);

  // Past dates are view-only — suppress Reserve CTA
  const isPastDate = useMemo(() => {
    return toDateKey(scheduleDate) < communityToday(now); // community calendar day, not the phone's
  }, [scheduleDate, now]);

  const dateLabel = scheduleDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  // 30 minute cells, one merged row per reservation / blockout (see lib/scheduleRows.ts).
  const timeBlocks = useMemo(() => buildScheduleRows({
    openMins: rules?.booking_start_time ? toMins(rules.booking_start_time) : 7 * 60,
    closeMins: rules?.booking_end_time ? toMins(rules.booking_end_time) : 21 * 60,
    bookings,
    maintenance,
    userId,
    phase: { isPast: isPastDate, isToday: toDateKey(scheduleDate) === communityToday(now), nowMins: communityMinutesNow(now) },
  }).map((r) => ({ slotStr: r.start, label: `${formatTime(r.start)} – ${formatTime(r.end)}`, type: r.type, onGrid: r.onGrid, past: r.past })),
  [bookings, maintenance, userId, rules, isPastDate, scheduleDate, now]);

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
          {!showSchedCalendar && (loading || availabilityStatus === 'loading' ? (
            <ActivityIndicator color={Colors.cyan} style={{ marginVertical: 24 }} />
          ) : availabilityStatus === 'error' ? (
            <View testID="schedule-error" style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Text style={styles.scheduleBlockStatus}>Could not load this date's reservations.</Text>
              <TouchableOpacity testID="schedule-retry" onPress={onRetryAvailability} style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={styles.scheduleBookBtnText}>Tap to retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
            {availabilityStatus === 'stale' && (
              <TouchableOpacity testID="schedule-stale" onPress={onRetryAvailability} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={styles.scheduleBlockStatus}>Could not refresh this date, so this may be out of date. Tap to retry.</Text>
              </TouchableOpacity>
            )}
            <ScrollView testID="schedule-blocks" showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
              <View>
                {timeBlocks.map((block, i) => {
                  const isAvail = block.type === 'available';
                  const isMaint = block.type === 'maintenance';
                  const isMine = block.type === 'mine';
                  const isPendingMine = block.type === 'mine_pending';
                  const isBooked = block.type === 'booked';
                  const past = block.past && !isMaint;
                  // Text + icon + colour for every state (colour is never the only cue). Past rows are muted history.
                  const accent = past ? Availability.past : isMaint ? Availability.blocked : isMine ? Availability.mine : isPendingMine ? Availability.minePending : isBooked ? Availability.reserved : Availability.available;
                  const bg = past ? Availability.pastBg : isMaint ? Availability.blockedBg : isMine ? Availability.mineBg : isPendingMine ? Availability.minePendingBg : isBooked ? Availability.reservedBg : 'transparent';
                  const statusText = isAvail ? (past ? 'PASSED' : 'OPEN')
                    : isMaint ? 'BLOCKED'
                    : isMine ? (past ? 'COMPLETED' : 'MY RESERVATION')
                    : isPendingMine ? (past ? 'REQUEST EXPIRED' : 'PENDING APPROVAL')
                    : (past ? 'PAST' : 'RESERVED');
                  const Icon = isMaint ? Lock : isMine ? Check : isPendingMine ? Clock : past ? History : null;
                  return (
                    <View key={i} testID={`schedule-block-${block.type}${past ? '-past' : ''}`}
                      style={[
                        styles.scheduleRow,
                        isAvail && !past && styles.scheduleRowAvail,
                        !isAvail && { borderLeftWidth: 4, borderLeftColor: accent, paddingLeft: 10, backgroundColor: bg },
                      ]}>
                      <Text style={[
                        styles.scheduleRowLabel,
                        isAvail && !past && styles.scheduleRowLabelAvail,
                        (past || isBooked) && { color: theme.textMuted },
                        (isMine || isPendingMine) && !past && { color: theme.textPrimary },
                      ]}>{block.label}</Text>
                      {isAvail && !past && !isPastDate && block.onGrid ? (
                        <TouchableOpacity testID={`schedule-book-${block.slotStr}`} style={styles.scheduleBookBtn}
                          onPress={() => onBook(block.slotStr)} activeOpacity={0.7}>
                          <Text style={styles.scheduleBookBtnText}>Reserve →</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          {Icon ? <Icon size={12} color={past ? theme.textMuted : accent} strokeWidth={2.5} /> : null}
                          <Text style={[styles.scheduleBlockStatus, { color: past ? theme.textMuted : isAvail ? theme.textMuted : accent === Availability.reserved ? theme.textMuted : accent }]}>{statusText}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
              <ReservationLegend theme={theme} variant="schedule" hoursNote={hoursNoteFor(rules)} />
            </ScrollView>
            </>
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
  myResBadgePill: {},
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
  sheetBody: { flex: 1, minHeight: 0, paddingHorizontal: Spacing.pagePx },
  allUnavailableText: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, color: theme.textMuted, textAlign: 'center', marginBottom: 8 },
  sheetConfirmArea: { paddingHorizontal: Spacing.pagePx, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border, gap: 8 },
  approvalNoticeText: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, color: Availability.minePending, textAlign: 'center' as const },
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
  scheduleRowMine: { borderLeftWidth: 4, borderLeftColor: Availability.mine, paddingLeft: 10, backgroundColor: Availability.mineBg },
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
