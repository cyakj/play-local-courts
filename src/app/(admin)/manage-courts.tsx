import { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import {
  Colors,
  FontFamily,
  FontSize,
  Radius,
  Spacing,
  MaxWidth,
} from '@/constants/design';
import { Header } from '@/components/ui/Header';
import type { Database } from '@/lib/types';

type Court = Database['public']['Tables']['courts']['Row'];
type Booking = Database['public']['Tables']['bookings']['Row'];
type Maintenance = Database['public']['Tables']['court_maintenance']['Row'];

// Vanilla JS date helpers (no date-fns)
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function addDays(date: Date, n: number): Date {
  return new Date(date.getTime() + n * 86400000);
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 7am–8pm time slots (14 slots, each 1 hour)
const TIME_SLOTS: string[] = [];
for (let h = 7; h <= 19; h++) {
  const label = h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;
  TIME_SLOTS.push(label);
}

// Convert "7am" → "07:00:00", "1pm" → "13:00:00"
function slotToTime(slot: string): string {
  const isPm = slot.endsWith('pm');
  const num = parseInt(slot.replace('am', '').replace('pm', ''), 10);
  let hour = num;
  if (isPm && num !== 12) hour = num + 12;
  if (!isPm && num === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:00:00`;
}

function slotToHour(slot: string): number {
  const isPm = slot.endsWith('pm');
  const num = parseInt(slot.replace('am', '').replace('pm', ''), 10);
  if (isPm && num !== 12) return num + 12;
  if (!isPm && num === 12) return 0;
  return num;
}

type SlotStatus = 'available' | 'booked' | 'maintenance';

const slotBg: Record<SlotStatus, string> = {
  available: Colors.optimalBg,
  booked: Colors.attentionBg,
  maintenance: Colors.criticalBg,
};

const slotTextColor: Record<SlotStatus, string> = {
  available: Colors.blueMid,
  booked: Colors.coral,
  maintenance: Colors.red,
};

export default function ManageCourtsScreen() {
  const [courts, setCourts] = useState<Court[]>([]);
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const days = Array.from({ length: 7 }, (_, i) => addDays(startOfDay(new Date()), i));

  async function loadCourts() {
    const { data } = await supabase
      .from('courts')
      .select('*')
      .order('name', { ascending: true });
    const list = data ?? [];
    setCourts(list);
    if (list.length > 0 && !selectedCourt) {
      setSelectedCourt(list[0]);
    }
  }

  async function loadSlots() {
    if (!selectedCourt) return;
    setLoadingSlots(true);
    const dateStr = toDateString(selectedDate);

    const [bookingRes, maintenanceRes] = await Promise.all([
      supabase
        .from('bookings')
        .select('*')
        .eq('court_id', selectedCourt.id)
        .eq('date', dateStr),
      supabase
        .from('court_maintenance')
        .select('*')
        .eq('court_id', selectedCourt.id)
        .eq('date', dateStr),
    ]);

    setBookings(bookingRes.data ?? []);
    setMaintenance(maintenanceRes.data ?? []);
    setLoadingSlots(false);
  }

  useEffect(() => {
    loadCourts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadSlots();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourt, selectedDate]);

  function getSlotStatus(slot: string): SlotStatus {
    const hour = slotToHour(slot);
    const slotTime = `${String(hour).padStart(2, '0')}:00:00`;

    // Check maintenance first
    for (const m of maintenance) {
      const mStart = m.start_time.substring(0, 8);
      const mEnd = m.end_time.substring(0, 8);
      if (slotTime >= mStart && slotTime < mEnd) return 'maintenance';
    }

    // Check bookings
    for (const b of bookings) {
      if (b.status === 'cancelled') continue;
      const bStart = b.start_time.substring(0, 8);
      const bEnd = b.end_time.substring(0, 8);
      if (slotTime >= bStart && slotTime < bEnd) return 'booked';
    }

    return 'available';
  }

  return (
    <View style={styles.screen}>
      <Header variant="inner" title="Court Schedule" onBack={() => router.back()} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          {/* Court selector pills */}
          <Text style={styles.sectionLabel}>COURT / AMENITY</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.pillScroll}
            contentContainerStyle={styles.pillContent}>
            {courts.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.pill,
                  selectedCourt?.id === c.id && styles.pillActive,
                ]}
                onPress={() => setSelectedCourt(c)}>
                <Text
                  style={[
                    styles.pillLabel,
                    selectedCourt?.id === c.id && styles.pillLabelActive,
                  ]}>
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Date carousel */}
          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>DATE</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.pillScroll}
            contentContainerStyle={styles.pillContent}>
            {days.map((d) => {
              const isSelected = toDateString(d) === toDateString(selectedDate);
              const isToday = toDateString(d) === toDateString(startOfDay(new Date()));
              return (
                <TouchableOpacity
                  key={toDateString(d)}
                  style={[styles.datePill, isSelected && styles.datePillActive]}
                  onPress={() => setSelectedDate(d)}>
                  <Text style={[styles.dateDayLabel, isSelected && styles.dateLabelActive]}>
                    {isToday ? 'Today' : DAYS_SHORT[d.getDay()]}
                  </Text>
                  <Text style={[styles.dateDayNum, isSelected && styles.dateLabelActive]}>
                    {d.getDate()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Slot grid */}
          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>TIME SLOTS</Text>

          {/* Legend */}
          <View style={styles.legend}>
            {(['available', 'booked', 'maintenance'] as SlotStatus[]).map((s) => (
              <View key={s} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: slotBg[s] }]} />
                <Text style={styles.legendLabel}>{s.charAt(0).toUpperCase() + s.slice(1)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.slotGrid}>
            {TIME_SLOTS.map((slot) => {
              const status = loadingSlots ? 'available' : getSlotStatus(slot);
              return (
                <View
                  key={slot}
                  style={[styles.slotCell, { backgroundColor: slotBg[status] }]}>
                  <Text style={[styles.slotTime, { color: slotTextColor[status] }]}>
                    {slot}
                  </Text>
                  <Text style={[styles.slotStatus, { color: slotTextColor[status] }]}>
                    {status}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Slot toggle note */}
          {/* Toggle to maintenance is not implemented — court_maintenance table requires
              manual date + start/end_time inserts which need a separate form flow. */}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },
  scroll: { flex: 1 },
  content: { padding: Spacing.pagePx, gap: 4, paddingBottom: 100 },
  sectionLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.metadata,
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  // Court pills
  pillScroll: { marginBottom: 4 },
  pillContent: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  pill: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.cardBg,
  },
  pillActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  pillLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.uiLabel,
    color: Colors.textMuted,
  },
  pillLabelActive: { color: Colors.white },
  // Date pills
  datePill: {
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.cardBg,
    alignItems: 'center',
    minWidth: 60,
  },
  datePillActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  dateDayLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.min,
    color: Colors.textMuted,
  },
  dateDayNum: {
    fontFamily: FontFamily.manropeBold,
    fontSize: FontSize.uiLabel,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  dateLabelActive: { color: Colors.white },
  // Slot grid
  legend: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.min,
    color: Colors.textMuted,
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotCell: {
    borderRadius: Radius.input,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: '28%',
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  slotTime: {
    fontFamily: FontFamily.manropeBold,
    fontSize: FontSize.uiLabel,
  },
  slotStatus: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.min,
  },
});
