import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const SLOTS: Slot[] = Array.from({ length: 14 }, (_, i) => {
  const h = i + 7;
  const pad = (n: number) => String(n).padStart(2, '0');
  const label = h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h - 12}:00 PM`;
  return { start: `${pad(h)}:00:00`, end: `${pad(h + 1)}:00:00`, label };
});

function getDateOptions(): DateOption[] {
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      iso: d.toISOString().split('T')[0],
      dayLabel: DAY_NAMES[d.getDay()],
      dayNum: d.getDate(),
    };
  });
}

export default function BookScreen() {
  const dateOptions = getDateOptions();
  const [userId, setUserId] = useState('');
  const [courts, setCourts] = useState<Court[]>([]);
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(dateOptions[0].iso);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);

      const { data: membership } = await supabase
        .from('hoa_memberships')
        .select('hoa_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      const hId = membership?.hoa_id ?? '';
      if (hId) {
        const { data: courtsData } = await supabase
          .from('courts')
          .select('*')
          .eq('hoa_id', hId)
          .order('name');
        const c = courtsData ?? [];
        setCourts(c);
        if (c.length > 0) {
          setSelectedCourtId(c[0].id);
          await loadSlots(c[0].id, dateOptions[0].iso);
        }
      }
      setLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    if (selectedCourtId && selectedDate) loadSlots(selectedCourtId, selectedDate);
  }, [selectedCourtId, selectedDate]);

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
    loadSlots(selectedCourtId, selectedDate);
  }

  const selectedCourt = courts.find((c) => c.id === selectedCourtId);

  return (
    <View style={styles.screen}>
      <Header variant="inner" title="Book a Court" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          {bookingSuccess && (
            <View style={styles.successBanner}>
              <CheckCircle color={Colors.accentCyan} size={18} strokeWidth={1.5} />
              <Text style={styles.successText}>Court booked successfully!</Text>
            </View>
          )}

          <Text style={styles.sectionLabel}>SELECT COURT</Text>
          {loading ? (
            <CardSkeleton />
          ) : courts.length === 0 ? (
            <EmptyState icon={null} title="No courts available" subtitle="Contact your HOA admin to add courts." />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll} contentContainerStyle={styles.pillScrollContent}>
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

          <Text style={[styles.sectionLabel, { marginTop: Spacing.sectionGap }]}>SELECT DATE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll} contentContainerStyle={styles.pillScrollContent}>
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
                        style={[styles.slotPill, isBooked ? styles.slotBooked : styles.slotAvailable]}
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
        </View>
      </ScrollView>

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
  pillScroll: { marginBottom: 4 },
  pillScrollContent: { paddingRight: Spacing.pagePx },
  courtPill: {
    borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 18, paddingVertical: 10, backgroundColor: Colors.cardBg, marginRight: 8,
  },
  courtPillActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  courtPillLabel: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.uiLabel, color: Colors.textMuted },
  courtPillLabelActive: { color: Colors.white },
  datePill: {
    alignItems: 'center', borderRadius: Radius.button, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 10, backgroundColor: Colors.cardBg, marginRight: 8, minWidth: 52,
  },
  datePillActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  dateDayLabel: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.metadata, color: Colors.textMuted, letterSpacing: 0.5 },
  dateDayNum: { fontFamily: FontFamily.manropeBold, fontSize: 18, color: Colors.navy, marginTop: 2 },
  dateLabelActive: { color: Colors.white },
  slotSpinner: { marginVertical: 20 },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  slotPill: { borderRadius: Radius.button, paddingHorizontal: 14, paddingVertical: 10, minWidth: '30%', alignItems: 'center' },
  slotAvailable: { backgroundColor: Colors.optimalBg },
  slotBooked: { backgroundColor: Colors.attentionBg },
  slotLabel: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.uiLabel },
  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,212,255,0.1)', borderRadius: Radius.button,
    padding: 12, marginBottom: 16,
  },
  successText: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.body, color: Colors.navy },
  modal: { flex: 1, backgroundColor: Colors.cardBg, padding: Spacing.pagePx },
  modalTitle: { fontFamily: FontFamily.manropeExtraBold, fontSize: 22, color: Colors.navy, marginBottom: 24 },
  modalDetails: { gap: 2 },
  modalDetailLabel: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.metadata, color: Colors.textMuted, letterSpacing: 1.2 },
  modalDetailValue: { fontFamily: FontFamily.manropeBold, fontSize: FontSize.sectionTitle, color: Colors.navy },
  modalActions: { marginTop: 32, gap: 12 },
});
