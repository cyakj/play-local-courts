# Match Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder match.tsx with a fully functional Match screen supporting player lookup, singles/hitting-session request/accept/decline flows, and upcoming match management.

**Architecture:** Single screen file (`match.tsx`) containing all section components as local functions, plus two extracted files: `WeatherMini.tsx` (reusable mini weather card) and a DB migration. Messages deep-link handled by adding a `?partner` param to the existing `messages.tsx`. The screen reads real data from `match_requests`, `matches`, `profiles`, and `match_preferences` via Supabase. A mock adapter provides fallback recommended players when `match_preferences` is empty.

**Tech Stack:** React Native, Expo Router, Supabase JS client, Lucide React Native, existing ThemeContext / design tokens.

---

## File Map

| File | Change |
|---|---|
| `src/app/(resident)/match.tsx` | Full rewrite — all screen sections + action sheets |
| `src/components/ui/WeatherMini.tsx` | New component — vector icon + temp + condition + wind |
| `supabase/migrations/20260604000000_extend_match_type.sql` | Extend enum with mixed_doubles + hitting_session |
| `src/app/messages.tsx` | Add partner deep-link param support (additive, ~15 lines) |

---

## Task 1: Extend match_type enum

**Files:**
- Create: `supabase/migrations/20260604000000_extend_match_type.sql`

- [ ] Create the migration file:

```sql
-- Extend match_type enum for mixed doubles and hitting sessions
ALTER TYPE match_type ADD VALUE IF NOT EXISTS 'mixed_doubles';
ALTER TYPE match_type ADD VALUE IF NOT EXISTS 'hitting_session';
```

- [ ] Apply with Supabase CLI or MCP tool. Verify enum values include all four types.

- [ ] Commit:
```
git add supabase/migrations/20260604000000_extend_match_type.sql
git commit -m "feat(db): extend match_type enum with mixed_doubles, hitting_session"
```

---

## Task 2: WeatherMini component

**Files:**
- Create: `src/components/ui/WeatherMini.tsx`

- [ ] Create the component. Use Lucide vector icons — no emoji. The `condition` string comes from `useWeather`:

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { Sun, Cloud, CloudSun, CloudRain, CloudSnow, Zap } from 'lucide-react-native';
import { Colors, FontFamily, FontSize, Radius } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';

export type WeatherCondition = 'sunny' | 'partly_cloudy' | 'cloudy' | 'rainy' | 'stormy';

interface WeatherMiniProps {
  temperature: number;
  condition: WeatherCondition;
  description: string;
  windSpeed?: number;
}

function WeatherIcon({ condition, size = 20 }: { condition: WeatherCondition; size?: number }) {
  const color = Colors.volt;  // warm yellow-volt for weather icons
  const props = { size, color, strokeWidth: 1.5 };
  switch (condition) {
    case 'sunny':        return <Sun {...props} />;
    case 'partly_cloudy':return <CloudSun {...props} />;
    case 'cloudy':       return <Cloud {...props} />;
    case 'rainy':        return <CloudRain {...props} />;
    case 'stormy':       return <Zap {...props} />;
    default:             return <Cloud {...props} />;
  }
}

export function WeatherMini({ temperature, condition, description, windSpeed }: WeatherMiniProps) {
  const { theme } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.bgElevated, borderColor: theme.border }]}>
      <WeatherIcon condition={condition} size={20} />
      <Text style={[styles.temp, { color: theme.textPrimary }]}>{temperature}°F</Text>
      <Text style={[styles.desc, { color: theme.textMuted }]}>{description}</Text>
      {windSpeed != null && (
        <Text style={[styles.wind, { color: theme.textMuted }]}>Wind {windSpeed} mph</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    gap: 2,
    minWidth: 72,
  },
  temp: {
    fontFamily: FontFamily.spaceGroteskBold,
    fontSize: 15,
  },
  desc: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.eyebrow,
    textAlign: 'center',
  },
  wind: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.eyebrow,
    textAlign: 'center',
  },
});
```

- [ ] Commit:
```
git add src/components/ui/WeatherMini.tsx
git commit -m "feat(ui): add WeatherMini component with vector icons"
```

---

## Task 3: Add partner deep-link to messages.tsx

**Files:**
- Modify: `src/app/messages.tsx` — read `?partner` search param on mount, auto-open conversation

- [ ] Add useLocalSearchParams import and deep-link logic at the top of `MessagesScreen`. Insert after existing imports and before the `useState` declarations:

In `messages.tsx`, add at the top:
```tsx
import { useLocalSearchParams } from 'expo-router';
```

Inside `MessagesScreen()`, add after existing state declarations:
```tsx
const { partner: partnerParam } = useLocalSearchParams<{ partner?: string }>();
const didDeepLink = useRef(false);
```

Inside the `useEffect` that calls `supabase.auth.getUser()`, after `load(user.id)` completes, add:
```tsx
// Deep-link: if ?partner=<id> is present, auto-open that conversation
if (partnerParam && !didDeepLink.current) {
  didDeepLink.current = true;
  const { data: pProfile } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('id', partnerParam)
    .single();
  if (pProfile) {
    const convo: Conversation = {
      partnerId: pProfile.id,
      partnerName: pProfile.full_name ?? 'Player',
      lastMessage: '',
      lastAt: new Date().toISOString(),
      unread: 0,
    };
    openConvo(convo);
  }
}
```

- [ ] Verify the existing `openConvo` function is declared before the `useEffect` (it is — it's a named async function, safe to call here).

- [ ] Commit:
```
git add src/app/messages.tsx
git commit -m "feat(messages): support ?partner=<id> deep-link to open conversation"
```

---

## Task 4: Local types and data hooks in match.tsx

**Files:**
- Create: `src/app/(resident)/match.tsx` (start with types + hooks, no UI yet)

- [ ] Write the file scaffold with all types, local extended MatchType, and data-fetching hooks. This is the foundation all later tasks build on:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  User, MessageCircle, CheckCircle2, XCircle, Calendar,
  MapPin, Clock, Users, Swords, Search, SlidersHorizontal,
  ChevronRight, X,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { Header } from '@/components/ui/Header';
import { WeatherMini, type WeatherCondition } from '@/components/ui/WeatherMini';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing,
} from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import { useWeather, getWeatherForDate } from '@/hooks/useWeather';

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
  // TODO(doubles): replace with match_request_participants rows
  // Currently only challenger + current user — real data, not faked
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
  // TODO(doubles): player3 + player4 when match_request_participants is implemented
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

const DEFAULT_FILTERS: MatchFilters = {
  format: 'singles',
  utrMin: 7.5,
  utrMax: 9.0,
  dateLabel: 'Today',
  timeLabel: '5:00 – 8:00 PM',
  distanceMiles: 10,
};

// ─── Mock adapter (swap out when match_preferences data populates) ─────────────
const MOCK_RECOMMENDED: RecommendedPlayer[] = [
  {
    id: 'mock-1', name: 'Alex Rodriguez', avatarUrl: null,
    utrRating: 8.3, ntrpRating: 4.5,
    preferredTimes: ['Evenings'], preferredCourt: 'Riverside Courts',
  },
  {
    id: 'mock-2', name: 'Ethan Lee', avatarUrl: null,
    utrRating: 8.1, ntrpRating: 4.0,
    preferredTimes: ['Weekends'], preferredCourt: 'Bayview Courts',
  },
  {
    id: 'mock-3', name: 'Marcus Kim', avatarUrl: null,
    utrRating: 7.8, ntrpRating: 3.5,
    preferredTimes: ['Mornings'], preferredCourt: 'Central Park TC',
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

    // ── Incoming requests ──────────────────────────────────────────────────
    const { data: rawRequests } = await supabase
      .from('match_requests')
      .select('id, match_type, date, time_start, time_end, location, challenger_id, status')
      .eq('opponent_id', userId)
      .eq('status', 'pending')
      .order('date', { ascending: true });

    (rawRequests ?? []).forEach((r) => profilesNeeded.add(r.challenger_id));

    // ── Upcoming matches ───────────────────────────────────────────────────
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

    // ── Recommended players ────────────────────────────────────────────────
    // Query users with looking_to_play=true excluding current user
    const { data: prefs } = await supabase
      .from('match_preferences')
      .select('user_id')
      .eq('looking_to_play', true)
      .neq('user_id', userId)
      .limit(20);

    const prefUserIds = (prefs ?? []).map((p) => p.user_id);
    prefUserIds.forEach((id) => profilesNeeded.add(id));

    // ── Fetch all profiles in one query ────────────────────────────────────
    const allIds = [...profilesNeeded];
    const { data: profiles } = allIds.length > 0
      ? await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, utr_rating, ntrp_rating, preferred_court_locations')
          .in('id', allIds)
      : { data: [] };

    const profileMap = new Map<string, (typeof profiles)[number]>();
    (profiles ?? []).forEach((p) => profileMap.set(p.id, p));

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

    // ── Build recommended list ─────────────────────────────────────────────
    if (prefUserIds.length > 0) {
      const { data: prefDetails } = await supabase
        .from('match_preferences')
        .select('user_id, preferred_times, preferred_days')
        .in('user_id', prefUserIds);
      const prefMap = new Map((prefDetails ?? []).map((p) => [p.user_id, p]));

      setRecommended(prefUserIds.map((uid) => {
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
      }));
    } else {
      // Fallback mock until real match_preferences data populates
      setRecommended(MOCK_RECOMMENDED);
    }

    // ── Build incoming requests ────────────────────────────────────────────
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

    // ── Build upcoming matches ─────────────────────────────────────────────
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

export default function MatchScreen() {
  return <View style={{ flex: 1 }} />;
}
```

- [ ] Verify the file compiles (run `npm run lint` or check for TS errors). No UI rendered yet — empty View.

- [ ] Commit:
```
git add src/app/(resident)/match.tsx
git commit -m "feat(match): scaffold types, data hooks, mock adapter"
```

---

## Task 5: PlayerAvatar helper + WeatherMini integration

**Files:**
- Modify: `src/app/(resident)/match.tsx` — add PlayerAvatar helper component + weather hook utility

- [ ] Add `PlayerAvatar` as a local component in match.tsx (above `MatchScreen`). Add `useMatchWeather` hook. Insert before the default export:

```tsx
// ─── PlayerAvatar ─────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface AvatarProps {
  player: MatchPlayer;
  size?: number;
  theme: ReturnType<typeof useTheme>['theme'];
}

function PlayerAvatar({ player, size = 48, theme }: AvatarProps) {
  return (
    <View style={[avatarStyles.wrap, {
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: theme.selectedBg,
      borderColor: theme.border,
    }]}>
      <Text style={[avatarStyles.initials, {
        fontSize: size * 0.33,
        color: Colors.blue,
        fontFamily: FontFamily.manropeSemiBold,
      }]}>
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
  },
  initials: {},
});

// ─── Match type display ───────────────────────────────────────────────────────

function matchTypeLabel(type: MatchType): string {
  switch (type) {
    case 'singles':       return 'Singles';
    case 'doubles':       return 'Doubles';
    case 'mixed_doubles': return 'Mixed Doubles';
    case 'hitting_session': return 'Hitting Session';
  }
}

function MatchTypeIcon({ type, color, size = 16 }: { type: MatchType; color: string; size?: number }) {
  const props = { size, color, strokeWidth: 1.5 };
  switch (type) {
    case 'singles':         return <User {...props} />;
    case 'hitting_session': return <Swords {...props} />;
    case 'doubles':
    case 'mixed_doubles':   return <Users {...props} />;
  }
}

// ─── Date/time formatting ─────────────────────────────────────────────────────

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
```

- [ ] Commit:
```
git add src/app/(resident)/match.tsx
git commit -m "feat(match): add PlayerAvatar, MatchTypeIcon, date/time formatters"
```

---

## Task 6: Action bottom sheets (Accept, Decline, Reschedule, Cancel)

**Files:**
- Modify: `src/app/(resident)/match.tsx` — add four action sheet components + state wiring

- [ ] Add the four action sheet components as local functions in match.tsx. Insert before the default export:

```tsx
// ─── Quick-reply chips ────────────────────────────────────────────────────────

interface QuickReply {
  label: string;
  text: string;
}

function QuickReplies({
  replies, onSelect, theme,
}: { replies: QuickReply[]; onSelect: (t: string) => void; theme: ReturnType<typeof useTheme>['theme'] }) {
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

// ─── Generic action sheet ─────────────────────────────────────────────────────

interface ActionSheetProps {
  visible: boolean;
  title: string;
  primaryLabel: string;       // e.g. "Send & Accept"
  secondaryLabel: string;     // e.g. "Accept Only"
  primaryColor: string;
  quickReplies: QuickReply[];
  onPrimary: (msg: string) => Promise<void>;
  onSecondary: () => Promise<void>;
  onDismiss: () => void;
  theme: ReturnType<typeof useTheme>['theme'];
}

function ActionSheet({
  visible, title, primaryLabel, secondaryLabel, primaryColor,
  quickReplies, onPrimary, onSecondary, onDismiss, theme,
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
        <TouchableOpacity style={{ flex: 1 }} onPress={onDismiss} />
        <View style={[sheetStyles.sheet, { backgroundColor: theme.sheetBg, ...theme.shadowSheet }]}>
          {/* Handle */}
          <View style={[sheetStyles.handle, { backgroundColor: theme.border }]} />

          {/* Header */}
          <View style={sheetStyles.header}>
            <Text style={[sheetStyles.title, { color: theme.textPrimary }]}>{title}</Text>
            <TouchableOpacity onPress={onDismiss} style={sheetStyles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={theme.textMuted} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>

          {/* Optional message */}
          <Text style={[sheetStyles.label, { color: theme.textSecondary }]}>Add a message (optional)</Text>
          <QuickReplies replies={quickReplies} onSelect={setMsg} theme={theme} />
          <TextInput
            style={[sheetStyles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.textPrimary }]}
            value={msg}
            onChangeText={setMsg}
            placeholder="Write a note…"
            placeholderTextColor={theme.textDisabled}
            multiline
            numberOfLines={3}
          />

          {/* CTAs */}
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
              <Text style={[sheetStyles.ctaSecondaryText, { color: primaryColor }]}>{secondaryLabel}</Text>
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
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 20 },
  closeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, marginBottom: 4 },
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
  ctaText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body, color: '#FFF' },
  ctaSecondary: {
    borderRadius: Radius.button,
    borderWidth: 1.5,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Spacing.tapTarget,
  },
  ctaSecondaryText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body },
});
```

- [ ] Commit:
```
git add src/app/(resident)/match.tsx
git commit -m "feat(match): add ActionSheet component with quick replies"
```

---

## Task 7: Recommended Players section

**Files:**
- Modify: `src/app/(resident)/match.tsx` — add RecommendedPlayerCard + section component

- [ ] Add `RecommendedPlayerCard` and `RecommendedPlayersSection`. Insert before the default export:

```tsx
// ─── Request to Play action ───────────────────────────────────────────────────

async function sendMatchRequest(
  currentUserId: string,
  opponentId: string,
  matchType: MatchType,
) {
  await supabase.from('match_requests').insert({
    challenger_id: currentUserId,
    opponent_id: opponentId,
    match_type: matchType as any,  // cast until types.ts regenerated
    status: 'pending',
  });
}

// ─── Recommended Player Card ──────────────────────────────────────────────────

interface RecommendedCardProps {
  player: RecommendedPlayer;
  currentUserId: string;
  onMessage: (id: string) => void;
  theme: ReturnType<typeof useTheme>['theme'];
}

function RecommendedPlayerCard({ player, currentUserId, onMessage, theme }: RecommendedCardProps) {
  const [requested, setRequested] = useState(false);

  async function handleRequest() {
    setRequested(true);
    await sendMatchRequest(currentUserId, player.id, 'singles');
  }

  return (
    <View style={[recStyles.card, { backgroundColor: theme.cardBg, borderColor: theme.border, ...theme.shadowCard }]}>
      <View style={recStyles.top}>
        <PlayerAvatar player={player} size={52} theme={theme} />
        <View style={recStyles.info}>
          <Text style={[recStyles.name, { color: theme.textPrimary }]} numberOfLines={1}>
            {player.name}
          </Text>
          <View style={recStyles.ratings}>
            {player.utrRating != null && (
              <Text style={recStyles.utr}>UTR {player.utrRating.toFixed(1)}</Text>
            )}
            {player.ntrpRating != null && (
              <Text style={[recStyles.ntrp, { color: theme.textSecondary }]}>• {player.ntrpRating.toFixed(1)} NTRP</Text>
            )}
          </View>
        </View>
      </View>

      {player.preferredTimes.length > 0 && (
        <View style={recStyles.metaRow}>
          <Clock size={13} color={theme.textMuted} strokeWidth={1.5} />
          <Text style={[recStyles.metaText, { color: theme.textSecondary }]}>
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
          style={[recStyles.btn, { borderColor: Colors.positive }]}
          onPress={handleRequest}
          disabled={requested}
          activeOpacity={0.8}>
          <Swords size={14} color={requested ? theme.textDisabled : Colors.positive} strokeWidth={1.5} />
          <Text style={[recStyles.btnText, { color: requested ? theme.textDisabled : Colors.positive }]}>
            {requested ? 'Requested' : 'Request to Play'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[recStyles.btn, { borderColor: Colors.blue }]}
          onPress={() => onMessage(player.id)}
          activeOpacity={0.8}>
          <MessageCircle size={14} color={Colors.blue} strokeWidth={1.5} />
          <Text style={[recStyles.btnText, { color: Colors.blue }]}>Message</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const recStyles = StyleSheet.create({
  card: {
    width: 230,
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: 16,
    gap: 8,
    marginRight: 12,
  },
  top: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  info: { flex: 1 },
  name: { fontFamily: FontFamily.spaceGroteskBold, fontSize: FontSize.cardTitle },
  ratings: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, flexWrap: 'wrap' },
  utr: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 12, color: Colors.blue },
  ntrp: { fontFamily: FontFamily.manropeMedium, fontSize: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, flex: 1 },
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
  theme: ReturnType<typeof useTheme>['theme'];
}

function RecommendedPlayersSection({ players, loading, currentUserId, theme }: RecSectionProps) {
  function handleMessage(partnerId: string) {
    router.push(`/messages?partner=${partnerId}`);
  }

  return (
    <View style={sectionStyles.section}>
      <View style={sectionStyles.headerRow}>
        <Text style={[sectionStyles.sectionTitle, { color: theme.textPrimary }]}>Recommended Players</Text>
        <TouchableOpacity style={sectionStyles.viewAll} activeOpacity={0.7}>
          <Text style={sectionStyles.viewAllText}>View all</Text>
          <ChevronRight size={14} color={Colors.blue} strokeWidth={1.5} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: Spacing.pagePx, gap: 12 }}>
          <Skeleton width={230} height={160} borderRadius={Radius.card} />
        </View>
      ) : players.length === 0 ? (
        <View style={{ paddingHorizontal: Spacing.pagePx }}>
          <Text style={[sectionStyles.emptyText, { color: theme.textMuted }]}>
            No matching players yet.{'\n'}Try widening your filters or use Player Lookup.
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
```

- [ ] Commit:
```
git add src/app/(resident)/match.tsx
git commit -m "feat(match): add RecommendedPlayers section with request/message actions"
```

---

## Task 8: Incoming Requests section

**Files:**
- Modify: `src/app/(resident)/match.tsx` — add IncomingRequestCard + section + wired accept/decline/message actions

- [ ] Add weather hook helper and IncomingRequestCard. Insert before default export:

```tsx
// ─── Weather lookup by location ───────────────────────────────────────────────
// Each card fetches weather for its own location. useWeather is a hook so it
// must be called at the component level, not in a map loop.

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

// ─── Incoming Request Card ────────────────────────────────────────────────────

interface IncomingCardProps {
  request: IncomingRequest;
  currentUserId: string;
  onAccept: (request: IncomingRequest) => void;
  onDecline: (request: IncomingRequest) => void;
  onMessage: (partnerId: string) => void;
  theme: ReturnType<typeof useTheme>['theme'];
}

function IncomingRequestCard({
  request, currentUserId, onAccept, onDecline, onMessage, theme,
}: IncomingCardProps) {
  const isDoubles = request.matchType === 'doubles' || request.matchType === 'mixed_doubles';

  return (
    <View style={[
      incStyles.card,
      { backgroundColor: theme.cardBg, borderColor: theme.border, ...theme.shadowCard },
    ]}>
      {/* Blue left rail */}
      <View style={[incStyles.rail, { backgroundColor: Colors.blue }]} />

      <View style={incStyles.body}>
        {/* Header row: match type icon + weather */}
        <View style={incStyles.topRow}>
          <View style={incStyles.matchTypeRow}>
            <MatchTypeIcon type={request.matchType} color={theme.textMuted} size={15} />
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
            <Calendar size={13} color={theme.textMuted} strokeWidth={1.5} />
            <Text style={[incStyles.metaText, { color: theme.textSecondary }]}>
              {formatMatchDate(request.date)} · {formatMatchTime(request.timeStart, request.timeEnd)}
            </Text>
          </View>
        )}
        {request.location && (
          <View style={incStyles.metaRow}>
            <MapPin size={13} color={theme.textMuted} strokeWidth={1.5} />
            <Text style={[incStyles.metaText, { color: theme.textSecondary }]} numberOfLines={1}>
              {request.location}
            </Text>
          </View>
        )}

        {/* Doubles participant slots */}
        {isDoubles && (
          <View style={incStyles.doublesRow}>
            {/* Slot 1: challenger */}
            <PlayerAvatar player={request.challenger} size={32} theme={theme} />
            {/* Slot 2: current user (you) */}
            <View style={[incStyles.youSlot, { borderColor: Colors.blue, backgroundColor: theme.selectedBg }]}>
              <Text style={{ fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 9, color: Colors.blue }}>YOU</Text>
            </View>
            {/* Slots 3–4: placeholder — TODO(doubles): replace with match_request_participants */}
            <View style={[incStyles.emptySlot, { borderColor: theme.border }]} />
            <View style={[incStyles.emptySlot, { borderColor: theme.border }]} />
            <Text style={[incStyles.doublesLabel, { color: theme.textMuted }]}>2 OF 4 CONFIRMED</Text>
          </View>
        )}

        {/* Action buttons */}
        <View style={incStyles.btns}>
          <TouchableOpacity
            style={[incStyles.btn, { borderColor: Colors.positive }]}
            onPress={() => onAccept(request)}
            activeOpacity={0.8}>
            <CheckCircle2 size={14} color={Colors.positive} strokeWidth={1.5} />
            <Text style={[incStyles.btnText, { color: Colors.positive }]}>Accept</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[incStyles.btn, { borderColor: Colors.blue }]}
            onPress={() => {
              // TODO(group-chat): open group conversation when conversations table exists
              onMessage(request.challenger.id);
            }}
            activeOpacity={0.8}>
            <MessageCircle size={14} color={Colors.blue} strokeWidth={1.5} />
            <Text style={[incStyles.btnText, { color: Colors.blue }]}>Message</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[incStyles.btn, { borderColor: Colors.negative }]}
            onPress={() => onDecline(request)}
            activeOpacity={0.8}>
            <XCircle size={14} color={Colors.negative} strokeWidth={1.5} />
            <Text style={[incStyles.btnText, { color: Colors.negative }]}>Decline</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const incStyles = StyleSheet.create({
  card: {
    width: 264,
    borderRadius: Radius.card,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
    marginRight: 12,
  },
  rail: { width: 4, flexShrink: 0 },
  body: { flex: 1, padding: 14, gap: 8 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  matchTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  matchTypeLabel: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label },
  challengerRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  challengerName: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 15 },
  ratingsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  utr: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 11, color: Colors.blue },
  ntrp: { fontFamily: FontFamily.manropeMedium, fontSize: 11 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, flex: 1 },
  doublesRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 },
  youSlot: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1.5, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  emptySlot: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1.5, borderStyle: 'dashed',
  },
  doublesLabel: {
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
  theme: ReturnType<typeof useTheme>['theme'];
}

function IncomingRequestsSection({
  requests, loading, currentUserId, onAccept, onDecline, theme,
}: IncomingSectionProps) {
  function handleMessage(partnerId: string) {
    router.push(`/messages?partner=${partnerId}`);
  }

  return (
    <View style={sectionStyles.section}>
      <View style={sectionStyles.headerRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[sectionStyles.sectionTitle, { color: theme.textPrimary }]}>Incoming Requests</Text>
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
        <View style={{ paddingHorizontal: Spacing.pagePx }}>
          <Text style={[sectionStyles.emptyText, { color: theme.textMuted }]}>No incoming requests.</Text>
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
```

- [ ] Commit:
```
git add src/app/(resident)/match.tsx
git commit -m "feat(match): add IncomingRequests section with accept/decline/message"
```

---

## Task 9: Upcoming Matches section

**Files:**
- Modify: `src/app/(resident)/match.tsx` — add UpcomingMatchCard + section + reschedule/cancel actions

- [ ] Add `UpcomingMatchCard` and `UpcomingMatchesSection`. Insert before default export:

```tsx
// ─── Upcoming Match Card ──────────────────────────────────────────────────────

interface UpcomingCardProps {
  match: UpcomingMatch;
  currentUserId: string;
  onMessage: (partnerId: string) => void;
  onReschedule: (match: UpcomingMatch) => void;
  onCancel: (match: UpcomingMatch) => void;
  theme: ReturnType<typeof useTheme>['theme'];
}

function UpcomingMatchCard({
  match, currentUserId, onMessage, onReschedule, onCancel, theme,
}: UpcomingCardProps) {
  const isDoubles = match.matchType === 'doubles' || match.matchType === 'mixed_doubles';
  const opponent = match.player1.id === currentUserId ? match.player2 : match.player1;

  return (
    <View style={[
      upStyles.card,
      { backgroundColor: theme.cardBg, borderColor: theme.border, ...theme.shadowCard },
    ]}>
      {/* Green left rail */}
      <View style={[upStyles.rail, { backgroundColor: Colors.positive }]} />

      <View style={upStyles.body}>
        <View style={upStyles.topRow}>
          {/* Left: opponent / match info */}
          <View style={upStyles.leftCol}>
            {isDoubles ? (
              <>
                <View style={upStyles.matchTypeRow}>
                  <MatchTypeIcon type={match.matchType} color={theme.textMuted} size={16} />
                  <Text style={[upStyles.matchLabel, { color: theme.textPrimary }]}>
                    {matchTypeLabel(match.matchType)}
                  </Text>
                </View>
                {/* Doubles avatar row — TODO(doubles): use real team data from match_request_participants */}
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
              <>
                <View style={upStyles.opponentRow}>
                  <PlayerAvatar player={opponent} size={40} theme={theme} />
                  <View>
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
              </>
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

          {/* Right: weather */}
          <WeatherForCard location={match.location} date={match.date} />
        </View>

        {/* Action buttons */}
        <View style={upStyles.btns}>
          <TouchableOpacity
            style={[upStyles.btn, { borderColor: Colors.blue }]}
            onPress={() => {
              // TODO(group-chat): open group conversation when conversations table exists
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
  vsText: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 11, marginHorizontal: 2 },
  emptySlot: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1.5, borderStyle: 'dashed',
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
  theme: ReturnType<typeof useTheme>['theme'];
}

function UpcomingMatchesSection({
  matches, loading, currentUserId, onReschedule, onCancel, theme,
}: UpcomingSectionProps) {
  function handleMessage(partnerId: string) {
    router.push(`/messages?partner=${partnerId}`);
  }

  return (
    <View style={[sectionStyles.section, { paddingHorizontal: Spacing.pagePx }]}>
      <View style={sectionStyles.headerRow}>
        <Text style={[sectionStyles.sectionTitle, { color: theme.textPrimary }]}>My Upcoming Matches</Text>
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
        <Text style={[sectionStyles.emptyText, { color: theme.textMuted }]}>
          No upcoming matches yet.{'\n'}Request a player or reserve a court.
        </Text>
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
```

- [ ] Commit:
```
git add src/app/(resident)/match.tsx
git commit -m "feat(match): add UpcomingMatches section with reschedule/cancel/message"
```

---

## Task 10: Filter card + Player Lookup modal

**Files:**
- Modify: `src/app/(resident)/match.tsx` — add FilterCard component and PlayerLookupModal

- [ ] Add filter card and player lookup modal. Insert before default export:

```tsx
// ─── Shared section styles ────────────────────────────────────────────────────
// (Referenced by Task 7, 8, 9 — define ONCE here, reference above in the file)

const sectionStyles = StyleSheet.create({
  section: { marginBottom: Spacing.sectionGap },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.pagePx,
    marginBottom: 12,
  },
  sectionTitle: { fontFamily: FontFamily.spaceGroteskBold, fontSize: FontSize.sectionTitle },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label, color: Colors.blue },
  badge: {
    minWidth: 22, height: 22, borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: {
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: 11,
    color: '#FFF',
  },
  emptyText: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.body,
    lineHeight: 22,
  },
});

// ─── Filter Card ──────────────────────────────────────────────────────────────

interface FilterCardProps {
  filters: MatchFilters;
  onEdit: () => void;
  theme: ReturnType<typeof useTheme>['theme'];
}

function FilterCard({ filters, onEdit, theme }: FilterCardProps) {
  const items = [
    { label: 'Format', value: matchTypeLabel(filters.format) },
    { label: 'Skill Level', value: `UTR ${filters.utrMin} – ${filters.utrMax}` },
    { label: 'Date', value: filters.dateLabel },
    { label: 'Time', value: filters.timeLabel },
    { label: 'Distance', value: `Within ${filters.distanceMiles} Miles` },
  ];

  return (
    <View style={[filterStyles.card, { backgroundColor: theme.cardBg, borderColor: theme.border, ...theme.shadowCard }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={filterStyles.scroll}>
        {items.map((item) => (
          <View key={item.label} style={[filterStyles.item, { borderRightColor: theme.border }]}>
            <Text style={[filterStyles.itemValue, { color: theme.textPrimary }]}>{item.value}</Text>
            <Text style={[filterStyles.itemLabel, { color: theme.textMuted }]}>{item.label}</Text>
          </View>
        ))}
        <TouchableOpacity
          style={[filterStyles.editBtn, { borderColor: Colors.blue }]}
          onPress={onEdit}
          activeOpacity={0.8}>
          <SlidersHorizontal size={13} color={Colors.blue} strokeWidth={1.5} />
          <Text style={[filterStyles.editText, { color: Colors.blue }]}>Edit Filters</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const filterStyles = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
    borderWidth: 1,
    marginHorizontal: Spacing.pagePx,
    marginBottom: Spacing.sectionGap,
    overflow: 'hidden',
  },
  scroll: { paddingHorizontal: 4, paddingVertical: 4, alignItems: 'center', gap: 0 },
  item: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRightWidth: 1,
    alignItems: 'center',
    minWidth: 72,
  },
  itemValue: { fontFamily: FontFamily.manropeSemiBold, fontSize: 13, textAlign: 'center' },
  itemLabel: { fontFamily: FontFamily.manropeMedium, fontSize: 11, textAlign: 'center', marginTop: 2 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderRadius: Radius.button,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 8,
  },
  editText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 13 },
});

// ─── Player Lookup Modal ──────────────────────────────────────────────────────

interface PlayerLookupProps {
  visible: boolean;
  currentUserId: string;
  onDismiss: () => void;
  theme: ReturnType<typeof useTheme>['theme'];
}

function PlayerLookupModal({ visible, currentUserId, onDismiss, theme }: PlayerLookupProps) {
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
        <TouchableOpacity style={{ flex: 1 }} onPress={onDismiss} />
        <View style={[lookupStyles.sheet, { backgroundColor: theme.sheetBg, ...theme.shadowSheet }]}>
          <View style={[lookupStyles.handle, { backgroundColor: theme.border }]} />
          <View style={lookupStyles.header}>
            <Text style={[lookupStyles.title, { color: theme.textPrimary }]}>Player Lookup</Text>
            <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={theme.textMuted} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>
          <Text style={[lookupStyles.sub, { color: theme.textSecondary }]}>
            Search players who have made themselves discoverable.
          </Text>

          <View style={[lookupStyles.searchBar, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
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
                  <Text style={[lookupStyles.resultName, { color: theme.textPrimary }]}>{p.name}</Text>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {p.utrRating != null && (
                      <Text style={{ fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 11, color: Colors.blue }}>
                        UTR {p.utrRating.toFixed(1)}
                      </Text>
                    )}
                    {p.ntrpRating != null && (
                      <Text style={{ fontFamily: FontFamily.manropeMedium, fontSize: 11, color: theme.textSecondary }}>
                        · {p.ntrpRating.toFixed(1)} NTRP
                      </Text>
                    )}
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={[lookupStyles.actionBtn, { borderColor: Colors.positive }]}
                    onPress={() => handleRequest(p)}
                    disabled={requested.has(p.id)}
                    activeOpacity={0.8}>
                    <Text style={{ fontFamily: FontFamily.manropeSemiBold, fontSize: 12, color: requested.has(p.id) ? theme.textDisabled : Colors.positive }}>
                      {requested.has(p.id) ? 'Sent' : 'Request'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[lookupStyles.actionBtn, { borderColor: Colors.blue }]}
                    onPress={() => handleMessage(p)}
                    activeOpacity={0.8}>
                    <Text style={{ fontFamily: FontFamily.manropeSemiBold, fontSize: 12, color: Colors.blue }}>Message</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {query.length >= 2 && !searching && results.length === 0 && (
              <Text style={{ fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, color: theme.textMuted, padding: 20, textAlign: 'center' }}>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
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
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  resultName: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.cardTitle },
  actionBtn: {
    borderWidth: 1.5,
    borderRadius: Radius.button,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

- [ ] Commit:
```
git add src/app/(resident)/match.tsx
git commit -m "feat(match): add FilterCard and PlayerLookup modal"
```

---

## Task 11: Wire everything into MatchScreen default export

**Files:**
- Modify: `src/app/(resident)/match.tsx` — replace placeholder `export default function MatchScreen`

- [ ] Replace the placeholder `MatchScreen` with the full wired implementation:

```tsx
// ─── Supabase action helpers ──────────────────────────────────────────────────

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
      content: `✓ Match accepted — ${message}`,
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

async function cancelMatch(
  matchId: string,
  opponentId: string,
  currentUserId: string,
  message: string,
) {
  // matches table has no status column — update via match_request if linked, or just notify via message
  // TODO: add a status column to matches table in a follow-up migration
  if (message) {
    await supabase.from('messages').insert({
      sender_id: currentUserId,
      receiver_id: opponentId,
      content: `Match cancelled — ${message}`,
    });
  }
}

async function rescheduleMatch(
  matchId: string,
  opponentId: string,
  currentUserId: string,
  message: string,
) {
  // TODO: add reschedule_requests table or update match date in a follow-up flow
  if (message) {
    await supabase.from('messages').insert({
      sender_id: currentUserId,
      receiver_id: opponentId,
      content: `Reschedule request — ${message}`,
    });
  }
}

// ─── MatchScreen ──────────────────────────────────────────────────────────────

export default function MatchScreen() {
  const { theme } = useTheme();
  const [userId, setUserId] = useState('');
  const { recommended, incoming, upcoming, loading, reload } = useMatchData(userId);

  const [filters, setFilters] = useState<MatchFilters>(DEFAULT_FILTERS);

  // Action sheet state
  const [acceptTarget, setAcceptTarget] = useState<IncomingRequest | null>(null);
  const [declineTarget, setDeclineTarget] = useState<IncomingRequest | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<UpcomingMatch | null>(null);
  const [cancelTarget, setCancelTarget] = useState<UpcomingMatch | null>(null);

  // Modal state
  const [showLookup, setShowLookup] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  return (
    <View style={[matchStyles.screen, { backgroundColor: theme.pageBg }]}>
      <Header variant="resident" />

      <ScrollView
        contentContainerStyle={matchStyles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Page title + Player Lookup */}
        <View style={[matchStyles.hero, { backgroundColor: theme.heroBg }]}>
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
            <User size={15} color={Colors.blue} strokeWidth={1.5} />
            <Text style={[matchStyles.lookupBtnText, { color: Colors.blue }]}>Player Lookup</Text>
          </TouchableOpacity>
        </View>

        {/* Filter summary */}
        <FilterCard filters={filters} onEdit={() => setShowFilters(true)} theme={theme} />

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
          { label: 'Propose new time', text: "Could we reschedule? I'll suggest a new time." },
          { label: 'Work conflict', text: "Something came up at work — can we find another slot?" },
          { label: 'Weather concern', text: "Weather isn't looking great — want to reschedule?" },
        ]}
        onPrimary={async (msg) => {
          if (!rescheduleTarget) return;
          const opponent = rescheduleTarget.player1.id === userId
            ? rescheduleTarget.player2
            : rescheduleTarget.player1;
          await rescheduleMatch(rescheduleTarget.id, opponent.id, userId, msg);
          setRescheduleTarget(null);
          reload();
        }}
        onSecondary={async () => {
          if (!rescheduleTarget) return;
          const opponent = rescheduleTarget.player1.id === userId
            ? rescheduleTarget.player2
            : rescheduleTarget.player1;
          await rescheduleMatch(rescheduleTarget.id, opponent.id, userId, '');
          setRescheduleTarget(null);
          reload();
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
          const opponent = cancelTarget.player1.id === userId
            ? cancelTarget.player2
            : cancelTarget.player1;
          await cancelMatch(cancelTarget.id, opponent.id, userId, msg);
          setCancelTarget(null);
          reload();
        }}
        onSecondary={async () => {
          if (!cancelTarget) return;
          const opponent = cancelTarget.player1.id === userId
            ? cancelTarget.player2
            : cancelTarget.player1;
          await cancelMatch(cancelTarget.id, opponent.id, userId, '');
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
    paddingTop: 24,
    paddingBottom: 24,
    marginBottom: Spacing.sectionGap,
  },
  heroLeft: { flex: 1, paddingRight: 12 },
  pageTitle: {
    fontFamily: FontFamily.spaceGroteskBold,
    fontSize: FontSize.display,
    letterSpacing: -0.5,
    lineHeight: 40,
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
  lookupBtnText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label },
});
```

- [ ] Run `npm run lint` or check TypeScript. Fix any type errors (mainly `as any` casts for match_type).

- [ ] Commit:
```
git add src/app/(resident)/match.tsx
git commit -m "feat(match): wire full MatchScreen with all sections and action sheets"
```

---

## Task 12: Final verification

- [ ] Start the dev server: `npm run dev`

- [ ] Navigate to the Match tab. Verify:
  - Header renders (logo + bell + menu)
  - "Match" title + subtitle visible
  - "Player Lookup" button visible, opens modal
  - Filter card visible with 5 filter chips + Edit Filters button
  - Recommended Players section shows (mock data or real data if match_preferences populated)
  - Incoming Requests section shows (empty state if no pending requests)
  - Upcoming Matches section shows (empty state if no upcoming matches)
  - Mock recommended player cards: avatar, name, UTR, NTRP, time, court, two buttons

- [ ] Test Accept flow:
  - Tap Accept on an incoming request (requires test data in match_requests with opponent_id = current user)
  - Accept sheet rises, quick replies visible
  - Tap "Send & Accept" — sheet dismisses, request disappears from list

- [ ] Test Decline flow:
  - Tap Decline — sheet rises with red CTA
  - Tap "Decline Only" — sheet dismisses

- [ ] Test Player Lookup:
  - Tap Player Lookup button
  - Type at least 2 characters
  - Results appear (players with location_visible=true)
  - Request button sends to Supabase

- [ ] Test Message button:
  - Tap Message on any card
  - Navigates to `/messages?partner=<id>`
  - Correct conversation opens (if deep-link wired in Task 3)

- [ ] Commit:
```
git add -A
git commit -m "feat(match): complete Match screen — singles/hitting-session fully functional"
```

---

## Follow-up items (NOT this build)

These are explicitly out of scope and have TODO comments in the code:

1. **`match_request_participants` table** — Track all 4 players in a doubles request. Required for "3 OF 4 CONFIRMED" display and proper doubles invite flow. Migration proposed in spec doc.

2. **Group conversations** — `conversations`, `conversation_participants`, `conversation_messages` tables. Required for doubles/mixed doubles group messaging. Migration proposed in spec doc.

3. **Filter persistence + apply** — Filter sheet writes to Supabase `match_preferences` table. Filter changes reload recommended players.

4. **Match status column** — `matches` table needs a `status` column to support proper cancel flow (currently only sends a message).

5. **Reschedule proposal flow** — Full date/time picker for rescheduling. Currently sends a message only.
