import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, CalendarDays } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Shadow, Spacing,
} from '@/constants/design';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusPill } from '@/components/ui/StatusPill';

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

export default function MyReservationsScreen() {
  const insets = useSafeAreaInsets();
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
          await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
          setCancelling(null);
          load();
        },
      },
    ]);
  }

  function bookingStatus(status: string): 'optimal' | 'needs-attention' | 'critical' | 'pending' {
    if (status === 'confirmed') return 'optimal';
    if (status === 'cancelled') return 'critical';
    if (status === 'pending') return 'pending';
    return 'needs-attention';
  }

  function BookingCard({ b, isUpcoming }: { b: Booking; isUpcoming: boolean }) {
    const d = new Date(b.date + 'T00:00:00');
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = d.getDate();
    return (
      <View style={styles.card}>
        {/* Colored date sidebar */}
        <View style={[styles.dateSidebar, isUpcoming ? styles.dateSidebarUpcoming : styles.dateSidebarPast]}>
          <Text style={[styles.dateDayName, isUpcoming ? styles.dateTextUpcoming : styles.dateTextPast]}>
            {dayName}
          </Text>
          <Text style={[styles.dateDayNum, isUpcoming ? styles.dateTextUpcoming : styles.dateTextPast]}>
            {dayNum}
          </Text>
        </View>

        {/* Content */}
        <View style={styles.cardBody}>
          <Text style={[styles.cardCourt, !isUpcoming && { color: Colors.textMuted }]} numberOfLines={1}>
            {b.courtName}
          </Text>
          <Text style={styles.cardTime}>
            {formatDate(b.date)} · {formatTime(b.start_time)} – {formatTime(b.end_time)}
          </Text>
          <StatusPill status={bookingStatus(b.status)} label={b.status} />
        </View>

        {/* Cancel — upcoming only */}
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
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={Colors.white} size={22} strokeWidth={1.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Reservations</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>
          {loading ? (
            <><CardSkeleton /><CardSkeleton /><CardSkeleton /></>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Upcoming ({upcoming.length})</Text>
              {upcoming.length === 0 ? (
                <EmptyState
                  icon={<CalendarDays color={Colors.textMuted} size={40} strokeWidth={1.5} />}
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },
  header: {
    backgroundColor: Colors.headerBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.pagePx,
    paddingBottom: 20,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 18, color: Colors.white },
  content: { padding: Spacing.pagePx, paddingBottom: 60 },
  sectionTitle: {
    fontFamily: FontFamily.spaceGroteskBold,
    fontSize: FontSize.sectionTitle,
    color: Colors.white,
    marginBottom: 12,
  },
  card: {
    backgroundColor: Colors.cardBg,  // dark surface
    borderRadius: Radius.card,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,      // dark border
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 3,
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
  dateSidebarUpcoming: { backgroundColor: Colors.courtBlue },  // dark navy
  dateSidebarPast: { backgroundColor: Colors.surface2 },       // dark muted
  dateDayName: { fontFamily: FontFamily.manropeBold, fontSize: 13 },
  dateDayNum: { fontFamily: FontFamily.manropeBlack, fontSize: 22, lineHeight: 26 },
  dateTextUpcoming: { color: Colors.white },
  dateTextPast: { color: Colors.fg3 },
  cardBody: {
    flex: 1,
    padding: 14,
    gap: 3,
  },
  cardCourt: { fontFamily: FontFamily.spaceGroteskBold, fontSize: FontSize.cardTitle, color: Colors.white },
  cardTime: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, color: Colors.fg3 },
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
  cancelText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label, color: Colors.negative },
});
