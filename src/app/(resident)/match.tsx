import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Modal,
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
  ChevronRight,
  CircleDot,
  Clock,
  Cloud,
  CloudRain,
  CloudSun,
  MapPin,
  Menu,
  MessageCircle,
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
import { Skeleton } from '@/components/ui/Skeleton';
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
const REC_CARD_W = 220;
const INC_CARD_W = Math.min(320, Math.round(SCREEN_W * 0.85));
const CARD_RADIUS = Radius.lg; // 20px — premium card feel matching Stitch reference

// ─── Types ────────────────────────────────────────────────────────────────────

type MatchType           = 'singles' | 'doubles' | 'mixed_doubles' | 'hitting_session';
type MatchLifecycleStatus = 'scheduled' | 'reschedule_requested' | 'cancelled' | 'completed';
type RescheduleStatus     = 'pending' | 'accepted' | 'declined' | 'cancelled';

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
  dateLabel: string;
  timeLabel: string;
  distanceMiles: number;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: MatchFilters = {
  format: 'singles',
  selectedNtrpLevels: [3.5, 4.0, 4.5],
  dateLabel: 'Today',
  timeLabel: '5 – 8 PM',
  distanceMiles: 10,
};

const NTRP_LEVELS = [3.0, 3.5, 4.0, 4.5, 5.0];

const DISTANCE_OPTIONS = [5, 10, 25, 50];

// ─── Mock data (dev/preview only — never shown in production runtime) ─────────

const MOCK_RECOMMENDED: RecommendedPlayer[] = [
  {
    id: 'mock-r1',
    name: 'Alex Rodriguez',
    avatarUrl: null,
    utrRating: 8.3,
    ntrpRating: 4.5,
    preferredTimes: ['Evenings'],
    preferredCourt: 'Riverside Courts',
  },
  {
    id: 'mock-r2',
    name: 'Ethan Lee',
    avatarUrl: null,
    utrRating: 8.1,
    ntrpRating: 4.0,
    preferredTimes: ['Weekends'],
    preferredCourt: 'Bayview Courts',
  },
  {
    id: 'mock-r3',
    name: 'Marcus Kim',
    avatarUrl: null,
    utrRating: 7.8,
    ntrpRating: 3.5,
    preferredTimes: ['Mornings'],
    preferredCourt: 'Central Park TC',
  },
];

const MOCK_INCOMING: IncomingRequest[] = [
  {
    id: 'mock-inc-1',
    matchType: 'singles',
    date: '2026-06-08',
    timeStart: '16:00',
    timeEnd: '17:30',
    location: 'The Greens Court',
    challenger: { id: 'mock-p1', name: 'Michael Torres', avatarUrl: null, utrRating: 8.1, ntrpRating: 4.5 },
    status: 'pending',
    mockWeatherTemp: 84,
    mockWeatherCond: 'sunny',
  },
  {
    id: 'mock-inc-2',
    matchType: 'doubles',
    date: '2026-06-09',
    timeStart: '10:00',
    timeEnd: '11:30',
    location: 'Bayview Courts',
    challenger: { id: 'mock-p2', name: 'Jordan Park', avatarUrl: null, utrRating: 7.6, ntrpRating: 4.0 },
    status: 'pending',
    mockWeatherTemp: 77,
    mockWeatherCond: 'partly_cloudy',
  },
];

const MOCK_UPCOMING: UpcomingMatch[] = [
  {
    id: 'mock-up-1',
    matchType: 'singles',
    date: '2026-06-05',
    timeStart: '18:00',
    timeEnd: '20:00',
    location: 'Riverside Courts',
    player1: { id: 'mock-opp-1', name: 'Alex Rodriguez', avatarUrl: null, utrRating: 8.3, ntrpRating: 4.5 },
    player2: { id: 'mock-me', name: 'Me', avatarUrl: null, utrRating: null, ntrpRating: null },
    player3: null,
    player4: null,
    status: 'scheduled' as MatchLifecycleStatus,
    pendingReschedule: null,
    mockWeatherTemp: 80,
    mockWeatherCond: 'sunny',
  },
  {
    id: 'mock-up-2',
    matchType: 'doubles',
    date: '2026-06-08',
    timeStart: '16:00',
    timeEnd: '18:00',
    location: 'Bayview Courts',
    player1: { id: 'mock-opp-2', name: 'Ethan Lee', avatarUrl: null, utrRating: 8.1, ntrpRating: 4.0 },
    player2: { id: 'mock-me', name: 'Me', avatarUrl: null, utrRating: null, ntrpRating: null },
    player3: { id: 'mock-opp-3', name: 'Marcus Kim', avatarUrl: null, utrRating: 7.8, ntrpRating: 3.5 },
    player4: null,
    status: 'scheduled' as MatchLifecycleStatus,
    pendingReschedule: null,
  },
];

// ─── Data hook ────────────────────────────────────────────────────────────────

function useMatchData(userId: string) {
  const [recommended, setRecommended] = useState<RecommendedPlayer[]>([]);
  const [incoming, setIncoming]       = useState<IncomingRequest[]>([]);
  const [upcoming, setUpcoming]       = useState<UpcomingMatch[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);

    const profilesNeeded = new Set<string>();

    const [reqResult, matchResult, prefResult] = await Promise.all([
      supabase
        .from('match_requests')
        .select('id, match_type, date, time_start, time_end, location, challenger_id, status')
        .eq('opponent_id', userId)
        .eq('status', 'pending')
        .order('date', { ascending: true }),

      supabase
        .from('matches')
        .select('id, match_type, status, date, time_start, time_end, location, player1_id, player2_id, player3_id, player4_id')
        .or(`player1_id.eq.${userId},player2_id.eq.${userId},player3_id.eq.${userId},player4_id.eq.${userId}`)
        .in('status', ['scheduled', 'reschedule_requested'])
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true }),

      supabase
        .from('match_preferences')
        .select('user_id')
        .eq('looking_to_play', true)
        .neq('user_id', userId)
        .limit(20),
    ]);

    if (reqResult.error || matchResult.error || prefResult.error) {
      setError('Could not load match data. Check your connection and try again.');
      setLoading(false);
      return;
    }

    const rawRequests = reqResult.data ?? [];
    const rawMatches  = matchResult.data ?? [];
    const prefUserIds = (prefResult.data ?? []).map((p) => p.user_id);

    rawRequests.forEach((r) => profilesNeeded.add(r.challenger_id));
    rawMatches.forEach((m) => {
      [m.player1_id, m.player2_id, m.player3_id, m.player4_id].forEach((id) => {
        if (id) profilesNeeded.add(id);
      });
    });
    prefUserIds.forEach((id) => profilesNeeded.add(id));

    type ProfileRow = {
      id: string;
      full_name: string | null;
      avatar_url: string | null;
      utr_rating: number | null;
      ntrp_rating: number | null;
      preferred_court_locations: string | null;
    };

    let profileRows: ProfileRow[] = [];
    const allIds = [...profilesNeeded];
    if (allIds.length > 0) {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, utr_rating, ntrp_rating, preferred_court_locations')
        .in('id', allIds);
      profileRows = (data ?? []) as ProfileRow[];
    }

    const profileMap = new Map<string, ProfileRow>();
    profileRows.forEach((p) => profileMap.set(p.id, p));

    function toPlayer(id: string): MatchPlayer {
      const p = profileMap.get(id);
      return {
        id,
        name:       p?.full_name ?? 'Unknown',
        avatarUrl:  p?.avatar_url ?? null,
        utrRating:  p?.utr_rating ?? null,
        ntrpRating: p?.ntrp_rating ?? null,
      };
    }

    if (prefUserIds.length > 0) {
      const { data: prefDetails } = await supabase
        .from('match_preferences')
        .select('user_id, preferred_times')
        .in('user_id', prefUserIds);
      const prefMap = new Map((prefDetails ?? []).map((p) => [p.user_id, p]));

      setRecommended(
        prefUserIds.map((uid) => {
          const profile = profileMap.get(uid);
          const pref    = prefMap.get(uid);
          return {
            id:             uid,
            name:           profile?.full_name ?? 'Unknown',
            avatarUrl:      profile?.avatar_url ?? null,
            utrRating:      profile?.utr_rating ?? null,
            ntrpRating:     profile?.ntrp_rating ?? null,
            preferredTimes: pref?.preferred_times ?? [],
            preferredCourt: profile?.preferred_court_locations ?? null,
          };
        })
      );
    } else {
      setRecommended([]);
    }

    setIncoming(
      rawRequests.map((r) => ({
        id:         r.id,
        matchType:  (r.match_type as MatchType) ?? 'singles',
        date:       r.date,
        timeStart:  r.time_start,
        timeEnd:    r.time_end,
        location:   r.location,
        challenger: toPlayer(r.challenger_id),
        status:     r.status as IncomingRequest['status'],
      }))
    );

    // Fetch pending reschedule requests for active matches
    const rescheduleMap = new Map<string, RescheduleRequest>();
    if (rawMatches.length > 0) {
      const { data: rrs } = await supabase
        .from('match_reschedule_requests')
        .select('id, match_id, requester_user_id, proposed_date, proposed_start_time, proposed_end_time, reason, message, status')
        .in('match_id', rawMatches.map((m) => m.id))
        .eq('status', 'pending');
      (rrs ?? []).forEach((r) => {
        rescheduleMap.set(r.match_id, {
          id:               r.id,
          matchId:          r.match_id,
          requesterUserId:  r.requester_user_id,
          proposedDate:     r.proposed_date ?? null,
          proposedStartTime: r.proposed_start_time ?? null,
          proposedEndTime:  r.proposed_end_time ?? null,
          reason:           r.reason ?? null,
          message:          r.message ?? null,
          status:           r.status as RescheduleStatus,
        });
      });
    }

    setUpcoming(
      rawMatches.map((m) => ({
        id:                m.id,
        matchType:         (m.match_type as MatchType) ?? 'singles',
        date:              m.date,
        timeStart:         m.time_start,
        timeEnd:           m.time_end ?? null,
        location:          m.location,
        player1:           toPlayer(m.player1_id),
        player2:           toPlayer(m.player2_id),
        player3:           m.player3_id ? toPlayer(m.player3_id) : null,
        player4:           m.player4_id ? toPlayer(m.player4_id) : null,
        status:            (m.status as MatchLifecycleStatus) ?? 'scheduled',
        pendingReschedule: rescheduleMap.get(m.id) ?? null,
      }))
    );

    setLoading(false);
  }, [userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return { recommended, incoming, upcoming, loading, error, reload: load };
}

// ─── Action helpers ───────────────────────────────────────────────────────────

async function sendMatchRequest(currentUserId: string, opponentId: string, matchType: MatchType) {
  if (opponentId.startsWith('mock-')) return;
  await supabase.from('match_requests').insert({
    challenger_id: currentUserId,
    opponent_id:   opponentId,
    match_type:    matchType as any,
    status:        'pending',
  });
}

async function acceptRequest(requestId: string, challengerId: string, currentUserId: string, message: string) {
  if (requestId.startsWith('mock-')) return;

  // Fetch full request so we can populate the matches row
  const { data: req } = await supabase
    .from('match_requests')
    .select('match_type, court_type, date, time_start, time_end, location')
    .eq('id', requestId)
    .single();

  await supabase.from('match_requests').update({ status: 'accepted' }).eq('id', requestId);

  if (req?.date && req?.time_start) {
    await supabase.from('matches').insert({
      match_request_id: requestId,
      player1_id:  challengerId,
      player2_id:  currentUserId,
      match_type:  req.match_type ?? 'singles',
      court_type:  req.court_type ?? 'hard',
      location:    req.location   ?? '',
      date:        req.date,
      time_start:  req.time_start,
      time_end:    req.time_end ?? null,
      status:      'scheduled',
    });
  }

  if (message) {
    await supabase.from('messages').insert({
      sender_id: currentUserId, receiver_id: challengerId, content: `Match accepted — ${message}`,
    });
  }
}

async function declineRequest(requestId: string, challengerId: string, currentUserId: string, message: string) {
  if (requestId.startsWith('mock-')) return;
  await supabase.from('match_requests').update({ status: 'declined' }).eq('id', requestId);
  if (message) {
    await supabase.from('messages').insert({
      sender_id: currentUserId, receiver_id: challengerId, content: `Request declined — ${message}`,
    });
  }
}

async function rescheduleMatch(matchId: string, opponentId: string, currentUserId: string, message: string) {
  if (matchId.startsWith('mock-')) return;
  await supabase.from('match_reschedule_requests').insert({
    match_id:          matchId,
    requester_user_id: currentUserId,
    message:           message || null,
    status:            'pending',
  });
  await supabase.from('matches').update({ status: 'reschedule_requested' }).eq('id', matchId);
  await supabase.from('messages').insert({
    sender_id:   currentUserId,
    receiver_id: opponentId,
    content:     message ? `Reschedule request — ${message}` : 'Reschedule requested.',
  });
}

async function cancelMatch(matchId: string, opponentId: string, currentUserId: string, message: string) {
  if (matchId.startsWith('mock-')) return;
  await supabase.from('matches').update({ status: 'cancelled' }).eq('id', matchId);
  await supabase.from('messages').insert({
    sender_id:   currentUserId,
    receiver_id: opponentId,
    content:     message ? `Match cancelled — ${message}` : 'Match cancelled.',
  });
}

async function acceptReschedule(
  rescheduleId: string, matchId: string,
  proposedDate: string | null, proposedStart: string | null, proposedEnd: string | null,
  requesterId: string, currentUserId: string, message: string,
) {
  if (matchId.startsWith('mock-')) return;
  await supabase.from('match_reschedule_requests').update({
    status: 'accepted', resolved_at: new Date().toISOString(),
  }).eq('id', rescheduleId);
  await supabase.from('matches').update({
    status:     'scheduled' as const,
    ...(proposedDate  ? { date:       proposedDate }  : {}),
    ...(proposedStart ? { time_start: proposedStart } : {}),
    ...(proposedEnd   ? { time_end:   proposedEnd }   : {}),
  }).eq('id', matchId);
  await supabase.from('messages').insert({
    sender_id:   currentUserId,
    receiver_id: requesterId,
    content:     message ? `Reschedule accepted — ${message}` : 'New time accepted.',
  });
}

async function declineReschedule(
  rescheduleId: string, matchId: string,
  requesterId: string, currentUserId: string, message: string,
) {
  if (matchId.startsWith('mock-')) return;
  await supabase.from('match_reschedule_requests').update({
    status: 'declined', resolved_at: new Date().toISOString(),
  }).eq('id', rescheduleId);
  await supabase.from('matches').update({ status: 'scheduled' }).eq('id', matchId);
  await supabase.from('messages').insert({
    sender_id:   currentUserId,
    receiver_id: requesterId,
    content:     message ? `Reschedule declined — ${message}` : 'New time declined, original match stands.',
  });
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

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
  const [draft, setDraft] = useState<MatchFilters>(filters);

  useEffect(() => { if (visible) setDraft(filters); }, [visible]);

  const formats: { label: string; value: MatchType }[] = [
    { label: 'Singles',         value: 'singles' },
    { label: 'Doubles',         value: 'doubles' },
    { label: 'Mixed Doubles',   value: 'mixed_doubles' },
    { label: 'Practice Session', value: 'hitting_session' },
  ];

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

          <Text style={[mfS.sectionLabel, { color: theme.textSecondary }]}>Match Format</Text>
          <View style={mfS.optionRow}>
            {formats.map((f) => (
              <TouchableOpacity
                key={f.value}
                style={[mfS.option, { borderColor: draft.format === f.value ? BLUE : theme.border, backgroundColor: draft.format === f.value ? theme.selectedBg : theme.cardBg }]}
                onPress={() => setDraft((d) => ({ ...d, format: f.value }))}
                activeOpacity={0.7}>
                <Text style={[mfS.optionText, { color: draft.format === f.value ? BLUE : theme.textSecondary }]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[mfS.sectionLabel, { color: theme.textSecondary }]}>NTRP Level</Text>
          <View style={mfS.optionRow}>
            {NTRP_LEVELS.map(level => {
              const active = draft.selectedNtrpLevels.includes(level);
              return (
                <TouchableOpacity
                  key={level}
                  style={[mfS.option, { borderColor: active ? BLUE : theme.border, backgroundColor: active ? theme.selectedBg : theme.cardBg }]}
                  onPress={() => {
                    if (active && draft.selectedNtrpLevels.length === 1) return; // keep at least one
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

          <Text style={[mfS.sectionLabel, { color: theme.textSecondary }]}>Max Distance</Text>
          <View style={mfS.optionRow}>
            {DISTANCE_OPTIONS.map((d) => {
              const active = draft.distanceMiles === d;
              return (
                <TouchableOpacity
                  key={d}
                  style={[mfS.option, { borderColor: active ? BLUE : theme.border, backgroundColor: active ? theme.selectedBg : theme.cardBg }]}
                  onPress={() => setDraft((prev) => ({ ...prev, distanceMiles: d }))}
                  activeOpacity={0.7}>
                  <Text style={[mfS.optionText, { color: active ? BLUE : theme.textSecondary }]}>{d} mi</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={mfS.ctaRow}>
            <TouchableOpacity
              style={[mfS.applyBtn, { backgroundColor: BLUE }]}
              onPress={() => { onApply(draft); onDismiss(); }}
              activeOpacity={0.85}>
              <Text style={mfS.applyText}>Apply Filters</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[mfS.resetBtn, { borderColor: theme.border }]}
              onPress={() => setDraft(DEFAULT_FILTERS)}
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
  backdrop:    { flex: 1, justifyContent: 'flex-end' },
  sheet:       { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, paddingHorizontal: Spacing.pagePx, paddingBottom: 40, paddingTop: 12 },
  handle:      { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  titleRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title:       { fontFamily: FontFamily.spaceGroteskBold, fontSize: 20 },
  sectionLabel:{ fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label, marginBottom: 10, marginTop: 16 },
  optionRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option:      { borderWidth: 1.5, borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  optionText:  { fontFamily: FontFamily.manropeSemiBold, fontSize: 13 },
  ctaRow:      { flexDirection: 'row', gap: 10, marginTop: 24 },
  applyBtn:    { flex: 2, borderRadius: Radius.button, paddingVertical: 14, alignItems: 'center', minHeight: Spacing.tapTarget },
  applyText:   { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body, color: '#FFF' },
  resetBtn:    { flex: 1, borderRadius: Radius.button, borderWidth: 1.5, paddingVertical: 14, alignItems: 'center', minHeight: Spacing.tapTarget },
  resetText:   { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body },
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

// ─── Recommended Player Card ──────────────────────────────────────────────────

function RecommendedPlayerCard({
  player,
  currentUserId,
  onMessage,
}: {
  player: RecommendedPlayer;
  currentUserId: string;
  onMessage: (id: string) => void;
}) {
  const { theme }     = useTheme();
  const [sent, setSent] = useState(false);

  async function handleRequest() {
    setSent(true);
    await sendMatchRequest(currentUserId, player.id, 'singles');
  }

  return (
    <View style={[rcS.card, { backgroundColor: theme.cardBg, borderColor: theme.border }, theme.shadowCard]}>
      {/* Avatar + name */}
      <View style={rcS.topRow}>
        <PlayerAvatar player={player} size={52} />
        <View style={rcS.nameCol}>
          <Text style={[rcS.name, { color: theme.textPrimary }]} numberOfLines={2}>{player.name}</Text>
          <RatingLine player={player} />
        </View>
      </View>

      {/* Meta */}
      <View style={rcS.meta}>
        {player.preferredTimes.length > 0 && (
          <View style={rcS.metaRow}>
            <Clock size={12} color={theme.textMuted} strokeWidth={1.5} />
            <Text style={[rcS.metaText, { color: theme.textSecondary }]} numberOfLines={1}>
              {player.preferredTimes[0]}
            </Text>
          </View>
        )}
        {player.preferredCourt != null && (
          <View style={rcS.metaRow}>
            <MapPin size={12} color={theme.textMuted} strokeWidth={1.5} />
            <Text style={[rcS.metaText, { color: theme.textSecondary }]} numberOfLines={1}>
              {player.preferredCourt}
            </Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={rcS.actions}>
        <TouchableOpacity
          style={[rcS.btn, { borderColor: sent ? theme.border : GREEN }]}
          onPress={handleRequest}
          disabled={sent}
          activeOpacity={0.8}>
          <Text style={[rcS.btnText, { color: sent ? theme.textDisabled : GREEN }]}>
            {sent ? 'Sent' : 'Request'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[rcS.btn, { borderColor: BLUE }]}
          onPress={() => onMessage(player.id)}
          activeOpacity={0.8}>
          <Text style={[rcS.btnText, { color: BLUE }]}>Chat</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const rcS = StyleSheet.create({
  card:    { width: REC_CARD_W, borderRadius: CARD_RADIUS, borderWidth: 1, padding: Spacing.cardPadding, marginRight: 12, gap: 14 },
  topRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  nameCol: { flex: 1 },
  name:    { fontFamily: FontFamily.spaceGroteskBold, fontSize: 15, lineHeight: 20 },
  meta:    { gap: 7 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontFamily: FontFamily.manropeMedium, fontSize: 12, flex: 1 },
  actions: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderRadius: Radius.button,
    paddingVertical: 11, minHeight: 42,
  },
  btnText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 12 },
});

// ─── Recommended Players Section ──────────────────────────────────────────────

function RecommendedPlayersSection({ players, loading, currentUserId }: {
  players: RecommendedPlayer[]; loading: boolean; currentUserId: string;
}) {
  const { theme } = useTheme();
  return (
    <View style={sectionStyle}>
      <SectionHeader title="Recommended" />
      {loading ? (
        <View style={{ paddingHorizontal: Spacing.pagePx }}>
          <Skeleton width={REC_CARD_W} height={200} borderRadius={CARD_RADIUS} />
        </View>
      ) : players.length === 0 ? (
        <EmptyRow
          icon={<Search size={15} color={theme.textMuted} strokeWidth={1.5} />}
          text="No players yet — try Player Lookup."
        />
      ) : (
        <FlatList
          data={players}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingHorizontal: Spacing.pagePx, paddingBottom: 4 }}
          renderItem={({ item }) => (
            <RecommendedPlayerCard
              player={item}
              currentUserId={currentUserId}
              onMessage={(id) => router.push(`/messages?partner=${id}`)}
            />
          )}
        />
      )}
    </View>
  );
}

// ─── Incoming Request Card ────────────────────────────────────────────────────

function IncomingRequestCard({
  request,
  currentUserId,
  onAccept,
  onDecline,
  onMessage,
}: {
  request: IncomingRequest;
  currentUserId: string;
  onAccept: (r: IncomingRequest) => void;
  onDecline: (r: IncomingRequest) => void;
  onMessage: (id: string) => void;
}) {
  const { theme } = useTheme();
  const isDoubles = request.matchType === 'doubles' || request.matchType === 'mixed_doubles';

  return (
    <View style={[incS.card, { backgroundColor: theme.cardBg, borderColor: theme.border }, theme.shadowCard]}>
      <View style={incS.rail} />
      <View style={incS.body}>
        {/* Challenger row */}
        <View style={incS.playerRow}>
          <PlayerAvatar player={request.challenger} size={46} />
          <View style={{ flex: 1 }}>
            <Text style={[incS.name, { color: theme.textPrimary }]}>{request.challenger.name}</Text>
            <RatingLine player={request.challenger} />
          </View>
        </View>

        {/* Match details + weather */}
        <View style={incS.meta}>
          <View style={incS.metaRow}>
            <MatchTypeIcon type={request.matchType} color={theme.textMuted} size={13} />
            <Text style={[incS.metaText, { color: theme.textSecondary }]}>{matchTypeLabel(request.matchType)}</Text>
          </View>
          {request.date && (
            <View style={incS.metaRow}>
              <Calendar size={13} color={theme.textMuted} strokeWidth={1.5} />
              <Text style={[incS.metaText, { color: theme.textSecondary }]}>
                {formatMatchDate(request.date)} · {formatMatchTime(request.timeStart, request.timeEnd)}
              </Text>
            </View>
          )}
          {request.location && (
            <View style={incS.metaRow}>
              <MapPin size={13} color={theme.textMuted} strokeWidth={1.5} />
              <Text style={[incS.metaText, { color: theme.textSecondary }]} numberOfLines={1}>{request.location}</Text>
            </View>
          )}
          {/* Weather as inline meta row */}
          {request.mockWeatherTemp != null
            ? (
              <View style={incS.metaRow}>
                <MatchWeatherWidget temp={request.mockWeatherTemp} condition={request.mockWeatherCond ?? 'sunny'} />
              </View>
            )
            : <WeatherForCard location={request.location} date={request.date} />}
        </View>

        {/* Doubles team preview */}
        {isDoubles && (
          <View style={incS.doublesRow}>
            <PlayerAvatar player={request.challenger} size={28} />
            <View style={[incS.youSlot, { borderColor: BLUE, backgroundColor: theme.selectedBg }]}>
              <Text style={[incS.youLabel, { color: BLUE }]}>YOU</Text>
            </View>
            <Text style={[incS.vsText, { color: theme.textMuted }]}>vs</Text>
            <View style={[incS.emptySlot, { borderColor: theme.border }]} />
            <View style={[incS.emptySlot, { borderColor: theme.border }]} />
            <Text style={[incS.doublesHint, { color: theme.textMuted }]}>+2 players TBD</Text>
          </View>
        )}

        {/* Actions */}
        <View style={incS.btns}>
          <TouchableOpacity style={[incS.btn, { borderColor: GREEN }]} onPress={() => onAccept(request)} activeOpacity={0.8}>
            <CheckCircle2 size={13} color={GREEN} strokeWidth={1.5} />
            <Text style={[incS.btnText, { color: GREEN }]}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[incS.btn, { borderColor: BLUE }]} onPress={() => onMessage(request.challenger.id)} activeOpacity={0.8}>
            <MessageCircle size={13} color={BLUE} strokeWidth={1.5} />
            <Text style={[incS.btnText, { color: BLUE }]}>Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[incS.btn, { borderColor: RED }]} onPress={() => onDecline(request)} activeOpacity={0.8}>
            <XCircle size={13} color={RED} strokeWidth={1.5} />
            <Text style={[incS.btnText, { color: RED }]}>Decline</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const incS = StyleSheet.create({
  card:      { width: INC_CARD_W, borderRadius: CARD_RADIUS, borderWidth: 1, overflow: 'hidden', flexDirection: 'row', marginRight: 12 },
  rail:      { width: 5, backgroundColor: BLUE, flexShrink: 0 },
  body:      { flex: 1, padding: Spacing.cardPadding, gap: 12 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name:      { fontFamily: FontFamily.spaceGroteskBold, fontSize: 15, lineHeight: 20 },
  meta:      { gap: 7 },
  metaRow:   { flexDirection: 'row', alignItems: 'center', gap: 7 },
  metaText:  { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, flex: 1 },
  doublesRow:{ flexDirection: 'row', alignItems: 'center', gap: 6 },
  youSlot:   { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  youLabel:  { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 7, letterSpacing: 0.5 },
  vsText:    { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 10, marginHorizontal: 2 },
  emptySlot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed' },
  doublesHint: { fontFamily: FontFamily.manropeMedium, fontSize: 10, flex: 1 },
  btns:      { flexDirection: 'row', gap: 6 },
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, borderWidth: 1.5, borderRadius: Radius.button, paddingVertical: 10, minHeight: 44,
  },
  btnText:   { fontFamily: FontFamily.manropeSemiBold, fontSize: 12 },
});

// ─── Incoming Requests Section ────────────────────────────────────────────────

function IncomingRequestsSection({ requests, loading, currentUserId, onAccept, onDecline }: {
  requests: IncomingRequest[]; loading: boolean; currentUserId: string;
  onAccept: (r: IncomingRequest) => void; onDecline: (r: IncomingRequest) => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={sectionStyle}>
      <SectionHeader title="Incoming" count={requests.length} />
      {loading ? (
        <View style={{ paddingHorizontal: Spacing.pagePx }}>
          <Skeleton width={INC_CARD_W} height={210} borderRadius={CARD_RADIUS} />
        </View>
      ) : requests.length === 0 ? (
        <EmptyRow
          icon={<CheckCircle2 size={15} color={theme.textMuted} strokeWidth={1.5} />}
          text="No pending requests."
        />
      ) : (
        <FlatList
          data={requests}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingHorizontal: Spacing.pagePx, paddingBottom: 4 }}
          renderItem={({ item }) => (
            <IncomingRequestCard
              request={item}
              currentUserId={currentUserId}
              onAccept={onAccept}
              onDecline={onDecline}
              onMessage={(id) => router.push(`/messages?partner=${id}`)}
            />
          )}
        />
      )}
    </View>
  );
}

// ─── Upcoming Match Card ──────────────────────────────────────────────────────

function UpcomingMatchCard({
  match,
  currentUserId,
  onMessage,
  onReschedule,
  onCancel,
  onAcceptReschedule,
  onDeclineReschedule,
}: {
  match: UpcomingMatch;
  currentUserId: string;
  onMessage: (id: string) => void;
  onReschedule: (m: UpcomingMatch) => void;
  onCancel: (m: UpcomingMatch) => void;
  onAcceptReschedule: (m: UpcomingMatch) => void;
  onDeclineReschedule: (m: UpcomingMatch) => void;
}) {
  const { theme }         = useTheme();
  const isDoubles         = match.matchType === 'doubles' || match.matchType === 'mixed_doubles';
  const opponent          = match.player1.id === currentUserId ? match.player2 : match.player1;
  const isPendingReschedule = match.status === 'reschedule_requested';
  const isRequester       = isPendingReschedule && match.pendingReschedule?.requesterUserId === currentUserId;

  return (
    <View style={[upS.card, { backgroundColor: theme.cardBg, borderColor: theme.border }, theme.shadowCard]}>
      <View style={upS.rail} />
      <View style={upS.body}>
        <View style={upS.topRow}>
          <View style={{ flex: 1, gap: 12 }}>
            {isDoubles ? (
              <>
                <View style={upS.matchLabelRow}>
                  <MatchTypeIcon type={match.matchType} color={theme.textMuted} size={15} />
                  <Text style={[upS.matchLabel, { color: theme.textPrimary }]}>{matchTypeLabel(match.matchType)}</Text>
                </View>
                <View style={upS.doublesTeams}>
                  <View style={upS.doublesTeam}>
                    <PlayerAvatar player={match.player1} size={32} />
                    <PlayerAvatar player={match.player2} size={32} />
                  </View>
                  <Text style={[upS.vsText, { color: theme.textMuted }]}>vs</Text>
                  <View style={upS.doublesTeam}>
                    {match.player3
                      ? <PlayerAvatar player={match.player3} size={32} />
                      : <View style={[upS.emptySlot, { borderColor: theme.border }]} />}
                    {match.player4
                      ? <PlayerAvatar player={match.player4} size={32} />
                      : <View style={[upS.emptySlot, { borderColor: theme.border }]} />}
                  </View>
                </View>
              </>
            ) : (
              <View style={upS.opponentRow}>
                <PlayerAvatar player={opponent} size={48} />
                <View style={{ flex: 1 }}>
                  <Text style={[upS.opponentName, { color: theme.textPrimary }]} numberOfLines={1}>{opponent.name}</Text>
                  <View style={[upS.matchLabelRow, { marginTop: 4 }]}>
                    <MatchTypeIcon type={match.matchType} color={theme.textMuted} size={12} />
                    <Text style={[upS.matchTypeSub, { color: theme.textSecondary }]}>{matchTypeLabel(match.matchType)}</Text>
                  </View>
                  <RatingLine player={opponent} />
                </View>
              </View>
            )}

            <View style={upS.meta}>
              <View style={upS.metaRow}>
                <Calendar size={13} color={theme.textMuted} strokeWidth={1.5} />
                <Text style={[upS.metaText, { color: theme.textSecondary }]}>
                  {formatMatchDate(match.date)} · {formatMatchTime(match.timeStart, match.timeEnd)}
                </Text>
              </View>
              <View style={upS.metaRow}>
                <MapPin size={13} color={theme.textMuted} strokeWidth={1.5} />
                <Text style={[upS.metaText, { color: theme.textSecondary }]} numberOfLines={1}>{match.location}</Text>
              </View>
              {/* Weather inline with meta */}
              {match.mockWeatherTemp != null
                ? (
                  <View style={upS.metaRow}>
                    <MatchWeatherWidget temp={match.mockWeatherTemp} condition={match.mockWeatherCond ?? 'sunny'} />
                  </View>
                )
                : <WeatherForCard location={match.location} date={match.date} />}
            </View>

            {/* Reschedule pending banner */}
            {isPendingReschedule && (
              <View style={[upS.rescheduleBanner, { backgroundColor: theme.selectedBg, borderColor: GREEN }]}>
                <Clock size={12} color={GREEN} strokeWidth={1.5} />
                <Text style={[upS.rescheduleText, { color: GREEN }]}>
                  {isRequester ? 'Reschedule pending — awaiting response' : 'New time proposed — review below'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {isPendingReschedule ? (
          isRequester ? (
            <View style={upS.btns}>
              <TouchableOpacity style={[upS.btn, { borderColor: BLUE, flex: 1 }]} onPress={() => onMessage(opponent.id)} activeOpacity={0.8}>
                <MessageCircle size={13} color={BLUE} strokeWidth={1.5} />
                <Text style={[upS.btnText, { color: BLUE }]}>Chat</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[upS.btn, { borderColor: RED, flex: 1 }]} onPress={() => onCancel(match)} activeOpacity={0.8}>
                <XCircle size={13} color={RED} strokeWidth={1.5} />
                <Text style={[upS.btnText, { color: RED }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={upS.btns}>
              <TouchableOpacity style={[upS.btn, { borderColor: GREEN, flex: 2 }]} onPress={() => onAcceptReschedule(match)} activeOpacity={0.8}>
                <CheckCircle2 size={13} color={GREEN} strokeWidth={1.5} />
                <Text style={[upS.btnText, { color: GREEN }]}>Accept New Time</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[upS.btn, { borderColor: RED, flex: 1 }]} onPress={() => onDeclineReschedule(match)} activeOpacity={0.8}>
                <XCircle size={13} color={RED} strokeWidth={1.5} />
                <Text style={[upS.btnText, { color: RED }]}>Decline</Text>
              </TouchableOpacity>
            </View>
          )
        ) : (
          <View style={upS.btns}>
            <TouchableOpacity style={[upS.btn, { borderColor: BLUE }]} onPress={() => onMessage(opponent.id)} activeOpacity={0.8}>
              <MessageCircle size={13} color={BLUE} strokeWidth={1.5} />
              <Text style={[upS.btnText, { color: BLUE }]}>Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[upS.btn, { borderColor: GREEN }]} onPress={() => onReschedule(match)} activeOpacity={0.8}>
              <Clock size={13} color={GREEN} strokeWidth={1.5} />
              <Text style={[upS.btnText, { color: GREEN }]}>Reschedule</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[upS.btn, { borderColor: RED }]} onPress={() => onCancel(match)} activeOpacity={0.8}>
              <XCircle size={13} color={RED} strokeWidth={1.5} />
              <Text style={[upS.btnText, { color: RED }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const upS = StyleSheet.create({
  card:         { borderRadius: CARD_RADIUS, borderWidth: 1, overflow: 'hidden', flexDirection: 'row', marginBottom: Spacing.cardGap },
  rail:         { width: 5, backgroundColor: GREEN, flexShrink: 0 },
  body:         { flex: 1, padding: Spacing.cardPadding, gap: 14 },
  topRow:       { flexDirection: 'row', gap: 12 },
  matchLabelRow:{ flexDirection: 'row', alignItems: 'center', gap: 6 },
  matchLabel:   { fontFamily: FontFamily.spaceGroteskBold, fontSize: 16 },
  matchTypeSub: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label },
  doublesTeams: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  doublesTeam:  { flexDirection: 'row', gap: 6 },
  vsText:       { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 11 },
  emptySlot:    { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', flexShrink: 0 },
  opponentRow:  { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  opponentName: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 17 },
  meta:         { gap: 7 },
  metaRow:      { flexDirection: 'row', alignItems: 'center', gap: 7 },
  metaText:     { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, flex: 1 },
  btns:         { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, borderWidth: 1.5, borderRadius: Radius.button, paddingVertical: 10, minHeight: 44,
  },
  btnText:          { fontFamily: FontFamily.manropeSemiBold, fontSize: 12 },
  rescheduleBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 7 },
  rescheduleText:   { fontFamily: FontFamily.manropeSemiBold, fontSize: 12, flex: 1 },
});

// ─── Upcoming Matches Section ─────────────────────────────────────────────────

function UpcomingMatchesSection({ matches, loading, currentUserId, onReschedule, onCancel, onAcceptReschedule, onDeclineReschedule }: {
  matches: UpcomingMatch[]; loading: boolean; currentUserId: string;
  onReschedule: (m: UpcomingMatch) => void;
  onCancel: (m: UpcomingMatch) => void;
  onAcceptReschedule: (m: UpcomingMatch) => void;
  onDeclineReschedule: (m: UpcomingMatch) => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={[sectionStyle, { paddingHorizontal: Spacing.pagePx }]}>
      <SectionHeader title="My Upcoming Matches" />
      {loading ? (
        <View style={{ gap: 12 }}>
          <Skeleton width="100%" height={150} borderRadius={CARD_RADIUS} />
          <Skeleton width="100%" height={150} borderRadius={CARD_RADIUS} />
        </View>
      ) : matches.length === 0 ? (
        <EmptyRow
          icon={<Calendar size={15} color={theme.textMuted} strokeWidth={1.5} />}
          text="No upcoming matches — request a player above."
        />
      ) : (
        matches.map((m) => (
          <UpcomingMatchCard
            key={m.id}
            match={m}
            currentUserId={currentUserId}
            onMessage={(id) => router.push(`/messages?partner=${id}`)}
            onReschedule={onReschedule}
            onCancel={onCancel}
            onAcceptReschedule={onAcceptReschedule}
            onDeclineReschedule={onDeclineReschedule}
          />
        ))
      )}
    </View>
  );
}

// ─── Quick Replies ────────────────────────────────────────────────────────────

function QuickReplies({ replies, onSelect }: { replies: { label: string; text: string }[]; onSelect: (t: string) => void }) {
  const { theme } = useTheme();
  return (
    <View style={qrS.row}>
      {replies.map((r) => (
        <TouchableOpacity
          key={r.label}
          style={[qrS.chip, { borderColor: theme.border, backgroundColor: theme.surface2 }]}
          onPress={() => onSelect(r.text)}
          activeOpacity={0.7}>
          <Text style={[qrS.text, { color: theme.textSecondary }]}>{r.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const qrS = StyleSheet.create({
  row:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12 },
  chip: { borderRadius: Radius.pill, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  text: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label },
});

// ─── Action Sheet ─────────────────────────────────────────────────────────────

function ActionSheet({
  visible, title, primaryLabel, secondaryLabel, primaryColor, quickReplies,
  onPrimary, onSecondary, onDismiss,
}: {
  visible: boolean; title: string; primaryLabel: string; secondaryLabel: string;
  primaryColor: string; quickReplies: { label: string; text: string }[];
  onPrimary: (msg: string) => Promise<void>; onSecondary: () => Promise<void>;
  onDismiss: () => void;
}) {
  const { theme }   = useTheme();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function handlePrimary() {
    setBusy(true); await onPrimary(msg.trim()); setBusy(false); setMsg('');
  }
  async function handleSecondary() {
    setBusy(true); await onSecondary(); setBusy(false); setMsg('');
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={[asS.backdrop, { backgroundColor: theme.backdrop }]}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onDismiss} activeOpacity={1} />
        <View style={[asS.sheet, { backgroundColor: theme.sheetBg }, theme.shadowSheet]}>
          <View style={[asS.handle, { backgroundColor: theme.border }]} />
          <View style={asS.headerRow}>
            <Text style={[asS.title, { color: theme.textPrimary }]}>{title}</Text>
            <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={theme.textMuted} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>
          <Text style={[asS.label, { color: theme.textSecondary }]}>Add a message (optional)</Text>
          <QuickReplies replies={quickReplies} onSelect={setMsg} />
          <TextInput
            style={[asS.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.textPrimary }]}
            value={msg}
            onChangeText={setMsg}
            placeholder="Write a note…"
            placeholderTextColor={theme.textDisabled}
            multiline
            numberOfLines={3}
          />
          <View style={asS.ctaRow}>
            <TouchableOpacity
              style={[asS.cta, { backgroundColor: primaryColor, flex: 2 }]}
              onPress={handlePrimary}
              disabled={busy}
              activeOpacity={0.85}>
              {busy
                ? <ActivityIndicator color="#FFF" size="small" />
                : <Text style={asS.ctaText}>{primaryLabel}</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[asS.ctaSec, { borderColor: primaryColor, flex: 1 }]}
              onPress={handleSecondary}
              disabled={busy}
              activeOpacity={0.85}>
              <Text style={[asS.ctaSecText, { color: primaryColor }]}>{secondaryLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const asS = StyleSheet.create({
  backdrop:  { flex: 1, justifyContent: 'flex-end' },
  sheet:     { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, paddingHorizontal: Spacing.pagePx, paddingBottom: 40, paddingTop: 12 },
  handle:    { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title:     { fontFamily: FontFamily.spaceGroteskBold, fontSize: 20 },
  label:     { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label },
  input: {
    borderWidth: 1.5, borderRadius: Radius.sm, padding: 14,
    fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body,
    minHeight: 80, textAlignVertical: 'top',
  },
  ctaRow:   { flexDirection: 'row', gap: 10, marginTop: 16 },
  cta:      { borderRadius: Radius.button, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', minHeight: Spacing.tapTarget },
  ctaText:  { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body, color: '#FFF' },
  ctaSec:   { borderRadius: Radius.button, borderWidth: 1.5, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', minHeight: Spacing.tapTarget },
  ctaSecText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body },
});

// ─── Player Lookup Modal ──────────────────────────────────────────────────────

function PlayerLookupModal({ visible, currentUserId, onDismiss }: {
  visible: boolean; currentUserId: string; onDismiss: () => void;
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

  async function handleRequest(player: MatchPlayer) {
    setRequested((prev) => new Set([...prev, player.id]));
    await sendMatchRequest(currentUserId, player.id, 'singles');
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
  const { recommended, incoming, upcoming, loading, error, reload } = useMatchData(userId);
  const [filters, setFilters] = useState<MatchFilters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  // Client-side filter recommended players by NTRP level and format
  const filteredRecommended = recommended.filter((p) => {
    return (p.ntrpRating == null || filters.selectedNtrpLevels.includes(p.ntrpRating));
  });

  const [acceptTarget,          setAcceptTarget]          = useState<IncomingRequest | null>(null);
  const [declineTarget,         setDeclineTarget]          = useState<IncomingRequest | null>(null);
  const [rescheduleTarget,      setRescheduleTarget]       = useState<UpcomingMatch | null>(null);
  const [cancelTarget,          setCancelTarget]           = useState<UpcomingMatch | null>(null);
  const [acceptReschTarget,     setAcceptReschTarget]      = useState<UpcomingMatch | null>(null);
  const [declineReschTarget,    setDeclineReschTarget]     = useState<UpcomingMatch | null>(null);

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

  function getOpponent(match: UpcomingMatch): MatchPlayer {
    return match.player1.id === userId ? match.player2 : match.player1;
  }

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
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={[scrS.pageTitle, { color: theme.textPrimary }]}>Match</Text>
            <Text style={[scrS.pageSub, { color: theme.textSecondary }]}>
              Find the right players. Play more tennis.
            </Text>
          </View>
          <TouchableOpacity
            style={[scrS.lookupBtn, { borderColor: BLUE, backgroundColor: theme.cardBg }]}
            onPress={() => setShowLookup(true)}
            activeOpacity={0.8}>
            <User size={14} color={BLUE} strokeWidth={1.5} />
            <Text style={scrS.lookupBtnText}>Player Lookup</Text>
          </TouchableOpacity>
        </View>

        {/* Filter bar */}
        <View style={scrS.filterWrap}>
          <FilterBar filters={filters} onEdit={() => setShowFilters(true)} />
          <ResultsContext filters={filters} matchingCount={filteredRecommended.length} loading={loading} />
        </View>

        {/* Error banner */}
        {error != null && (
          <TouchableOpacity
            style={[scrS.errorBanner, { backgroundColor: theme.cardBg, borderColor: RED }]}
            onPress={reload}
            activeOpacity={0.8}>
            <XCircle size={15} color={RED} strokeWidth={1.5} />
            <Text style={[scrS.errorText, { color: RED }]}>{error}</Text>
            <Text style={[scrS.errorRetry, { color: theme.textMuted }]}>Tap to retry</Text>
          </TouchableOpacity>
        )}

        {/* Sections */}
        <RecommendedPlayersSection players={filteredRecommended} loading={loading} currentUserId={userId} />
        <IncomingRequestsSection
          requests={incoming} loading={loading} currentUserId={userId}
          onAccept={setAcceptTarget} onDecline={setDeclineTarget}
        />
        <UpcomingMatchesSection
          matches={upcoming} loading={loading} currentUserId={userId}
          onReschedule={setRescheduleTarget} onCancel={setCancelTarget}
          onAcceptReschedule={setAcceptReschTarget} onDeclineReschedule={setDeclineReschTarget}
        />
      </ScrollView>

      {/* Accept */}
      <ActionSheet
        visible={acceptTarget != null}
        title="Accept Match"
        primaryLabel="Send & Accept"
        secondaryLabel="Accept Only"
        primaryColor={GREEN}
        quickReplies={[
          { label: 'Looking forward to it', text: 'Looking forward to it.' },
          { label: 'Sounds great',          text: 'Sounds great — see you then.' },
          { label: "Let's do it",           text: "Let's do it." },
        ]}
        onPrimary={async (msg) => {
          if (!acceptTarget) return;
          await acceptRequest(acceptTarget.id, acceptTarget.challenger.id, userId, msg);
          setAcceptTarget(null); reload();
        }}
        onSecondary={async () => {
          if (!acceptTarget) return;
          await acceptRequest(acceptTarget.id, acceptTarget.challenger.id, userId, '');
          setAcceptTarget(null); reload();
        }}
        onDismiss={() => setAcceptTarget(null)}
      />

      {/* Decline */}
      <ActionSheet
        visible={declineTarget != null}
        title="Decline Request"
        primaryLabel="Send & Decline"
        secondaryLabel="Decline Only"
        primaryColor={RED}
        quickReplies={[
          { label: 'Already have plans',   text: 'Sorry, already have plans.' },
          { label: "Can't make that time", text: "Can't make that time." },
          { label: 'Suggest another day',  text: 'Maybe another day works?' },
        ]}
        onPrimary={async (msg) => {
          if (!declineTarget) return;
          await declineRequest(declineTarget.id, declineTarget.challenger.id, userId, msg);
          setDeclineTarget(null); reload();
        }}
        onSecondary={async () => {
          if (!declineTarget) return;
          await declineRequest(declineTarget.id, declineTarget.challenger.id, userId, '');
          setDeclineTarget(null); reload();
        }}
        onDismiss={() => setDeclineTarget(null)}
      />

      {/* Reschedule */}
      <ActionSheet
        visible={rescheduleTarget != null}
        title="Reschedule Match"
        primaryLabel="Send Reschedule"
        secondaryLabel="Just Notify"
        primaryColor={GREEN}
        quickReplies={[
          { label: 'Suggest new time',  text: "Can we find a new time?" },
          { label: 'Work conflict',     text: "Work came up — can we move it?" },
          { label: 'Weather concern',   text: "Weather looks rough — reschedule?" },
        ]}
        onPrimary={async (msg) => {
          if (!rescheduleTarget) return;
          await rescheduleMatch(rescheduleTarget.id, getOpponent(rescheduleTarget).id, userId, msg);
          setRescheduleTarget(null);
        }}
        onSecondary={async () => {
          if (!rescheduleTarget) return;
          await rescheduleMatch(rescheduleTarget.id, getOpponent(rescheduleTarget).id, userId, '');
          setRescheduleTarget(null);
        }}
        onDismiss={() => setRescheduleTarget(null)}
      />

      {/* Cancel */}
      <ActionSheet
        visible={cancelTarget != null}
        title="Cancel Match"
        primaryLabel="Send & Cancel"
        secondaryLabel="Cancel Only"
        primaryColor={RED}
        quickReplies={[
          { label: 'Something came up', text: 'Sorry, something came up.' },
          { label: 'Need to cancel',    text: 'I need to cancel.' },
          { label: 'Weather',           text: "Weather isn't great — let's find another time." },
        ]}
        onPrimary={async (msg) => {
          if (!cancelTarget) return;
          await cancelMatch(cancelTarget.id, getOpponent(cancelTarget).id, userId, msg);
          setCancelTarget(null); reload();
        }}
        onSecondary={async () => {
          if (!cancelTarget) return;
          await cancelMatch(cancelTarget.id, getOpponent(cancelTarget).id, userId, '');
          setCancelTarget(null); reload();
        }}
        onDismiss={() => setCancelTarget(null)}
      />

      {/* Filter sheet */}
      <MatchFiltersSheet
        visible={showFilters}
        filters={filters}
        onApply={setFilters}
        onDismiss={() => setShowFilters(false)}
      />

      {/* Accept Reschedule */}
      <ActionSheet
        visible={acceptReschTarget != null}
        title="Accept New Time"
        primaryLabel="Confirm & Accept"
        secondaryLabel="Accept Only"
        primaryColor={GREEN}
        quickReplies={[
          { label: 'Works for me',       text: 'Works for me!' },
          { label: 'See you then',       text: 'See you then.' },
          { label: 'Thanks for the flexibility', text: 'Thanks for the flexibility.' },
        ]}
        onPrimary={async (msg) => {
          if (!acceptReschTarget?.pendingReschedule) return;
          const pr = acceptReschTarget.pendingReschedule;
          await acceptReschedule(pr.id, acceptReschTarget.id, pr.proposedDate, pr.proposedStartTime, pr.proposedEndTime, pr.requesterUserId, userId, msg);
          setAcceptReschTarget(null); reload();
        }}
        onSecondary={async () => {
          if (!acceptReschTarget?.pendingReschedule) return;
          const pr = acceptReschTarget.pendingReschedule;
          await acceptReschedule(pr.id, acceptReschTarget.id, pr.proposedDate, pr.proposedStartTime, pr.proposedEndTime, pr.requesterUserId, userId, '');
          setAcceptReschTarget(null); reload();
        }}
        onDismiss={() => setAcceptReschTarget(null)}
      />

      {/* Decline Reschedule */}
      <ActionSheet
        visible={declineReschTarget != null}
        title="Decline New Time"
        primaryLabel="Send & Decline"
        secondaryLabel="Decline Only"
        primaryColor={RED}
        quickReplies={[
          { label: "Original time works", text: "Original time still works for me." },
          { label: "Can't make new time", text: "Sorry, that new time doesn't work for me." },
          { label: 'Let\'s keep original', text: "Let's keep the original time." },
        ]}
        onPrimary={async (msg) => {
          if (!declineReschTarget?.pendingReschedule) return;
          const pr = declineReschTarget.pendingReschedule;
          await declineReschedule(pr.id, declineReschTarget.id, pr.requesterUserId, userId, msg);
          setDeclineReschTarget(null); reload();
        }}
        onSecondary={async () => {
          if (!declineReschTarget?.pendingReschedule) return;
          const pr = declineReschTarget.pendingReschedule;
          await declineReschedule(pr.id, declineReschTarget.id, pr.requesterUserId, userId, '');
          setDeclineReschTarget(null); reload();
        }}
        onDismiss={() => setDeclineReschTarget(null)}
      />

      <PlayerLookupModal visible={showLookup} currentUserId={userId} onDismiss={() => setShowLookup(false)} />
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
  lookupBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderRadius: Radius.button,
    paddingHorizontal: 14, paddingVertical: 11,
    alignSelf: 'flex-start', marginTop: 8,
  },
  lookupBtnText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label, color: BLUE },
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
