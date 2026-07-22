// src/app/my-matches.tsx
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CalendarDays, CheckCircle2, MapPin, XCircle } from 'lucide-react-native';
import { Header } from '@/components/ui/Header';
import { useTheme } from '@/context/ThemeContext';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { supabase } from '@/lib/supabase';
import { useMyMatches, type MyMatchListing, type PendingItem } from '@/hooks/useMyMatches';

type Tab = 'upcoming' | 'pending' | 'past' | 'cancelled';

const TABS: Tab[] = ['upcoming', 'pending', 'past', 'cancelled'];

// Tap feedback: scale(0.97) at 140ms with a snappy ease — matches DESIGN.md's
// documented Interaction Pattern ("Tap feedback: scale(0.97) at --t-fast with
// --ease-snap") and the Animated-driven treatment established for segmented
// tab rows elsewhere in the match flow (StepLocation's HOA/Club/Directory
// tabs, StepReview's row taps). TABS is a fixed, known-length set, so it gets
// one Animated.Value per tab, matching that same pattern.
const EASE_SNAP = Easing.bezier(0.34, 1.56, 0.64, 1);
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function animatePressScale(value: Animated.Value, toValue: number) {
  Animated.timing(value, { toValue, duration: 140, easing: EASE_SNAP, useNativeDriver: true }).start();
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
function formatTime(value: string) {
  const [h, m] = value.slice(0, 5).split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export default function MyMatchesScreen() {
  const { theme } = useTheme();
  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('You');
  const [tab, setTab] = useState<Tab>('upcoming');
  const { upcoming, pending, past, cancelled, loading, approveRequest, declineRequest } = useMyMatches(userId);

  const tabScales = useRef(TABS.map(() => new Animated.Value(1))).current;

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle().then(({ data }) => {
        if (data?.full_name) setUserName(data.full_name);
      });
    });
  }, []);

  const listByTab: Record<Tab, MyMatchListing[]> = { upcoming, pending: [], past, cancelled };

  return (
    <View style={[styles.root, { backgroundColor: theme.pageBg }]}>
      <Header variant="inner" title="My Matches" />
      <View style={styles.tabRow}>
        {TABS.map((t, i) => {
          const active = tab === t;
          const scale = tabScales[i];
          const count = t === 'pending' ? pending.length : listByTab[t].length;
          return (
            <AnimatedTouchable
              key={t}
              style={[
                styles.tab,
                { borderColor: active ? Colors.blue : theme.border, backgroundColor: active ? theme.selectedBg : theme.cardBg },
                { transform: [{ scale }] },
              ]}
              onPress={() => setTab(t)}
              onPressIn={() => animatePressScale(scale, 0.97)}
              onPressOut={() => animatePressScale(scale, 1)}
              activeOpacity={0.85}>
              <Text style={[styles.tabText, { color: active ? Colors.blue : theme.textSecondary }]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}{count ? ` (${count})` : ''}
              </Text>
            </AnimatedTouchable>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.blue} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {tab === 'pending' ? (
            pending.length ? pending.map(item => (
              <PendingCard
                key={`${item.id}-${item.participantUserId}-${item.kind}`}
                item={item}
                theme={theme}
                onApprove={item.direction === 'incoming' ? () => approveRequest(item.id, item.participantUserId, userName, { format: item.format, match_date: item.matchDate, start_time: item.startTime, location: item.location }) : undefined}
                onDecline={item.direction === 'incoming' ? () => declineRequest(item.id, item.participantUserId, userName, { format: item.format, match_date: item.matchDate, start_time: item.startTime, location: item.location }) : undefined}
              />
            )) : <EmptyState theme={theme} label="No pending invitations or requests." />
          ) : listByTab[tab].length ? listByTab[tab].map(item => (
            <MatchCard key={item.id} item={item} theme={theme} />
          )) : <EmptyState theme={theme} label={`No ${tab} matches.`} />}
        </ScrollView>
      )}
    </View>
  );
}

function MatchCard({ item, theme }: { item: MyMatchListing; theme: ThemeTokens }) {
  return (
    <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.cardBg }]}>
      <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>{item.format === 'doubles' ? 'Doubles' : 'Singles'} · {formatDate(item.matchDate)}</Text>
      <View style={styles.metaRow}>
        <CalendarDays size={13} color={theme.textSecondary} strokeWidth={1.8} />
        <Text style={[styles.metaText, { color: theme.textSecondary }]}>{formatTime(item.startTime)}</Text>
      </View>
      <View style={styles.metaRow}>
        <MapPin size={13} color={theme.textSecondary} strokeWidth={1.8} />
        <Text style={[styles.metaText, { color: theme.textSecondary }]} numberOfLines={1}>{item.location}</Text>
      </View>
      <Text style={[styles.roleTag, { color: item.role === 'organizer' ? Colors.blue : Colors.positive }]}>{item.role === 'organizer' ? 'ORGANIZER' : 'GOING'}</Text>
    </View>
  );
}

function PendingCard({ item, theme, onApprove, onDecline }: { item: PendingItem; theme: ThemeTokens; onApprove?: () => void; onDecline?: () => void }) {
  return (
    <View style={[styles.card, { borderColor: Colors.blue, backgroundColor: theme.cardBg }]}>
      <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
        {item.direction === 'incoming'
          ? `${item.counterpartName} ${item.kind === 'request' ? 'requested to join' : 'was invited to'} · ${item.format === 'doubles' ? 'Doubles' : 'Singles'}`
          : `You ${item.kind === 'request' ? 'requested to join' : 'were invited to'} a ${item.format === 'doubles' ? 'doubles' : 'singles'} match`}
      </Text>
      <View style={styles.metaRow}>
        <CalendarDays size={13} color={theme.textSecondary} strokeWidth={1.8} />
        <Text style={[styles.metaText, { color: theme.textSecondary }]}>{formatDate(item.matchDate)} · {formatTime(item.startTime)}</Text>
      </View>
      {onApprove && onDecline && (
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.declineBtn} onPress={onDecline} activeOpacity={0.85}>
            <XCircle size={15} color={Colors.negative} strokeWidth={2} />
            <Text style={styles.declineBtnText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.approveBtn} onPress={onApprove} activeOpacity={0.85}>
            <CheckCircle2 size={15} color={Colors.white} strokeWidth={2} />
            <Text style={styles.approveBtnText}>Approve</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function EmptyState({ theme, label }: { theme: ThemeTokens; label: string }) {
  return <Text style={[styles.empty, { color: theme.textSecondary }]}>{label}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabRow: { flexDirection: 'row', gap: 6, paddingHorizontal: Spacing.pagePx, paddingVertical: 10 },
  tab: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: Radius.chip, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 11, textAlign: 'center' },
  content: { padding: Spacing.pagePx, gap: 10 },
  card: { borderWidth: 1.5, borderRadius: Radius.card, padding: 14, gap: 6 },
  cardTitle: { fontFamily: FontFamily.manropeBold, fontSize: FontSize.body },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label },
  roleTag: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.eyebrow, letterSpacing: 1.2, marginTop: 2 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  declineBtn: { flex: 1, flexDirection: 'row', gap: 6, minHeight: 40, borderRadius: Radius.button, borderWidth: 1, borderColor: 'rgba(255,92,107,0.40)', alignItems: 'center', justifyContent: 'center' },
  declineBtnText: { color: Colors.negative, fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label },
  approveBtn: { flex: 1, flexDirection: 'row', gap: 6, minHeight: 40, borderRadius: Radius.button, backgroundColor: Colors.positive, alignItems: 'center', justifyContent: 'center' },
  approveBtnText: { color: Colors.white, fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label },
  empty: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, textAlign: 'center', padding: 40 },
});
