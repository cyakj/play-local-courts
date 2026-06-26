import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { CalendarDays } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing } from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusPill } from '@/components/ui/StatusPill';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

interface Booking {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  courtName: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(t: string): string {
  const [h] = t.split(':');
  const hour = parseInt(h, 10);
  const suffix = hour < 12 ? 'AM' : 'PM';
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${display}:00 ${suffix}`;
}

function bookingStatus(status: string): 'optimal' | 'needs-attention' | 'critical' | 'pending' {
  if (status === 'confirmed') return 'optimal';
  if (status === 'cancelled') return 'critical';
  if (status === 'pending') return 'pending';
  return 'needs-attention';
}

export default function MyReservationsScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const [upcoming, setUpcoming] = useState<Booking[]>([]);
  const [past, setPast] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const today = new Date().toISOString().split('T')[0];

    const { data } = await supabase
      .from('bookings')
      .select('id, date, start_time, end_time, status, courts(name)')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .order('start_time', { ascending: false });

    const all = (data ?? []).map((b: any) => ({
      id: b.id,
      date: b.date,
      start_time: b.start_time,
      end_time: b.end_time,
      status: b.status,
      courtName: b.courts?.name ?? 'Court',
    }));

    setUpcoming(all.filter((b) => b.date >= today && b.status !== 'cancelled').reverse());
    setPast(all.filter((b) => b.date < today || b.status === 'cancelled'));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function cancelBooking(id: string) {
    Alert.alert('Cancel Booking', 'Are you sure you want to cancel this booking?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          setCancelling(id);
          const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
          setCancelling(null);
          if (error) {
            Alert.alert('Cancellation failed', 'Could not cancel this booking. Please try again.');
            return;
          }
          load();
        },
      },
    ]);
  }

  function BookingCard({ b, isUpcoming }: { b: Booking; isUpcoming: boolean }) {
    const d = new Date(b.date + 'T00:00:00');
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = d.getDate();
    return (
      <View style={styles.card}>
        <View style={[styles.dateSidebar, isUpcoming ? styles.dateSidebarUpcoming : styles.dateSidebarPast]}>
          <Text style={[styles.dateDayName, isUpcoming ? styles.dateTextUpcoming : styles.dateTextPast]}>
            {dayName}
          </Text>
          <Text style={[styles.dateDayNum, isUpcoming ? styles.dateTextUpcoming : styles.dateTextPast]}>
            {dayNum}
          </Text>
        </View>

        <View style={styles.cardBody}>
          <Text
            style={[styles.cardCourt, !isUpcoming && { color: theme.textMuted }]}
            numberOfLines={1}>
            {b.courtName}
          </Text>
          <Text style={styles.cardTime}>
            {formatDate(b.date)} · {formatTime(b.start_time)} – {formatTime(b.end_time)}
          </Text>
          <StatusPill status={bookingStatus(b.status)} label={b.status} />
        </View>

        {isUpcoming && (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => cancelBooking(b.id)}
            disabled={cancelling === b.id}>
            <Text style={styles.cancelText}>
              {cancelling === b.id ? '…' : 'Cancel'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
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
                  subtitle="Book a court to see it here."
                />
              ) : (
                upcoming.map((b) => <BookingCard key={b.id} b={b} isUpcoming />)
              )}

              {past.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Past Reservations</Text>
                  {past.slice(0, 5).map((b) => <BookingCard key={b.id} b={b} isUpcoming={false} />)}
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
      flexDirection: 'row',
      overflow: 'hidden',
      alignItems: 'center',
    },
    dateSidebar: {
      width: 64,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    dateSidebarUpcoming: { backgroundColor: Colors.courtBlue },
    dateSidebarPast:     { backgroundColor: theme.surface2 },
    dateDayName: { fontFamily: FontFamily.manropeBold, fontSize: 13 },
    dateDayNum:  { fontFamily: FontFamily.manropeBlack, fontSize: 22, lineHeight: 26 },
    dateTextUpcoming: { color: Colors.white },
    dateTextPast:     { color: theme.textMuted },
    cardBody: { flex: 1, padding: 14, gap: 3 },
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
    cancelBtn: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginRight: 4,
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
  }), [theme]);
}
