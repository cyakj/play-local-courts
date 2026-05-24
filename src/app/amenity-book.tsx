import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft, Bell, Menu, Check,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, Radius, Spacing,
} from '@/constants/design';

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const AMENITY_LABELS: Record<string, string> = {
  tennis: 'Court', pickleball: 'Court', pool: 'Pool', barbecue: 'BBQ Area',
  clubhouse: 'Clubhouse', gym: 'Gym', fitness: 'Gym', jacuzzi: 'Spa', spa: 'Spa',
  basketball: 'Court',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = mins / 60;
  return h === 1 ? '1 hr' : `${h} hr`;
}

function getEndTime(start: string, durationMins: number): string {
  const [h, m] = start.split(':').map(Number);
  const endDec = h + m / 60 + durationMins / 60;
  const endH = Math.floor(endDec);
  const endM = Math.round((endDec % 1) * 60);
  return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface BookedSlot {
  start_time: string;
  end_time: string;
}

interface AmenityRules {
  advance_booking_days: number | null;
  booking_start_time: string | null;
  booking_end_time: string | null;
  singles_duration_minutes: number | null;
  doubles_duration_minutes: number | null;
  family_duration_minutes: number | null;
  group_duration_minutes: number | null;
  singles_only: boolean | null;
  doubles_only: boolean | null;
  max_reservations_per_day: number | null;
  max_reservations_per_week: number | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AmenityBookScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    amenityId: string;
    amenityName: string;
    amenityType: string;
  }>();

  const amenityId = params.amenityId ?? '';
  const amenityName = params.amenityName ?? 'Amenity';
  const amenityType = params.amenityType ?? 'tennis';
  const typeLabel = AMENITY_LABELS[amenityType] ?? amenityType;

  // State
  const [rules, setRules] = useState<AmenityRules | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [playType, setPlayType] = useState<'singles' | 'doubles' | 'family' | 'group'>('singles');
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [userId, setUserId] = useState('');

  // Load rules and user id
  useEffect(() => {
    async function loadInit() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id ?? '');

      if (!amenityId) return;
      const { data } = await supabase
        .from('amenity_rules')
        .select('advance_booking_days, booking_start_time, booking_end_time, singles_duration_minutes, doubles_duration_minutes, family_duration_minutes, group_duration_minutes, singles_only, doubles_only, max_reservations_per_day, max_reservations_per_week')
        .eq('amenity_id', amenityId)
        .limit(1)
        .single();
      if (data) setRules(data);
    }
    loadInit();
  }, [amenityId]);

  // Fetch booked slots when date or amenityId changes
  useEffect(() => {
    if (!amenityId) return;
    const dateStr = selectedDate.toISOString().split('T')[0];
    supabase
      .from('bookings')
      .select('start_time, end_time')
      .eq('court_id', amenityId)
      .eq('date', dateStr)
      .eq('status', 'confirmed')
      .then(({ data }) => setBookedSlots(data ?? []));
    setSelectedSlot(null);
  }, [amenityId, selectedDate]);

  // Reset slot when duration changes
  useEffect(() => { setSelectedSlot(null); }, [selectedDuration]);
  // Reset slot + duration when play type changes
  useEffect(() => { setSelectedDuration(null); setSelectedSlot(null); }, [playType]);

  // Date pills (advance_booking_days from rules, default 7)
  const advanceDays = rules?.advance_booking_days ?? 7;
  const datePills = useMemo(() => {
    const pills: Date[] = [];
    const today = new Date();
    for (let i = 0; i <= advanceDays; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      pills.push(d);
    }
    return pills;
  }, [advanceDays]);

  // Is court sport?
  const isCourtSport = amenityType === 'tennis' || amenityType === 'pickleball';

  // Play type options
  const playTypeOptions = useMemo(() => {
    if (isCourtSport) {
      const singlesAllowed = !!rules?.singles_only;
      const doublesAllowed = !!rules?.doubles_only;
      const opts = [
        { value: 'singles' as const, label: 'Singles' },
        { value: 'doubles' as const, label: 'Doubles' },
      ];
      if (!singlesAllowed && !doublesAllowed) return opts;
      return opts.filter(o =>
        (o.value === 'singles' && singlesAllowed) ||
        (o.value === 'doubles' && doublesAllowed)
      );
    }
    return [
      { value: 'family' as const, label: 'Family' },
      { value: 'group' as const, label: 'Group' },
    ];
  }, [rules, isCourtSport]);

  // Set default play type
  useEffect(() => {
    if (playTypeOptions.length > 0 && !playTypeOptions.find(o => o.value === playType)) {
      setPlayType(playTypeOptions[0].value);
    }
  }, [playTypeOptions]);

  // Max duration per play type
  const maxDuration = useMemo(() => {
    if (!rules) return isCourtSport ? 60 : 120;
    if (isCourtSport) {
      return playType === 'singles'
        ? (rules.singles_duration_minutes ?? 60)
        : (rules.doubles_duration_minutes ?? 90);
    }
    return playType === 'family'
      ? (rules.family_duration_minutes ?? 120)
      : (rules.group_duration_minutes ?? 120);
  }, [rules, playType, isCourtSport]);

  const durationOptions = useMemo(() => {
    const opts: number[] = [];
    for (let d = 30; d <= maxDuration; d += 30) opts.push(d);
    if (opts.length === 0) opts.push(30);
    return opts;
  }, [maxDuration]);

  // Operating hours
  const startHour = rules?.booking_start_time ? parseInt(rules.booking_start_time.split(':')[0]) : 6;
  const endHour = rules?.booking_end_time ? parseInt(rules.booking_end_time.split(':')[0]) : 22;

  // Time slots
  const timeSlots = useMemo(() => {
    if (!selectedDuration) return [];
    const slots: string[] = [];
    const durationHours = selectedDuration / 60;
    const now = new Date();
    const isToday = selectedDate.toDateString() === now.toDateString();

    for (let h = startHour; h < endHour; h++) {
      for (let m = 0; m < 60; m += 30) {
        const slotDec = h + m / 60;
        if (slotDec + durationHours > endHour) continue;
        if (isToday) {
          const currentDec = now.getHours() + now.getMinutes() / 60;
          if (slotDec <= currentDec) continue;
        }
        slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
      }
    }
    return slots;
  }, [selectedDuration, startHour, endHour, selectedDate]);

  // Slot status
  const getSlotStatus = useCallback((slotStart: string): 'available' | 'booked' => {
    if (!selectedDuration) return 'available';
    const slotEnd = getEndTime(slotStart, selectedDuration);
    for (const bs of bookedSlots) {
      if (slotStart < bs.end_time && slotEnd > bs.start_time) return 'booked';
    }
    return 'available';
  }, [selectedDuration, bookedSlots]);

  // Confirm booking
  async function handleConfirm() {
    if (!userId || !amenityId || !selectedSlot || !selectedDuration) return;
    setConfirming(true);
    const dateStr = selectedDate.toISOString().split('T')[0];
    const endTime = getEndTime(selectedSlot, selectedDuration);
    await supabase.from('bookings').insert({
      court_id: amenityId,
      user_id: userId,
      date: dateStr,
      start_time: `${selectedSlot}:00`,
      end_time: `${endTime}:00`,
      status: 'confirmed',
    });
    setConfirming(false);
    router.back();
  }

  const selectedDateStr = selectedDate.toISOString().split('T')[0];

  return (
    <View style={styles.screen}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <View style={styles.headerTopBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ArrowLeft color={Colors.white} size={22} strokeWidth={1.5} />
          </TouchableOpacity>
          <Image
            source={require('@/assets/images/TenisX_logo-removebg-preview.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <View style={styles.headerIcons}>
            <TouchableOpacity
              onPress={() => router.push('/notifications')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Bell color={Colors.white} size={20} strokeWidth={1.5} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/settings')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Menu color={Colors.white} size={22} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.amenityName}>{amenityName}</Text>
        <Text style={styles.amenitySub}>{typeLabel} · Book a slot</Text>
      </View>

      {/* ── Date strip ──────────────────────────────────────────────────── */}
      <View style={styles.dateStrip}>
        <Text style={styles.dateSectionLabel}>SELECT DATE</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.datePillRow}>
          {datePills.map((d, i) => {
            const dStr = d.toISOString().split('T')[0];
            const sel = dStr === selectedDateStr;
            const dayLabel = i === 0 ? 'Today' : DAY_LABELS[d.getDay()];
            return (
              <TouchableOpacity
                key={dStr}
                onPress={() => setSelectedDate(d)}
                style={[styles.datePill, sel && styles.datePillActive]}>
                <Text style={[styles.datePillDay, sel && styles.datePillTextActive]}>
                  {dayLabel}
                </Text>
                <Text style={[styles.datePillNum, sel && styles.datePillTextActive]}>
                  {d.getDate()}
                </Text>
                <Text style={[styles.datePillMonth, sel && styles.datePillMonthActive]}>
                  {MONTH_ABBR[d.getMonth()]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Scrollable body ─────────────────────────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.body,
          { paddingBottom: selectedSlot ? 160 : 100 },
        ]}
        showsVerticalScrollIndicator={false}>

        {/* OPTIONS card */}
        <View style={styles.optionsCard}>
          <Text style={styles.cardSectionLabel}>OPTIONS</Text>

          {/* Type of Play / Use */}
          <Text style={styles.optionLabel}>
            {isCourtSport ? 'Type of Play' : 'Type of Use'}
          </Text>
          <View style={styles.optionRow}>
            {playTypeOptions.map((t) => {
              const sel = playType === t.value;
              return (
                <TouchableOpacity
                  key={t.value}
                  onPress={() => setPlayType(t.value)}
                  style={[styles.optionBtn, sel && styles.optionBtnActive]}
                  activeOpacity={0.8}>
                  <Text style={[styles.optionBtnLabel, sel && styles.optionBtnLabelActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Duration */}
          <Text style={[styles.optionLabel, { marginTop: 16 }]}>Duration</Text>
          <View style={styles.optionRow}>
            {durationOptions.map((d) => {
              const sel = selectedDuration === d;
              return (
                <TouchableOpacity
                  key={d}
                  onPress={() => setSelectedDuration(d)}
                  style={[styles.optionBtn, sel && styles.optionBtnActive]}
                  activeOpacity={0.8}>
                  <Text style={[styles.optionBtnLabel, sel && styles.optionBtnLabelActive]}>
                    {fmtDuration(d)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.maxDurationHint}>Max: {fmtDuration(maxDuration)}</Text>
        </View>

        {/* Time grid */}
        {selectedDuration !== null && (
          <View style={styles.timesCard}>
            <View style={styles.timesHeader}>
              <Text style={styles.cardSectionLabel}>TIMES</Text>
              <View style={styles.legendRow}>
                {[
                  { label: 'Available', bg: Colors.pageBg, border: '#E5E7EB' },
                  { label: 'Selected',  bg: Colors.navy,   border: Colors.accentCyan },
                  { label: 'Booked',    bg: '#F3F4F6',     border: '#EBEBEB' },
                ].map((l) => (
                  <View key={l.label} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: l.bg, borderColor: l.border }]} />
                    <Text style={styles.legendText}>{l.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {timeSlots.length === 0 ? (
              <Text style={styles.noSlotsText}>No available slots for this date.</Text>
            ) : (
              <View style={styles.slotsGrid}>
                {timeSlots.map((slot) => {
                  const status = getSlotStatus(slot);
                  const isSel = selectedSlot === slot;
                  return (
                    <TouchableOpacity
                      key={slot}
                      disabled={status === 'booked'}
                      onPress={() => status === 'available' && setSelectedSlot(isSel ? null : slot)}
                      style={[
                        styles.slotBtn,
                        status === 'booked' && styles.slotBooked,
                        status === 'available' && !isSel && styles.slotAvailable,
                        isSel && styles.slotSelected,
                      ]}
                      activeOpacity={0.75}>
                      {isSel && (
                        <View style={styles.slotCheckDot}>
                          <Check color={Colors.navy} size={8} strokeWidth={3} />
                        </View>
                      )}
                      <Text style={[
                        styles.slotLabel,
                        {
                          color: isSel ? Colors.white
                            : status === 'booked' ? '#9CA3AF'
                            : Colors.navy,
                        },
                      ]}>
                        {formatTime(slot)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

      </ScrollView>

      {/* ── Sticky confirm bar ──────────────────────────────────────────── */}
      {selectedSlot && selectedDuration !== null && (
        <View style={[styles.confirmBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.confirmSummary}>
            <Text style={styles.confirmTime}>
              {formatTime(selectedSlot)} – {formatTime(getEndTime(selectedSlot, selectedDuration))}
            </Text>
            <Text style={styles.confirmMeta}>
              {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {' · '}
              {fmtDuration(selectedDuration)}
              {' · '}
              {playType}
            </Text>
          </View>
          <View style={styles.confirmedPill}>
            <Text style={styles.confirmedPillText}>Selected ✓</Text>
          </View>
          <TouchableOpacity
            style={[styles.confirmBtn, confirming && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={confirming}
            activeOpacity={0.85}>
            {confirming ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={styles.confirmBtnLabel}>Confirm Booking →</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },

  // Header
  header: {
    backgroundColor: Colors.headerBg,
    paddingHorizontal: Spacing.pagePx,
    paddingBottom: 20,
  },
  headerTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  headerLogo: {
    height: 40,
    width: 110,
    flex: 1,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginLeft: 12,
  },
  amenityName: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: 22,
    color: Colors.white,
    lineHeight: 28,
  },
  amenitySub: {
    fontFamily: FontFamily.interRegular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
  },

  // Date strip
  dateStrip: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: Spacing.pagePx,
    paddingTop: 14,
    paddingBottom: 10,
  },
  dateSectionLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 11,
    color: '#374151',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  datePillRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  datePill: {
    alignItems: 'center',
    minWidth: 56,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: Colors.pageBg,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  datePillActive: {
    backgroundColor: Colors.navy,
    borderColor: Colors.accentCyan,
  },
  datePillDay: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 10,
    color: '#9CA3AF',
    letterSpacing: 0.3,
  },
  datePillNum: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: 18,
    color: Colors.navy,
    lineHeight: 22,
  },
  datePillMonth: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 9,
    color: '#9CA3AF',
  },
  datePillTextActive: { color: Colors.white },
  datePillMonthActive: { color: Colors.accentCyan },

  // Body
  body: {
    padding: Spacing.pagePx,
  },

  // Options card
  optionsCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 12,
  },
  cardSectionLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 11,
    color: '#374151',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  optionLabel: {
    fontFamily: FontFamily.manropeBold,
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  optionBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: Colors.pageBg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  optionBtnActive: {
    backgroundColor: Colors.navy,
    borderColor: Colors.accentCyan,
  },
  optionBtnLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.uiLabel,
    color: '#4B5563',
  },
  optionBtnLabelActive: {
    color: Colors.white,
  },
  maxDurationHint: {
    fontFamily: FontFamily.interRegular,
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 8,
  },

  // Times card
  timesCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 12,
  },
  timesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 4,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: 1.5,
  },
  legendText: {
    fontFamily: FontFamily.interRegular,
    fontSize: 11,
    color: '#4B5563',
  },
  noSlotsText: {
    fontFamily: FontFamily.interRegular,
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    paddingVertical: 24,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotBtn: {
    width: '31%',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1.5,
  },
  slotAvailable: {
    backgroundColor: Colors.pageBg,
    borderColor: '#E5E7EB',
  },
  slotBooked: {
    backgroundColor: '#F3F4F6',
    borderColor: '#EBEBEB',
  },
  slotSelected: {
    backgroundColor: Colors.navy,
    borderColor: Colors.accentCyan,
    borderWidth: 2,
  },
  slotCheckDot: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.accentCyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 12,
  },

  // Confirm bar
  confirmBar: {
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: Spacing.pagePx,
    paddingTop: 12,
    gap: 10,
  },
  confirmSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  confirmTime: {
    fontFamily: FontFamily.manropeBold,
    fontSize: 14,
    color: Colors.navy,
  },
  confirmMeta: {
    fontFamily: FontFamily.interRegular,
    fontSize: 12,
    color: '#4B5563',
    marginTop: 2,
  },
  confirmedPill: {
    alignSelf: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: '#E6FFFA',
  },
  confirmedPillText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 11,
    color: Colors.accentCyan,
  },
  confirmBtn: {
    backgroundColor: Colors.accentCyan,
    borderRadius: Radius.button,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 44,
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 4,
  },
  confirmBtnDisabled: {
    opacity: 0.7,
  },
  confirmBtnLabel: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: 15,
    color: Colors.white,
  },
});
