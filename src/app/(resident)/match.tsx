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
  Bell,
  Menu,
  User,
  MessageCircle,
  CheckCircle2,
  XCircle,
  Calendar,
  MapPin,
  Clock,
  Users,
  Swords,
  CircleDot,
  Search,
  SlidersHorizontal,
  ChevronRight,
  X,
} from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
// Header not used — MatchPageHeader is inlined below for light-mode treatment
import { WeatherMini } from '@/components/ui/WeatherMini';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Colors, FontFamily, FontSize, Radius, Spacing,
} from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import { useWeather, getWeatherForDate } from '@/hooks/useWeather';
import type { WeatherCondition } from '@/components/ui/WeatherMini';

// ─── Types ────────────────────────────────────────────────────────────────────

// Local alias: extends DB enum until types.ts is regenerated after migration
type MatchType = 'singles' | 'doubles' | 'mixed_doubles' | 'hitting_session';

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
  // TODO(doubles): replace with match_request_participants rows once that table exists
  // Currently only 2 participants (challenger + current user) — real data, not faked
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
  // TODO(doubles): player3 + player4 fully reliable once match_request_participants is implemented
  player3: MatchPlayer | null;
  player4: MatchPlayer | null;
}

interface MatchFilters {
  format: MatchType;
  utrMin: number;
  utrMax: number;
  dateLabel: string;
  timeLabel: string;
  distanceMiles: number;
}

// ─── Match Page Header (light — replaces dark resident header on this screen) ──

interface MatchPageHeaderProps {
  avatarInitials: string;
  onBell?: () => void;
  onMenu?: () => void;
}

function MatchPageHeader({ avatarInitials, onBell, onMenu }: MatchPageHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[mpHeaderStyles.container, { paddingTop: insets.top + 6 }]}>
      <Image
        source={require('@/assets/images/TenisX_logo-removebg-preview.png')}
        style={mpHeaderStyles.logo}
        resizeMode="contain"
      />
      <View style={mpHeaderStyles.right}>
        <TouchableOpacity
          style={mpHeaderStyles.iconBtn}
          onPress={onBell ?? (() => router.push('/notifications'))}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Bell size={22} color="#FFFFFF" strokeWidth={1.5} />
        </TouchableOpacity>
        <View style={mpHeaderStyles.avatar}>
          <Text style={mpHeaderStyles.avatarText}>{avatarInitials}</Text>
        </View>
        <TouchableOpacity
          style={mpHeaderStyles.iconBtn}
          onPress={onMenu ?? (() => router.push('/settings'))}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Menu size={22} color="#FFFFFF" strokeWidth={1.5} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const mpHeaderStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.pagePx,
    paddingBottom: 10,
    backgroundColor: '#0F2A57',
  },
  logo: { width: 110, height: 44 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 12, color: '#FFFFFF' },
});

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: MatchFilters = {
  format: 'singles',
  utrMin: 7.5,
  utrMax: 9.0,
  dateLabel: 'Today',
  timeLabel: '5–8 PM',
  distanceMiles: 10,
};

// Fallback mock: shown when match_preferences table returns no rows
// Replace this data by populating match_preferences.looking_to_play = true
const MOCK_RECOMMENDED: RecommendedPlayer[] = [
  {
    id: 'mock-1',
    name: 'Alex Rodriguez',
    avatarUrl: null,
    utrRating: 8.3,
    ntrpRating: 4.5,
    preferredTimes: ['Evenings'],
    preferredCourt: 'Riverside Courts',
  },
  {
    id: 'mock-2',
    name: 'Ethan Lee',
    avatarUrl: null,
    utrRating: 8.1,
    ntrpRating: 4.0,
    preferredTimes: ['Weekends'],
    preferredCourt: 'Bayview Courts',
  },
  {
    id: 'mock-3',
    name: 'Marcus Kim',
    avatarUrl: null,
    utrRating: 7.8,
    ntrpRating: 3.5,
    preferredTimes: ['Mornings'],
    preferredCourt: 'Central Park TC',
  },
];

// ─── Data hook ────────────────────────────────────────────────────────────────

function useMatchData(userId: string) {
  const [recommended, setRecommended] = useState<RecommendedPlayer[]>([]);
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingMatch[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    const profilesNeeded = new Set<string>();

    // Incoming requests where current user is the opponent
    const { data: rawRequests } = await supabase
      .from('match_requests')
      .select('id, match_type, date, time_start, time_end, location, challenger_id, status')
      .eq('opponent_id', userId)
      .eq('status', 'pending')
      .order('date', { ascending: true });

    (rawRequests ?? []).forEach((r) => profilesNeeded.add(r.challenger_id));

    // Upcoming matches where current user is any player slot
    const today = new Date().toISOString().split('T')[0];
    const { data: rawMatches } = await supabase
      .from('matches')
      .select('id, match_type, date, time_start, time_end, location, player1_id, player2_id, player3_id, player4_id')
      .or(`player1_id.eq.${userId},player2_id.eq.${userId},player3_id.eq.${userId},player4_id.eq.${userId}`)
      .gte('date', today)
      .order('date', { ascending: true });

    (rawMatches ?? []).forEach((m) => {
      [m.player1_id, m.player2_id, m.player3_id, m.player4_id].forEach((id) => {
        if (id) profilesNeeded.add(id);
      });
    });

    // Recommended: players with looking_to_play = true, excluding current user
    const { data: prefs } = await supabase
      .from('match_preferences')
      .select('user_id')
      .eq('looking_to_play', true)
      .neq('user_id', userId)
      .limit(20);

    const prefUserIds = (prefs ?? []).map((p) => p.user_id);
    prefUserIds.forEach((id) => profilesNeeded.add(id));

    // Single batch profile fetch
    const allIds = [...profilesNeeded];
    type ProfileRow = {
      id: string;
      full_name: string | null;
      avatar_url: string | null;
      utr_rating: number | null;
      ntrp_rating: number | null;
      preferred_court_locations: string | null;
    };

    let profileRows: ProfileRow[] = [];
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
        name: p?.full_name ?? 'Unknown',
        avatarUrl: p?.avatar_url ?? null,
        utrRating: p?.utr_rating ?? null,
        ntrpRating: p?.ntrp_rating ?? null,
      };
    }

    // Build recommended list
    if (prefUserIds.length > 0) {
      const { data: prefDetails } = await supabase
        .from('match_preferences')
        .select('user_id, preferred_times')
        .in('user_id', prefUserIds);
      const prefMap = new Map((prefDetails ?? []).map((p) => [p.user_id, p]));

      setRecommended(
        prefUserIds.map((uid) => {
          const profile = profileMap.get(uid);
          const pref = prefMap.get(uid);
          return {
            id: uid,
            name: profile?.full_name ?? 'Unknown',
            avatarUrl: profile?.avatar_url ?? null,
            utrRating: profile?.utr_rating ?? null,
            ntrpRating: profile?.ntrp_rating ?? null,
            preferredTimes: pref?.preferred_times ?? [],
            preferredCourt: profile?.preferred_court_locations ?? null,
          };
        })
      );
    } else {
      // Fallback mock until match_preferences data populates
      setRecommended(MOCK_RECOMMENDED);
    }

    setIncoming(
      (rawRequests ?? []).map((r) => ({
        id: r.id,
        matchType: (r.match_type as MatchType) ?? 'singles',
        date: r.date,
        timeStart: r.time_start,
        timeEnd: r.time_end,
        location: r.location,
        challenger: toPlayer(r.challenger_id),
        status: r.status as IncomingRequest['status'],
      }))
    );

    setUpcoming(
      (rawMatches ?? []).map((m) => ({
        id: m.id,
        matchType: (m.match_type as MatchType) ?? 'singles',
        date: m.date,
        timeStart: m.time_start,
        timeEnd: m.time_end ?? null,
        location: m.location,
        player1: toPlayer(m.player1_id),
        player2: toPlayer(m.player2_id),
        player3: m.player3_id ? toPlayer(m.player3_id) : null,
        player4: m.player4_id ? toPlayer(m.player4_id) : null,
      }))
    );

    setLoading(false);
  }, [userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return { recommended, incoming, upcoming, loading, reload: load };
}

// ─── Supabase action helpers ──────────────────────────────────────────────────

async function sendMatchRequest(
  currentUserId: string,
  opponentId: string,
  matchType: MatchType,
) {
  await supabase.from('match_requests').insert({
    challenger_id: currentUserId,
    opponent_id: opponentId,
    match_type: matchType as any, // cast until types.ts regenerated after migration
    status: 'pending',
  });
}

async function acceptRequest(
  requestId: string,
  challengerId: string,
  currentUserId: string,
  message: string,
) {
  await supabase.from('match_requests').update({ status: 'accepted' }).eq('id', requestId);
  if (message) {
    await supabase.from('messages').insert({
      sender_id: currentUserId,
      receiver_id: challengerId,
      content: `Match accepted — ${message}`,
    });
  }
}

async function declineRequest(
  requestId: string,
  challengerId: string,
  currentUserId: string,
  message: string,
) {
  await supabase.from('match_requests').update({ status: 'declined' }).eq('id', requestId);
  if (message) {
    await supabase.from('messages').insert({
      sender_id: currentUserId,
      receiver_id: challengerId,
      content: `Request declined — ${message}`,
    });
  }
}

async function rescheduleMatch(
  _matchId: string,
  opponentId: string,
  currentUserId: string,
  message: string,
) {
  // TODO: add reschedule_requests table or a separate flow in follow-up
  if (message) {
    await supabase.from('messages').insert({
      sender_id: currentUserId,
      receiver_id: opponentId,
      content: `Reschedule request — ${message}`,
    });
  }
}

async function cancelMatch(
  _matchId: string,
  opponentId: string,
  currentUserId: string,
  message: string,
) {
  // TODO: add status column to matches table in a follow-up migration
  if (message) {
    await supabase.from('messages').insert({
      sender_id: currentUserId,
      receiver_id: opponentId,
      content: `Match cancelled — ${message}`,
    });
  }
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
    case 'hitting_session': return 'Hitting Session';
  }
}

function MatchTypeIcon({
  type,
  color,
  size = 16,
}: {
  type: MatchType;
  color: string;
  size?: number;
}) {
  const props = { size, color, strokeWidth: 1.5 };
  switch (type) {
    case 'singles':         return <User {...props} />;
    case 'hitting_session': return <CircleDot {...props} />;
    case 'doubles':
    case 'mixed_doubles':   return <Users {...props} />;
  }
}

function formatMatchDate(date: string | null): string {
  if (!date) return '—';
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatMatchTime(timeStart: string | null, timeEnd: string | null): string {
  if (!timeStart) return '—';
  const fmt = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return m === 0 ? `${hour} ${period}` : `${hour}:${String(m).padStart(2, '0')} ${period}`;
  };
  return timeEnd ? `${fmt(timeStart)} – ${fmt(timeEnd)}` : fmt(timeStart);
}

// ─── PlayerAvatar ─────────────────────────────────────────────────────────────

type ThemeType = ReturnType<typeof useTheme>['theme'];

interface AvatarProps {
  player: MatchPlayer;
  size?: number;
  theme: ThemeType;
}

function PlayerAvatar({ player, size = 48, theme }: AvatarProps) {
  return (
    <View style={[
      avatarStyles.wrap,
      {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.selectedBg,
        borderColor: theme.border,
      },
    ]}>
      <Text style={[
        avatarStyles.initials,
        { fontSize: size * 0.33, color: Colors.blue },
      ]}>
        {getInitials(player.name)}
      </Text>
    </View>
  );
}

const avatarStyles = StyleSheet.create({
  wrap: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  initials: {
    fontFamily: FontFamily.manropeSemiBold,
  },
});

// ─── WeatherForCard ───────────────────────────────────────────────────────────
// Hook wrapper: each card manages its own weather fetch by location.
// Multiple cards with the same location will each make a fetch.
// TODO: add a shared weather cache to deduplicate requests when many cards share a location.

function WeatherForCard({ location, date }: { location: string | null; date: string | null }) {
  const { forecast } = useWeather(location ?? undefined);
  if (!location || !date) return null;
  const w = getWeatherForDate(forecast, date);
  if (!w) return null;
  return (
    <WeatherMini
      temperature={w.temperature}
      condition={w.condition as WeatherCondition}
      description={w.description}
      windSpeed={w.windSpeed}
    />
  );
}

// ─── Shared section styles ────────────────────────────────────────────────────

const sectionStyles = StyleSheet.create({
  section: { marginBottom: Spacing.sectionGap },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.pagePx,
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: FontFamily.spaceGroteskBold,
    fontSize: FontSize.sectionTitle,
  },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.label,
    color: Colors.blue,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: 11,
    color: '#FFF',
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  emptyRowPadded: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.pagePx,
    paddingVertical: 4,
  },
  emptyText: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.label,
    lineHeight: 20,
    flex: 1,
  },
});

// ─── Quick Replies ────────────────────────────────────────────────────────────

interface QuickReply { label: string; text: string }

function QuickReplies({
  replies,
  onSelect,
  theme,
}: {
  replies: QuickReply[];
  onSelect: (t: string) => void;
  theme: ThemeType;
}) {
  return (
    <View style={chipStyles.row}>
      {replies.map((r) => (
        <TouchableOpacity
          key={r.label}
          style={[chipStyles.chip, { backgroundColor: theme.surface2, borderColor: theme.border }]}
          onPress={() => onSelect(r.text)}
          activeOpacity={0.7}>
          <Text style={[chipStyles.chipText, { color: theme.textSecondary }]}>{r.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const chipStyles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12 },
  chip: { borderRadius: Radius.pill, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label },
});

// ─── ActionSheet ──────────────────────────────────────────────────────────────

interface ActionSheetProps {
  visible: boolean;
  title: string;
  primaryLabel: string;
  secondaryLabel: string;
  primaryColor: string;
  quickReplies: QuickReply[];
  onPrimary: (msg: string) => Promise<void>;
  onSecondary: () => Promise<void>;
  onDismiss: () => void;
  theme: ThemeType;
}

function ActionSheet({
  visible,
  title,
  primaryLabel,
  secondaryLabel,
  primaryColor,
  quickReplies,
  onPrimary,
  onSecondary,
  onDismiss,
  theme,
}: ActionSheetProps) {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function handlePrimary() {
    setBusy(true);
    await onPrimary(msg.trim());
    setBusy(false);
    setMsg('');
  }

  async function handleSecondary() {
    setBusy(true);
    await onSecondary();
    setBusy(false);
    setMsg('');
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={[sheetStyles.backdrop, { backgroundColor: theme.backdrop }]}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onDismiss} activeOpacity={1} />
        <View style={[sheetStyles.sheet, { backgroundColor: theme.sheetBg }, theme.shadowSheet]}>
          <View style={[sheetStyles.handle, { backgroundColor: theme.border }]} />
          <View style={sheetStyles.header}>
            <Text style={[sheetStyles.title, { color: theme.textPrimary }]}>{title}</Text>
            <TouchableOpacity
              onPress={onDismiss}
              style={sheetStyles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={theme.textMuted} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>

          <Text style={[sheetStyles.label, { color: theme.textSecondary }]}>
            Add a message (optional)
          </Text>
          <QuickReplies replies={quickReplies} onSelect={setMsg} theme={theme} />
          <TextInput
            style={[
              sheetStyles.input,
              {
                backgroundColor: theme.inputBg,
                borderColor: theme.border,
                color: theme.textPrimary,
              },
            ]}
            value={msg}
            onChangeText={setMsg}
            placeholder="Write a note…"
            placeholderTextColor={theme.textDisabled}
            multiline
            numberOfLines={3}
          />

          <View style={sheetStyles.ctaRow}>
            <TouchableOpacity
              style={[sheetStyles.cta, { backgroundColor: primaryColor, flex: 2 }]}
              onPress={handlePrimary}
              disabled={busy}
              activeOpacity={0.85}>
              {busy
                ? <ActivityIndicator color="#FFF" size="small" />
                : <Text style={sheetStyles.ctaText}>{primaryLabel}</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[sheetStyles.ctaSecondary, { borderColor: primaryColor, flex: 1 }]}
              onPress={handleSecondary}
              disabled={busy}
              activeOpacity={0.85}>
              <Text style={[sheetStyles.ctaSecondaryText, { color: primaryColor }]}>
                {secondaryLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.pagePx,
    paddingBottom: 40,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 20 },
  closeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label },
  input: {
    borderWidth: 1.5,
    borderRadius: Radius.sm,
    padding: 14,
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.body,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  ctaRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cta: {
    borderRadius: Radius.button,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Spacing.tapTarget,
  },
  ctaText: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.body,
    color: '#FFF',
  },
  ctaSecondary: {
    borderRadius: Radius.button,
    borderWidth: 1.5,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Spacing.tapTarget,
  },
  ctaSecondaryText: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.body,
  },
});

// ─── Recommended Player Card ──────────────────────────────────────────────────

interface RecommendedCardProps {
  player: RecommendedPlayer;
  currentUserId: string;
  onMessage: (id: string) => void;
  theme: ThemeType;
}

function RecommendedPlayerCard({
  player,
  currentUserId,
  onMessage,
  theme,
}: RecommendedCardProps) {
  const [requested, setRequested] = useState(false);

  async function handleRequest() {
    setRequested(true);
    await sendMatchRequest(currentUserId, player.id, 'singles');
  }

  return (
    <View style={[recStyles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }, theme.shadowCard]}>
      <View style={recStyles.top}>
        <PlayerAvatar player={player} size={56} theme={theme} />
        <View style={recStyles.info}>
          <Text style={[recStyles.name, { color: theme.textPrimary }]} numberOfLines={1}>
            {player.name}
          </Text>
          <View style={recStyles.ratings}>
            {player.utrRating != null && (
              <Text style={recStyles.utr}>UTR {player.utrRating.toFixed(1)}</Text>
            )}
            {player.ntrpRating != null && (
              <Text style={[recStyles.ntrp, { color: theme.textSecondary }]}>
                · {player.ntrpRating.toFixed(1)} NTRP
              </Text>
            )}
          </View>
        </View>
      </View>

      {player.preferredTimes.length > 0 && (
        <View style={recStyles.metaRow}>
          <Clock size={13} color={theme.textMuted} strokeWidth={1.5} />
          <Text style={[recStyles.metaText, { color: theme.textSecondary }]} numberOfLines={1}>
            {player.preferredTimes.join(', ')}
          </Text>
        </View>
      )}
      {player.preferredCourt != null && (
        <View style={recStyles.metaRow}>
          <MapPin size={13} color={theme.textMuted} strokeWidth={1.5} />
          <Text style={[recStyles.metaText, { color: theme.textSecondary }]} numberOfLines={1}>
            {player.preferredCourt}
          </Text>
        </View>
      )}

      <View style={recStyles.btns}>
        <TouchableOpacity
          style={[recStyles.btn, { borderColor: requested ? theme.border : Colors.positive }]}
          onPress={handleRequest}
          disabled={requested}
          activeOpacity={0.8}>
          <Swords
            size={13}
            color={requested ? theme.textDisabled : Colors.positive}
            strokeWidth={1.5}
          />
          <Text style={[recStyles.btnText, { color: requested ? theme.textDisabled : Colors.positive }]}>
            {requested ? 'Requested' : 'Request to Play'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[recStyles.btn, { borderColor: Colors.blue }]}
          onPress={() => onMessage(player.id)}
          activeOpacity={0.8}>
          <MessageCircle size={13} color={Colors.blue} strokeWidth={1.5} />
          <Text style={[recStyles.btnText, { color: Colors.blue }]}>Message</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const SCREEN_W = Dimensions.get('window').width;
// 80% of screen width — shows ~1.2 cards, clear peek of next card
const REC_CARD_W = Math.max(270, Math.min(340, SCREEN_W * 0.80));
const INC_CARD_W_COMPUTED = Math.max(290, Math.min(350, SCREEN_W * 0.84));

const recStyles = StyleSheet.create({
  card: {
    width: REC_CARD_W,
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    marginRight: 12,
  },
  top: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  info: { flex: 1 },
  name: { fontFamily: FontFamily.spaceGroteskBold, fontSize: FontSize.cardTitle },
  ratings: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  utr: {
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: 12,
    color: Colors.blue,
  },
  ntrp: { fontFamily: FontFamily.manropeMedium, fontSize: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.label,
    flex: 1,
  },
  btns: { flexDirection: 'row', gap: 8, marginTop: 4 },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderRadius: Radius.button,
    paddingVertical: 9,
    minHeight: 40,
  },
  btnText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 12 },
});

// ─── Recommended Players Section ──────────────────────────────────────────────

interface RecSectionProps {
  players: RecommendedPlayer[];
  loading: boolean;
  currentUserId: string;
  theme: ThemeType;
}

function RecommendedPlayersSection({
  players,
  loading,
  currentUserId,
  theme,
}: RecSectionProps) {
  function handleMessage(partnerId: string) {
    router.push(`/messages?partner=${partnerId}`);
  }

  return (
    <View style={sectionStyles.section}>
      <View style={sectionStyles.headerRow}>
        <Text style={[sectionStyles.sectionTitle, { color: theme.textPrimary }]}>
          Recommended Players
        </Text>
        <TouchableOpacity style={sectionStyles.viewAll} activeOpacity={0.7}>
          <Text style={sectionStyles.viewAllText}>View all</Text>
          <ChevronRight size={14} color={Colors.blue} strokeWidth={1.5} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: Spacing.pagePx }}>
          <Skeleton width={230} height={160} borderRadius={Radius.card} />
        </View>
      ) : players.length === 0 ? (
        <View style={sectionStyles.emptyRowPadded}>
          <Search size={15} color={theme.textMuted} strokeWidth={1.5} />
          <Text style={[sectionStyles.emptyText, { color: theme.textMuted }]}>
            No matches yet — try Player Lookup.
          </Text>
        </View>
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
              onMessage={handleMessage}
              theme={theme}
            />
          )}
        />
      )}
    </View>
  );
}

// ─── Incoming Request Card ────────────────────────────────────────────────────

interface IncomingCardProps {
  request: IncomingRequest;
  currentUserId: string;
  onAccept: (request: IncomingRequest) => void;
  onDecline: (request: IncomingRequest) => void;
  onMessage: (partnerId: string) => void;
  theme: ThemeType;
}

function IncomingRequestCard({
  request,
  currentUserId,
  onAccept,
  onDecline,
  onMessage,
  theme,
}: IncomingCardProps) {
  const isDoubles =
    request.matchType === 'doubles' || request.matchType === 'mixed_doubles';

  return (
    <View style={[
      incStyles.card,
      { backgroundColor: theme.cardBg, borderColor: theme.border },
      theme.shadowCard,
    ]}>
      {/* Blue left rail — signals incoming / needs response */}
      <View style={[incStyles.rail, { backgroundColor: Colors.blue }]} />

      <View style={incStyles.body}>
        {/* Row: match type + weather */}
        <View style={incStyles.topRow}>
          <View style={incStyles.matchTypeRow}>
            <MatchTypeIcon type={request.matchType} color={theme.textMuted} size={14} />
            <Text style={[incStyles.matchTypeLabel, { color: theme.textSecondary }]}>
              {matchTypeLabel(request.matchType)}
            </Text>
          </View>
          <WeatherForCard location={request.location} date={request.date} />
        </View>

        {/* Challenger info */}
        <View style={incStyles.challengerRow}>
          <PlayerAvatar player={request.challenger} size={44} theme={theme} />
          <View style={{ flex: 1 }}>
            <Text style={[incStyles.challengerName, { color: theme.textPrimary }]}>
              {request.challenger.name}
            </Text>
            <View style={incStyles.ratingsRow}>
              {request.challenger.utrRating != null && (
                <Text style={incStyles.utr}>UTR {request.challenger.utrRating.toFixed(1)}</Text>
              )}
              {request.challenger.ntrpRating != null && (
                <Text style={[incStyles.ntrp, { color: theme.textSecondary }]}>
                  • {request.challenger.ntrpRating.toFixed(1)} NTRP
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Date / location */}
        {request.date && (
          <View style={incStyles.metaRow}>
            <Calendar size={12} color={theme.textMuted} strokeWidth={1.5} />
            <Text style={[incStyles.metaText, { color: theme.textSecondary }]}>
              {formatMatchDate(request.date)} · {formatMatchTime(request.timeStart, request.timeEnd)}
            </Text>
          </View>
        )}
        {request.location && (
          <View style={incStyles.metaRow}>
            <MapPin size={12} color={theme.textMuted} strokeWidth={1.5} />
            <Text style={[incStyles.metaText, { color: theme.textSecondary }]} numberOfLines={1}>
              {request.location}
            </Text>
          </View>
        )}

        {/* Doubles participant slots
            TODO(doubles): replace with match_request_participants query.
            Currently shows challenger + current user as confirmed, 2 open slots.
            Do NOT show "3 OF 4 CONFIRMED" — the schema only confirms 2 people. */}
        {isDoubles && (
          <View style={incStyles.doublesRow}>
            <PlayerAvatar player={request.challenger} size={32} theme={theme} />
            <View style={[
              incStyles.youSlot,
              { borderColor: Colors.blue, backgroundColor: theme.selectedBg },
            ]}>
              <Text style={[incStyles.youLabel, { color: Colors.blue }]}>YOU</Text>
            </View>
            {/* Open slots — awaiting match_request_participants */}
            <View style={[incStyles.emptySlot, { borderColor: theme.border }]} />
            <View style={[incStyles.emptySlot, { borderColor: theme.border }]} />
            <Text style={[incStyles.doublesStatus, { color: theme.textMuted }]}>
              2 OF 4
            </Text>
          </View>
        )}

        {/* Buttons: Accept · Message · Decline */}
        <View style={incStyles.btns}>
          <TouchableOpacity
            style={[incStyles.btn, { borderColor: Colors.positive }]}
            onPress={() => onAccept(request)}
            activeOpacity={0.8}>
            <CheckCircle2 size={13} color={Colors.positive} strokeWidth={1.5} />
            <Text style={[incStyles.btnText, { color: Colors.positive }]}>Accept</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[incStyles.btn, { borderColor: Colors.blue }]}
            onPress={() => {
              // TODO(group-chat): open group conversation once conversations table exists
              onMessage(request.challenger.id);
            }}
            activeOpacity={0.8}>
            <MessageCircle size={13} color={Colors.blue} strokeWidth={1.5} />
            <Text style={[incStyles.btnText, { color: Colors.blue }]}>Message</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[incStyles.btn, { borderColor: Colors.negative }]}
            onPress={() => onDecline(request)}
            activeOpacity={0.8}>
            <XCircle size={13} color={Colors.negative} strokeWidth={1.5} />
            <Text style={[incStyles.btnText, { color: Colors.negative }]}>Decline</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const INC_CARD_W = INC_CARD_W_COMPUTED;

const incStyles = StyleSheet.create({
  card: {
    width: INC_CARD_W,
    borderRadius: Radius.card,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
    marginRight: 10,
  },
  rail: { width: 4, flexShrink: 0 },
  body: { flex: 1, padding: 14, gap: 8 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  matchTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  matchTypeLabel: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label },
  challengerRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  challengerName: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 15 },
  ratingsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  utr: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 11, color: Colors.blue },
  ntrp: { fontFamily: FontFamily.manropeMedium, fontSize: 11 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, flex: 1 },
  doublesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  youSlot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  youLabel: {
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  emptySlot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  doublesStatus: {
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: 9,
    letterSpacing: 0.5,
    marginLeft: 2,
  },
  btns: { flexDirection: 'row', gap: 6, marginTop: 4 },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderRadius: Radius.button,
    paddingVertical: 8,
    minHeight: 40,
  },
  btnText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 11 },
});

// ─── Incoming Requests Section ────────────────────────────────────────────────

interface IncomingSectionProps {
  requests: IncomingRequest[];
  loading: boolean;
  currentUserId: string;
  onAccept: (r: IncomingRequest) => void;
  onDecline: (r: IncomingRequest) => void;
  theme: ThemeType;
}

function IncomingRequestsSection({
  requests,
  loading,
  currentUserId,
  onAccept,
  onDecline,
  theme,
}: IncomingSectionProps) {
  function handleMessage(partnerId: string) {
    router.push(`/messages?partner=${partnerId}`);
  }

  return (
    <View style={sectionStyles.section}>
      <View style={sectionStyles.headerRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[sectionStyles.sectionTitle, { color: theme.textPrimary }]}>
            Incoming Requests
          </Text>
          {requests.length > 0 && (
            <View style={[sectionStyles.badge, { backgroundColor: Colors.blue }]}>
              <Text style={sectionStyles.badgeText}>{requests.length}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={sectionStyles.viewAll} activeOpacity={0.7}>
          <Text style={sectionStyles.viewAllText}>View all</Text>
          <ChevronRight size={14} color={Colors.blue} strokeWidth={1.5} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: Spacing.pagePx }}>
          <Skeleton width={264} height={200} borderRadius={Radius.card} />
        </View>
      ) : requests.length === 0 ? (
        <View style={sectionStyles.emptyRowPadded}>
          <CheckCircle2 size={15} color={theme.textMuted} strokeWidth={1.5} />
          <Text style={[sectionStyles.emptyText, { color: theme.textMuted }]}>
            No pending requests.
          </Text>
        </View>
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
              onMessage={handleMessage}
              theme={theme}
            />
          )}
        />
      )}
    </View>
  );
}

// ─── Upcoming Match Card ──────────────────────────────────────────────────────

interface UpcomingCardProps {
  match: UpcomingMatch;
  currentUserId: string;
  onMessage: (partnerId: string) => void;
  onReschedule: (match: UpcomingMatch) => void;
  onCancel: (match: UpcomingMatch) => void;
  theme: ThemeType;
}

function UpcomingMatchCard({
  match,
  currentUserId,
  onMessage,
  onReschedule,
  onCancel,
  theme,
}: UpcomingCardProps) {
  const isDoubles =
    match.matchType === 'doubles' || match.matchType === 'mixed_doubles';
  const opponent =
    match.player1.id === currentUserId ? match.player2 : match.player1;

  return (
    <View style={[
      upStyles.card,
      { backgroundColor: theme.cardBg, borderColor: theme.border },
      theme.shadowCard,
    ]}>
      {/* Green left rail — signals confirmed / upcoming */}
      <View style={[upStyles.rail, { backgroundColor: Colors.positive }]} />

      <View style={upStyles.body}>
        <View style={upStyles.topRow}>
          <View style={upStyles.leftCol}>
            {isDoubles ? (
              <>
                <View style={upStyles.matchTypeRow}>
                  <MatchTypeIcon type={match.matchType} color={theme.textMuted} size={16} />
                  <Text style={[upStyles.matchLabel, { color: theme.textPrimary }]}>
                    {matchTypeLabel(match.matchType)}
                  </Text>
                </View>
                {/* TODO(doubles): replace with real team data from match_request_participants */}
                <View style={upStyles.doublesAvatars}>
                  <PlayerAvatar player={match.player1} size={32} theme={theme} />
                  <PlayerAvatar player={match.player2} size={32} theme={theme} />
                  <Text style={[upStyles.vsText, { color: theme.textMuted }]}>vs</Text>
                  {match.player3
                    ? <PlayerAvatar player={match.player3} size={32} theme={theme} />
                    : <View style={[upStyles.emptySlot, { borderColor: theme.border }]} />}
                  {match.player4
                    ? <PlayerAvatar player={match.player4} size={32} theme={theme} />
                    : <View style={[upStyles.emptySlot, { borderColor: theme.border }]} />}
                </View>
              </>
            ) : (
              <View style={upStyles.opponentRow}>
                <PlayerAvatar player={opponent} size={40} theme={theme} />
                <View style={{ flex: 1 }}>
                  <Text style={[upStyles.opponentName, { color: theme.textPrimary }]} numberOfLines={1}>
                    {opponent.name}
                  </Text>
                  <View style={upStyles.matchTypeRow}>
                    <MatchTypeIcon type={match.matchType} color={theme.textMuted} size={13} />
                    <Text style={[upStyles.matchTypeSub, { color: theme.textSecondary }]}>
                      {matchTypeLabel(match.matchType)}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <View style={upStyles.metaRow}>
              <Calendar size={12} color={theme.textMuted} strokeWidth={1.5} />
              <Text style={[upStyles.metaText, { color: theme.textSecondary }]}>
                {formatMatchDate(match.date)} · {formatMatchTime(match.timeStart, match.timeEnd)}
              </Text>
            </View>
            <View style={upStyles.metaRow}>
              <MapPin size={12} color={theme.textMuted} strokeWidth={1.5} />
              <Text style={[upStyles.metaText, { color: theme.textSecondary }]} numberOfLines={1}>
                {match.location}
              </Text>
            </View>
          </View>

          <WeatherForCard location={match.location} date={match.date} />
        </View>

        {/* Buttons: Message · Reschedule · Cancel */}
        <View style={upStyles.btns}>
          <TouchableOpacity
            style={[upStyles.btn, { borderColor: Colors.blue }]}
            onPress={() => {
              // TODO(group-chat): open group conversation once conversations table exists
              onMessage(opponent.id);
            }}
            activeOpacity={0.8}>
            <MessageCircle size={13} color={Colors.blue} strokeWidth={1.5} />
            <Text style={[upStyles.btnText, { color: Colors.blue }]}>Message</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[upStyles.btn, { borderColor: Colors.positive }]}
            onPress={() => onReschedule(match)}
            activeOpacity={0.8}>
            <Calendar size={13} color={Colors.positive} strokeWidth={1.5} />
            <Text style={[upStyles.btnText, { color: Colors.positive }]}>Reschedule</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[upStyles.btn, { borderColor: Colors.negative }]}
            onPress={() => onCancel(match)}
            activeOpacity={0.8}>
            <XCircle size={13} color={Colors.negative} strokeWidth={1.5} />
            <Text style={[upStyles.btnText, { color: Colors.negative }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const upStyles = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
    marginBottom: Spacing.cardGap,
  },
  rail: { width: 4, flexShrink: 0 },
  body: { flex: 1, padding: 14, gap: 8 },
  topRow: { flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  leftCol: { flex: 1, gap: 6 },
  opponentRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  opponentName: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 16 },
  matchTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  matchLabel: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 15 },
  matchTypeSub: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label },
  doublesAvatars: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  vsText: {
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: 11,
    marginHorizontal: 2,
  },
  emptySlot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    flexShrink: 0,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, flex: 1 },
  btns: { flexDirection: 'row', gap: 8 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderRadius: Radius.button,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minHeight: 40,
  },
  btnText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 12 },
});

// ─── Upcoming Matches Section ─────────────────────────────────────────────────

interface UpcomingSectionProps {
  matches: UpcomingMatch[];
  loading: boolean;
  currentUserId: string;
  onReschedule: (m: UpcomingMatch) => void;
  onCancel: (m: UpcomingMatch) => void;
  theme: ThemeType;
}

function UpcomingMatchesSection({
  matches,
  loading,
  currentUserId,
  onReschedule,
  onCancel,
  theme,
}: UpcomingSectionProps) {
  function handleMessage(partnerId: string) {
    router.push(`/messages?partner=${partnerId}`);
  }

  return (
    <View style={[sectionStyles.section, upSectionStyles.padded]}>
      <View style={sectionStyles.headerRow}>
        <Text style={[sectionStyles.sectionTitle, { color: theme.textPrimary }]}>
          My Upcoming Matches
        </Text>
        <TouchableOpacity style={sectionStyles.viewAll} activeOpacity={0.7}>
          <Text style={sectionStyles.viewAllText}>View all</Text>
          <ChevronRight size={14} color={Colors.blue} strokeWidth={1.5} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ gap: 12 }}>
          <Skeleton width="100%" height={140} borderRadius={Radius.card} />
          <Skeleton width="100%" height={140} borderRadius={Radius.card} />
        </View>
      ) : matches.length === 0 ? (
        <View style={sectionStyles.emptyRow}>
          <Calendar size={15} color={theme.textMuted} strokeWidth={1.5} />
          <Text style={[sectionStyles.emptyText, { color: theme.textMuted }]}>
            No upcoming matches — request a player to start.
          </Text>
        </View>
      ) : (
        matches.map((m) => (
          <UpcomingMatchCard
            key={m.id}
            match={m}
            currentUserId={currentUserId}
            onMessage={handleMessage}
            onReschedule={onReschedule}
            onCancel={onCancel}
            theme={theme}
          />
        ))
      )}
    </View>
  );
}

const upSectionStyles = StyleSheet.create({
  padded: { paddingHorizontal: Spacing.pagePx },
});

// ─── Filter Card ──────────────────────────────────────────────────────────────

interface FilterCardProps {
  filters: MatchFilters;
  onEdit: () => void;
  theme: ThemeType;
}

function FilterCard({ filters, onEdit, theme }: FilterCardProps) {
  const items = [
    { label: 'Format', value: matchTypeLabel(filters.format) },
    { label: 'Skill Level', value: `${filters.utrMin}–${filters.utrMax}` },
    { label: 'Date', value: filters.dateLabel },
    { label: 'Time', value: filters.timeLabel },
    { label: 'Distance', value: `≤${filters.distanceMiles} mi` },
  ];

  return (
    <View style={[
      filterStyles.card,
      { backgroundColor: theme.cardBg, borderColor: theme.border },
      theme.shadowCard,
    ]}>
      <View style={filterStyles.row}>
        {items.map((item, idx) => (
          <View
            key={item.label}
            style={[
              filterStyles.item,
              idx < items.length - 1 && { borderRightWidth: 1, borderRightColor: theme.border },
            ]}>
            <Text style={[filterStyles.itemValue, { color: theme.textPrimary }]} numberOfLines={1}>
              {item.value}
            </Text>
            <Text style={[filterStyles.itemLabel, { color: theme.textMuted }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {item.label}
            </Text>
          </View>
        ))}
        <TouchableOpacity
          style={[filterStyles.editBtn, { borderLeftColor: theme.border }]}
          onPress={onEdit}
          activeOpacity={0.8}>
          <SlidersHorizontal size={12} color={Colors.blue} strokeWidth={1.5} />
          <Text style={[filterStyles.editText, { color: Colors.blue }]}>Edit Filters</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const filterStyles = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
    borderWidth: 1,
    marginHorizontal: Spacing.pagePx,
    marginTop: Spacing.sectionGap,
    marginBottom: Spacing.sectionGap,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  item: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemValue: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: 12,
    textAlign: 'center',
  },
  itemLabel: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderLeftWidth: 1,
    backgroundColor: '#EEF3FF',
    paddingHorizontal: 8,
    paddingVertical: 12,
    flexShrink: 0,
  },
  editText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 11 },
});

// ─── Player Lookup Modal ──────────────────────────────────────────────────────

interface PlayerLookupProps {
  visible: boolean;
  currentUserId: string;
  onDismiss: () => void;
  theme: ThemeType;
}

function PlayerLookupModal({
  visible,
  currentUserId,
  onDismiss,
  theme,
}: PlayerLookupProps) {
  const [query, setQuery] = useState('');
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
        id: p.id,
        name: p.full_name ?? 'Unknown',
        avatarUrl: p.avatar_url ?? null,
        utrRating: p.utr_rating ?? null,
        ntrpRating: p.ntrp_rating ?? null,
      }))
    );
    setSearching(false);
  }

  async function handleRequest(player: MatchPlayer) {
    setRequested((prev) => new Set([...prev, player.id]));
    await sendMatchRequest(currentUserId, player.id, 'singles');
  }

  function handleMessage(player: MatchPlayer) {
    onDismiss();
    router.push(`/messages?partner=${player.id}`);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={[lookupStyles.backdrop, { backgroundColor: theme.backdrop }]}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onDismiss} activeOpacity={1} />
        <View style={[lookupStyles.sheet, { backgroundColor: theme.sheetBg }, theme.shadowSheet]}>
          <View style={[lookupStyles.handle, { backgroundColor: theme.border }]} />
          <View style={lookupStyles.header}>
            <Text style={[lookupStyles.title, { color: theme.textPrimary }]}>Player Lookup</Text>
            <TouchableOpacity
              onPress={onDismiss}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={theme.textMuted} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>
          <Text style={[lookupStyles.sub, { color: theme.textSecondary }]}>
            Search players who have made themselves discoverable.
          </Text>

          <View style={[lookupStyles.searchBar, {
            backgroundColor: theme.inputBg,
            borderColor: theme.border,
          }]}>
            <Search size={16} color={theme.textMuted} strokeWidth={1.5} />
            <TextInput
              style={[lookupStyles.searchInput, { color: theme.textPrimary }]}
              value={query}
              onChangeText={search}
              placeholder="Search by name…"
              placeholderTextColor={theme.textDisabled}
              autoFocus
            />
            {searching && <ActivityIndicator size="small" color={Colors.blue} />}
          </View>

          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
            {results.map((p) => (
              <View key={p.id} style={[lookupStyles.resultRow, { borderBottomColor: theme.border }]}>
                <PlayerAvatar player={p} size={40} theme={theme} />
                <View style={{ flex: 1 }}>
                  <Text style={[lookupStyles.resultName, { color: theme.textPrimary }]}>
                    {p.name}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                    {p.utrRating != null && (
                      <Text style={lookupStyles.utr}>UTR {p.utrRating.toFixed(1)}</Text>
                    )}
                    {p.ntrpRating != null && (
                      <Text style={[lookupStyles.ntrp, { color: theme.textSecondary }]}>
                        · {p.ntrpRating.toFixed(1)} NTRP
                      </Text>
                    )}
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={[
                      lookupStyles.actionBtn,
                      { borderColor: requested.has(p.id) ? theme.border : Colors.positive },
                    ]}
                    onPress={() => handleRequest(p)}
                    disabled={requested.has(p.id)}
                    activeOpacity={0.8}>
                    <Text style={[
                      lookupStyles.actionText,
                      { color: requested.has(p.id) ? theme.textDisabled : Colors.positive },
                    ]}>
                      {requested.has(p.id) ? 'Sent' : 'Request'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[lookupStyles.actionBtn, { borderColor: Colors.blue }]}
                    onPress={() => handleMessage(p)}
                    activeOpacity={0.8}>
                    <Text style={[lookupStyles.actionText, { color: Colors.blue }]}>Message</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {query.length >= 2 && !searching && results.length === 0 && (
              <Text style={[lookupStyles.noResults, { color: theme.textMuted }]}>
                No discoverable players found for "{query}".
              </Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const lookupStyles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    height: '80%',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.pagePx,
    paddingTop: 12,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 20 },
  sub: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, marginBottom: 16 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: Radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  resultName: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.cardTitle },
  utr: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 11, color: Colors.blue },
  ntrp: { fontFamily: FontFamily.manropeMedium, fontSize: 11 },
  actionBtn: {
    borderWidth: 1.5,
    borderRadius: Radius.button,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 12 },
  noResults: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.body,
    padding: 20,
    textAlign: 'center',
  },
});

// ─── MatchScreen ──────────────────────────────────────────────────────────────

export default function MatchScreen() {
  const { theme } = useTheme();
  const [userId, setUserId] = useState('');
  const [avatarInitials, setAvatarInitials] = useState('ME');
  const { recommended, incoming, upcoming, loading, reload } = useMatchData(userId);
  const [filters] = useState<MatchFilters>(DEFAULT_FILTERS);

  // Action sheet targets
  const [acceptTarget, setAcceptTarget] = useState<IncomingRequest | null>(null);
  const [declineTarget, setDeclineTarget] = useState<IncomingRequest | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<UpcomingMatch | null>(null);
  const [cancelTarget, setCancelTarget] = useState<UpcomingMatch | null>(null);

  // Modal visibility
  const [showLookup, setShowLookup] = useState(false);

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

  // Opponent helper used in cancel/reschedule sheets
  function getOpponent(match: UpcomingMatch): MatchPlayer {
    return match.player1.id === userId ? match.player2 : match.player1;
  }

  return (
    <View style={[matchStyles.screen, { backgroundColor: theme.pageBg }]}>
      <MatchPageHeader
        avatarInitials={avatarInitials}
        onBell={() => router.push('/notifications')}
        onMenu={() => router.push('/settings')}
      />

      <ScrollView
        contentContainerStyle={matchStyles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Page title + Player Lookup button */}
        <View style={[matchStyles.hero, { backgroundColor: theme.pageBg }]}>
          <View style={matchStyles.heroLeft}>
            <Text style={[matchStyles.pageTitle, { color: theme.textPrimary }]}>Match</Text>
            <Text style={[matchStyles.pageSub, { color: theme.textSecondary }]}>
              Find the right players. Play more tennis.
            </Text>
          </View>
          <TouchableOpacity
            style={[matchStyles.lookupBtn, { borderColor: Colors.blue }]}
            onPress={() => setShowLookup(true)}
            activeOpacity={0.8}>
            <User size={14} color={Colors.blue} strokeWidth={1.5} />
            <Text style={[matchStyles.lookupBtnText, { color: Colors.blue }]}>Player Lookup</Text>
          </TouchableOpacity>
        </View>

        {/* Filter summary */}
        <FilterCard filters={filters} onEdit={() => {}} theme={theme} />

        {/* Recommended players */}
        <RecommendedPlayersSection
          players={recommended}
          loading={loading}
          currentUserId={userId}
          theme={theme}
        />

        {/* Incoming requests */}
        <IncomingRequestsSection
          requests={incoming}
          loading={loading}
          currentUserId={userId}
          onAccept={setAcceptTarget}
          onDecline={setDeclineTarget}
          theme={theme}
        />

        {/* Upcoming matches */}
        <UpcomingMatchesSection
          matches={upcoming}
          loading={loading}
          currentUserId={userId}
          onReschedule={setRescheduleTarget}
          onCancel={setCancelTarget}
          theme={theme}
        />
      </ScrollView>

      {/* Accept sheet */}
      <ActionSheet
        visible={acceptTarget != null}
        title="Accept Match"
        primaryLabel="Send & Accept"
        secondaryLabel="Accept Only"
        primaryColor={Colors.positive}
        quickReplies={[
          { label: 'Looking forward to it', text: 'Looking forward to it.' },
          { label: 'Sounds good', text: 'Sounds good — see you then.' },
          { label: 'Excited to play', text: 'Excited to play.' },
        ]}
        onPrimary={async (msg) => {
          if (!acceptTarget) return;
          await acceptRequest(acceptTarget.id, acceptTarget.challenger.id, userId, msg);
          setAcceptTarget(null);
          reload();
        }}
        onSecondary={async () => {
          if (!acceptTarget) return;
          await acceptRequest(acceptTarget.id, acceptTarget.challenger.id, userId, '');
          setAcceptTarget(null);
          reload();
        }}
        onDismiss={() => setAcceptTarget(null)}
        theme={theme}
      />

      {/* Decline sheet */}
      <ActionSheet
        visible={declineTarget != null}
        title="Decline Request"
        primaryLabel="Send & Decline"
        secondaryLabel="Decline Only"
        primaryColor={Colors.negative}
        quickReplies={[
          { label: 'Already have plans', text: "Sorry, I already have plans." },
          { label: "Friend's birthday", text: "I have a friend's birthday that day." },
          { label: "Can't make that time", text: "Can't make that time, maybe another day." },
        ]}
        onPrimary={async (msg) => {
          if (!declineTarget) return;
          await declineRequest(declineTarget.id, declineTarget.challenger.id, userId, msg);
          setDeclineTarget(null);
          reload();
        }}
        onSecondary={async () => {
          if (!declineTarget) return;
          await declineRequest(declineTarget.id, declineTarget.challenger.id, userId, '');
          setDeclineTarget(null);
          reload();
        }}
        onDismiss={() => setDeclineTarget(null)}
        theme={theme}
      />

      {/* Reschedule sheet */}
      <ActionSheet
        visible={rescheduleTarget != null}
        title="Reschedule Match"
        primaryLabel="Send Reschedule Request"
        secondaryLabel="Just Notify"
        primaryColor={Colors.positive}
        quickReplies={[
          { label: 'Suggest new time', text: "Could we reschedule? I'll suggest a new time." },
          { label: 'Work conflict', text: "Something came up at work — can we find another slot?" },
          { label: 'Weather concern', text: "Weather isn't looking great — want to reschedule?" },
        ]}
        onPrimary={async (msg) => {
          if (!rescheduleTarget) return;
          const opp = getOpponent(rescheduleTarget);
          await rescheduleMatch(rescheduleTarget.id, opp.id, userId, msg);
          setRescheduleTarget(null);
        }}
        onSecondary={async () => {
          if (!rescheduleTarget) return;
          const opp = getOpponent(rescheduleTarget);
          await rescheduleMatch(rescheduleTarget.id, opp.id, userId, '');
          setRescheduleTarget(null);
        }}
        onDismiss={() => setRescheduleTarget(null)}
        theme={theme}
      />

      {/* Cancel sheet */}
      <ActionSheet
        visible={cancelTarget != null}
        title="Cancel Match"
        primaryLabel="Send & Cancel"
        secondaryLabel="Cancel Only"
        primaryColor={Colors.negative}
        quickReplies={[
          { label: 'Something came up', text: "Sorry, something came up." },
          { label: 'Need to cancel', text: "I need to cancel today." },
          { label: 'Weather', text: "Weather isn't looking good — let's find another time." },
        ]}
        onPrimary={async (msg) => {
          if (!cancelTarget) return;
          const opp = getOpponent(cancelTarget);
          await cancelMatch(cancelTarget.id, opp.id, userId, msg);
          setCancelTarget(null);
          reload();
        }}
        onSecondary={async () => {
          if (!cancelTarget) return;
          const opp = getOpponent(cancelTarget);
          await cancelMatch(cancelTarget.id, opp.id, userId, '');
          setCancelTarget(null);
          reload();
        }}
        onDismiss={() => setCancelTarget(null)}
        theme={theme}
      />

      {/* Player Lookup modal */}
      <PlayerLookupModal
        visible={showLookup}
        currentUserId={userId}
        onDismiss={() => setShowLookup(false)}
        theme={theme}
      />
    </View>
  );
}

const matchStyles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingBottom: 120 },
  hero: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.pagePx,
    paddingTop: 20,
    paddingBottom: 20,
    marginBottom: 0,
  },
  heroLeft: { flex: 1, paddingRight: 12 },
  pageTitle: {
    fontFamily: FontFamily.spaceGroteskBold,
    fontSize: FontSize.display,
    letterSpacing: -0.5,
    lineHeight: 42,
  },
  pageSub: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.body,
    marginTop: 4,
    lineHeight: 22,
  },
  lookupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: Radius.button,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  lookupBtnText: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.label,
  },
});
