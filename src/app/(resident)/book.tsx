import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CheckCircle } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing,
} from '@/constants/design';
import { Header } from '@/components/ui/Header';
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
  shortLabel: string;
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
      shortLabel: i === 0 ? 'Today' : i === 1 ? 'Tmrw' : DAY_NAMES[d.getDay()],
      dayNum: d.getDate(),
    };
  });
}

const TYPE_LABELS: Record<string, string> = {
  all: 'All',
  tennis: 'Tennis',
  pickleball: 'Pickleball',
  pool: 'Pool',
  gym: 'Gym',
  clubhouse: 'Clubhouse',
  barbecue: 'Barbecue',
  jacuzzi: 'Jacuzzi',
};

export default function BookScreen() {
  const dateOptions = getDateOptions();
  const [userId, setUserId] = useState('');
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(dateOptions[0].iso);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [pendingSlot, setPendingSlot] = useState<Slot | null>(null);
  const [slotLoading, setSlotLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

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

      if (membership?.hoa_id) {
        const { data: courtsData } = await supabase
          .from('courts')
          .select('*')
          .eq('hoa_id', membership.hoa_id)
          .order('name');
        setCourts(courtsData ?? []);
      }
      setLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    if (selectedCourtId && selectedDate) {
      setPendingSlot(null);
      loadSlots(selectedCourtId, selectedDate);
    }
  }, [selectedCourtId, selectedDate]);

  function toggleCourt(court: Court) {
    if (selectedCourtId === court.id) {
      setSelectedCourtId(null);
      setBookedSlots([]);
      setPendingSlot(null);
    } else {
      setSelectedCourtId(court.id);
    }
  }

  async function confirmBooking() {
    if (!pendingSlot || !selectedCourtId || !userId) return;
    setBooking(true);
    await supabase.from('bookings').insert({
      court_id: selectedCourtId,
      user_id: userId,
      date: selectedDate,
      start_time: pendingSlot.start,
      end_time: pendingSlot.end,
      status: 'confirmed',
    });
    setBooking(false);
    setPendingSlot(null);
    const court = courts.find((c) => c.id === selectedCourtId);
    setSuccessMsg(`${court?.name ?? 'Court'} booked for ${pendingSlot.label}!`);
    setTimeout(() => setSuccessMsg(''), 3500);
    loadSlots(selectedCourtId, selectedDate);
  }

  const filteredCourts = activeFilter === 'all'
    ? courts
    : courts.filter((c) => c.court_type === activeFilter);

  const availableTypes = ['all', ...new Set(courts.map((c) => c.court_type))];

  return (
    <View style={styles.screen}>
      <Header variant="inner" title="Book Amenity" />

      {!!successMsg && (
        <View style={styles.successBanner}>
          <CheckCircle color={Colors.accentCyan} size={18} strokeWidth={1.5} />
          <Text style={styles.successText}>{successMsg}</Text>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          {/* Check Availability CTA */}
          <View style={styles.ctaCard}>
            <Text style={styles.ctaTitle}>Check Availability</Text>
            <Text style={styles.ctaSubtitle}>Pick a date and time to see what's open</Text>
            <View style={styles.ctaTag}>
              <Text style={styles.ctaTagText}>📅  Select Date & Time</Text>
            </View>
          </View>

          {/* Type filter tabs */}
          {!loading && courts.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroll}
              contentContainerStyle={styles.filterContent}>
              {availableTypes.map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => {
                    setActiveFilter(type);
                    setSelectedCourtId(null);
                    setPendingSlot(null);
                  }}
                  style={[styles.filterTab, activeFilter === type && styles.filterTabActive]}>
                  <Text style={[styles.filterLabel, activeFilter === type && styles.filterLabelActive]}>
                    {TYPE_LABELS[type] ?? (type.charAt(0).toUpperCase() + type.slice(1))}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <Text style={styles.discoverTitle}>Discover Amenities</Text>

          {loading ? (
            <><CardSkeleton /><CardSkeleton /></>
          ) : filteredCourts.length === 0 ? (
            <EmptyState
              icon={null}
              title="No amenities available"
              subtitle="Contact your HOA admin to add amenities."
            />
          ) : (
            filteredCourts.map((court) => {
              const isSelected = selectedCourtId === court.id;
              const typeLabel = TYPE_LABELS[court.court_type] ?? court.court_type;

              return (
                <View
                  key={court.id}
                  style={[styles.amenityCard, isSelected && styles.amenityCardSelected]}>

                  {/* Card header row */}
                  <View style={styles.amenityTop}>
                    <View style={styles.amenityInfo}>
                      <Text style={styles.amenityName}>{court.name}</Text>
                      <Text style={styles.amenityType}>{typeLabel}</Text>
                    </View>
                    <View style={styles.openBadge}>
                      <Text style={styles.openBadgeText}>Open Now</Text>
                    </View>
                  </View>

                  {/* Book Now button or inline form */}
                  {!isSelected ? (
                    <TouchableOpacity
                      style={styles.bookNowBtn}
                      onPress={() => toggleCourt(court)}
                      activeOpacity={0.8}>
                      <Text style={styles.bookNowLabel}>Book Now</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.bookingForm}>
                      <View style={styles.formDivider} />

                      {/* Date selector */}
                      <Text style={styles.formLabel}>SELECT DATE</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.datePillRow}>
                        {dateOptions.map((d) => (
                          <TouchableOpacity
                            key={d.iso}
                            style={[styles.datePill, selectedDate === d.iso && styles.datePillActive]}
                            onPress={() => setSelectedDate(d.iso)}>
                            <Text style={[styles.datePillDay, selectedDate === d.iso && styles.dateLabelActive]}>
                              {d.shortLabel}
                            </Text>
                            <Text style={[styles.datePillNum, selectedDate === d.iso && styles.dateLabelActive]}>
                              {d.dayNum}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>

                      {/* Time slots */}
                      <Text style={[styles.formLabel, { marginTop: 16 }]}>SELECT TIME</Text>
                      <Text style={styles.formHint}>
                        Green = available · Tap a slot to select, then confirm below
                      </Text>

                      {slotLoading ? (
                        <ActivityIndicator color={Colors.accentCyan} style={{ marginVertical: 16 }} />
                      ) : (
                        <View style={styles.slotsGrid}>
                          {SLOTS.map((slot) => {
                            const isBooked = bookedSlots.includes(slot.start);
                            const isPending = pendingSlot?.start === slot.start;
                            return (
                              <TouchableOpacity
                                key={slot.start}
                                style={[
                                  styles.slotPill,
                                  isBooked && styles.slotBooked,
                                  !isBooked && !isPending && styles.slotAvailable,
                                  isPending && styles.slotPending,
                                ]}
                                onPress={() => {
                                  if (!isBooked) setPendingSlot(isPending ? null : slot);
                                }}
                                disabled={isBooked}
                                activeOpacity={0.75}>
                                <Text style={[
                                  styles.slotLabel,
                                  { color: isBooked ? Colors.textMuted : isPending ? Colors.white : Colors.navy },
                                ]}>
                                  {slot.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}

                      {/* Confirm button */}
                      <TouchableOpacity
                        style={[styles.confirmBtn, !pendingSlot && styles.confirmBtnDisabled]}
                        onPress={confirmBooking}
                        disabled={!pendingSlot || booking}
                        activeOpacity={0.85}>
                        {booking
                          ? <ActivityIndicator color={Colors.white} size="small" />
                          : <Text style={styles.confirmBtnLabel}>
                              {pendingSlot
                                ? `Confirm Booking for ${pendingSlot.label} →`
                                : 'Select a time slot'}
                            </Text>
                        }
                      </TouchableOpacity>

                      <TouchableOpacity onPress={() => toggleCourt(court)} style={styles.collapseBtn}>
                        <Text style={styles.collapseBtnLabel}>Hide ↑</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
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

  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,212,255,0.1)',
    paddingHorizontal: Spacing.pagePx,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,212,255,0.2)',
  },
  successText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.body,
    color: Colors.navy,
    flex: 1,
  },

  // Check Availability card
  ctaCard: {
    borderRadius: Radius.card,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    backgroundColor: Colors.navy,
  },
  ctaTitle: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: FontSize.sectionTitle,
    color: Colors.white,
    marginBottom: 4,
  },
  ctaSubtitle: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.uiLabel,
    color: 'rgba(0,212,255,0.8)',
    marginBottom: 14,
  },
  ctaTag: {
    backgroundColor: Colors.white,
    borderRadius: Radius.button,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  ctaTagText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.uiLabel,
    color: Colors.navy,
  },

  // Filter tabs
  filterScroll: { marginBottom: 16 },
  filterContent: { flexDirection: 'row', gap: 8, paddingRight: 4 },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterTabActive: {
    backgroundColor: Colors.navy,
    borderColor: Colors.navy,
  },
  filterLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.uiLabel,
    color: Colors.textMuted,
  },
  filterLabelActive: { color: Colors.white },

  discoverTitle: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: FontSize.sectionTitle,
    color: Colors.navy,
    marginBottom: 12,
  },

  // Amenity card
  amenityCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  amenityCardSelected: {
    borderColor: Colors.accentCyan,
    borderWidth: 2,
  },
  amenityTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  amenityInfo: { flex: 1, marginRight: 12 },
  amenityName: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: FontSize.cardTitle,
    color: Colors.navy,
  },
  amenityType: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.metadata,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginTop: 2,
  },
  openBadge: {
    backgroundColor: 'rgba(0,212,255,0.12)',
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  openBadgeText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 11,
    color: Colors.accentCyan,
  },
  bookNowBtn: {
    backgroundColor: Colors.accentCyan,
    borderRadius: Radius.button,
    paddingVertical: 10,
    alignItems: 'center',
  },
  bookNowLabel: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: FontSize.uiLabel,
    color: Colors.navy,
  },

  // Inline booking form
  bookingForm: { gap: 0 },
  formDivider: { height: 1, backgroundColor: Colors.border, marginBottom: 16 },
  formLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.metadata,
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  formHint: {
    fontFamily: FontFamily.interRegular,
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 10,
    marginTop: -6,
  },

  datePillRow: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  datePill: {
    alignItems: 'center',
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.pageBg,
    minWidth: 50,
  },
  datePillActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  datePillDay: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },
  datePillNum: {
    fontFamily: FontFamily.manropeBold,
    fontSize: 16,
    color: Colors.navy,
    marginTop: 2,
  },
  dateLabelActive: { color: Colors.white },

  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  slotPill: {
    borderRadius: Radius.button,
    paddingHorizontal: 10,
    paddingVertical: 9,
    minWidth: '30%',
    flex: 1,
    alignItems: 'center',
  },
  slotAvailable: { backgroundColor: Colors.optimalBg },
  slotBooked: { backgroundColor: Colors.attentionBg },
  slotPending: { backgroundColor: Colors.navy },
  slotLabel: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.uiLabel },

  confirmBtn: {
    backgroundColor: Colors.navy,
    borderRadius: Radius.button,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmBtnDisabled: { backgroundColor: Colors.textMuted },
  confirmBtnLabel: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: FontSize.uiLabel,
    color: Colors.white,
  },

  collapseBtn: { alignItems: 'center', paddingVertical: 4 },
  collapseBtnLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.uiLabel,
    color: Colors.textMuted,
  },
});
