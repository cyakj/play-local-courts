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
                <EmptyState icon={null} title="No upcoming bookings" subtitle="Book a court to see it here." />
              ) : (
                upcoming.map((b) => (
                  <View key={b.id} style={styles.card}>
                    <View style={styles.cardTop}>
                      <CalendarDays color={Colors.accentCyan} size={18} strokeWidth={1.5} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardCourt}>{b.courtName}</Text>
                        <Text style={styles.cardTime}>
                          {formatDate(b.date)} · {formatTime(b.start_time)} – {formatTime(b.end_time)}
                        </Text>
                      </View>
                      <StatusPill status={bookingStatus(b.status)} label={b.status} />
                    </View>
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => cancelBooking(b.id)}
                      disabled={cancelling === b.id}>
                      <Text style={styles.cancelText}>
                        {cancelling === b.id ? 'Cancelling…' : 'Cancel Booking'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}

              <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Past Bookings</Text>
              {past.length === 0 ? (
                <EmptyState icon={null} title="No past bookings" subtitle="" />
              ) : (
                past.map((b) => (
                  <View key={b.id} style={[styles.card, styles.cardPast]}>
                    <View style={styles.cardTop}>
                      <CalendarDays color={Colors.textMuted} size={18} strokeWidth={1.5} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.cardCourt, { color: Colors.textMuted }]}>{b.courtName}</Text>
                        <Text style={styles.cardTime}>
                          {formatDate(b.date)} · {formatTime(b.start_time)} – {formatTime(b.end_time)}
                        </Text>
                      </View>
                      <StatusPill status={bookingStatus(b.status)} label={b.status} />
                    </View>
                  </View>
                ))
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
  headerTitle: { fontFamily: FontFamily.manropeExtraBold, fontSize: 18, color: Colors.white },
  content: { padding: Spacing.pagePx, paddingBottom: 60 },
  sectionTitle: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: FontSize.sectionTitle,
    color: Colors.navy,
    marginBottom: 12,
  },
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.card,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow,
  },
  cardPast: { opacity: 0.7 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardCourt: { fontFamily: FontFamily.manropeBold, fontSize: FontSize.cardTitle, color: Colors.navy },
  cardTime: { fontFamily: FontFamily.interRegular, fontSize: FontSize.uiLabel, color: Colors.textMuted, marginTop: 2 },
  cancelBtn: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'center',
  },
  cancelText: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.uiLabel, color: Colors.coral },
});
