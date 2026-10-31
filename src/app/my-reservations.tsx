import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { CalendarDays, ChevronRight, Info } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { sendNotificationEmail } from '@/lib/emailNotifications';
import { platformAlert } from '@/lib/platformAlert';
import { Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing } from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ReservationStatusPill } from '@/components/ui/ReservationStatusPill';
import { useTheme } from '@/context/ThemeContext';
import { useActiveCommunity } from '@/hooks/useActiveCommunity';
import { createLatestGuard } from '@/lib/latestGuard';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { cancellationState, durationLabel, formatTime12, isUpcoming, relativeDay } from '@/lib/reservations';

interface Booking {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  courtName: string;
  courtId: string;
  minCancellationHours: number;
  cancellationReason: string | null;
  cancelledBy: string | null;
}

const DEFAULT_MIN_CANCELLATION_HOURS = 2;
const HISTORY_PAGE = 5;

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export default function MyReservationsScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const { community, loading: communityLoading } = useActiveCommunity();
  const hoaId = community?.hoaId;

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [userId, setUserId] = useState('');
  const [historyShown, setHistoryShown] = useState(HISTORY_PAGE);

  // A slow load for a previous community/account must never publish over the current one.
  const loadGuard = useRef(createLatestGuard()).current;

  const load = useCallback(async () => {
    // Wait for the active community; with none, show an empty state - never every community's reservations.
    if (communityLoading) return;
    if (!hoaId) { loadGuard.invalidate(); setBookings([]); setLoading(false); return; }
    const isStale = loadGuard.begin();
    const { data: { user } } = await supabase.auth.getUser();
    if (isStale()) return;
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    // Scoped to the active community (courts.hoa_id), newest first.
    const query = supabase
      .from('bookings')
      .select('id, date, start_time, end_time, status, cancellation_reason, cancelled_by, court_id, courts!inner(name, hoa_id)')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .eq('courts.hoa_id', hoaId)
      .order('start_time', { ascending: false });
    const { data } = await query;
    if (isStale()) return;

    const courtIds = [...new Set((data ?? []).map((b: any) => b.court_id).filter(Boolean))];
    const rulesByCourtId = new Map<string, number>();
    if (courtIds.length > 0) {
      const { data: rules } = await supabase
        .from('amenity_rules')
        .select('amenity_id, min_cancellation_hours')
        .in('amenity_id', courtIds);
      if (isStale()) return;
      for (const r of rules ?? []) {
        if (r.min_cancellation_hours != null) rulesByCourtId.set(r.amenity_id, r.min_cancellation_hours);
      }
    }

    setBookings((data ?? []).map((b: any) => ({
      id: b.id,
      date: b.date,
      start_time: b.start_time,
      end_time: b.end_time,
      status: b.status,
      courtName: b.courts?.name ?? 'Amenity',
      courtId: b.court_id,
      minCancellationHours: rulesByCourtId.get(b.court_id) ?? DEFAULT_MIN_CANCELLATION_HOURS,
      cancellationReason: b.cancellation_reason ?? null,
      cancelledBy: b.cancelled_by ?? null,
    })));
    setLoading(false);
  }, [hoaId, communityLoading]);

  useEffect(() => { setBookings([]); setLoading(true); load(); return () => { loadGuard.invalidate(); }; }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const { upcoming, history } = useMemo(() => {
    const now = new Date();
    const up = bookings
      .filter((b) => isUpcoming(b.status, b.date, b.end_time, now))
      .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));
    const upIds = new Set(up.map((b) => b.id));
    return { upcoming: up, history: bookings.filter((b) => !upIds.has(b.id)) };
  }, [bookings]);

  async function cancelBooking(booking: Booking) {
    platformAlert('Cancel Reservation', `Cancel your ${booking.courtName} reservation?`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel Reservation',
        style: 'destructive',
        onPress: async () => {
          setCancelling(booking.id);
          const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id).eq('user_id', userId);
          setCancelling(null);
          if (error) {
            // 23514 is the DB-enforced cancellation window; its message is already
            // resident-friendly. Anything else gets a generic message, never raw Postgres text.
            platformAlert(
              'Cancellation Failed',
              error.code === '23514' ? error.message : 'Could not cancel this reservation. Please try again.',
            );
            load();
            return;
          }
          sendNotificationEmail({
            type: 'booking_cancellation',
            userId,
            courtName: booking.courtName,
            date: booking.date,
            startTime: booking.start_time,
            endTime: booking.end_time,
          });
          load();
        },
      },
    ]);
  }

  function BookingCard({ b, isUpcoming: up }: { b: Booking; isUpcoming: boolean }) {
    const d = new Date(`${b.date}T00:00:00Z`);
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    const dayNum = d.getUTCDate();
    const cancel = up
      ? cancellationState({ status: b.status, date: b.date, startTime: b.start_time, minHours: b.minCancellationHours })
      : { canCancel: false } as ReturnType<typeof cancellationState>;
    const when = up ? relativeDay(b.date) : null;

    return (
      <TouchableOpacity
        testID="reservation-card"
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => router.push(`/reservation-detail/${b.id}` as any)}
        accessibilityRole="button"
        accessibilityLabel={`${b.courtName}, ${formatShortDate(b.date)}, ${b.status}. Opens reservation details`}>
        <View style={styles.cardRow}>
          <View style={[styles.dateChip, up ? styles.dateChipUpcoming : styles.dateChipPast]}>
            <Text style={[styles.dateDayName, up ? styles.dateTextUpcoming : styles.dateTextPast]}>{dayName.toUpperCase()}</Text>
            <Text style={[styles.dateDayNum, up ? styles.dateTextUpcoming : styles.dateTextPast]}>{dayNum}</Text>
          </View>

          <View style={styles.cardBody}>
            <View style={styles.cardTitleRow}>
              <Text style={[styles.cardCourt, !up && { color: theme.textMuted }]} numberOfLines={1}>{b.courtName}</Text>
              <ReservationStatusPill status={b.status} />
            </View>
            <Text style={styles.cardTime} numberOfLines={1}>
              {when ? <Text style={styles.cardWhen}>{when} · </Text> : null}
              {up ? '' : `${formatShortDate(b.date)} · `}{formatTime12(b.start_time)} – {formatTime12(b.end_time)} · {durationLabel(b.start_time, b.end_time)}
            </Text>
            {(b.status === 'cancelled' || b.status === 'rejected') && b.cancellationReason ? (
              <Text testID="cancellation-reason" style={styles.cardReason}>
                {b.status === 'rejected' ? 'Declined' : b.cancelledBy === 'admin' ? 'Cancelled by an administrator' : 'Cancelled'}: {b.cancellationReason}
              </Text>
            ) : null}
          </View>
          <ChevronRight color={theme.textMuted} size={18} strokeWidth={1.75} />
        </View>

        {up && (cancel.canCancel || cancel.reason) && (
          <View style={styles.cardFooter}>
            {cancel.canCancel ? (
              <TouchableOpacity
                testID="cancel-reservation-btn"
                style={styles.cancelBtn}
                onPress={() => cancelBooking(b)}
                disabled={cancelling === b.id}
                accessibilityRole="button">
                <Text style={styles.cancelText}>{cancelling === b.id ? 'Cancelling…' : 'Cancel reservation'}</Text>
              </TouchableOpacity>
            ) : (
              <View testID="cancel-unavailable" style={styles.cancelUnavailable} accessibilityLabel={cancel.reason}>
                <Info color={theme.textMuted} size={14} strokeWidth={1.75} />
                <Text style={styles.cancelUnavailableText} numberOfLines={1}>{cancel.short ?? cancel.reason}</Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.screen}>
      <Header variant="inner" title="My Reservations" onBack={() => router.back()} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>
          {loading ? (
            <><CardSkeleton /><CardSkeleton /><CardSkeleton /></>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Upcoming ({upcoming.length})</Text>
              {upcoming.length === 0 ? (
                <EmptyState
                  icon={<CalendarDays color={theme.textMuted} size={40} strokeWidth={1.5} />}
                  title="No upcoming reservations"
                  subtitle="Reserve an amenity to see it here."
                />
              ) : (
                upcoming.map((b) => <BookingCard key={b.id} b={b} isUpcoming />)
              )}

              {history.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { marginTop: 28 }]}>History ({history.length})</Text>
                  {history.slice(0, historyShown).map((b) => <BookingCard key={b.id} b={b} isUpcoming={false} />)}
                  {history.length > historyShown && (
                    <TouchableOpacity
                      testID="show-more-history"
                      style={styles.showMore}
                      onPress={() => setHistoryShown((n) => n + HISTORY_PAGE)}
                      accessibilityRole="button">
                      <Text style={styles.showMoreText}>Show {Math.min(HISTORY_PAGE, history.length - historyShown)} more</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen:  { flex: 1, backgroundColor: theme.pageBg },
    content: { padding: Spacing.pagePx, paddingBottom: 60 },

    cardReason: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textSecondary,
      marginTop: 8,
    },
    sectionTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.sectionTitle,
      color: theme.textPrimary,
      marginBottom: 12,
    },
    card: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
      ...theme.shadowCard,
      overflow: 'hidden',
    },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12 },
    dateChip: { width: 52, paddingVertical: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    dateChipUpcoming: { backgroundColor: Colors.courtBlue },
    dateChipPast:     { backgroundColor: theme.surface2 },
    dateDayName: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 11, letterSpacing: 1 },
    dateDayNum:  { fontFamily: FontFamily.spaceGroteskBold, fontSize: 22, lineHeight: 26 },
    dateTextUpcoming: { color: Colors.white },
    dateTextPast:     { color: theme.textMuted },
    cardBody: { flex: 1, gap: 2 },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    cardWhen: { fontFamily: FontFamily.manropeBold, color: theme.cyanOnLight },
    cardCourt: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
    },
    cardTime: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    cardFooter: {
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingHorizontal: 12,
      paddingVertical: 4,
      alignItems: 'flex-end',
    },
    cancelBtn: {
      alignSelf: 'flex-end',
      paddingHorizontal: 14,
      borderRadius: Radius.button,
      backgroundColor: 'rgba(255,92,107,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(255,92,107,0.25)',
      minHeight: 44,
      justifyContent: 'center',
    },
    cancelText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.negative,
    },
    cancelUnavailable: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32, alignSelf: 'flex-start' },
    cancelUnavailableText: {
      flex: 1,
      fontFamily: FontFamily.manropeMedium,
      fontSize: 13,
      color: theme.textMuted,
    },
    showMore: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.button,
      borderWidth: 1,
      borderColor: theme.border,
    },
    showMoreText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label, color: Colors.cyan },
  }), [theme]);
}
