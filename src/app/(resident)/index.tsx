import { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { CalendarDays, Plus, ClipboardList } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing, Shadow,
} from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { CardSkeleton } from '@/components/ui/Skeleton';

interface UpcomingBooking {
  id: string;
  courtName: string;
  date: string;
  start_time: string;
  end_time: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatTime(t: string): string {
  const [h] = t.split(':');
  const hour = parseInt(h, 10);
  const suffix = hour < 12 ? 'AM' : 'PM';
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${display}:00 ${suffix}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function ResidentHomeScreen() {
  const [userName, setUserName] = useState('');
  const [avatarInitials, setAvatarInitials] = useState('U');
  const [upcomingBookings, setUpcomingBookings] = useState<UpcomingBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [profileRes, bookingsRes] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', user.id).single(),
      supabase
        .from('bookings')
        .select('id, date, start_time, end_time, courts(name)')
        .eq('user_id', user.id)
        .gte('date', new Date().toISOString().split('T')[0])
        .neq('status', 'cancelled')
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(10),
    ]);

    if (profileRes.data?.full_name) {
      setUserName(profileRes.data.full_name);
      setAvatarInitials(getInitials(profileRes.data.full_name));
    }

    setUpcomingBookings(
      (bookingsRes.data ?? []).map((b: any) => ({
        id: b.id,
        courtName: b.courts?.name ?? 'Court',
        date: b.date,
        start_time: b.start_time,
        end_time: b.end_time,
      }))
    );

    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  useFocusEffect(useCallback(() => { load(); }, []));

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <View style={styles.screen}>
      <Header
        variant="resident-home"
        greeting={`Hey${userName ? ', ' + userName.split(' ')[0] : ''}!`}
        subCopy="Manage your bookings and community"
        avatarInitials={avatarInitials}
        onBell={() => router.push('/notifications')}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accentCyan} />
        }
        showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          {/* Quick actions */}
          <TouchableOpacity style={styles.bookCta} onPress={() => router.push('/(resident)/book')}>
            <View style={styles.bookCtaLeft}>
              <CalendarDays color={Colors.accentCyan} size={22} strokeWidth={1.5} />
              <View>
                <Text style={styles.bookCtaTitle}>Book a Court</Text>
                <Text style={styles.bookCtaSub}>Check availability and reserve</Text>
              </View>
            </View>
            <Plus color={Colors.navy} size={20} strokeWidth={2} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.bookCta, { marginTop: 10 }]} onPress={() => router.push('/my-reservations')}>
            <View style={styles.bookCtaLeft}>
              <CalendarDays color={Colors.navy} size={22} strokeWidth={1.5} />
              <View>
                <Text style={styles.bookCtaTitle}>My Reservations</Text>
                <Text style={styles.bookCtaSub}>View and manage your bookings</Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.bookCta, { marginTop: 10 }]} onPress={() => router.push('/my-reports')}>
            <View style={styles.bookCtaLeft}>
              <ClipboardList color={Colors.coral} size={22} strokeWidth={1.5} />
              <View>
                <Text style={styles.bookCtaTitle}>My Reports</Text>
                <Text style={styles.bookCtaSub}>Track your submitted issues</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Upcoming bookings */}
          <Text style={styles.sectionTitle}>Upcoming Bookings</Text>
          {loading ? (
            <><CardSkeleton /><CardSkeleton /></>
          ) : upcomingBookings.length === 0 ? (
            <EmptyState
              icon={null}
              title="No upcoming bookings"
              subtitle="Tap 'Book a Court' above to get started."
            />
          ) : (
            upcomingBookings.map((b) => (
              <Card key={b.id} style={styles.bookingCard}>
                <View style={styles.bookingRow}>
                  <View style={styles.bookingDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bookingCourt}>{b.courtName}</Text>
                    <Text style={styles.bookingTime}>
                      {formatDate(b.date)} · {formatTime(b.start_time)} – {formatTime(b.end_time)}
                    </Text>
                  </View>
                </View>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },
  scroll: { flex: 1 },
  content: { padding: Spacing.pagePx, paddingBottom: 100 },
  sectionTitle: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: FontSize.sectionTitle,
    color: Colors.navy,
    marginBottom: 12,
    marginTop: 8,
  },
  bookCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.card,
    padding: 18,
    marginBottom: 24,
    ...Shadow,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bookCtaLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  bookCtaTitle: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.body, color: Colors.navy },
  bookCtaSub: { fontFamily: FontFamily.interRegular, fontSize: FontSize.uiLabel, color: Colors.textMuted, marginTop: 2 },
  bookingCard: { marginBottom: 10, padding: 16 },
  bookingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bookingDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.accentCyan, flexShrink: 0,
  },
  bookingCourt: {
    fontFamily: FontFamily.manropeBold,
    fontSize: FontSize.cardTitle,
    color: Colors.navy,
  },
  bookingTime: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
