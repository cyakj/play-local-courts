import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CalendarDays, Clock, Info, MapPin, ShieldCheck } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { sendNotificationEmail } from '@/lib/emailNotifications';
import { platformAlert } from '@/lib/platformAlert';
import { Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing } from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { ReservationStatusPill } from '@/components/ui/ReservationStatusPill';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { cancellationState, formatLongDate, formatTime12, kindDescription } from '@/lib/reservations';
import { reservationKind } from '@/lib/reservationState';
import { useNow } from '@/hooks/useNow';

interface Detail {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  created_at: string;
  courtName: string;
  courtType: string | null;
  communityName: string | null;
  minCancellationHours: number | null;
  requiresApproval: boolean;
  cancellationReason: string | null;
  cancelledBy: string | null;
}

export default function ReservationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    if (!id) { setNotFound(true); setLoading(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // RLS limits this to the resident's own booking (or an admin of the community).
    const { data: b } = await supabase
      .from('bookings')
      .select('id, date, start_time, end_time, status, created_at, cancellation_reason, cancelled_by, court_id, courts(name, court_type, hoa_id, hoas(name))')
      .eq('id', id)
      .maybeSingle();
    if (!b) { setNotFound(true); setLoading(false); return; }

    const { data: rule } = await supabase
      .from('amenity_rules')
      .select('min_cancellation_hours, requires_admin_approval')
      .eq('amenity_id', (b as any).court_id)
      .maybeSingle();

    const court: any = (b as any).courts;
    setDetail({
      id: b.id,
      date: b.date,
      start_time: b.start_time,
      end_time: b.end_time,
      status: b.status ?? 'confirmed',
      created_at: (b as any).created_at ?? '',
      courtName: court?.name ?? 'Amenity',
      courtType: court?.court_type ?? null,
      communityName: court?.hoas?.name ?? null,
      minCancellationHours: rule?.min_cancellation_hours ?? null,
      requiresApproval: !!rule?.requires_admin_approval,
      cancellationReason: (b as any).cancellation_reason ?? null,
      cancelledBy: (b as any).cancelled_by ?? null,
    });
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);
  // Ticking clock + periodic/focus refresh: an approval, rejection or the booking ending shows up without leaving the screen.
  const now = useNow({ onRefresh: load });

  const cancel = detail
    ? cancellationState({
        status: detail.status,
        date: detail.date,
        startTime: detail.start_time,
        minHours: detail.minCancellationHours ?? 0,
        now,
      })
    : { canCancel: false };

  function confirmCancel() {
    if (!detail) return;
    platformAlert('Cancel Reservation', `Cancel your ${detail.courtName} reservation?`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel Reservation',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          const { data: { user } } = await supabase.auth.getUser();
          const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', detail.id);
          setCancelling(false);
          if (error) {
            platformAlert(
              'Cancellation Failed',
              error.code === '23514' ? error.message : 'Could not cancel this reservation. Please try again.',
            );
            load();
            return;
          }
          if (user) {
            sendNotificationEmail({
              type: 'booking_cancellation',
              userId: user.id,
              courtName: detail.courtName,
              date: detail.date,
              startTime: detail.start_time,
              endTime: detail.end_time,
            });
          }
          load();
        },
      },
    ]);
  }

  const kind = detail ? reservationKind(detail, now) : null;
  const display = detail && kind ? { description: kindDescription(kind, detail.communityName ?? undefined) } : null;

  return (
    <View style={styles.screen}>
      <Header variant="inner" title="Reservation" onBack={() => { if (router.canGoBack()) router.back(); else router.replace('/my-reservations' as any); }} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>
          {loading ? (
            <View style={styles.center}><ActivityIndicator color={Colors.cyan} size="large" /></View>
          ) : notFound || !detail || !display ? (
            <View testID="reservation-not-found" style={styles.center}>
              <Text style={styles.title}>Reservation not found</Text>
              <Text style={styles.body}>It may have been removed, or you may not have access to it.</Text>
            </View>
          ) : (
            <>
              <View style={styles.heroCard}>
                <Text testID="reservation-court" style={styles.title} numberOfLines={2}>{detail.courtName}</Text>
                <View style={{ marginTop: 10 }}><ReservationStatusPill status={detail.status} date={detail.date} start_time={detail.start_time} end_time={detail.end_time} now={now} /></View>
                <Text testID="reservation-status-description" style={[styles.body, { marginTop: 12 }]}>
                  {display.description}
                </Text>
                {(detail.status === 'cancelled' || detail.status === 'rejected') && detail.cancellationReason ? (
                  <Text testID="cancellation-reason" style={[styles.body, { marginTop: 8, fontFamily: FontFamily.manropeSemiBold }]}>
                    {detail.status === 'rejected' ? 'Reason' : detail.cancelledBy === 'admin' ? 'Cancelled by an administrator' : 'Reason'}: {detail.cancellationReason}
                  </Text>
                ) : null}
              </View>

              <View style={styles.card}>
                <Row styles={styles} theme={theme} icon={CalendarDays} label="Date" value={formatLongDate(detail.date)} />
                <Row styles={styles} theme={theme} icon={Clock} label="Time"
                  value={`${formatTime12(detail.start_time)} – ${formatTime12(detail.end_time)}`} />
                {detail.communityName && (
                  <Row styles={styles} theme={theme} icon={MapPin} label="Community" value={detail.communityName} />
                )}
                <Row styles={styles} theme={theme} icon={ShieldCheck} label="Approval"
                  value={detail.requiresApproval ? 'Required by your community' : 'Automatic'} last />
              </View>

              {detail.minCancellationHours != null && (
                <View style={styles.policy}>
                  <Info color={theme.textMuted} size={16} strokeWidth={1.75} />
                  <Text style={styles.policyText}>
                    Cancellation policy: reservations can be cancelled up to {detail.minCancellationHours} hour
                    {detail.minCancellationHours === 1 ? '' : 's'} before the start time (community time).
                  </Text>
                </View>
              )}

              {cancel.canCancel ? (
                <TouchableOpacity testID="cancel-reservation-btn" style={styles.cancelBtn}
                  onPress={confirmCancel} disabled={cancelling} accessibilityRole="button">
                  <Text style={styles.cancelText}>{cancelling ? 'Cancelling…' : 'Cancel reservation'}</Text>
                </TouchableOpacity>
              ) : cancel.reason ? (
                <View testID="cancel-unavailable" style={styles.unavailable}>
                  <Text style={styles.unavailableTitle}>Cancellation unavailable</Text>
                  <Text style={styles.unavailableText}>{cancel.reason}</Text>
                </View>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Row({ icon: Icon, label, value, last, styles, theme }: {
  icon: typeof Info; label: string; value: string; last?: boolean;
  styles: ReturnType<typeof useStyles>; theme: ThemeTokens;
}) {
  return (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <Icon color={Colors.cyan} size={20} strokeWidth={1.6} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={[styles.rowValue, { color: theme.textPrimary }]}>{value}</Text>
      </View>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.pageBg },
    content: { padding: Spacing.pagePx, paddingBottom: 60, gap: 16 },
    center: { alignItems: 'center', paddingVertical: 56, gap: 8 },
    heroCard: {
      backgroundColor: theme.cardBg, borderRadius: Radius.card, borderWidth: 1,
      borderColor: theme.border, padding: 20,
    },
    title: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 26, color: theme.textPrimary, letterSpacing: -0.4 },
    body: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, lineHeight: 24, color: theme.textSecondary },
    card: {
      backgroundColor: theme.cardBg, borderRadius: Radius.card, borderWidth: 1,
      borderColor: theme.border, paddingHorizontal: 20,
    },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 16 },
    rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.border },
    rowLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.eyebrow,
      letterSpacing: 1.4, color: theme.textMuted, textTransform: 'uppercase', marginBottom: 2,
    },
    rowValue: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body, lineHeight: 22 },
    policy: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    policyText: { flex: 1, fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, lineHeight: 20, color: theme.textMuted },
    cancelBtn: {
      minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.button,
      backgroundColor: 'rgba(255,92,107,0.12)', borderWidth: 1, borderColor: 'rgba(255,92,107,0.35)',
    },
    cancelText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body, color: Colors.negative },
    unavailable: {
      borderRadius: Radius.card, borderWidth: 1, borderColor: theme.border,
      backgroundColor: theme.surface2, padding: 16, gap: 4,
    },
    unavailableTitle: { fontFamily: FontFamily.manropeBold, fontSize: FontSize.body, color: theme.textPrimary },
    unavailableText: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, lineHeight: 20, color: theme.textSecondary },
  }), [theme]);
}
