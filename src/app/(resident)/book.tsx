import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bell,
  Building2,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudLightning,
  CloudRain,
  Dumbbell,
  Flame,
  Sun,
  Waves,
  X,
} from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors,
  FontFamily,
  FontSize,
  MaxWidth,
  Radius,
  Spacing,
} from '@/constants/design';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CardSkeleton } from '@/components/ui/Skeleton';
import type { Database } from '@/lib/types';

// ─── Types ────────────────────────────────────────────────────────

type Court = Database['public']['Tables']['courts']['Row'];
type NetworkMode = 'hoa' | 'other';
type AmenityFilter = 'tennis' | 'amenities';
type PlayType = 'singles' | 'doubles' | 'family' | 'group';
type WeatherCondition = 'sunny' | 'partly_cloudy' | 'cloudy' | 'rainy' | 'stormy';
type SlotStatus = 'available' | 'booked_mine' | 'booked_other' | 'maintenance';

interface AmenityRules {
  advance_booking_days: number | null;
  booking_start_time: string | null;
  booking_end_time: string | null;
  singles_duration_minutes: number | null;
  doubles_duration_minutes: number | null;
  family_duration_minutes: number | null;
  group_duration_minutes: number | null;
  singles_only: boolean | null;
  doubles_only: boolean | null;
}

interface HourlyWeather {
  hour: number;
  temp: number;
  condition: WeatherCondition;
  rainPct: number;
}

interface TimeSlot {
  start: string;
  end: string;
  label: string;
}

interface ScheduleEntry {
  slot: TimeSlot;
  status: SlotStatus;
}

// ─── Constants ────────────────────────────────────────────────────

const OUTDOOR_TYPES = new Set(['tennis', 'pickleball', 'basketball', 'pool', 'barbecue']);
const TENNIS_TYPES = new Set(['tennis', 'pickleball']);
const DEFAULT_START_H = 7;
const DEFAULT_END_H = 21;
const DEFAULT_ADVANCE_DAYS = 14;
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ─── Date/time helpers ────────────────────────────────────────────

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function todayStr(): string {
  return toDateStr(new Date());
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function formatDisplayDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const now = startOfDay(new Date());
  const tomorrow = addDays(now, 1);
  if (d.getTime() === now.getTime()) return 'Today';
  if (d.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function parseHour(t: string): number {
  return parseInt(t.split(':')[0], 10);
}

function hourToTimeStr(h: number): string {
  return `${pad2(h)}:00:00`;
}

function hourLabel(h: number): string {
  if (h === 0) return '12:00 AM';
  if (h === 12) return '12:00 PM';
  if (h < 12) return `${h}:00 AM`;
  return `${h - 12}:00 PM`;
}

function buildTimeSlots(startH: number, endH: number, durationMin: number): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const dh = Math.floor(durationMin / 60);
  const dm = durationMin % 60;
  for (let h = startH; h + dh + (dm > 0 ? 1 : 0) <= endH; h++) {
    const endHour = h + dh;
    slots.push({
      start: hourToTimeStr(h),
      end: dm > 0 ? `${pad2(endHour)}:${pad2(dm)}:00` : hourToTimeStr(endHour),
      label: hourLabel(h),
    });
  }
  return slots;
}

// ─── Weather helpers ──────────────────────────────────────────────

function mapWmoCode(code: number): WeatherCondition {
  if (code <= 1) return 'sunny';
  if (code === 2) return 'partly_cloudy';
  if (code === 3) return 'cloudy';
  if (code >= 45 && code <= 48) return 'cloudy';
  if (code >= 51 && code <= 82) return 'rainy';
  if (code >= 95) return 'stormy';
  return 'cloudy';
}

async function fetchHourlyWeather(date: string): Promise<HourlyWeather[]> {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=18.4655&longitude=-66.1057` +
      `&hourly=temperature_2m,weather_code,precipitation_probability` +
      `&timezone=America%2FPuerto_Rico` +
      `&start_date=${date}&end_date=${date}` +
      `&temperature_unit=fahrenheit`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.hourly?.time ?? []).map((t: string, i: number) => ({
      hour: parseInt(t.split('T')[1].split(':')[0], 10),
      temp: Math.round(data.hourly.temperature_2m[i]),
      condition: mapWmoCode(data.hourly.weather_code[i]),
      rainPct: data.hourly.precipitation_probability?.[i] ?? 0,
    }));
  } catch {
    return [];
  }
}

// ─── Sub-components ───────────────────────────────────────────────

function SlotWeatherIcon({ condition, size = 13 }: { condition: WeatherCondition; size?: number }) {
  switch (condition) {
    case 'sunny':
      return <Sun color={Colors.accentCyan} size={size} strokeWidth={1.5} />;
    case 'rainy':
      return <CloudRain color='#5BB8E0' size={size} strokeWidth={1.5} />;
    case 'stormy':
      return <CloudLightning color={Colors.coral} size={size} strokeWidth={1.5} />;
    default:
      return <Cloud color={Colors.textMuted} size={size} strokeWidth={1.5} />;
  }
}

function CourtIcon({ type }: { type: string }) {
  switch (type) {
    case 'pool':
    case 'jacuzzi':
    case 'spa':
      return <Waves color={Colors.accentCyan} size={20} strokeWidth={1.5} />;
    case 'barbecue':
      return <Flame color={Colors.accentCyan} size={20} strokeWidth={1.5} />;
    case 'clubhouse':
      return <Building2 color={Colors.accentCyan} size={20} strokeWidth={1.5} />;
    default:
      return <Dumbbell color={Colors.accentCyan} size={20} strokeWidth={1.5} />;
  }
}

// ─── Calendar Grid ────────────────────────────────────────────────

interface CalendarGridProps {
  selectedDate: string;
  minDate: Date;
  maxDate: Date;
  onSelect: (iso: string) => void;
}

function CalendarGrid({ selectedDate, minDate, maxDate, onSelect }: CalendarGridProps) {
  const init = new Date(selectedDate + 'T00:00:00');
  const [viewYear, setViewYear] = useState(init.getFullYear());
  const [viewMonth, setViewMonth] = useState(init.getMonth());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDOW = new Date(viewYear, viewMonth, 1).getDay();
  const todayISO = todayStr();
  const minTime = startOfDay(minDate).getTime();
  const maxTime = startOfDay(maxDate).getTime();

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  const cells: Array<number | null> = [
    ...Array(firstDOW).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <View>
      <View style={calSt.navRow}>
        <TouchableOpacity
          style={calSt.navBtn}
          onPress={prevMonth}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ChevronLeft color={Colors.navy} size={20} strokeWidth={1.5} />
        </TouchableOpacity>
        <Text style={calSt.monthLabel}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
        <TouchableOpacity
          style={calSt.navBtn}
          onPress={nextMonth}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ChevronRight color={Colors.navy} size={20} strokeWidth={1.5} />
        </TouchableOpacity>
      </View>

      <View style={calSt.weekRow}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <Text key={i} style={calSt.weekDay}>{d}</Text>
        ))}
      </View>

      <View style={calSt.grid}>
        {cells.map((day, i) => {
          if (day === null) return <View key={`e${i}`} style={calSt.cell} />;
          const dDate = new Date(viewYear, viewMonth, day);
          const iso = toDateStr(dDate);
          const dTime = startOfDay(dDate).getTime();
          const disabled = dTime < minTime || dTime > maxTime;
          const selected = iso === selectedDate;
          const isToday = iso === todayISO;

          return (
            <TouchableOpacity
              key={iso}
              style={[
                calSt.cell,
                selected && calSt.cellSelected,
                isToday && !selected && calSt.cellToday,
              ]}
              onPress={() => { if (!disabled) onSelect(iso); }}
              disabled={disabled}
              activeOpacity={0.7}>
              <Text style={[
                calSt.cellText,
                disabled && calSt.cellDisabled,
                selected && calSt.cellSelectedText,
                isToday && !selected && calSt.cellTodayText,
              ]}>
                {day}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const calSt = StyleSheet.create({
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  monthLabel: {
    fontFamily: FontFamily.manropeBold,
    fontSize: FontSize.cardTitle,
    color: Colors.navy,
  },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.metadata,
    color: Colors.textMuted,
    letterSpacing: 0.5,
    paddingVertical: 4,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%` as any,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellSelected: {
    backgroundColor: Colors.navy,
    borderRadius: Radius.pill,
  },
  cellToday: {
    borderWidth: 1,
    borderColor: Colors.accentCyan,
    borderRadius: Radius.pill,
  },
  cellText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 13,
    color: Colors.navy,
  },
  cellDisabled: { color: Colors.textMuted, opacity: 0.35 },
  cellSelectedText: { color: Colors.white },
  cellTodayText: { color: Colors.accentCyan },
});

// ─── Main Screen ──────────────────────────────────────────────────

export default function ReserveScreen() {
  const insets = useSafeAreaInsets();

  // Auth / HOA context
  const [userId, setUserId] = useState('');
  const [hoaId, setHoaId] = useState('');

  // Courts list
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Top-level navigation
  const [networkMode, setNetworkMode] = useState<NetworkMode>('hoa');
  const [amenityFilter, setAmenityFilter] = useState<AmenityFilter>('tennis');

  // Active court (shared across sheets)
  const [activeCourt, setActiveCourt] = useState<Court | null>(null);

  // ── Booking sheet state ──
  const [bookingVisible, setBookingVisible] = useState(false);
  const [bookingDate, setBookingDate] = useState(todayStr());
  const [calPickerVisible, setCalPickerVisible] = useState(false);
  const [rules, setRules] = useState<AmenityRules | null>(null);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [playType, setPlayType] = useState<PlayType>('singles');
  const [bookedStarts, setBookedStarts] = useState<string[]>([]);
  const [maintenanceWindows, setMaintenanceWindows] = useState<Array<{ start: string; end: string }>>([]);
  const [slotLoading, setSlotLoading] = useState(false);
  const [confirmSlot, setConfirmSlot] = useState<TimeSlot | null>(null);
  const [bookingInFlight, setBookingInFlight] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [hourlyWeather, setHourlyWeather] = useState<HourlyWeather[]>([]);

  // ── Schedule sheet state ──
  const [scheduleVisible, setScheduleVisible] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(todayStr());
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleRules, setScheduleRules] = useState<AmenityRules | null>(null);

  // ────────────────────────────────────────────────────────────────
  // Data loading
  // ────────────────────────────────────────────────────────────────

  async function loadCourts() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    const { data: mem } = await supabase
      .from('hoa_memberships')
      .select('hoa_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    const hId = mem?.hoa_id ?? '';
    setHoaId(hId);

    if (hId) {
      const { data } = await supabase
        .from('courts')
        .select('*')
        .eq('hoa_id', hId)
        .order('name');
      setCourts(data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { loadCourts(); }, []);

  async function onRefresh() {
    setRefreshing(true);
    await loadCourts();
    setRefreshing(false);
  }

  async function loadRulesAndAvailability(
    courtId: string,
    date: string,
    courtType: string,
    currentHoaId: string,
  ) {
    setSlotLoading(true);
    setRulesLoading(true);

    const [rulesRes, bookingsRes, maintRes] = await Promise.all([
      supabase
        .from('amenity_rules')
        .select('advance_booking_days,booking_start_time,booking_end_time,singles_duration_minutes,doubles_duration_minutes,family_duration_minutes,group_duration_minutes,singles_only,doubles_only')
        .eq('hoa_id', currentHoaId)
        .eq('amenity_id', courtId)
        .maybeSingle(),
      supabase
        .from('bookings')
        .select('start_time')
        .eq('court_id', courtId)
        .eq('date', date)
        .neq('status', 'cancelled'),
      supabase
        .from('court_maintenance')
        .select('start_time, end_time')
        .eq('court_id', courtId)
        .eq('date', date),
    ]);

    setRules(rulesRes.data ?? null);
    setRulesLoading(false);
    setBookedStarts((bookingsRes.data ?? []).map(b => b.start_time));
    setMaintenanceWindows((maintRes.data ?? []).map(m => ({ start: m.start_time, end: m.end_time })));
    setSlotLoading(false);

    if (OUTDOOR_TYPES.has(courtType)) {
      fetchHourlyWeather(date).then(setHourlyWeather);
    } else {
      setHourlyWeather([]);
    }
  }

  async function openBooking(court: Court, prefillDate?: string) {
    const date = prefillDate ?? todayStr();
    setActiveCourt(court);
    setBookingDate(date);
    setConfirmSlot(null);
    setBookingSuccess(false);
    setPlayType('singles');
    setBookingVisible(true);
    await loadRulesAndAvailability(court.id, date, court.court_type, hoaId);
  }

  async function changeBookingDate(date: string) {
    setBookingDate(date);
    setConfirmSlot(null);
    if (activeCourt) {
      await loadRulesAndAvailability(activeCourt.id, date, activeCourt.court_type, hoaId);
    }
  }

  async function openSchedule(court: Court) {
    const date = todayStr();
    setActiveCourt(court);
    setScheduleDate(date);
    setScheduleVisible(true);
    await loadSchedule(court.id, date, hoaId);
  }

  async function loadSchedule(courtId: string, date: string, currentHoaId: string) {
    setScheduleLoading(true);

    const [rulesRes, bookingsRes, maintRes] = await Promise.all([
      supabase
        .from('amenity_rules')
        .select('advance_booking_days,booking_start_time,booking_end_time,singles_duration_minutes,doubles_duration_minutes,family_duration_minutes,group_duration_minutes,singles_only,doubles_only')
        .eq('hoa_id', currentHoaId)
        .eq('amenity_id', courtId)
        .maybeSingle(),
      supabase
        .from('bookings')
        .select('start_time, end_time, user_id')
        .eq('court_id', courtId)
        .eq('date', date)
        .neq('status', 'cancelled'),
      supabase
        .from('court_maintenance')
        .select('start_time, end_time')
        .eq('court_id', courtId)
        .eq('date', date),
    ]);

    const r = rulesRes.data;
    setScheduleRules(r ?? null);
    const startH = r?.booking_start_time ? parseHour(r.booking_start_time) : DEFAULT_START_H;
    const endH = r?.booking_end_time ? parseHour(r.booking_end_time) : DEFAULT_END_H;
    const dur = r?.singles_duration_minutes ?? 60;
    const slots = buildTimeSlots(startH, endH, dur);

    const bookings: Array<{ start_time: string; user_id: string }> = bookingsRes.data ?? [];
    const maint: Array<{ start_time: string; end_time: string }> = maintRes.data ?? [];

    const entries: ScheduleEntry[] = slots.map(slot => {
      const slotH = parseHour(slot.start);
      const inMaint = maint.some(m => {
        const ms = parseHour(m.start_time);
        const me = parseHour(m.end_time);
        return slotH >= ms && slotH < me;
      });
      if (inMaint) return { slot, status: 'maintenance' };

      const booking = bookings.find(b => b.start_time === slot.start);
      if (booking) {
        return { slot, status: booking.user_id === userId ? 'booked_mine' : 'booked_other' };
      }
      return { slot, status: 'available' };
    });

    setScheduleEntries(entries);
    setScheduleLoading(false);
  }

  async function changeScheduleDate(date: string) {
    setScheduleDate(date);
    if (activeCourt) await loadSchedule(activeCourt.id, date, hoaId);
  }

  async function confirmBooking() {
    if (!confirmSlot || !activeCourt || !userId) return;
    setBookingInFlight(true);
    await supabase.from('bookings').insert({
      court_id: activeCourt.id,
      user_id: userId,
      date: bookingDate,
      start_time: confirmSlot.start,
      end_time: confirmSlot.end,
      status: 'confirmed',
      play_type: playType,
    });
    setBookingInFlight(false);
    setConfirmSlot(null);
    setBookingSuccess(true);
    await loadRulesAndAvailability(activeCourt.id, bookingDate, activeCourt.court_type, hoaId);
    setTimeout(() => setBookingSuccess(false), 3000);
  }

  // ────────────────────────────────────────────────────────────────
  // Derived values
  // ────────────────────────────────────────────────────────────────

  const today = startOfDay(new Date());
  const tomorrowIso = toDateStr(addDays(today, 1));
  const advanceDays = rules?.advance_booking_days ?? DEFAULT_ADVANCE_DAYS;
  const maxBookingDate = addDays(today, advanceDays);
  const scheduleAdvanceDays = scheduleRules?.advance_booking_days ?? DEFAULT_ADVANCE_DAYS;
  const maxScheduleDate = addDays(today, scheduleAdvanceDays);

  const isTennis = activeCourt ? TENNIS_TYPES.has(activeCourt.court_type) : false;
  const singlesOnly = rules?.singles_only ?? false;
  const doublesOnly = rules?.doubles_only ?? false;
  const showPlayTypeSelector = isTennis && !singlesOnly && !doublesOnly;

  const effectivePlayType: PlayType =
    singlesOnly ? 'singles' :
    doublesOnly ? 'doubles' :
    isTennis ? playType : 'family';

  const durationMin =
    effectivePlayType === 'singles' ? (rules?.singles_duration_minutes ?? 60) :
    effectivePlayType === 'doubles' ? (rules?.doubles_duration_minutes ?? 90) :
    effectivePlayType === 'family' ? (rules?.family_duration_minutes ?? 60) :
    (rules?.group_duration_minutes ?? 60);

  const startH = rules?.booking_start_time ? parseHour(rules.booking_start_time) : DEFAULT_START_H;
  const endH = rules?.booking_end_time ? parseHour(rules.booking_end_time) : DEFAULT_END_H;
  const timeSlots = rulesLoading ? [] : buildTimeSlots(startH, endH, durationMin);

  const filteredCourts = courts.filter(c =>
    amenityFilter === 'tennis'
      ? TENNIS_TYPES.has(c.court_type)
      : !TENNIS_TYPES.has(c.court_type)
  );

  function getSlotStatus(slot: TimeSlot): 'available' | 'booked' | 'maintenance' {
    const slotH = parseHour(slot.start);
    const inMaint = maintenanceWindows.some(m => {
      const ms = parseHour(m.start);
      const me = parseHour(m.end);
      return slotH >= ms && slotH < me;
    });
    if (inMaint) return 'maintenance';
    if (bookedStarts.includes(slot.start)) return 'booked';
    return 'available';
  }

  function getWeatherForHour(h: number): HourlyWeather | undefined {
    return hourlyWeather.find(w => w.hour === h);
  }

  const isBookingDateToday = bookingDate === todayStr();
  const isBookingDateTomorrow = bookingDate === tomorrowIso;
  const isBookingDateOther = !isBookingDateToday && !isBookingDateTomorrow;

  // ────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────

  return (
    <View style={st.screen}>

      {/* ── Page Header ── */}
      <View style={[st.header, { paddingTop: Math.max(insets.top, 20) + 8 }]}>
        <View style={st.headerRow}>
          <Text style={st.headerTitle}>Reserve</Text>
          <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Bell color="#FFFFFF" size={22} strokeWidth={1.5} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={st.scroll}
        contentContainerStyle={st.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accentCyan} />
        }
        showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          {/* ── My HOA / Club | Other ── */}
          <View style={st.segRow}>
            <TouchableOpacity
              style={[st.segBtn, networkMode === 'hoa' && st.segBtnActive]}
              onPress={() => setNetworkMode('hoa')}
              activeOpacity={0.85}>
              <Text style={[st.segLabel, networkMode === 'hoa' && st.segLabelActive]}>
                My HOA / Club
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[st.segBtn, networkMode === 'other' && st.segBtnActive]}
              onPress={() => setNetworkMode('other')}
              activeOpacity={0.85}>
              <Text style={[st.segLabel, networkMode === 'other' && st.segLabelActive]}>
                Other
              </Text>
            </TouchableOpacity>
          </View>

          {networkMode === 'other' ? (

            /* ── Other: coming soon ── */
            <View style={st.otherPlaceholder}>
              <CalendarDays color={Colors.textMuted} size={44} strokeWidth={1.5} />
              <Text style={st.otherTitle}>Public Courts Coming Soon</Text>
              <Text style={st.otherSub}>
                Search public courts and clubs near you — launching later this year.
              </Text>
            </View>

          ) : (
            <>
              {/* ── Tennis | Amenities ── */}
              <View style={st.filterRow}>
                <TouchableOpacity
                  style={[st.filterBtn, amenityFilter === 'tennis' && st.filterBtnActive]}
                  onPress={() => setAmenityFilter('tennis')}
                  activeOpacity={0.85}>
                  <Text style={[st.filterLabel, amenityFilter === 'tennis' && st.filterLabelActive]}>
                    Tennis
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.filterBtn, amenityFilter === 'amenities' && st.filterBtnActive]}
                  onPress={() => setAmenityFilter('amenities')}
                  activeOpacity={0.85}>
                  <Text style={[st.filterLabel, amenityFilter === 'amenities' && st.filterLabelActive]}>
                    Amenities
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ── Facility cards ── */}
              {loading ? (
                <>
                  <CardSkeleton />
                  <View style={{ height: Spacing.cardGap }} />
                  <CardSkeleton />
                </>
              ) : filteredCourts.length === 0 ? (
                <View style={st.emptyWrap}>
                  <CalendarDays color={Colors.textMuted} size={36} strokeWidth={1.5} />
                  <Text style={st.emptyTitle}>
                    No {amenityFilter === 'tennis' ? 'courts' : 'amenities'} found
                  </Text>
                  <Text style={st.emptySub}>
                    Contact your HOA admin to add facilities.
                  </Text>
                </View>
              ) : (
                filteredCourts.map(court => (
                  <View key={court.id} style={st.courtCardWrap}>
                    <Card>
                      {/* Court identity row */}
                      <View style={st.courtTop}>
                        <View style={st.courtIconBg}>
                          <CourtIcon type={court.court_type} />
                        </View>
                        <View style={st.courtInfo}>
                          <Text style={st.courtName}>{court.name}</Text>
                          <Text style={st.courtType}>
                            {court.court_type.charAt(0).toUpperCase() + court.court_type.slice(1)}
                          </Text>
                        </View>
                      </View>

                      {/* Action row */}
                      <View style={st.courtActions}>
                        <TouchableOpacity
                          style={st.scheduleBtn}
                          onPress={() => openSchedule(court)}
                          activeOpacity={0.85}>
                          <Text style={st.scheduleBtnLabel}>View Schedule</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={st.reserveBtn}
                          onPress={() => openBooking(court)}
                          activeOpacity={0.85}>
                          <Text style={st.reserveBtnLabel}>Play Now</Text>
                        </TouchableOpacity>
                      </View>
                    </Card>
                  </View>
                ))
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* ══════════════════════════════════════════════════════════
          BOOKING SHEET
      ══════════════════════════════════════════════════════════ */}
      <Modal
        visible={bookingVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setBookingVisible(false)}>
        <SafeAreaView style={st.sheet} edges={['top', 'bottom']}>

          {/* Sheet header */}
          <View style={st.sheetHeader}>
            <Text style={st.sheetTitle} numberOfLines={1}>
              {activeCourt?.name ?? 'Reserve'}
            </Text>
            <TouchableOpacity
              onPress={() => setBookingVisible(false)}
              style={st.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X color={Colors.textMuted} size={20} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={st.sheetBody}
            showsVerticalScrollIndicator={false}>

            {/* Success banner */}
            {bookingSuccess && (
              <View style={st.successBanner}>
                <Check color={Colors.accentCyan} size={16} strokeWidth={2} />
                <Text style={st.successText}>Booked! See you on the court.</Text>
              </View>
            )}

            {/* ── Date selector ── */}
            <Text style={st.fieldLabel}>DATE</Text>
            <View style={st.dateBtnRow}>
              <TouchableOpacity
                style={[st.dateBtn, isBookingDateToday && st.dateBtnActive]}
                onPress={() => changeBookingDate(todayStr())}
                activeOpacity={0.85}>
                <Text style={[st.dateBtnLabel, isBookingDateToday && st.dateBtnLabelActive]}>
                  Today
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.dateBtn, isBookingDateTomorrow && st.dateBtnActive]}
                onPress={() => changeBookingDate(tomorrowIso)}
                activeOpacity={0.85}>
                <Text style={[st.dateBtnLabel, isBookingDateTomorrow && st.dateBtnLabelActive]}>
                  Tomorrow
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.dateBtn, isBookingDateOther && st.dateBtnActive]}
                onPress={() => setCalPickerVisible(true)}
                activeOpacity={0.85}>
                <Text style={[st.dateBtnLabel, isBookingDateOther && st.dateBtnLabelActive]} numberOfLines={1}>
                  {isBookingDateOther ? formatDisplayDate(bookingDate) : 'More Dates'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* ── Play type (tennis courts only) ── */}
            {showPlayTypeSelector && (
              <>
                <Text style={[st.fieldLabel, { marginTop: Spacing.sectionGap }]}>TYPE</Text>
                <View style={st.dateBtnRow}>
                  <TouchableOpacity
                    style={[st.dateBtn, playType === 'singles' && st.dateBtnActive]}
                    onPress={() => setPlayType('singles')}
                    activeOpacity={0.85}>
                    <Text style={[st.dateBtnLabel, playType === 'singles' && st.dateBtnLabelActive]}>
                      Singles
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[st.dateBtn, playType === 'doubles' && st.dateBtnActive]}
                    onPress={() => setPlayType('doubles')}
                    activeOpacity={0.85}>
                    <Text style={[st.dateBtnLabel, playType === 'doubles' && st.dateBtnLabelActive]}>
                      Doubles
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* ── Duration (informational) ── */}
            {!rulesLoading && (
              <View style={st.durationInfo}>
                <Text style={st.durationText}>
                  {effectivePlayType.charAt(0).toUpperCase() + effectivePlayType.slice(1)} · {durationMin} min
                </Text>
              </View>
            )}

            {/* ── Available times ── */}
            <Text style={[st.fieldLabel, { marginTop: Spacing.sectionGap }]}>AVAILABLE TIMES</Text>

            {(slotLoading || rulesLoading) ? (
              <ActivityIndicator
                color={Colors.accentCyan}
                style={{ marginVertical: 24 }}
              />
            ) : timeSlots.length === 0 ? (
              <Text style={st.noSlotsText}>No available slots for this date.</Text>
            ) : (
              <View style={st.slotsWrap}>
                {timeSlots.map(slot => {
                  const slotStatus = getSlotStatus(slot);
                  const isAvail = slotStatus === 'available';
                  const isSelected = confirmSlot?.start === slot.start;
                  const slotH = parseHour(slot.start);
                  const wx = OUTDOOR_TYPES.has(activeCourt?.court_type ?? '')
                    ? getWeatherForHour(slotH)
                    : undefined;

                  return (
                    <TouchableOpacity
                      key={slot.start}
                      style={[
                        st.slotRow,
                        isSelected && st.slotRowSelected,
                        !isAvail && st.slotRowUnavail,
                      ]}
                      onPress={() => {
                        if (isAvail) setConfirmSlot(isSelected ? null : slot);
                      }}
                      disabled={!isAvail}
                      activeOpacity={0.75}>

                      {/* Time label */}
                      <Text style={[
                        st.slotTime,
                        isSelected && st.slotTimeSelected,
                        !isAvail && st.slotTimeUnavail,
                      ]}>
                        {slot.label}
                      </Text>

                      {/* Weather (outdoor + available only) */}
                      {wx && isAvail ? (
                        <View style={st.slotWeather}>
                          <SlotWeatherIcon condition={wx.condition} size={13} />
                          <Text style={st.slotWeatherText}>
                            {wx.temp}°F · {wx.rainPct}%
                          </Text>
                        </View>
                      ) : (
                        <View style={st.slotWeather} />
                      )}

                      {/* Status indicator */}
                      <View style={st.slotStatus}>
                        {isSelected ? (
                          <View style={st.slotCheckBadge}>
                            <Check color={Colors.navy} size={12} strokeWidth={2.5} />
                          </View>
                        ) : isAvail ? (
                          <Text style={st.slotSelectLabel}>Select</Text>
                        ) : slotStatus === 'maintenance' ? (
                          <Text style={st.slotMaintLabel}>MAINT</Text>
                        ) : (
                          <Text style={st.slotBookedLabel}>BOOKED</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* ── Confirm CTA ── */}
            <View style={st.confirmArea}>
              <Button
                variant="accent"
                label={confirmSlot ? `Confirm · ${confirmSlot.label}` : 'Select a time slot'}
                onPress={confirmBooking}
                loading={bookingInFlight}
                disabled={!confirmSlot}
                fullWidth
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ══════════════════════════════════════════════════════════
          CALENDAR PICKER  (More Dates)
      ══════════════════════════════════════════════════════════ */}
      <Modal
        visible={calPickerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCalPickerVisible(false)}>
        <SafeAreaView style={st.sheet} edges={['top', 'bottom']}>
          <View style={st.sheetHeader}>
            <Text style={st.sheetTitle}>Select Date</Text>
            <TouchableOpacity
              onPress={() => setCalPickerVisible(false)}
              style={st.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X color={Colors.textMuted} size={20} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={st.sheetBody}>
            <CalendarGrid
              key={bookingDate}
              selectedDate={bookingDate}
              minDate={today}
              maxDate={maxBookingDate}
              onSelect={iso => {
                changeBookingDate(iso);
                setCalPickerVisible(false);
              }}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ══════════════════════════════════════════════════════════
          SCHEDULE SHEET
      ══════════════════════════════════════════════════════════ */}
      <Modal
        visible={scheduleVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setScheduleVisible(false)}>
        <SafeAreaView style={st.sheet} edges={['top', 'bottom']}>
          <View style={st.sheetHeader}>
            <Text style={st.sheetTitle} numberOfLines={1}>
              Schedule · {activeCourt?.name ?? ''}
            </Text>
            <TouchableOpacity
              onPress={() => setScheduleVisible(false)}
              style={st.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X color={Colors.textMuted} size={20} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={st.sheetBody} showsVerticalScrollIndicator={false}>
            {/* Calendar to pick schedule date */}
            <CalendarGrid
              key={scheduleDate}
              selectedDate={scheduleDate}
              minDate={addDays(today, -365 * 2)}
              maxDate={maxScheduleDate}
              onSelect={changeScheduleDate}
            />

            <View style={st.scheduleDivider} />

            {/* Day header */}
            <Text style={st.fieldLabel}>
              {formatDisplayDate(scheduleDate).toUpperCase()}
            </Text>

            {scheduleLoading ? (
              <ActivityIndicator color={Colors.accentCyan} style={{ marginVertical: 24 }} />
            ) : scheduleEntries.length === 0 ? (
              <Text style={st.noSlotsText}>No schedule data for this date.</Text>
            ) : (
              scheduleEntries.map(({ slot, status }) => (
                <View
                  key={slot.start}
                  style={[
                    st.scheduleRow,
                    status === 'booked_mine' && st.scheduleRowMine,
                    status === 'maintenance' && st.scheduleRowMaint,
                  ]}>
                  <Text style={st.scheduleTime}>{slot.label}</Text>
                  <View style={st.scheduleRight}>
                    {status === 'available' ? (
                      <TouchableOpacity
                        style={st.playNowBtn}
                        onPress={() => {
                          setScheduleVisible(false);
                          openBooking(activeCourt!, scheduleDate);
                        }}
                        activeOpacity={0.85}>
                        <Text style={st.playNowLabel}>Play Now</Text>
                      </TouchableOpacity>
                    ) : status === 'booked_mine' ? (
                      <Text style={st.pillMine}>MY RESERVATION</Text>
                    ) : status === 'maintenance' ? (
                      <Text style={st.pillMaint}>MAINTENANCE</Text>
                    ) : (
                      <Text style={st.pillBooked}>RESERVED</Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },

  // Header
  header: {
    backgroundColor: Colors.headerBg,
    paddingHorizontal: Spacing.pagePx,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: FontSize.sectionTitle,
    color: '#FFFFFF',
  },

  scroll: { flex: 1 },
  content: { padding: Spacing.pagePx, paddingBottom: 120 },

  // Network mode selector
  segRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.sectionGap,
  },
  segBtn: {
    flex: 1,
    height: 48,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segBtnActive: {
    backgroundColor: Colors.navy,
    borderColor: Colors.navy,
  },
  segLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.uiLabel,
    color: Colors.textMuted,
  },
  segLabelActive: { color: Colors.white },

  // Amenity filter
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.sectionGap,
  },
  filterBtn: {
    flex: 1,
    height: 40,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: {
    backgroundColor: Colors.navy,
    borderColor: Colors.navy,
  },
  filterLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.uiLabel,
    color: Colors.textMuted,
  },
  filterLabelActive: { color: Colors.white },

  // Other placeholder
  otherPlaceholder: {
    alignItems: 'center',
    paddingVertical: 56,
    gap: 12,
  },
  otherTitle: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: FontSize.sectionTitle,
    color: Colors.navy,
    textAlign: 'center',
  },
  otherSub: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
  },

  // Court card
  courtCardWrap: { marginBottom: Spacing.cardGap },
  courtTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  courtIconBg: {
    width: 44,
    height: 44,
    borderRadius: Radius.button,
    backgroundColor: Colors.optimalBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courtInfo: { flex: 1 },
  courtName: {
    fontFamily: FontFamily.manropeBold,
    fontSize: FontSize.cardTitle,
    color: Colors.navy,
  },
  courtType: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.uiLabel,
    color: Colors.textMuted,
    marginTop: 2,
  },
  courtActions: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
  },
  scheduleBtn: {
    flex: 1,
    height: 40,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleBtnLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.uiLabel,
    color: Colors.navy,
  },
  reserveBtn: {
    flex: 1,
    height: 40,
    borderRadius: Radius.button,
    backgroundColor: Colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reserveBtnLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.uiLabel,
    color: Colors.white,
  },

  // Empty state
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  emptyTitle: {
    fontFamily: FontFamily.manropeBold,
    fontSize: FontSize.sectionTitle,
    color: Colors.navy,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 260,
  },

  // Sheet shared
  sheet: { flex: 1, backgroundColor: Colors.cardBg },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.pagePx,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sheetTitle: {
    flex: 1,
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: FontSize.sectionTitle,
    color: Colors.navy,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sheetBody: { padding: Spacing.pagePx, paddingBottom: 48 },

  // Success
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,212,255,0.08)',
    borderRadius: Radius.button,
    padding: 12,
    marginBottom: 16,
  },
  successText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.body,
    color: Colors.navy,
  },

  // Field label
  fieldLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.metadata,
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 10,
  },

  // Date buttons
  dateBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dateBtn: {
    flex: 1,
    height: 48,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  dateBtnActive: {
    backgroundColor: Colors.navy,
    borderColor: Colors.navy,
  },
  dateBtnLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  dateBtnLabelActive: { color: Colors.white },

  // Duration info
  durationInfo: {
    paddingVertical: 10,
    marginTop: 8,
  },
  durationText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.uiLabel,
    color: Colors.textSubtle,
    letterSpacing: 0.3,
  },

  // Slots
  slotsWrap: { gap: 6 },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.pageBg,
    borderRadius: Radius.button,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 48,
  },
  slotRowSelected: {
    backgroundColor: Colors.optimalBg,
    borderColor: Colors.accentCyan,
  },
  slotRowUnavail: { opacity: 0.5 },
  slotTime: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.uiLabel,
    color: Colors.navy,
    width: 76,
  },
  slotTimeSelected: { color: Colors.navy },
  slotTimeUnavail: { color: Colors.textMuted },
  slotWeather: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  slotWeatherText: {
    fontFamily: FontFamily.interRegular,
    fontSize: 11,
    color: Colors.textMuted,
  },
  slotStatus: {
    alignItems: 'flex-end',
    minWidth: 60,
  },
  slotCheckBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.accentCyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotSelectLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 11,
    color: Colors.accentCyan,
  },
  slotBookedLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  slotMaintLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 10,
    color: Colors.coral,
    letterSpacing: 0.5,
  },

  noSlotsText: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: Colors.textMuted,
    paddingVertical: 16,
  },

  // Confirm CTA
  confirmArea: { marginTop: 24 },

  // Schedule sheet
  scheduleDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 20,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    minHeight: 52,
  },
  scheduleRowMine: { backgroundColor: 'rgba(0,212,255,0.05)' },
  scheduleRowMaint: { backgroundColor: 'rgba(249,112,102,0.05)' },
  scheduleTime: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.uiLabel,
    color: Colors.navy,
    width: 76,
  },
  scheduleRight: { flex: 1, alignItems: 'flex-end' },
  playNowBtn: {
    backgroundColor: Colors.navy,
    borderRadius: Radius.button,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playNowLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 12,
    color: Colors.white,
  },
  pillMine: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 10,
    color: Colors.accentCyan,
    letterSpacing: 0.5,
  },
  pillBooked: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  pillMaint: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 10,
    color: Colors.coral,
    letterSpacing: 0.5,
  },
});
