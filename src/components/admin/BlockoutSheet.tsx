import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { sendNotificationEmail } from '@/lib/emailNotifications';
import { formatDateFull, formatTime12h } from '@/lib/format';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { Button } from '@/components/ui/Button';
import { CalendarPicker } from '@/components/ui/CalendarPicker';
import type { ThemeTokens } from '@/constants/theme-tokens';
import type { Database } from '@/lib/types';

type AmenityRules = Database['public']['Tables']['amenity_rules']['Row'];

type BlockoutMode = 'single' | 'range';
type ReasonType = 'maintenance' | 'private_event' | 'closure' | 'other';
type DateField = 'start' | 'end';

interface RawBooking {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
}

interface ConflictBooking extends RawBooking {
  residentName: string;
}

interface BlockoutSheetProps {
  visible: boolean;
  onClose: () => void;
  courtId: string;
  courtName: string;
  hoaId: string;
  rules?: Partial<AmenityRules>;
  theme: ThemeTokens;
  onSaved: () => void;
}

const REASON_TYPES: { value: ReasonType; label: string }[] = [
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'private_event', label: 'Private Event' },
  { value: 'closure', label: 'Closure' },
  { value: 'other', label: 'Other' },
];

const REASON_LABELS: Record<ReasonType, string> = {
  maintenance: 'Maintenance',
  private_event: 'Private Event',
  closure: 'Closure',
  other: 'Other',
};

const DEFAULT_OPEN_HOUR = 6;   // 6am
const DEFAULT_CLOSE_HOUR = 22; // 10pm
const MAX_ADVANCE_DAYS = 365;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function parseHour(t: string | null | undefined, fallback: number): number {
  if (!t) return fallback;
  const h = parseInt(t.split(':')[0], 10);
  return Number.isFinite(h) ? h : fallback;
}

export function BlockoutSheet({
  visible,
  onClose,
  courtId,
  courtName,
  hoaId,
  rules,
  theme,
  onSaved,
}: BlockoutSheetProps) {
  const styles = useStyles(theme);

  const today = useMemo(() => startOfDay(new Date()), []);
  const maxDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + MAX_ADVANCE_DAYS);
    return d;
  }, [today]);

  const openHour = useMemo(() => {
    const o = parseHour(rules?.booking_start_time, DEFAULT_OPEN_HOUR);
    const c = parseHour(rules?.booking_end_time, DEFAULT_CLOSE_HOUR);
    return c > o ? o : DEFAULT_OPEN_HOUR;
  }, [rules?.booking_start_time, rules?.booking_end_time]);
  const closeHour = useMemo(() => {
    const o = parseHour(rules?.booking_start_time, DEFAULT_OPEN_HOUR);
    const c = parseHour(rules?.booking_end_time, DEFAULT_CLOSE_HOUR);
    return c > o ? c : DEFAULT_CLOSE_HOUR;
  }, [rules?.booking_start_time, rules?.booking_end_time]);

  const hours = useMemo(() => {
    const list: number[] = [];
    for (let h = openHour; h < closeHour; h++) list.push(h);
    return list;
  }, [openHour, closeHour]);

  const [mode, setMode] = useState<BlockoutMode>('single');
  const [startDate, setStartDate] = useState<Date>(today);
  const [endDate, setEndDate] = useState<Date>(today);
  const [activeField, setActiveField] = useState<DateField>('start');
  const [allDay, setAllDay] = useState(true);
  const [selectedHours, setSelectedHours] = useState<Set<number>>(new Set());
  const [bookedHours, setBookedHours] = useState<Set<number>>(new Set());
  const [reasonType, setReasonType] = useState<ReasonType>('maintenance');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictBooking[] | null>(null);

  // Reset all form state each time the sheet is opened.
  useEffect(() => {
    if (!visible) return;
    const now = startOfDay(new Date());
    setMode('single');
    setStartDate(now);
    setEndDate(now);
    setActiveField('start');
    setAllDay(true);
    setSelectedHours(new Set());
    setBookedHours(new Set());
    setReasonType('maintenance');
    setNote('');
    setSaving(false);
    setResolving(false);
    setConflicts(null);
  }, [visible]);

  const dateRange = useMemo(() => {
    const from = toISODate(startDate);
    const to = mode === 'range' ? toISODate(endDate) : from;
    return { from, to };
  }, [mode, startDate, endDate]);

  // Load which hours already have a resident reservation so the grid can
  // grey them out — this is purely visual; the authoritative conflict
  // check happens again (with full detail) at Save time.
  useEffect(() => {
    if (!visible) return;
    if (mode === 'range' && endDate < startDate) {
      setBookedHours(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      const { from, to } = dateRange;
      const { data } = await supabase
        .from('bookings')
        .select('start_time')
        .eq('court_id', courtId)
        .gte('date', from)
        .lte('date', to)
        .neq('status', 'cancelled');
      if (cancelled) return;
      setBookedHours(new Set((data ?? []).map((b) => parseInt(b.start_time.split(':')[0], 10))));
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, mode, dateRange, courtId, startDate, endDate]);

  const referenceIsToday = toISODate(startDate) === toISODate(today);
  const nowHour = new Date().getHours();

  function toggleHour(h: number) {
    setSelectedHours((prev) => {
      const next = new Set(prev);
      if (next.has(h)) next.delete(h);
      else next.add(h);
      return next;
    });
  }

  function getBlockHourRange(): { start: number; end: number } {
    if (selectedHours.size === 0) return { start: openHour, end: openHour };
    const vals = [...selectedHours];
    return { start: Math.min(...vals), end: Math.max(...vals) + 1 };
  }

  function buildSummary(): string {
    const reasonLabel = REASON_LABELS[reasonType];
    const dateLabel =
      mode === 'single'
        ? formatDateFull(toISODate(startDate))
        : `${formatDateFull(toISODate(startDate))} – ${formatDateFull(toISODate(endDate))}`;
    let durationLabel: string;
    if (allDay) {
      durationLabel = 'All Day';
    } else {
      const n = selectedHours.size;
      durationLabel = n > 0 ? `${n} hour${n === 1 ? '' : 's'} selected` : 'No hours selected';
    }
    return `${reasonLabel} · ${dateLabel} · ${durationLabel}`;
  }

  async function findConflicts(): Promise<RawBooking[]> {
    const { from, to } = dateRange;
    let query = supabase
      .from('bookings')
      .select('id, user_id, date, start_time, end_time')
      .eq('court_id', courtId)
      .neq('status', 'cancelled');
    query = mode === 'range' ? query.gte('date', from).lte('date', to) : query.eq('date', from);
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []) as RawBooking[];
    if (allDay) return rows;
    const { start, end } = getBlockHourRange();
    return rows.filter((b) => {
      const h = parseInt(b.start_time.split(':')[0], 10);
      return h >= start && h < end;
    });
  }

  async function attachNames(rows: RawBooking[]): Promise<ConflictBooking[]> {
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const { data: profiles } =
      userIds.length > 0
        ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
        : { data: [] as { id: string; full_name: string | null }[] };
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? 'Resident']));
    return rows.map((r) => ({ ...r, residentName: nameMap.get(r.user_id) ?? 'Resident' }));
  }

  async function insertBlockout(): Promise<string | null> {
    const dateISO = toISODate(startDate);
    const endDateISO = mode === 'range' ? toISODate(endDate) : null;

    let startTimeStr: string;
    let endTimeStr: string;
    if (allDay) {
      startTimeStr = `${pad(openHour)}:00`;
      endTimeStr = `${pad(closeHour)}:00`;
    } else {
      const { start, end } = getBlockHourRange();
      startTimeStr = `${pad(start)}:00`;
      endTimeStr = `${pad(end)}:00`;
    }

    const { error } = await supabase.from('court_maintenance').insert({
      court_id: courtId,
      date: dateISO,
      end_date: endDateISO,
      start_time: startTimeStr,
      end_time: endTimeStr,
      blockout_type: reasonType,
      description: note.trim() || null,
    });
    return error ? error.message : null;
  }

  async function handleSavePress() {
    if (mode === 'range' && endDate < startDate) {
      Alert.alert('Invalid Date Range', 'The end date cannot be earlier than the start date.');
      return;
    }
    if (!allDay && selectedHours.size === 0) {
      Alert.alert('Select Hours', 'Choose at least one hour to block, or switch to All Day.');
      return;
    }

    setSaving(true);
    try {
      const conflictRows = await findConflicts();
      if (conflictRows.length > 0) {
        const withNames = await attachNames(conflictRows);
        setConflicts(withNames);
        setSaving(false);
        return;
      }
      const err = await insertBlockout();
      setSaving(false);
      if (err) {
        Alert.alert('Could Not Save Blockout', err);
        return;
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setSaving(false);
      Alert.alert('Could Not Save Blockout', e?.message ?? 'Please try again.');
    }
  }

  function handleGoBack() {
    setConflicts(null);
  }

  async function handleCancelAndContinue() {
    if (!conflicts || conflicts.length === 0 || resolving) return;
    setResolving(true);

    const reasonLabel = REASON_LABELS[reasonType];
    const cancelReasonText = `This amenity is blocked for ${reasonLabel.toLowerCase()}${
      note.trim() ? `: ${note.trim()}` : '.'
    }`;
    const toResolve = conflicts;
    // Clear immediately so a second tap on this button (or a re-render) can
    // never re-fire the cancellation/notification loop for the same rows.
    setConflicts(null);

    for (const c of toResolve) {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled', cancellation_reason: cancelReasonText, cancelled_by: 'admin' })
        .eq('id', c.id);
      if (error) continue;

      await supabase.from('hoa_notifications').insert({
        user_id: c.user_id,
        hoa_id: hoaId,
        title: 'Reservation Cancelled',
        body: `Your reservation for ${courtName} on ${formatDateFull(c.date)} at ${formatTime12h(
          c.start_time,
        )}–${formatTime12h(c.end_time)} was cancelled because ${courtName} is blocked for ${reasonLabel.toLowerCase()}.`,
        type: 'booking_cancellation',
        read: false,
      });

      sendNotificationEmail({
        type: 'booking_cancellation',
        userId: c.user_id,
        courtName,
        date: c.date,
        startTime: c.start_time,
        endTime: c.end_time,
        isAdminCancellation: true,
        cancellationReason: cancelReasonText,
      });
    }

    const err = await insertBlockout();
    setResolving(false);
    if (err) {
      Alert.alert('Could Not Save Blockout', err);
      return;
    }
    onSaved();
    onClose();
  }

  function renderConflictPanel() {
    if (!conflicts) return null;
    return (
      <View>
        <Text style={styles.sectionTitle}>Booking Conflicts Found</Text>
        <Text style={styles.conflictIntro}>
          {conflicts.length} existing reservation{conflicts.length === 1 ? '' : 's'} overlap with this
          blockout. Cancelling them will notify the affected residents.
        </Text>
        {conflicts.map((c) => (
          <View key={c.id} style={styles.conflictRow}>
            <Text style={styles.conflictName}>{c.residentName}</Text>
            <Text style={styles.conflictDetail}>
              {formatDateFull(c.date)} · {formatTime12h(c.start_time)}–{formatTime12h(c.end_time)}
            </Text>
          </View>
        ))}
        <View style={styles.conflictActions}>
          <Button variant="ghost" label="Go Back" onPress={handleGoBack} fullWidth />
          <View style={{ height: 12 }} />
          <Button
            variant="destructive"
            label="Cancel & Continue"
            onPress={handleCancelAndContinue}
            loading={resolving}
            fullWidth
          />
        </View>
      </View>
    );
  }

  function renderForm() {
    return (
      <View>
        <View style={styles.segmented}>
          <TouchableOpacity
            style={[styles.segmentBtn, mode === 'single' && styles.segmentBtnActive]}
            onPress={() => setMode('single')}
            activeOpacity={0.8}>
            <Text style={[styles.segmentLabel, mode === 'single' && styles.segmentLabelActive]}>
              Single Day
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, mode === 'range' && styles.segmentBtnActive]}
            onPress={() => setMode('range')}
            activeOpacity={0.8}>
            <Text style={[styles.segmentLabel, mode === 'range' && styles.segmentLabelActive]}>
              Date Range
            </Text>
          </TouchableOpacity>
        </View>

        {mode === 'single' ? (
          <>
            <Text style={styles.fieldLabel}>DATE</Text>
            <CalendarPicker
              selectedDate={startDate}
              onSelect={(d) => {
                setStartDate(d);
                if (endDate < d) setEndDate(d);
              }}
              minDate={today}
              maxDate={maxDate}
              theme={theme}
            />
          </>
        ) : (
          <>
            <Text style={styles.fieldLabel}>DATE RANGE</Text>
            <View style={styles.dateChipsRow}>
              <TouchableOpacity
                style={[styles.dateChip, activeField === 'start' && styles.dateChipActive]}
                onPress={() => setActiveField('start')}
                activeOpacity={0.8}>
                <Text style={styles.dateChipLabel}>START</Text>
                <Text style={styles.dateChipValue}>{formatDateFull(toISODate(startDate))}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dateChip, activeField === 'end' && styles.dateChipActive]}
                onPress={() => setActiveField('end')}
                activeOpacity={0.8}>
                <Text style={styles.dateChipLabel}>END</Text>
                <Text style={styles.dateChipValue}>{formatDateFull(toISODate(endDate))}</Text>
              </TouchableOpacity>
            </View>
            <CalendarPicker
              selectedDate={activeField === 'start' ? startDate : endDate}
              onSelect={(d) => {
                if (activeField === 'start') {
                  setStartDate(d);
                  if (endDate < d) setEndDate(d);
                } else {
                  setEndDate(d);
                }
              }}
              minDate={activeField === 'start' ? today : startDate}
              maxDate={maxDate}
              theme={theme}
            />
          </>
        )}

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>All Day</Text>
          <Switch
            value={allDay}
            onValueChange={setAllDay}
            trackColor={{ false: theme.border, true: Colors.blue }}
          />
        </View>

        {!allDay && (
          <>
            <Text style={styles.fieldLabel}>HOURS TO BLOCK</Text>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.legendDotBooked]} />
                <Text style={styles.legendLabel}>Booked</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.legendDotSelected]} />
                <Text style={styles.legendLabel}>Selected</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.legendDotPast]} />
                <Text style={styles.legendLabel}>Past</Text>
              </View>
            </View>
            <View style={styles.hourGrid}>
              {hours.map((h) => {
                const isBooked = bookedHours.has(h);
                const isSelected = selectedHours.has(h);
                const isPast = referenceIsToday && nowHour >= h + 1;
                return (
                  <TouchableOpacity
                    key={h}
                    disabled={isPast}
                    onPress={() => toggleHour(h)}
                    activeOpacity={0.75}
                    style={[
                      styles.hourCell,
                      isBooked && !isSelected && styles.hourCellBooked,
                      isSelected && styles.hourCellSelected,
                      isPast && styles.hourCellPast,
                    ]}>
                    <Text
                      style={[
                        styles.hourCellText,
                        isBooked && !isSelected && styles.hourCellTextBooked,
                        isSelected && styles.hourCellTextSelected,
                        isPast && styles.hourCellTextPast,
                      ]}>
                      {formatTime12h(`${pad(h)}:00`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        <Text style={styles.fieldLabel}>REASON</Text>
        <View style={styles.typeGrid}>
          {REASON_TYPES.map((rt) => (
            <TouchableOpacity
              key={rt.value}
              style={[styles.typePill, reasonType === rt.value && styles.typePillActive]}
              onPress={() => setReasonType(rt.value)}
              activeOpacity={0.8}>
              <Text style={[styles.typePillLabel, reasonType === rt.value && styles.typePillLabelActive]}>
                {rt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>NOTE (OPTIONAL)</Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          value={note}
          onChangeText={setNote}
          placeholder="Additional details for residents or staff"
          placeholderTextColor={theme.textMuted}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>{buildSummary()}</Text>
        </View>

        <View style={styles.modalActions}>
          <Button variant="primary" label="Save Blockout" onPress={handleSavePress} loading={saving} fullWidth />
        </View>
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle} numberOfLines={1}>
            Block Out {courtName}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X color={theme.textMuted} size={22} strokeWidth={1.5} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.modalScroll}
          contentContainerStyle={styles.modalContent}
          keyboardShouldPersistTaps="handled">
          {conflicts ? renderConflictPanel() : renderForm()}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(
    () =>
      StyleSheet.create({
        modal: { flex: 1, backgroundColor: theme.cardBg },
        modalHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: Spacing.pagePx,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        },
        modalTitle: {
          fontFamily: FontFamily.manropeExtraBold,
          fontSize: FontSize.sectionTitle,
          color: theme.textPrimary,
          flex: 1,
          marginRight: 12,
        },
        modalScroll: { flex: 1 },
        modalContent: {
          padding: Spacing.pagePx,
          paddingBottom: 40,
        },

        sectionTitle: {
          fontFamily: FontFamily.manropeExtraBold,
          fontSize: FontSize.cardTitle,
          color: theme.textPrimary,
          marginBottom: 12,
        },
        fieldLabel: {
          fontFamily: FontFamily.jetbrainsMonoSemiBold,
          fontSize: FontSize.metadata,
          color: theme.textMuted,
          letterSpacing: 1.2,
          marginBottom: 8,
          marginTop: 16,
        },

        segmented: {
          flexDirection: 'row',
          backgroundColor: theme.surface2,
          borderRadius: Radius.chip,
          borderWidth: 1,
          borderColor: theme.border,
          padding: 4,
          marginTop: 4,
        },
        segmentBtn: {
          flex: 1,
          paddingVertical: 10,
          alignItems: 'center',
          borderRadius: Radius.chip - 2,
        },
        segmentBtnActive: { backgroundColor: Colors.blue },
        segmentLabel: {
          fontFamily: FontFamily.manropeSemiBold,
          fontSize: FontSize.uiLabel,
          color: theme.textMuted,
        },
        segmentLabelActive: { color: Colors.white },

        dateChipsRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
        dateChip: {
          flex: 1,
          borderRadius: Radius.card,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.cardBg,
          padding: 12,
        },
        dateChipActive: { borderColor: Colors.blue, backgroundColor: theme.selectedBg },
        dateChipLabel: {
          fontFamily: FontFamily.jetbrainsMonoSemiBold,
          fontSize: FontSize.min,
          color: theme.textMuted,
          letterSpacing: 1,
          marginBottom: 4,
        },
        dateChipValue: {
          fontFamily: FontFamily.manropeBold,
          fontSize: FontSize.uiLabel,
          color: theme.textPrimary,
        },

        switchRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 20,
          paddingTop: 16,
          borderTopWidth: 1,
          borderTopColor: theme.border,
        },
        switchLabel: {
          fontFamily: FontFamily.manropeSemiBold,
          fontSize: FontSize.uiLabel,
          color: theme.textPrimary,
        },

        legendRow: { flexDirection: 'row', gap: 16, marginBottom: 10 },
        legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
        legendDot: { width: 10, height: 10, borderRadius: 3 },
        legendDotBooked: { backgroundColor: theme.surface2, borderWidth: 1.5, borderColor: theme.borderStrong },
        legendDotSelected: { backgroundColor: 'rgba(255,92,107,0.18)', borderWidth: 1.5, borderColor: Colors.negative },
        legendDotPast: { backgroundColor: theme.surface2, borderWidth: 1.5, borderColor: theme.border, opacity: 0.4 },
        legendLabel: {
          fontFamily: FontFamily.manropeMedium,
          fontSize: FontSize.min,
          color: theme.textMuted,
        },

        hourGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
        hourCell: {
          width: '31%',
          paddingVertical: 12,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: Radius.sm,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.cardBg,
        },
        hourCellBooked: {
          backgroundColor: theme.surface2,
          borderColor: theme.borderStrong,
        },
        hourCellSelected: {
          backgroundColor: 'rgba(255,92,107,0.18)',
          borderColor: Colors.negative,
        },
        hourCellPast: {
          opacity: 0.35,
        },
        hourCellText: {
          fontFamily: FontFamily.jetbrainsMonoSemiBold,
          fontSize: FontSize.min,
          color: theme.textPrimary,
        },
        hourCellTextBooked: { color: theme.textMuted },
        hourCellTextSelected: { color: Colors.negative },
        hourCellTextPast: { color: theme.textMuted },

        typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
        typePill: {
          borderRadius: Radius.pill,
          borderWidth: 1,
          borderColor: theme.border,
          paddingHorizontal: 16,
          paddingVertical: 8,
          backgroundColor: theme.cardBg,
        },
        typePillActive: {
          backgroundColor: Colors.blue,
          borderColor: Colors.blue,
        },
        typePillLabel: {
          fontFamily: FontFamily.manropeSemiBold,
          fontSize: FontSize.uiLabel,
          color: theme.textMuted,
        },
        typePillLabelActive: { color: Colors.white },

        textInput: {
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: Radius.input,
          padding: 14,
          fontFamily: FontFamily.manropeMedium,
          fontSize: FontSize.body,
          color: theme.textPrimary,
          backgroundColor: theme.pageBg,
        },
        textArea: { minHeight: 72 },

        summaryBox: {
          marginTop: 20,
          borderRadius: Radius.card,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.surface2,
          padding: 14,
        },
        summaryText: {
          fontFamily: FontFamily.manropeSemiBold,
          fontSize: FontSize.uiLabel,
          color: theme.textPrimary,
        },

        modalActions: { marginTop: 24 },

        conflictIntro: {
          fontFamily: FontFamily.manropeMedium,
          fontSize: FontSize.body,
          color: theme.textSecondary,
          lineHeight: 22,
          marginBottom: 16,
        },
        conflictRow: {
          borderRadius: Radius.card,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.cardBg,
          padding: 14,
          marginBottom: 10,
        },
        conflictName: {
          fontFamily: FontFamily.manropeBold,
          fontSize: FontSize.uiLabel,
          color: theme.textPrimary,
        },
        conflictDetail: {
          fontFamily: FontFamily.jetbrainsMonoSemiBold,
          fontSize: FontSize.metadata,
          color: theme.textMuted,
          marginTop: 4,
        },
        conflictActions: { marginTop: 12 },
      }),
    [theme],
  );
}
