import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing,
} from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { CardSkeleton } from '@/components/ui/Skeleton';
import type { Database } from '@/lib/types';

type Court = Database['public']['Tables']['courts']['Row'];

interface Slot {
  start: string;
  end: string;
  label: string;
}

interface DateOption {
  iso: string;
  dayLabel: string;
  dayNum: number;
}

interface UpcomingBooking {
  id: string;
  courtName: string;
  date: string;
  start_time: string;
  end_time: string;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const SLOTS: Slot[] = Array.from({ length: 14 }, (_, i) => {
  const h = i + 7;
  const pad = (n: number) => String(n).padStart(2, '0');
  const label = h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h - 12}:00 PM`;
  return { start: `${pad(h)}:00:00`, end: `${pad(h + 1)}:00:00`, label };
});

function getDateOptions(): DateOption[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      iso: d.toISOString().split('T')[0],
      dayLabel: DAY_NAMES[d.getDay()],
      dayNum: d.getDate(),
    };
  });
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function ResidentHomeScreen() {
  const dateOptions = getDateOptions();

  const [userName, setUserName] = useState('');
  const [avatarInitials, setAvatarInitials] = useState('U');
  const [userId, setUserId] = useState('');
  const [courts, setCourts] = useState<Court[]>([]);
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(dateOptions[0].iso);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<UpcomingBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [slotLoading, setSlotLoading] = useState(false);
  const [confirmSlot, setConfirmSlot] = useState<Slot | null>(null);
  const [booking, setBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  async function loadSlots(courtId: string, date: string) {
    setSlotLoading(true);
    const { data } = await supabase
      .from('bookings')
      .select('start_time')
      .eq('court_id', courtId)
      .eq('date', date)
      .neq('status', 'cancelled');
    setBookedSlots((data ?? []).map((b) => b.start_time));
    setSlotLoading(false);
  }

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    const [profileRes, membershipRes] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', user.id).single(),
      supabase.from('hoa_memberships').select('hoa_id').eq('user_id', user.id).limit(1).single(),
    ]);

    if (profileRes.data?.full_name) {
      setUserName(profileRes.data.full_name);
      setAvatarInitials(getInitials(profileRes.data.full_name));
    }

    const hId = membershipRes.data?.hoa_id ?? '';

    let firstCourtId: string | null = null;
    if (hId) {
      const { data: courtsData } = await supabase
        .from('courts')
        .select('*')
        .eq('hoa_id', hId)
        .order('name');
      const c = courtsData ?? [];
      setCourts(c);
      if (c.length > 0) {
        firstCourtId = c[0].id;
        setSelectedCourtId((prev) => prev ?? c[0].id);
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const { data: upcoming } = await supabase
      .from('bookings')
      .select('id, date, start_time, end_time, courts(name)')
      .eq('user_id', user.id)
      .gte('date', today)
      .neq('status', 'cancelled')
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(5);

    setUpcomingBookings(
      (upcoming ?? []).map((b: any) => ({
        id: b.id,
        courtName: b.courts?.name ?? 'Court',
        date: b.date,
        start_time: b.start_time,
        end_time: b.end_time,
      }))
    );

    // Load slots for first court + today if not already selected
    if (firstCourtId) {
      await loadSlots(firstCourtId, today);
    }

    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (selectedCourtId && selectedDate) loadSlots(selectedCourtId, selectedDate);
  }, [selectedCourtId, selectedDate]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function confirmBooking() {
    if (!confirmSlot || !selectedCourtId || !userId) return;
    setBooking(true);
    await supabase.from('bookings').insert({
      court_id: selectedCourtId,
      user_id: userId,
      date: selectedDate,
      start_time: confirmSlot.start,
      end_time: confirmSlot.end,
      status: 'confirmed',
    });
    setBooking(false);
    setConfirmSlot(null);
    setBookingSuccess(true);
    setTimeout(() => setBookingSuccess(false), 3000);
    await loadSlots(selectedCourtId, selectedDate);
    const today = new Date().toISOString().split('T')[0];
    const { data: upcoming } = await supabase
      .from('bookings')
      .select('id, date, start_time, end_time, courts(name)')
      .eq('user_id', userId)
      .gte('date', today)
      .neq('status', 'cancelled')
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(5);
    setUpcomingBookings(
      (upcoming ?? []).map((b: any) => ({
        id: b.id,
        courtName: b.courts?.name ?? 'Court',
        date: b.date,
        start_time: b.start_time,
        end_time: b.end_time,
      }))
    );
  }

  const selectedCourt = courts.find((c) => c.id === selectedCourtId);

  function formatTime(t: string): string {
    const [h, m] = t.split(':');
    const hour = parseInt(h, 10);
    const suffix = hour < 12 ? 'AM' : 'PM';
    const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${display}:${m} ${suffix}`;
  }

  return (
    <View style={styles.screen}>
      <Header
        variant="resident-home"
        greeting={`Hey${userName ? ', ' + userName.split(' ')[0] : ''}!`}
        subCopy="Book a court or report an issue"
        avatarInitials={avatarInitials}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accentCyan} />
        }
        showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          {bookingSuccess && (
            <View style={styles.successBanner}>
              <CheckCircle color={Colors.accentCyan} size={18} strokeWidth={1.5} />
              <Text style={styles.successText}>Court booked successfully!</Text>
            </View>
          )}

          {/* Court selector */}
          <Text style={styles.sectionLabel}>SELECT COURT</Text>
          {loading ? (
            <CardSkeleton />
          ) : courts.length === 0 ? (
            <EmptyState
              icon={null}
              title="No courts available"
              subtitle="Contact your HOA admin to add courts."
            />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.pillScroll}
              contentContainerStyle={styles.pillScrollContent}>
              {courts.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.courtPill, selectedCourtId === c.id && styles.courtPillActive]}
                  onPress={() => setSelectedCourtId(c.id)}>
                  <Text style={[styles.courtPillLabel, selectedCourtId === c.id && styles.courtPillLabelActive]}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Date selector */}
          <Text style={[styles.sectionLabel, { marginTop: Spacing.sectionGap }]}>SELECT DATE</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.pillScroll}
            contentContainerStyle={styles.pillScrollContent}>
            {dateOptions.map((d) => (
              <TouchableOpacity
                key={d.iso}
                style={[styles.datePill, selectedDate === d.iso && styles.datePillActive]}
                onPress={() => setSelectedDate(d.iso)}>
                <Text style={[styles.dateDayLabel, selectedDate === d.iso && styles.dateLabelActive]}>
                  {d.dayLabel}
                </Text>
                <Text style={[styles.dateDayNum, selectedDate === d.iso && styles.dateLabelActive]}>
                  {d.dayNum}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Time slots */}
          {selectedCourtId && !loading && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: Spacing.sectionGap }]}>
                AVAILABLE TIMES{selectedCourt ? ` — ${selectedCourt.name}` : ''}
              </Text>
              {slotLoading ? (
                <ActivityIndicator color={Colors.accentCyan} style={styles.slotSpinner} />
              ) : (
                <View style={styles.slotsGrid}>
                  {SLOTS.map((slot) => {
                    const isBooked = bookedSlots.includes(slot.start);
                    return (
                      <TouchableOpacity
                        key={slot.start}
                        style={[
                          styles.slotPill,
                          isBooked ? styles.slotBooked : styles.slotAvailable,
                        ]}
                        onPress={() => { if (!isBooked) setConfirmSlot(slot); }}
                        disabled={isBooked}
                        activeOpacity={0.75}>
                        <Text style={[styles.slotLabel, { color: isBooked ? Colors.textMuted : Colors.navy }]}>
                          {slot.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </>
          )}

          {/* Upcoming bookings */}
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Upcoming Bookings</Text>
          {upcomingBookings.length === 0 ? (
            <Text style={styles.emptyText}>No upcoming bookings yet.</Text>
          ) : (
            upcomingBookings.map((b) => (
              <Card key={b.id} style={styles.bookingCard}>
                <Text style={styles.bookingCourt}>{b.courtName}</Text>
                <Text style={styles.bookingTime}>
                  {b.date} · {formatTime(b.start_time)} – {formatTime(b.end_time)}
                </Text>
              </Card>
            ))
          )}
        </View>
      </ScrollView>

      {/* Confirmation modal */}
      <Modal
        visible={!!confirmSlot}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setConfirmSlot(null)}>
        <SafeAreaView style={styles.modal}>
          <Text style={styles.modalTitle}>Confirm Booking</Text>
          <View style={styles.modalDetails}>
            <Text style={styles.modalDetailLabel}>COURT</Text>
            <Text style={styles.modalDetailValue}>{selectedCourt?.name ?? '—'}</Text>
            <Text style={[styles.modalDetailLabel, { marginTop: 12 }]}>DATE</Text>
            <Text style={styles.modalDetailValue}>{selectedDate}</Text>
            <Text style={[styles.modalDetailLabel, { marginTop: 12 }]}>TIME</Text>
            <Text style={styles.modalDetailValue}>{confirmSlot?.label}</Text>
          </View>
          <View style={styles.modalActions}>
            <Button variant="accent" label="Confirm Booking" onPress={confirmBooking} loading={booking} fullWidth />
            <Button variant="ghost" label="Cancel" onPress={() => setConfirmSlot(null)} fullWidth />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },
  scroll: { flex: 1 },
  content: { padding: Spacing.pagePx, paddingBottom: 100 },
  sectionLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.metadata,
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: FontSize.sectionTitle,
    color: Colors.navy,
    marginBottom: 8,
  },
  pillScroll: { marginBottom: 4 },
  pillScrollContent: { paddingRight: Spacing.pagePx },
  courtPill: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: Colors.cardBg,
    marginRight: 8,
  },
  courtPillActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  courtPillLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.uiLabel,
    color: Colors.textMuted,
  },
  courtPillLabelActive: { color: Colors.white },
  datePill: {
    alignItems: 'center',
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.cardBg,
    marginRight: 8,
    minWidth: 52,
  },
  datePillActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  dateDayLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.metadata,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  dateDayNum: {
    fontFamily: FontFamily.manropeBold,
    fontSize: 18,
    color: Colors.navy,
    marginTop: 2,
  },
  dateLabelActive: { color: Colors.white },
  slotSpinner: { marginVertical: 20 },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  slotPill: {
    borderRadius: Radius.button,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: '30%',
    alignItems: 'center',
  },
  slotAvailable: { backgroundColor: Colors.optimalBg },
  slotBooked: { backgroundColor: Colors.attentionBg },
  slotLabel: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.uiLabel },
  bookingCard: { marginBottom: 8, padding: 16, gap: 4 },
  bookingCourt: {
    fontFamily: FontFamily.manropeBold,
    fontSize: FontSize.cardTitle,
    color: Colors.navy,
  },
  bookingTime: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: Colors.textMuted,
  },
  emptyText: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: Colors.textMuted,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,212,255,0.1)',
    borderRadius: Radius.button,
    padding: 12,
    marginBottom: 16,
  },
  successText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.body,
    color: Colors.navy,
  },
  modal: {
    flex: 1,
    backgroundColor: Colors.cardBg,
    padding: Spacing.pagePx,
  },
  modalTitle: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: 22,
    color: Colors.navy,
    marginBottom: 24,
  },
  modalDetails: { gap: 2 },
  modalDetailLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.metadata,
    color: Colors.textMuted,
    letterSpacing: 1.2,
  },
  modalDetailValue: {
    fontFamily: FontFamily.manropeBold,
    fontSize: FontSize.sectionTitle,
    color: Colors.navy,
  },
  modalActions: { marginTop: 32, gap: 12 },
});
