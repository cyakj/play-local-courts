import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BarChart2,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock,
  Cloud,
  CloudRain,
  CloudSun,
  MapPin,
  Menu,
  MessageCircle,
  Plus,
  Search,
  SlidersHorizontal,
  Sun,
  User,
  Users,
  X,
  XCircle,
  Zap,
} from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { sendNotificationEmail } from '@/lib/emailNotifications';
import { Skeleton } from '@/components/ui/Skeleton';
import { MatchDiscovery } from '@/components/match/MatchDiscovery';
import { useTheme } from '@/context/ThemeContext';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useWeather, getWeatherForDate } from '@/hooks/useWeather';
import type { WeatherCondition } from '@/components/ui/WeatherMini';

// Brand accent colors — fixed across light and dark modes
const BLUE  = Colors.blue;     // #2D6BFF — primary action
const GREEN = Colors.positive; // #2FD98B — confirmed/success
const RED   = Colors.negative; // #FF5C6B — error/declined

// Layout constants
const SCREEN_W   = Dimensions.get('window').width;
const SCREEN_H   = Dimensions.get('window').height;
const REC_CARD_W = 220;
const INC_CARD_W = Math.min(320, Math.round(SCREEN_W * 0.85));
const CARD_RADIUS = Radius.lg; // 20px — premium card feel matching Stitch reference

// ─── Types ────────────────────────────────────────────────────────────────────

type MatchType           = 'singles' | 'doubles' | 'mixed_doubles' | 'hitting_session';
type MatchLifecycleStatus = 'scheduled' | 'reschedule_requested' | 'cancelled' | 'completed';
type RescheduleStatus     = 'pending' | 'accepted' | 'declined' | 'cancelled';
type DateMode             = 'today' | 'tomorrow' | 'pick';
type TimeMode             = 'morning' | 'afternoon' | 'evening' | 'custom';

interface RescheduleRequest {
  id: string;
  matchId: string;
  requesterUserId: string;
  proposedDate: string | null;
  proposedStartTime: string | null;
  proposedEndTime: string | null;
  reason: string | null;
  message: string | null;
  status: RescheduleStatus;
}

interface MatchPlayer {
  id: string;
  name: string;
  avatarUrl: string | null;
  utrRating: number | null;
  ntrpRating: number | null;
}

interface RecommendedPlayer extends MatchPlayer {
  preferredTimes: string[];
  preferredCourt: string | null;
}

interface IncomingRequest {
  id: string;
  matchType: MatchType;
  date: string | null;
  timeStart: string | null;
  timeEnd: string | null;
  location: string | null;
  challenger: MatchPlayer;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  mockWeatherTemp?: number;
  mockWeatherCond?: WeatherCondition;
}

interface UpcomingMatch {
  id: string;
  matchType: MatchType;
  date: string;
  timeStart: string;
  timeEnd: string | null;
  location: string;
  player1: MatchPlayer;
  player2: MatchPlayer;
  player3: MatchPlayer | null;
  player4: MatchPlayer | null;
  status: MatchLifecycleStatus;
  pendingReschedule: RescheduleRequest | null;
  mockWeatherTemp?: number;
  mockWeatherCond?: WeatherCondition;
}

interface MatchFilters {
  format: MatchType;
  selectedNtrpLevels: number[];
  dateMode: DateMode;
  selectedDate: Date | null;
  timeMode: TimeMode;
  timeStart: string | null; // HH:mm
  timeEnd: string | null;   // HH:mm
  dateLabel: string;
  timeLabel: string;
  distanceMiles: number;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: MatchFilters = {
  format: 'singles',
  selectedNtrpLevels: [3.5, 4.0, 4.5],
  dateMode: 'today',
  selectedDate: null,
  timeMode: 'custom',
  timeStart: '17:00',
  timeEnd: '20:00',
  dateLabel: 'Today',
  timeLabel: '5 – 8 PM',
  distanceMiles: 10,
};

const NTRP_LEVELS = [3.0, 3.5, 4.0, 4.5, 5.0];

const DISTANCE_OPTIONS = [5, 10, 25, 50];

const DATE_PRESETS: { mode: DateMode; label: string }[] = [
  { mode: 'today',        label: 'Today' },
  { mode: 'tomorrow',     label: 'Tomorrow' },
  { mode: 'pick',         label: 'Pick Date' },
];

const TIME_PRESETS: { mode: Exclude<TimeMode, 'custom'>; label: string; start: string; end: string }[] = [
  { mode: 'morning',   label: 'Morning',   start: '06:00', end: '12:00' },
  { mode: 'afternoon', label: 'Afternoon', start: '12:00', end: '17:00' },
  { mode: 'evening',   label: 'Evening',   start: '17:00', end: '21:00' },
];

const REQUEST_MATCH_TYPES: { value: MatchType; label: string }[] = [
  { value: 'singles',         label: 'Singles' },
  { value: 'doubles',         label: 'Doubles' },
  { value: 'mixed_doubles',   label: 'Mixed Doubles' },
  { value: 'hitting_session', label: 'Practice Session' },
];

const REQUEST_AVAILABILITY: { value: string; label: string }[] = [
  { value: 'one_time',   label: 'One Time Match' },
  { value: 'recurring',  label: 'Recurring Hitting Partner' },
];

const REQUEST_DURATIONS = [60, 90, 120];

const REQUEST_TIME_SLOTS: string[] = Array.from({ length: 33 }, (_, i) => {
  const totalMins = 6 * 60 + i * 30;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});

const REQ_MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const REQ_DAY_LABELS  = ['Su','Mo','Tu','We','Th','Fr','Sa'];

// ─── Utility helpers ──────────────────────────────────────────────────────────

function buildDateLabel(mode: DateMode, date: Date | null): string {
  if (mode === 'today')        return 'Today';
  if (mode === 'tomorrow')     return 'Tomorrow';
  if (mode === 'pick' && date) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return 'Pick Date';
}

function buildTimeLabel(mode: TimeMode, start: string | null, end: string | null): string {
  if (mode === 'morning')   return 'Morning';
  if (mode === 'afternoon') return 'Afternoon';
  if (mode === 'evening')   return 'Evening';
  if (start && end) {
    const fmtN = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      const hour   = h % 12 || 12;
      return m === 0 ? `${hour}` : `${hour}:${String(m).padStart(2, '0')}`;
    };
    const period = (t: string) => parseInt(t.split(':')[0], 10) >= 12 ? 'PM' : 'AM';
    const sp = period(start), ep = period(end);
    return sp === ep
      ? `${fmtN(start)} – ${fmtN(end)} ${ep}`
      : `${fmtN(start)} ${sp} – ${fmtN(end)} ${ep}`;
  }
  return 'Custom';
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function matchTypeLabel(type: MatchType): string {
  switch (type) {
    case 'singles':         return 'Singles';
    case 'doubles':         return 'Doubles';
    case 'mixed_doubles':   return 'Mixed Doubles';
    case 'hitting_session': return 'Practice Session';
  }
}

function MatchTypeIcon({ type, color, size = 14 }: { type: MatchType; color: string; size?: number }) {
  const props = { size, color, strokeWidth: 1.5 };
  if (type === 'singles')         return <User {...props} />;
  if (type === 'hitting_session') return <CircleDot {...props} />;
  return <Users {...props} />;
}

function formatMatchDate(date: string | null): string {
  if (!date) return '—';
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function formatMatchTime(start: string | null, end: string | null): string {
  if (!start) return '—';
  const fmt = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour   = h % 12 || 12;
    return m === 0 ? `${hour} ${period}` : `${hour}:${String(m).padStart(2, '0')} ${period}`;
  };
  return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start);
}

function formatRequestDate(d: Date): string {
  return `${REQ_DAY_LABELS[d.getDay()]} ${REQ_MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

function formatRequestTime(slot: string): string {
  const [h, m] = slot.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour   = h % 12 || 12;
  return m === 0 ? `${hour} ${period}` : `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

function addMinutes(slot: string, mins: number): string {
  const [h, m] = slot.split(':').map(Number);
  const total  = h * 60 + m + mins;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function conditionLabel(c: WeatherCondition): string {
  switch (c) {
    case 'sunny':         return 'Sunny';
    case 'partly_cloudy': return 'Partly Cloudy';
    case 'cloudy':        return 'Cloudy';
    case 'rainy':         return 'Rainy';
    case 'stormy':        return 'Stormy';
    default:              return c;
  }
}

// ─── MatchRequestDatePicker ───────────────────────────────────────────────────

function MatchRequestDatePicker({
  selected,
  onSelect,
}: {
  selected: Date | null;
  onSelect: (d: Date) => void;
}) {
  const { theme } = useTheme();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startPad     = firstOfMonth.getDay(); // 0=Sun
  const daysInMonth  = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: (Date | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(viewYear, viewMonth, i + 1)),
  ];

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else { setViewMonth(m => m - 1); }
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else { setViewMonth(m => m + 1); }
  }

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <View>
      {/* Month navigation */}
      <View style={dpS.navRow}>
        <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ChevronLeft size={18} color={theme.textSecondary} strokeWidth={1.5} />
        </TouchableOpacity>
        <Text style={[dpS.monthLabel, { color: theme.textPrimary }]}>
          {REQ_MONTH_NAMES[viewMonth]} {viewYear}
        </Text>
        <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ChevronRight size={18} color={theme.textSecondary} strokeWidth={1.5} />
        </TouchableOpacity>
      </View>

      {/* Day labels */}
      <View style={dpS.weekRow}>
        {REQ_DAY_LABELS.map(d => (
          <Text key={d} style={[dpS.dayLabel, { color: theme.textMuted }]}>{d}</Text>
        ))}
      </View>

      {/* Week rows */}
      {weeks.map((week, wi) => (
        <View key={wi} style={dpS.weekRow}>
          {week.map((day, di) => {
            if (!day) return <View key={di} style={dpS.dayCell} />;
            const isPast     = day < today;
            const isToday    = day.getTime() === today.getTime();
            const isSelected = selected != null && day.getTime() === new Date(
              selected.getFullYear(), selected.getMonth(), selected.getDate()
            ).getTime();

            return (
              <TouchableOpacity
                key={di}
                style={[
                  dpS.dayCell,
                  isToday    && !isSelected && { borderWidth: 1.5, borderColor: BLUE, borderRadius: 18 },
                  isSelected && { backgroundColor: BLUE, borderRadius: 18 },
                  isPast     && { opacity: 0.3 },
                ]}
                onPress={() => !isPast && onSelect(day)}
                disabled={isPast}
                activeOpacity={0.7}>
                <Text style={[
                  dpS.dayNum,
                  { color: isSelected ? '#FFF' : isToday ? BLUE : theme.textPrimary },
                ]}>
                  {day.getDate()}
                </Text>
              </TouchableOpacity>
            );
          })}
          {/* Pad remaining cells to fill 7 columns */}
          {Array.from({ length: 7 - week.length }, (_, i) => (
            <View key={`pad-${i}`} style={dpS.dayCell} />
          ))}
        </View>
      ))}
    </View>
  );
}

const dpS = StyleSheet.create({
  navRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  monthLabel: { fontFamily: FontFamily.manropeSemiBold, fontSize: 15 },
  weekRow:    { flexDirection: 'row', marginBottom: 2 },
  dayLabel:   { flex: 1, textAlign: 'center', fontFamily: FontFamily.manropeMedium, fontSize: 11, paddingBottom: 6 },
  dayCell:    { flex: 1, height: 36, alignItems: 'center', justifyContent: 'center' },
  dayNum:     { fontFamily: FontFamily.manropeMedium, fontSize: 13 },
});

// ─── PlayerAvatar ─────────────────────────────────────────────────────────────

function PlayerAvatar({ player, size = 48, square = false }: { player: MatchPlayer; size?: number; square?: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={[
      avS.base,
      {
        width:           size,
        height:          size,
        borderRadius:    square ? Math.round(size * 0.24) : size / 2,
        backgroundColor: theme.selectedBg,
        borderColor:     theme.border,
      },
    ]}>
      <Text style={[avS.initials, { fontSize: Math.round(size * 0.33), color: BLUE }]}>
        {getInitials(player.name)}
      </Text>
    </View>
  );
}

const avS = StyleSheet.create({
  base: { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  initials: { fontFamily: FontFamily.manropeSemiBold },
});

// ─── Inline weather — simple icon + temp + label, no box ─────────────────────

function WeatherIcon({ condition, size = 16 }: { condition: WeatherCondition; size?: number }) {
  const p = { size, strokeWidth: 1.5 };
  switch (condition) {
    case 'sunny':         return <Sun {...p} color="#F5A623" />;
    case 'partly_cloudy': return <CloudSun {...p} color="#F5A623" />;
    case 'cloudy':        return <Cloud {...p} color={Colors.fg3} />;
    case 'rainy':         return <CloudRain {...p} color={BLUE} />;
    case 'stormy':        return <Zap {...p} color={RED} />;
    default:              return <Cloud {...p} color={Colors.fg3} />;
  }
}

// Rendered as a plain meta row: ☀ 84° · Sunny
function MatchWeatherWidget({ temp, condition }: { temp: number; condition: WeatherCondition }) {
  const { theme } = useTheme();
  return (
    <View style={wwS.row}>
      <WeatherIcon condition={condition} size={15} />
      <Text style={[wwS.temp, { color: theme.textSecondary }]}>{temp}°</Text>
      <Text style={[wwS.dot, { color: theme.textMuted }]}>·</Text>
      <Text style={[wwS.cond, { color: theme.textMuted }]}>{conditionLabel(condition)}</Text>
    </View>
  );
}

const wwS = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  temp: { fontFamily: FontFamily.manropeSemiBold, fontSize: 12 },
  dot:  { fontFamily: FontFamily.manropeMedium, fontSize: 11 },
  cond: { fontFamily: FontFamily.manropeMedium, fontSize: 11 },
});

function WeatherForCard({ location, date }: { location: string | null; date: string | null }) {
  const { forecast } = useWeather(location ?? undefined);
  if (!location || !date) return null;
  const w = getWeatherForDate(forecast, date);
  if (!w) return null;
  return <MatchWeatherWidget temp={w.temperature} condition={w.condition as WeatherCondition} />;
}

// ─── Shared rating line — "UTR 6.0 · NTRP 3.5" ───────────────────────────────

function RatingLine({ player }: { player: MatchPlayer }) {
  const { theme } = useTheme();
  const hasUTR  = player.utrRating  != null;
  const hasNTRP = player.ntrpRating != null;
  if (!hasUTR && !hasNTRP) return null;
  return (
    <View style={rlS.row}>
      {hasUTR  && <Text style={rlS.utr}>UTR {player.utrRating!.toFixed(1)}</Text>}
      {hasUTR && hasNTRP && <Text style={[rlS.dot, { color: theme.textMuted }]}>·</Text>}
      {hasNTRP && <Text style={[rlS.ntrp, { color: theme.textSecondary }]}>NTRP {player.ntrpRating!.toFixed(1)}</Text>}
    </View>
  );
}

const rlS = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  utr:  { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 11, color: BLUE },
  dot:  { fontFamily: FontFamily.manropeMedium, fontSize: 11 },
  ntrp: { fontFamily: FontFamily.manropeMedium, fontSize: 11 },
});

// ─── Match Page Header ────────────────────────────────────────────────────────

function MatchPageHeader({
  avatarInitials,
  notifCount = 0,
  onBell,
  onMenu,
}: {
  avatarInitials: string;
  notifCount?: number;
  onBell?: () => void;
  onMenu?: () => void;
}) {
  const insets    = useSafeAreaInsets();
  const { theme } = useTheme();

  return (
    <View style={[
      hdrS.container,
      {
        paddingTop:      insets.top + 8,
        backgroundColor: theme.headerBg,
        borderBottomColor: theme.headerBorder,
      },
    ]}>
      <Image
        source={require('@/assets/images/TenisX_logo-removebg-preview.png')}
        style={hdrS.logo}
        resizeMode="contain"
      />

      <View style={hdrS.right}>
        <TouchableOpacity
          style={hdrS.iconBtn}
          onPress={onBell ?? (() => router.push('/notifications'))}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Bell size={22} color={Colors.white} strokeWidth={1.5} />
          {notifCount > 0 && (
            <View style={hdrS.badge}>
              <Text style={hdrS.badgeText}>{notifCount > 9 ? '9+' : notifCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[hdrS.avatar, { backgroundColor: theme.selectedBg }]}
          onPress={() => router.push('/(resident)/me')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}>
          <Text style={hdrS.avatarText}>{avatarInitials}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={hdrS.iconBtn}
          onPress={onMenu ?? (() => router.push('/settings'))}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Menu size={22} color={Colors.white} strokeWidth={1.5} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const hdrS = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.pagePx, paddingBottom: 12, borderBottomWidth: 1,
  },
  logo:    { width: 110, height: 44 },
  right:   { flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  badge: {
    position: 'absolute', top: 6, right: 4,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3, borderWidth: 2, borderColor: Colors.courtBlue,
  },
  badgeText: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 9, color: '#FFF', lineHeight: 12 },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(45,224,255,0.3)',
  },
  avatarText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 13, color: Colors.white },
});

// ─── Filter chips — horizontal scrollable pills ───────────────────────────────

interface FilterChip { icon: React.ReactNode; label: string }

const FILTER_SCROLL_STEP = 120;

function FilterBar({ filters, onEdit }: { filters: MatchFilters; onEdit: () => void }) {
  const { theme } = useTheme();
  const scrollRef  = useRef<ScrollView>(null);
  const [scrollX, setScrollX]       = useState(0);
  const [contentW, setContentW]     = useState(0);
  const [containerW, setContainerW] = useState(0);

  const atEnd = contentW > 0 && containerW > 0 && scrollX + containerW >= contentW - 12;

  function handleChevronPress() {
    if (atEnd) {
      scrollRef.current?.scrollTo({ x: 0, animated: true });
    } else {
      scrollRef.current?.scrollTo({ x: scrollX + FILTER_SCROLL_STEP, animated: true });
    }
  }

  const staticChips: FilterChip[] = [
    { icon: <CircleDot size={12} color="#FFF" strokeWidth={1.5} />, label: matchTypeLabel(filters.format) },
    { icon: <Calendar  size={12} color="#FFF" strokeWidth={1.5} />, label: filters.dateLabel },
    { icon: <Clock     size={12} color="#FFF" strokeWidth={1.5} />, label: filters.timeLabel },
    { icon: <MapPin    size={12} color="#FFF" strokeWidth={1.5} />, label: `≤${filters.distanceMiles} mi` },
  ];

  return (
    <View
      style={fbS.wrap}
      onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={fbS.row}
        onScroll={(e) => setScrollX(e.nativeEvent.contentOffset.x)}
        scrollEventThrottle={16}
        onContentSizeChange={(w) => setContentW(w)}>
        {staticChips.map((chip) => (
          <TouchableOpacity
            key={chip.label}
            style={[fbS.chip, { backgroundColor: theme.chipActiveBg }]}
            onPress={onEdit}
            activeOpacity={0.75}>
            {chip.icon}
            <Text style={fbS.chipLabel} numberOfLines={1}>{chip.label}</Text>
          </TouchableOpacity>
        ))}
        {/* NTRP chips */}
        {filters.selectedNtrpLevels.slice(0, 2).map(level => (
          <TouchableOpacity
            key={level}
            style={[fbS.chip, { backgroundColor: theme.chipActiveBg }]}
            onPress={onEdit}
            activeOpacity={0.75}>
            <BarChart2 size={12} color="#FFF" strokeWidth={1.5} />
            <Text style={fbS.chipLabel} numberOfLines={1}>NTRP {level.toFixed(1)}</Text>
          </TouchableOpacity>
        ))}
        {filters.selectedNtrpLevels.length > 2 && (
          <TouchableOpacity
            style={[fbS.chip, { backgroundColor: theme.chipActiveBg }]}
            onPress={onEdit}
            activeOpacity={0.75}>
            <BarChart2 size={12} color="#FFF" strokeWidth={1.5} />
            <Text style={fbS.chipLabel} numberOfLines={1}>+{filters.selectedNtrpLevels.length - 2} more</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[fbS.filtersBtn, { borderColor: theme.border, backgroundColor: theme.cardBg }]}
          onPress={onEdit}
          activeOpacity={0.8}>
          <SlidersHorizontal size={12} color={BLUE} strokeWidth={1.5} />
          <Text style={[fbS.filtersBtnText, { color: BLUE }]}>Filters</Text>
        </TouchableOpacity>
        {/* Trailing space so last chip clears the chevron overlay */}
        <View style={{ width: 44 }} />
      </ScrollView>
      <TouchableOpacity
        style={[fbS.scrollHint, { backgroundColor: theme.pageBg }]}
        onPress={handleChevronPress}
        activeOpacity={0.6}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
        <ChevronRight
          size={14}
          color={atEnd ? theme.textDisabled : theme.textMuted}
          strokeWidth={2}
        />
      </TouchableOpacity>
    </View>
  );
}

const fbS = StyleSheet.create({
  wrap:         { position: 'relative' },
  row:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.pagePx, gap: 8, paddingBottom: 2 },
  chip:         { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 10 },
  chipLabel:    { fontFamily: FontFamily.manropeSemiBold, fontSize: 13, color: '#FFF' },
  filtersBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: Radius.pill, borderWidth: 1.5,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  filtersBtnText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 13 },
  scrollHint: {
    position: 'absolute', right: 0, top: 0, bottom: 0,
    width: 36, alignItems: 'center', justifyContent: 'center',
  },
});

// ─── Results context — shown below filter bar ─────────────────────────────────

function ResultsContext({ filters, matchingCount, loading }: {
  filters: MatchFilters; matchingCount: number; loading: boolean;
}) {
  const { theme } = useTheme();
  if (loading) return null;
  const ntrpLabel   = filters.selectedNtrpLevels.length === 5
    ? 'Any NTRP'
    : `NTRP ${filters.selectedNtrpLevels.map(l => l.toFixed(1)).join(', ')}`;
  const countLabel  = matchingCount === 0 ? 'No players match' : `${matchingCount} player${matchingCount !== 1 ? 's' : ''} match`;
  return (
    <View style={rcxS.row}>
      <Text style={[rcxS.count, { color: theme.textSecondary }]}>{countLabel}</Text>
      <Text style={[rcxS.sep, { color: theme.textMuted }]}>·</Text>
      <Text style={[rcxS.detail, { color: theme.textMuted }]} numberOfLines={1}>
        {ntrpLabel} · {matchTypeLabel(filters.format)} · ≤{filters.distanceMiles} mi
      </Text>
    </View>
  );
}

const rcxS = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.pagePx, paddingTop: 10, paddingBottom: 4 },
  count:  { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label },
  sep:    { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label },
  detail: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, flex: 1 },
});

// ─── Match Filters Sheet ───────────────────────────────────────────────────────

function MatchFiltersSheet({ visible, filters, onApply, onDismiss }: {
  visible: boolean;
  filters: MatchFilters;
  onApply: (f: MatchFilters) => void;
  onDismiss: () => void;
}) {
  const { theme } = useTheme();
  const [draft,          setDraft]          = useState<MatchFilters>(filters);
  const [showDateCal,    setShowDateCal]    = useState(false);
  const [showCustomTime, setShowCustomTime] = useState(false);
  const [timeError,      setTimeError]      = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setDraft(filters);
      setShowDateCal(filters.dateMode === 'pick');
      setShowCustomTime(filters.timeMode === 'custom');
      setTimeError(null);
    }
  }, [visible]);

  const formats: { label: string; value: MatchType }[] = [
    { label: 'Singles',          value: 'singles' },
    { label: 'Doubles',          value: 'doubles' },
    { label: 'Mixed Doubles',    value: 'mixed_doubles' },
    { label: 'Practice Session', value: 'hitting_session' },
  ];

  function handleApply() {
    if (draft.timeMode === 'custom') {
      if (!draft.timeStart || !draft.timeEnd) {
        setTimeError('Please select a start and end time.');
        return;
      }
      if (draft.timeStart >= draft.timeEnd) {
        setTimeError('End time must be after start time.');
        return;
      }
    }
    onApply({
      ...draft,
      dateLabel: buildDateLabel(draft.dateMode, draft.selectedDate),
      timeLabel: buildTimeLabel(draft.timeMode, draft.timeStart, draft.timeEnd),
    });
    onDismiss();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={[mfS.backdrop, { backgroundColor: theme.backdrop }]}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onDismiss} activeOpacity={1} />
        <View style={[mfS.sheet, { backgroundColor: theme.sheetBg }, theme.shadowSheet]}>
          <View style={[mfS.handle, { backgroundColor: theme.border }]} />
          <View style={mfS.titleRow}>
            <Text style={[mfS.title, { color: theme.textPrimary }]}>Match Filters</Text>
            <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={theme.textMuted} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>

          <ScrollView style={mfS.scrollArea} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* Match Format */}
            <Text style={[mfS.sectionLabel, { color: theme.textSecondary }]}>Match Format</Text>
            <View style={mfS.optionRow}>
              {formats.map((f) => {
                const active = draft.format === f.value;
                return (
                  <TouchableOpacity
                    key={f.value}
                    style={[mfS.option, { borderColor: active ? BLUE : theme.border, backgroundColor: active ? theme.selectedBg : theme.cardBg }]}
                    onPress={() => setDraft(d => ({ ...d, format: f.value }))}
                    activeOpacity={0.7}>
                    <Text style={[mfS.optionText, { color: active ? BLUE : theme.textSecondary }]}>{f.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Date */}
            <Text style={[mfS.sectionLabel, { color: theme.textSecondary }]}>Date</Text>
            <View style={mfS.optionRow}>
              {DATE_PRESETS.map((dp) => {
                const active = draft.dateMode === dp.mode;
                return (
                  <TouchableOpacity
                    key={dp.mode}
                    style={[mfS.option, { borderColor: active ? BLUE : theme.border, backgroundColor: active ? theme.selectedBg : theme.cardBg }]}
                    onPress={() => {
                      const isPickMode = dp.mode === 'pick';
                      setDraft(d => ({
                        ...d,
                        dateMode: dp.mode,
                        selectedDate: isPickMode ? d.selectedDate : null,
                        dateLabel: buildDateLabel(dp.mode, isPickMode ? d.selectedDate : null),
                      }));
                      setShowDateCal(isPickMode);
                    }}
                    activeOpacity={0.7}>
                    <Text style={[mfS.optionText, { color: active ? BLUE : theme.textSecondary }]}>{dp.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {showDateCal && (
              <View style={[mfS.calBox, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <MatchRequestDatePicker
                  selected={draft.selectedDate}
                  onSelect={(date) => {
                    setDraft(d => ({
                      ...d,
                      selectedDate: date,
                      dateLabel: buildDateLabel('pick', date),
                    }));
                    setShowDateCal(false);
                  }}
                />
              </View>
            )}

            {/* Time */}
            <Text style={[mfS.sectionLabel, { color: theme.textSecondary }]}>Time</Text>
            <View style={mfS.optionRow}>
              {TIME_PRESETS.map((tp) => {
                const active = draft.timeMode === tp.mode;
                return (
                  <TouchableOpacity
                    key={tp.mode}
                    style={[mfS.option, { borderColor: active ? BLUE : theme.border, backgroundColor: active ? theme.selectedBg : theme.cardBg }]}
                    onPress={() => {
                      setDraft(d => ({
                        ...d,
                        timeMode: tp.mode,
                        timeStart: tp.start,
                        timeEnd: tp.end,
                        timeLabel: tp.label,
                      }));
                      setShowCustomTime(false);
                      setTimeError(null);
                    }}
                    activeOpacity={0.7}>
                    <Text style={[mfS.optionText, { color: active ? BLUE : theme.textSecondary }]}>{tp.label}</Text>
                  </TouchableOpacity>
                );
              })}
              {/* Custom Time */}
              <TouchableOpacity
                style={[mfS.option, { borderColor: draft.timeMode === 'custom' ? BLUE : theme.border, backgroundColor: draft.timeMode === 'custom' ? theme.selectedBg : theme.cardBg }]}
                onPress={() => {
                  setDraft(d => ({ ...d, timeMode: 'custom' }));
                  setShowCustomTime(true);
                  setTimeError(null);
                }}
                activeOpacity={0.7}>
                <Text style={[mfS.optionText, { color: draft.timeMode === 'custom' ? BLUE : theme.textSecondary }]}>Custom</Text>
              </TouchableOpacity>
            </View>
            {showCustomTime && (
              <View style={mfS.customTimeBox}>
                <Text style={[mfS.subLabel, { color: theme.textMuted }]}>From</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={mfS.timeSlotRow}>
                    {REQUEST_TIME_SLOTS.map(slot => {
                      const active = draft.timeStart === slot;
                      return (
                        <TouchableOpacity
                          key={`s-${slot}`}
                          style={[mfS.timeSlot, { borderColor: active ? BLUE : theme.border, backgroundColor: active ? theme.selectedBg : theme.cardBg }]}
                          onPress={() => { setDraft(d => ({ ...d, timeStart: slot })); setTimeError(null); }}
                          activeOpacity={0.7}>
                          <Text style={[mfS.optionText, { color: active ? BLUE : theme.textSecondary }]}>
                            {formatRequestTime(slot)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
                <Text style={[mfS.subLabel, { color: theme.textMuted, marginTop: 10 }]}>To</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={mfS.timeSlotRow}>
                    {REQUEST_TIME_SLOTS.map(slot => {
                      const active = draft.timeEnd === slot;
                      return (
                        <TouchableOpacity
                          key={`e-${slot}`}
                          style={[mfS.timeSlot, { borderColor: active ? BLUE : theme.border, backgroundColor: active ? theme.selectedBg : theme.cardBg }]}
                          onPress={() => { setDraft(d => ({ ...d, timeEnd: slot })); setTimeError(null); }}
                          activeOpacity={0.7}>
                          <Text style={[mfS.optionText, { color: active ? BLUE : theme.textSecondary }]}>
                            {formatRequestTime(slot)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
                {timeError != null && (
                  <Text style={[mfS.timeErrorText, { color: RED }]}>{timeError}</Text>
                )}
              </View>
            )}

            {/* NTRP Level */}
            <Text style={[mfS.sectionLabel, { color: theme.textSecondary }]}>NTRP Level</Text>
            <View style={mfS.optionRow}>
              {NTRP_LEVELS.map(level => {
                const active = draft.selectedNtrpLevels.includes(level);
                return (
                  <TouchableOpacity
                    key={level}
                    style={[mfS.option, { borderColor: active ? BLUE : theme.border, backgroundColor: active ? theme.selectedBg : theme.cardBg }]}
                    onPress={() => {
                      if (active && draft.selectedNtrpLevels.length === 1) return;
                      setDraft(d => ({
                        ...d,
                        selectedNtrpLevels: active
                          ? d.selectedNtrpLevels.filter(l => l !== level)
                          : [...d.selectedNtrpLevels, level],
                      }));
                    }}
                    activeOpacity={0.7}>
                    <Text style={[mfS.optionText, { color: active ? BLUE : theme.textSecondary }]}>{level.toFixed(1)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Max Distance */}
            <Text style={[mfS.sectionLabel, { color: theme.textSecondary }]}>Max Distance</Text>
            <View style={mfS.optionRow}>
              {DISTANCE_OPTIONS.map((d) => {
                const active = draft.distanceMiles === d;
                return (
                  <TouchableOpacity
                    key={d}
                    style={[mfS.option, { borderColor: active ? BLUE : theme.border, backgroundColor: active ? theme.selectedBg : theme.cardBg }]}
                    onPress={() => setDraft(prev => ({ ...prev, distanceMiles: d }))}
                    activeOpacity={0.7}>
                    <Text style={[mfS.optionText, { color: active ? BLUE : theme.textSecondary }]}>{d} mi</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{ height: 8 }} />
          </ScrollView>

          <View style={mfS.ctaRow}>
            <TouchableOpacity
              style={[mfS.applyBtn, { backgroundColor: BLUE }]}
              onPress={handleApply}
              activeOpacity={0.85}>
              <Text style={mfS.applyText}>Apply Filters</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[mfS.resetBtn, { borderColor: theme.border }]}
              onPress={() => {
                setDraft(DEFAULT_FILTERS);
                setShowDateCal(false);
                setShowCustomTime(true);
                setTimeError(null);
              }}
              activeOpacity={0.75}>
              <Text style={[mfS.resetText, { color: theme.textSecondary }]}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const mfS = StyleSheet.create({
  backdrop:      { flex: 1, justifyContent: 'flex-end' },
  sheet:         {
    maxHeight: Math.round(SCREEN_H * 0.88),
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.pagePx, paddingTop: 12,
  },
  handle:        { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  titleRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title:         { fontFamily: FontFamily.spaceGroteskBold, fontSize: 20 },
  sectionLabel:  { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label, marginBottom: 10, marginTop: 16 },
  optionRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option:        { borderWidth: 1.5, borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  optionText:    { fontFamily: FontFamily.manropeSemiBold, fontSize: 13 },
  scrollArea:    { flexShrink: 1 },
  calBox:        { borderWidth: 1, borderRadius: Radius.sm, padding: 12, marginTop: 8 },
  customTimeBox: { marginTop: 10 },
  subLabel:      { fontFamily: FontFamily.manropeSemiBold, fontSize: 12, marginBottom: 6 },
  timeSlotRow:   { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  timeSlot:      { borderWidth: 1.5, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  timeErrorText: { fontFamily: FontFamily.manropeMedium, fontSize: 12, marginTop: 6 },
  ctaRow:        { flexDirection: 'row', gap: 10, paddingTop: 16, paddingBottom: 40 },
  applyBtn:      { flex: 2, borderRadius: Radius.button, paddingVertical: 14, alignItems: 'center', minHeight: Spacing.tapTarget },
  applyText:     { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body, color: '#FFF' },
  resetBtn:      { flex: 1, borderRadius: Radius.button, borderWidth: 1.5, paddingVertical: 14, alignItems: 'center', minHeight: Spacing.tapTarget },
  resetText:     { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body },
});

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({
  title,
  count,
  onViewAll,
}: {
  title: string;
  count?: number;
  onViewAll?: () => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={secS.header}>
      <View style={secS.titleRow}>
        <Text style={[secS.title, { color: theme.textPrimary }]}>{title}</Text>
        {count != null && count > 0 && (
          <View style={secS.badge}>
            <Text style={secS.badgeText}>{count}</Text>
          </View>
        )}
      </View>
      {onViewAll && (
        <TouchableOpacity style={secS.viewAll} onPress={onViewAll} activeOpacity={0.7}>
          <Text style={secS.viewAllText}>View all</Text>
          <ChevronRight size={13} color={BLUE} strokeWidth={1.5} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function EmptyRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  const { theme } = useTheme();
  return (
    <View style={secS.emptyRow}>
      {icon}
      <Text style={[secS.emptyText, { color: theme.textMuted }]}>{text}</Text>
    </View>
  );
}

const secS = StyleSheet.create({
  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.pagePx, marginBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title:    { fontFamily: FontFamily.spaceGroteskBold, fontSize: FontSize.sectionTitle },
  badge:    { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: BLUE },
  badgeText: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 10, color: '#FFF' },
  viewAll:   { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 12, color: BLUE },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.pagePx, paddingVertical: 8 },
  emptyText: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, flex: 1 },
});

// ─── Match Request Sheet ──────────────────────────────────────────────────────

function MatchRequestSheet({
  visible,
  opponent,
  currentUserId,
  onSend,
  onDismiss,
}: {
  visible: boolean;
  opponent: RecommendedPlayer | MatchPlayer | null;
  currentUserId: string;
  onSend: () => void;
  onDismiss: () => void;
}) {
  const { theme } = useTheme();

  const [matchType,  setMatchType]  = useState<MatchType>('singles');
  const [availType,  setAvailType]  = useState<string>('one_time');
  const [date,       setDate]       = useState<Date | null>(null);
  const [timeSlot,   setTimeSlot]   = useState<string | null>(null);
  const [duration,   setDuration]   = useState<number>(90);
  const [message,    setMessage]    = useState<string>('');
  const [showCal,    setShowCal]    = useState(false);
  const [sending,    setSending]    = useState(false);

  // Reset form whenever sheet opens for a new opponent
  useEffect(() => {
    if (visible) {
      setMatchType('singles');
      setAvailType('one_time');
      setDate(null);
      setTimeSlot(null);
      setDuration(90);
      setMessage('');
      setShowCal(false);
      setSending(false);
    }
  }, [visible, opponent?.id]);

  const canSend = date != null && timeSlot != null && !sending;

  async function handleSend() {
    if (!opponent || !date || !timeSlot) return;
    setSending(true);
    if (!opponent.id.startsWith('mock-')) {
      const dateStr  = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const timeEnd  = addMinutes(timeSlot, duration);
      await supabase.from('match_requests').insert({
        challenger_id:    currentUserId,
        opponent_id:      opponent.id,
        match_type:       matchType as any,
        court_type:       null,
        date:             dateStr,
        time_start:       timeSlot,
        time_end:         timeEnd,
        duration,
        availability_type: availType,
        message:          message.trim() || null,
        status:           'pending',
      });
      void sendNotificationEmail({
        type:       'match_request_received',
        userId:     opponent.id,
        playerId:   currentUserId,
        date:       dateStr,
        startTime:  timeSlot,
        endTime:    timeEnd,
        matchType:  matchType as string,
      });
    }
    setSending(false);
    onSend();
    onDismiss();
  }

  const dateLabel    = date     ? formatRequestDate(date)    : null;
  const timeLabel    = timeSlot ? formatRequestTime(timeSlot) : null;
  const availLabel   = REQUEST_AVAILABILITY.find(a => a.value === availType)?.label ?? '';
  const mtLabel      = REQUEST_MATCH_TYPES.find(t => t.value === matchType)?.label ?? '';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[mrS.backdrop, { backgroundColor: theme.backdrop }]}>
          <TouchableOpacity style={{ flex: 1 }} onPress={onDismiss} activeOpacity={1} />
          <View style={[mrS.sheet, { backgroundColor: theme.sheetBg }, theme.shadowSheet]}>
            <View style={[mrS.handle, { backgroundColor: theme.border }]} />
            <View style={mrS.sheetHeader}>
              <Text style={[mrS.sheetTitle, { color: theme.textPrimary }]}>
                Request Match
                {opponent ? ` — ${opponent.name.split(' ')[0]}` : ''}
              </Text>
              <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={20} color={theme.textMuted} strokeWidth={1.5} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

              {/* Match Type */}
              <Text style={[mrS.sectionLabel, { color: theme.textSecondary }]}>Match Type</Text>
              <View style={mrS.pillRow}>
                {REQUEST_MATCH_TYPES.map(t => {
                  const active = matchType === t.value;
                  return (
                    <TouchableOpacity
                      key={t.value}
                      style={[mrS.pill, { borderColor: active ? BLUE : theme.border, backgroundColor: active ? BLUE + '22' : 'transparent' }]}
                      onPress={() => setMatchType(t.value)}
                      activeOpacity={0.8}>
                      <Text style={[mrS.pillText, { color: active ? BLUE : theme.textSecondary }]}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Availability Type */}
              <Text style={[mrS.sectionLabel, { color: theme.textSecondary }]}>Availability</Text>
              <View style={mrS.pillRow}>
                {REQUEST_AVAILABILITY.map(a => {
                  const active = availType === a.value;
                  return (
                    <TouchableOpacity
                      key={a.value}
                      style={[mrS.pill, { borderColor: active ? BLUE : theme.border, backgroundColor: active ? BLUE + '22' : 'transparent' }]}
                      onPress={() => setAvailType(a.value)}
                      activeOpacity={0.8}>
                      <Text style={[mrS.pillText, { color: active ? BLUE : theme.textSecondary }]}>{a.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Date */}
              <Text style={[mrS.sectionLabel, { color: theme.textSecondary }]}>Date</Text>
              <TouchableOpacity
                style={[mrS.fieldRow, { borderColor: theme.border, backgroundColor: theme.inputBg }]}
                onPress={() => setShowCal(c => !c)}
                activeOpacity={0.8}>
                <Calendar size={16} color={theme.textMuted} strokeWidth={1.5} />
                <Text style={[mrS.fieldText, { color: dateLabel ? theme.textPrimary : theme.textDisabled }]}>
                  {dateLabel ?? 'Select date'}
                </Text>
                <ChevronRight size={14} color={theme.textMuted} strokeWidth={1.5} />
              </TouchableOpacity>
              {showCal && (
                <View style={[mrS.calBox, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                  <MatchRequestDatePicker
                    selected={date}
                    onSelect={(d) => { setDate(d); setShowCal(false); }}
                  />
                </View>
              )}

              {/* Start Time */}
              <Text style={[mrS.sectionLabel, { color: theme.textSecondary }]}>Start Time</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={mrS.timeScroll}>
                <View style={mrS.pillRow}>
                  {REQUEST_TIME_SLOTS.map(slot => {
                    const active = timeSlot === slot;
                    return (
                      <TouchableOpacity
                        key={slot}
                        style={[mrS.pill, { borderColor: active ? BLUE : theme.border, backgroundColor: active ? BLUE + '22' : 'transparent' }]}
                        onPress={() => setTimeSlot(slot)}
                        activeOpacity={0.8}>
                        <Text style={[mrS.pillText, { color: active ? BLUE : theme.textSecondary }]}>
                          {formatRequestTime(slot)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Duration */}
              <Text style={[mrS.sectionLabel, { color: theme.textSecondary }]}>Duration</Text>
              <View style={mrS.pillRow}>
                {REQUEST_DURATIONS.map(d => {
                  const active = duration === d;
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[mrS.pill, { borderColor: active ? BLUE : theme.border, backgroundColor: active ? BLUE + '22' : 'transparent' }]}
                      onPress={() => setDuration(d)}
                      activeOpacity={0.8}>
                      <Text style={[mrS.pillText, { color: active ? BLUE : theme.textSecondary }]}>{d} min</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Message */}
              <Text style={[mrS.sectionLabel, { color: theme.textSecondary }]}>Message (optional)</Text>
              <TextInput
                style={[mrS.messageInput, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.textPrimary }]}
                value={message}
                onChangeText={setMessage}
                placeholder="Looking for competitive practice. Available evenings."
                placeholderTextColor={theme.textDisabled}
                multiline
                numberOfLines={3}
                maxLength={300}
                textAlignVertical="top"
              />

              {/* Summary */}
              <View style={[mrS.summary, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <Text style={[mrS.summaryTitle, { color: theme.textPrimary }]}>Summary</Text>
                {[
                  { label: 'Playing with', value: opponent?.name ?? '—' },
                  { label: 'Date',         value: dateLabel  ?? '—' },
                  { label: 'Time',         value: timeLabel  ?? '—' },
                  { label: 'Duration',     value: duration ? `${duration} min` : '—' },
                  { label: 'Type',         value: mtLabel },
                  { label: 'Availability', value: availLabel },
                ].map(row => (
                  <View key={row.label} style={mrS.summaryRow}>
                    <Text style={[mrS.summaryKey, { color: theme.textMuted }]}>{row.label}</Text>
                    <Text style={[mrS.summaryVal, { color: theme.textPrimary }]} numberOfLines={1}>{row.value}</Text>
                  </View>
                ))}
              </View>

              {/* CTA */}
              <TouchableOpacity
                style={[mrS.cta, { backgroundColor: canSend ? BLUE : theme.border }]}
                onPress={handleSend}
                disabled={!canSend}
                activeOpacity={0.85}>
                {sending
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Text style={mrS.ctaText}>Send Match Request</Text>
                }
              </TouchableOpacity>

              <View style={{ height: 32 }} />
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const mrS = StyleSheet.create({
  backdrop:     { flex: 1, justifyContent: 'flex-end' },
  sheet:        { height: '90%', borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.pagePx, paddingTop: 12 },
  handle:       { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle:   { fontFamily: FontFamily.spaceGroteskBold, fontSize: 20 },
  sectionLabel: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label, marginBottom: 8, marginTop: 16 },
  pillRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill:         { borderWidth: 1.5, borderRadius: Radius.button, paddingHorizontal: 14, paddingVertical: 9 },
  pillText:     { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label },
  fieldRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: Radius.sm, paddingHorizontal: 14, paddingVertical: 13 },
  fieldText:    { flex: 1, fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body },
  calBox:       { borderWidth: 1, borderRadius: Radius.sm, padding: 12, marginTop: 8, borderColor: '#232838' },
  timeScroll:   { marginBottom: 4 },
  messageInput: { borderWidth: 1.5, borderRadius: Radius.sm, padding: 14, fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, minHeight: 80, textAlignVertical: 'top', marginBottom: 4 },
  summary:      { borderWidth: 1, borderRadius: Radius.sm, padding: 14, marginTop: 20, gap: 8 },
  summaryTitle: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label, marginBottom: 4 },
  summaryRow:   { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  summaryKey:   { fontFamily: FontFamily.manropeMedium, fontSize: 12 },
  summaryVal:   { fontFamily: FontFamily.manropeSemiBold, fontSize: 12, flex: 1, textAlign: 'right' },
  cta:          { borderRadius: Radius.button, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 16, minHeight: 52 },
  ctaText:      { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body, color: '#FFF' },
});

// ─── Player Lookup Modal ──────────────────────────────────────────────────────

function PlayerLookupModal({ visible, currentUserId, onDismiss, onRequestPlayer }: {
  visible: boolean; currentUserId: string; onDismiss: () => void; onRequestPlayer: (player: MatchPlayer) => void;
}) {
  const { theme }           = useTheme();
  const [query, setQuery]   = useState('');
  const [results, setResults] = useState<MatchPlayer[]>([]);
  const [searching, setSearching] = useState(false);
  const [requested, setRequested] = useState<Set<string>>(new Set());

  async function search(q: string) {
    setQuery(q);
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, utr_rating, ntrp_rating')
      .eq('location_visible', true)
      .ilike('full_name', `%${q}%`)
      .neq('id', currentUserId)
      .limit(15);
    setResults(
      (data ?? []).map((p) => ({
        id: p.id, name: p.full_name ?? 'Unknown', avatarUrl: p.avatar_url ?? null,
        utrRating: p.utr_rating ?? null, ntrpRating: p.ntrp_rating ?? null,
      }))
    );
    setSearching(false);
  }

  function handleRequest(player: MatchPlayer) {
    setRequested(prev => new Set([...prev, player.id]));
    onRequestPlayer(player);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={[lkS.backdrop, { backgroundColor: theme.backdrop }]}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onDismiss} activeOpacity={1} />
        <View style={[lkS.sheet, { backgroundColor: theme.sheetBg }, theme.shadowSheet]}>
          <View style={[lkS.handle, { backgroundColor: theme.border }]} />
          <View style={lkS.headerRow}>
            <Text style={[lkS.title, { color: theme.textPrimary }]}>Player Lookup</Text>
            <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={theme.textMuted} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>
          <Text style={[lkS.sub, { color: theme.textSecondary }]}>
            Search players who have made themselves discoverable.
          </Text>

          <View style={[lkS.searchBar, { borderColor: theme.border, backgroundColor: theme.inputBg }]}>
            <Search size={16} color={theme.textMuted} strokeWidth={1.5} />
            <TextInput
              style={[lkS.searchInput, { color: theme.textPrimary }]}
              value={query}
              onChangeText={search}
              placeholder="Search by name…"
              placeholderTextColor={theme.textDisabled}
              autoFocus
            />
            {searching && <ActivityIndicator size="small" color={BLUE} />}
          </View>

          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
            {results.map((p) => (
              <View key={p.id} style={[lkS.resultRow, { borderBottomColor: theme.border }]}>
                <PlayerAvatar player={p} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={[lkS.resultName, { color: theme.textPrimary }]}>{p.name}</Text>
                  <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center', marginTop: 2 }}>
                    {p.utrRating  != null && <Text style={lkS.utr}>UTR {p.utrRating.toFixed(1)}</Text>}
                    {p.ntrpRating != null && <Text style={[lkS.ntrp, { color: theme.textSecondary }]}>· {p.ntrpRating.toFixed(1)} NTRP</Text>}
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={[lkS.actionBtn, { borderColor: requested.has(p.id) ? theme.border : GREEN }]}
                    onPress={() => handleRequest(p)}
                    disabled={requested.has(p.id)}
                    activeOpacity={0.8}>
                    <Text style={[lkS.actionText, { color: requested.has(p.id) ? theme.textDisabled : GREEN }]}>
                      {requested.has(p.id) ? 'Sent' : 'Request'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[lkS.actionBtn, { borderColor: BLUE }]}
                    onPress={() => { onDismiss(); router.push(`/messages?partner=${p.id}`); }}
                    activeOpacity={0.8}>
                    <Text style={[lkS.actionText, { color: BLUE }]}>Chat</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {query.length >= 2 && !searching && results.length === 0 && (
              <Text style={[lkS.noResults, { color: theme.textMuted }]}>
                No discoverable players found for "{query}".
              </Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const lkS = StyleSheet.create({
  backdrop:   { flex: 1, justifyContent: 'flex-end' },
  sheet:      { height: '82%', borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.pagePx, paddingTop: 12 },
  handle:     { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  headerRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  title:      { fontFamily: FontFamily.spaceGroteskBold, fontSize: 20 },
  sub:        { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, marginBottom: 16 },
  searchBar:  { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: Radius.sm, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8 },
  searchInput:{ flex: 1, fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body },
  resultRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1 },
  resultName: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.uiLabel },
  utr:        { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 11, color: BLUE },
  ntrp:       { fontFamily: FontFamily.manropeMedium, fontSize: 11 },
  actionBtn:  { borderWidth: 1.5, borderRadius: Radius.button, paddingHorizontal: 12, paddingVertical: 7, minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 12 },
  noResults:  { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, padding: 24, textAlign: 'center' },
});

// ─── Shared section spacing ───────────────────────────────────────────────────

const sectionStyle: import('react-native').ViewStyle = { marginBottom: Spacing.s8 }; // 32px between sections

// ─── Match Screen ─────────────────────────────────────────────────────────────

export default function MatchScreen() {
  const { theme }                             = useTheme();
  const [userId, setUserId]                   = useState('');
  const [avatarInitials, setAvatarInitials]   = useState('ME');
  const [showLookup, setShowLookup]           = useState(false);
  const [requestTarget, setRequestTarget] = useState<RecommendedPlayer | MatchPlayer | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      const { data: p } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      if (p?.full_name) setAvatarInitials(getInitials(p.full_name));
    });
  }, []);

  return (
    <View style={[scrS.root, { backgroundColor: theme.pageBg }]}>
      <MatchPageHeader
        avatarInitials={avatarInitials}
        onBell={() => router.push('/notifications')}
        onMenu={() => router.push('/settings')}
      />

      <ScrollView
        style={scrS.scroll}
        contentContainerStyle={scrS.content}
        showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={scrS.hero}>
          <View style={{ flex: 1 }}>
            <Text style={[scrS.pageTitle, { color: theme.textPrimary }]}>Matches</Text>
            <Text style={[scrS.pageSub, { color: theme.textSecondary }]}>
              Discover open matches and join players nearby.
            </Text>
          </View>
          <View style={scrS.heroActions}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Create a match"
              style={scrS.newMatchBtn}
              onPress={() => router.push('/match/new')}>
              <Plus size={16} color={Colors.white} />
              <Text style={scrS.newMatchBtnText}>Create Match</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Find a player"
              style={[scrS.lookupBtn, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
              onPress={() => setShowLookup(true)}>
              <Search size={18} color={BLUE} />
            </TouchableOpacity>
          </View>
        </View>

        <MatchDiscovery userId={userId} />
      </ScrollView>

      <PlayerLookupModal
        visible={showLookup}
        currentUserId={userId}
        onDismiss={() => setShowLookup(false)}
        onRequestPlayer={(p) => { setShowLookup(false); setRequestTarget(p); }}
      />
      <MatchRequestSheet
        visible={requestTarget != null}
        opponent={requestTarget}
        currentUserId={userId}
        onSend={() => {}}
        onDismiss={() => setRequestTarget(null)}
      />
    </View>
  );
}

const scrS = StyleSheet.create({
  root:       { flex: 1 },
  scroll:     { flex: 1 },
  content:    { paddingBottom: 140 },
  hero: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: Spacing.pagePx, paddingTop: 24, paddingBottom: 20,
  },
  pageTitle: {
    fontFamily: FontFamily.spaceGroteskBold, fontSize: FontSize.display,
    letterSpacing: -0.8, lineHeight: 42,
  },
  pageSub: {
    fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label,
    marginTop: 4, lineHeight: 20,
  },
  heroActions: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 4,
  },
  lookupBtn: {
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderRadius: Radius.button,
  },
  lookupBtnText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label, color: BLUE },
  newMatchBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.blue, borderRadius: Radius.button,
    paddingHorizontal: 14, paddingVertical: 11,
  },
  newMatchBtnText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label, color: Colors.white },
  filterWrap: { marginBottom: Spacing.s8 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: Spacing.pagePx, marginBottom: Spacing.s8,
    borderWidth: 1.5, borderRadius: Radius.sm,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  errorText:  { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label, color: RED, flex: 1 },
  errorRetry: { fontFamily: FontFamily.manropeMedium, fontSize: 11 },
});
