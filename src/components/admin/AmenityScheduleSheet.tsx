import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AlertTriangle, Ban, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Clock, Minus, Plus, Trash2, X,
} from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errors';
import { db } from '@/lib/untypedDb';
import { platformAlert } from '@/lib/platformAlert';
import { communityToday } from '@/lib/communityTime';
import { formatDateFull } from '@/lib/format';
import {
  buildSlots, formatMinutes, isSelectable, minutesToTime, SLOT_STATE_LABEL, selectionRange, toMinutes,
  validateBlockout, type ScheduleBlockout, type ScheduleBooking, type Slot, type SlotState,
} from '@/lib/adminSchedule';
import { A } from '@/constants/adminTheme';
import { FontFamily } from '@/constants/design';
import { lightTheme } from '@/constants/theme-tokens';
import { CalendarPicker } from '@/components/ui/CalendarPicker';
import { Button, Card, Chip, ChipRow, Pill, StatusBadge } from '@/components/admin/kit';

interface Props {
  visible: boolean;
  onClose: () => void;
  court: { id: string; name: string; hoa_id: string } | null;
  openTime?: string | null;
  closeTime?: string | null;
  /** Called after any change that affects availability (blockout created/edited/removed). */
  onChanged: () => void;
}

type Step = 'schedule' | 'form' | 'confirm' | 'reservation' | 'blockout';

interface Conflict {
  booking_id: string; resident_id: string; resident_name: string;
  booking_date: string; slot_start: string; slot_end: string; booking_status: string;
}
interface BlockoutRow extends ScheduleBlockout {
  date: string; end_date: string | null; resident_message: string | null;
}

const REASON_TYPES = [
  { value: 'maintenance', label: 'Court maintenance' },
  { value: 'private_event', label: 'Private event' },
  { value: 'closure', label: 'Closure' },
  { value: 'other', label: 'Other' },
] as const;

const SLOT_STYLE: Record<SlotState, { bg: string; border: string; fg: string; Icon: typeof Clock }> = {
  available: { bg: A.surface, border: A.border, fg: A.textSecondary, Icon: CheckCircle2 },
  reserved: { bg: A.infoBg, border: '#C5D6FF', fg: A.infoText, Icon: CalendarClock },
  pending: { bg: A.warningBg, border: '#F5DDA0', fg: A.warningText, Icon: Clock },
  blocked: { bg: A.errorBg, border: '#F6C3C9', fg: A.errorText, Icon: Ban },
  past: { bg: A.disabledBg, border: A.border, fg: A.textMuted, Icon: Clock },
};

type RpcResult = { data: unknown; error: { message: string; code?: string; details?: string } | null };
const rpc = db.rpc.bind(db) as unknown as (fn: string, args: Record<string, unknown>) => Promise<RpcResult>;

function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}
const isoToDate = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const dateToIso = (dt: Date) =>
  `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

function friendlyRpcError(e: { message: string; code?: string }): string {
  if (e.code === '42883' || e.code === 'PGRST202' || /Could not find the function/i.test(e.message)) {
    return 'Blockout scheduling needs the latest database update (migration 20261013110000) before it can be used.';
  }
  return e.message;
}

export function AmenityScheduleSheet({ visible, onClose, court, openTime, closeTime, onChanged }: Props) {
  const insets = useSafeAreaInsets();
  const today = communityToday();
  const [date, setDate] = useState(today);
  const [step, setStep] = useState<Step>('schedule');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bookings, setBookings] = useState<ScheduleBooking[]>([]);
  const [blockouts, setBlockouts] = useState<BlockoutRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [banner, setBanner] = useState<string | null>(null);

  // Form state
  const [startMin, setStartMin] = useState(0);
  const [endMin, setEndMin] = useState(0);
  const [multiDay, setMultiDay] = useState(false);
  const [endDate, setEndDate] = useState(today);
  const [reasonType, setReasonType] = useState<(typeof REASON_TYPES)[number]['value']>('maintenance');
  const [reason, setReason] = useState('');
  const [residentMessage, setResidentMessage] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Confirm state
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [cancelReason, setCancelReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Detail state
  const [detailBooking, setDetailBooking] = useState<ScheduleBooking | null>(null);
  const [detailBlockout, setDetailBlockout] = useState<BlockoutRow | null>(null);
  const [editReason, setEditReason] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [detailBusy, setDetailBusy] = useState(false);

  const openMin = openTime ? toMinutes(openTime) : 6 * 60;
  const closeMin = closeTime ? toMinutes(closeTime) : 22 * 60;

  const nowMinutes = useMemo(() => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Puerto_Rico', hourCycle: 'h23', hour: '2-digit', minute: '2-digit',
    }).formatToParts(new Date());
    return Number(parts.find((p) => p.type === 'hour')?.value ?? 0) * 60 + Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, visible, bookings, blockouts]);

  const slots: Slot[] = useMemo(
    () => buildSlots({ date, today, nowMinutes, openMin, closeMin, bookings, blockouts }),
    [date, today, nowMinutes, openMin, closeMin, bookings, blockouts],
  );

  const courtId = court?.id;
  const load = useCallback(async () => {
    if (!courtId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [bRes, mRes] = await Promise.all([
        supabase.from('bookings')
          .select('id, user_id, start_time, end_time, status, play_type')
          .eq('court_id', courtId).eq('date', date).in('status', ['confirmed', 'pending']),
        db.from('court_maintenance')
          .select('*')
          .eq('court_id', courtId).lte('date', date)
          .or(`end_date.gte.${date},and(end_date.is.null,date.eq.${date})`),
      ]);
      if (bRes.error) throw bRes.error;
      if (mRes.error) throw mRes.error;
      const rows = bRes.data ?? [];
      const ids = [...new Set(rows.map((r) => r.user_id))];
      const { data: people, error: pErr } = ids.length
        ? await supabase.from('profiles').select('id, full_name').in('id', ids)
        : { data: [], error: null };
      if (pErr) throw pErr;
      const names = new Map((people ?? []).map((p) => [p.id, p.full_name as string | null]));
      setBookings(rows.map((r) => ({
        id: r.id, userId: r.user_id, residentName: names.get(r.user_id)?.trim() || 'Resident',
        startTime: r.start_time, endTime: r.end_time, status: r.status ?? 'confirmed', playType: r.play_type,
      })));
      setBlockouts((mRes.data ?? []).map((m) => ({
        id: m.id, date: m.date, end_date: m.end_date, startTime: m.start_time, endTime: m.end_time,
        description: m.description, blockoutType: m.blockout_type, resident_message: (m as { resident_message?: string | null }).resident_message ?? null,
      })));
    } catch (e) {
      setLoadError(errorMessage(e, 'Could not load the schedule.'));
    } finally {
      setLoading(false);
    }
  }, [courtId, date]);

  useEffect(() => { if (visible) load(); }, [visible, load]);

  // Reset when (re)opened for an amenity.
  useEffect(() => {
    if (!visible) return;
    setStep('schedule'); setSelected(new Set()); setBanner(null); setDate(communityToday());
  }, [visible, courtId]);

  // Keep the grid honest if a resident books/cancels (or another admin blocks) while it is open.
  useEffect(() => {
    if (!visible || !courtId) return;
    const channel = supabase.channel(`admin-schedule-${courtId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `court_id=eq.${courtId}` }, () => { load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'court_maintenance', filter: `court_id=eq.${courtId}` }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [visible, courtId, load]);

  if (!court) return null;

  function changeDate(next: string) {
    setDate(next); setSelected(new Set()); setBanner(null);
  }

  function onSlotPress(slot: Slot) {
    if (slot.state === 'past' || loadError) return;
    if (slot.state === 'blocked') {
      const b = blockouts.find((x) => x.id === slot.blockouts[0].id) ?? null;
      setDetailBlockout(b);
      setEditReason(b?.description ?? ''); setEditMessage(b?.resident_message ?? ''); setEditNotes('');
      if (b) {
        db.from('court_maintenance_private').select('internal_notes').eq('blockout_id', b.id).maybeSingle()
          .then(({ data }) => setEditNotes(data?.internal_notes ?? ''));
      }
      setStep('blockout');
      return;
    }
    if (slot.state === 'reserved' || slot.state === 'pending') {
      setDetailBooking(slot.bookings[0]);
      setStep('reservation');
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slot.startMin)) next.delete(slot.startMin); else next.add(slot.startMin);
      return next;
    });
  }

  function openForm(range: { start: number; end: number }, prefill?: string) {
    setStartMin(range.start); setEndMin(range.end);
    setMultiDay(false); setEndDate(date);
    setReasonType('maintenance'); setReason(prefill ?? ''); setResidentMessage(''); setInternalNotes('');
    setFormError(null); setConflicts([]); setCancelReason('');
    setStep('form');
  }

  async function goToConfirm() {
    const err = validateBlockout({
      date, endDate: multiDay ? endDate : null, startMin, endMin, reason, today,
    });
    if (err) { setFormError(err); return; }
    setFormError(null);
    setSubmitting(true);
    const { data, error } = await rpc('admin_blockout_conflicts', {
      p_court_id: court!.id, p_date: date, p_end_date: multiDay ? endDate : date,
      p_start_time: minutesToTime(startMin), p_end_time: minutesToTime(endMin),
    });
    setSubmitting(false);
    if (error) { setFormError(friendlyRpcError(error)); return; }
    const list = (data ?? []) as Conflict[];
    setConflicts(list);
    setCancelReason((prev) => prev || `Amenity unavailable: ${reason.trim()}`);
    setStep('confirm');
  }

  async function submitBlockout() {
    if (submitting) return;
    if (conflicts.length > 0 && !cancelReason.trim()) {
      setFormError('Enter the reason residents will see for the cancellation.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const typeLabel = REASON_TYPES.find((t) => t.value === reasonType)?.label ?? 'Blockout';
    const { data, error } = await rpc('admin_create_blockout', {
      p_court_id: court!.id, p_date: date, p_end_date: multiDay ? endDate : date,
      p_start_time: minutesToTime(startMin), p_end_time: minutesToTime(endMin),
      p_reason: reason.trim(), p_blockout_type: reasonType,
      p_resident_message: residentMessage.trim() || null, p_internal_notes: internalNotes.trim() || null,
      p_cancel_booking_ids: conflicts.map((c) => c.booking_id),
      p_cancellation_reason: conflicts.length ? cancelReason.trim() : null,
    });
    setSubmitting(false);
    if (error) {
      if (/BLOCKOUT_CONFLICTS/.test(error.message)) {
        // New reservations appeared since the preview. Re-list every conflict and ask again.
        setFormError('New reservations were added for this time. Review the updated list and confirm again.');
        const refreshed = await rpc('admin_blockout_conflicts', {
          p_court_id: court!.id, p_date: date, p_end_date: multiDay ? endDate : date,
          p_start_time: minutesToTime(startMin), p_end_time: minutesToTime(endMin),
        });
        if (!refreshed.error) setConflicts((refreshed.data ?? []) as Conflict[]);
        return;
      }
      setFormError(friendlyRpcError(error));
      return;
    }
    const cancelled = (data as { cancelled_count?: number } | null)?.cancelled_count ?? 0;
    setBanner(`${typeLabel} blockout created${cancelled ? `; ${cancelled} reservation${cancelled === 1 ? '' : 's'} cancelled and residents notified in the app` : ''}.`);
    setSelected(new Set());
    setStep('schedule');
    await load();
    onChanged();
  }

  async function saveBlockoutEdits() {
    if (!detailBlockout || detailBusy) return;
    if (!editReason.trim()) { platformAlert('Reason required', 'Enter a reason for this blockout.'); return; }
    setDetailBusy(true);
    const { data, error } = await db.from('court_maintenance')
      .update({ description: editReason.trim(), resident_message: editMessage.trim() || null })
      .eq('id', detailBlockout.id).select('id');
    if (error || !data?.length) {
      setDetailBusy(false);
      platformAlert('Could not save', error?.message ?? 'You do not have permission to edit this blockout.');
      return;
    }
    const { error: nErr } = await db.from('court_maintenance_private')
      .upsert({ blockout_id: detailBlockout.id, internal_notes: editNotes.trim() || null, updated_at: new Date().toISOString() });
    setDetailBusy(false);
    if (nErr) { platformAlert('Blockout saved, notes not saved', nErr.message); return; }
    setBanner('Blockout updated.');
    setStep('schedule');
    await load();
    onChanged();
  }

  function confirmRemoveBlockout() {
    if (!detailBlockout) return;
    platformAlert(
      'Remove this blockout?',
      'Residents will be able to book this time again. Reservations that were cancelled because of it stay cancelled.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Remove blockout', style: 'destructive',
          onPress: async () => {
            setDetailBusy(true);
            const { data, error } = await db.from('court_maintenance').delete().eq('id', detailBlockout.id).select('id');
            setDetailBusy(false);
            if (error || !data?.length) {
              platformAlert('Could not remove', error?.message ?? 'You do not have permission to remove this blockout.');
              return;
            }
            setBanner('Blockout removed. The time is available again.');
            setStep('schedule');
            await load();
            onChanged();
          },
        },
      ],
    );
  }

  const range = selectionRange(slots, selected);
  const title = court.name;
  const back = () => { setFormError(null); setStep(step === 'confirm' ? 'form' : 'schedule'); };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={step === 'schedule' ? onClose : back}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: A.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.header}>
          <Pressable
            onPress={step === 'schedule' ? onClose : back}
            hitSlop={8} style={s.headerBtn} accessibilityRole="button"
            accessibilityLabel={step === 'schedule' ? 'Close schedule' : 'Back'}>
            {step === 'schedule' ? <X size={22} color={A.text} /> : <ChevronLeft size={24} color={A.text} />}
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle} numberOfLines={1} accessibilityRole="header">
              {step === 'form' ? 'New blockout' : step === 'confirm' ? 'Confirm blockout' : step === 'reservation' ? 'Reservation'
                : step === 'blockout' ? 'Blockout details' : `${title} schedule`}
            </Text>
            <Text style={s.headerSub} numberOfLines={1}>{title}</Text>
          </View>
        </View>

        {step === 'schedule' && (
          <>
            <View style={s.dateBar}>
              <Pressable onPress={() => changeDate(shiftDate(date, -1))} style={s.headerBtn} accessibilityRole="button" accessibilityLabel="Previous day">
                <ChevronLeft size={22} color={A.text} />
              </Pressable>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={s.dateText} testID="schedule-date">{formatDateFull(date)}</Text>
                {date !== today ? (
                  <Pressable onPress={() => changeDate(today)} accessibilityRole="button"><Text style={s.todayLink}>Jump to today</Text></Pressable>
                ) : <Text style={s.todayLabel}>Today</Text>}
              </View>
              <Pressable onPress={() => changeDate(shiftDate(date, 1))} style={s.headerBtn} accessibilityRole="button" accessibilityLabel="Next day">
                <ChevronRight size={22} color={A.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
              {banner ? (
                <Card style={{ backgroundColor: A.successBg, borderColor: '#BFE8D2' }}>
                  <Text style={[s.body, { color: A.successText }]} testID="schedule-banner">{banner}</Text>
                </Card>
              ) : null}

              <Legend />

              {loadError ? <Card><Text style={[s.body, { color: A.errorText }]}>{loadError}</Text><View style={{ marginTop: 8 }}><Button label="Try again" variant="secondary" onPress={load} /></View></Card> : null}

              {/* Never draw an all-available grid when the data behind it failed to load. */}
              {loadError ? null : slots.map((slot) => {
                const st = SLOT_STYLE[slot.state];
                const isSel = selected.has(slot.startMin);
                const label = `${formatMinutes(slot.startMin)} to ${formatMinutes(slot.endMin)}, ${SLOT_STATE_LABEL[slot.state]}`;
                const detail = slot.state === 'blocked'
                  ? slot.blockouts[0].description || 'Blocked out'
                  : slot.bookings.length ? slot.bookings.map((b) => b.residentName).join(', ') : null;
                return (
                  <Pressable
                    key={slot.startMin}
                    testID={`slot-${slot.startMin}`}
                    onPress={() => onSlotPress(slot)}
                    disabled={slot.state === 'past'}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    accessibilityState={{ selected: isSel, disabled: slot.state === 'past' }}
                    style={[s.slot, { backgroundColor: isSel ? A.infoBg : st.bg, borderColor: isSel ? A.primary : st.border }, isSel && { borderWidth: 2 }]}>
                    <Text style={[s.slotTime, slot.state === 'past' && { color: A.textMuted }]}>{formatMinutes(slot.startMin)}</Text>
                    <View style={{ flex: 1 }}>
                      <View style={s.slotState}>
                        <st.Icon size={16} color={isSel ? A.primary : st.fg} strokeWidth={2} />
                        <Text style={[s.slotStateText, { color: isSel ? A.primary : st.fg }]}>
                          {isSel ? 'Selected to block' : SLOT_STATE_LABEL[slot.state]}
                        </Text>
                      </View>
                      {detail ? <Text style={s.slotDetail} numberOfLines={1}>{detail}</Text> : null}
                    </View>
                    {slot.state === 'available' && !isSel ? <Plus size={18} color={A.textMuted} /> : null}
                  </Pressable>
                );
              })}
              {loading && slots.length === 0 ? <Text style={s.body}>Loading…</Text> : null}
            </ScrollView>

            <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              {range ? (
                <Button
                  testID="block-selected"
                  label={`Block ${formatMinutes(range.start)} – ${formatMinutes(range.end)}`}
                  Icon={Ban}
                  onPress={() => openForm(range)}
                />
              ) : (
                <Text style={[s.body, { textAlign: 'center', color: A.textSecondary }]}>
                  Tap available times to block them, or tap a reservation to cancel it and block the slot.
                </Text>
              )}
            </View>
          </>
        )}

        {step === 'form' && (
          <>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
              <Card style={{ gap: 12 }}>
                <Text style={s.sectionTitle}>When</Text>
                <Text style={s.body}>{formatDateFull(date)}{multiDay ? ` – ${formatDateFull(endDate)}` : ''}</Text>
                <Stepper label="Start" value={formatMinutes(startMin)} onMinus={() => setStartMin((v) => Math.max(openMin, v - 30))} onPlus={() => setStartMin((v) => Math.min(endMin - 30, v + 30))} />
                <Stepper label="End" value={formatMinutes(endMin)} onMinus={() => setEndMin((v) => Math.max(startMin + 30, v - 30))} onPlus={() => setEndMin((v) => Math.min(closeMin, v + 30))} />
                <Chip label={multiDay ? 'Multiple days: on' : 'Block multiple days'} selected={multiDay} onPress={() => { setMultiDay((v) => !v); setEndDate(date); }} />
                {multiDay ? (
                  <View>
                    <Text style={s.label}>Through (same hours each day)</Text>
                    <CalendarPicker
                      selectedDate={isoToDate(endDate)}
                      onSelect={(d) => setEndDate(dateToIso(d))}
                      minDate={isoToDate(date)}
                      maxDate={isoToDate(shiftDate(date, 365))}
                      theme={lightTheme}
                    />
                  </View>
                ) : null}
              </Card>

              <Card style={{ gap: 10 }}>
                <Text style={s.sectionTitle}>Why</Text>
                <ChipRow>
                  {REASON_TYPES.map((t) => (
                    <Chip key={t.value} label={t.label} selected={reasonType === t.value} onPress={() => setReasonType(t.value)} />
                  ))}
                </ChipRow>
                <Text style={s.label}>Reason (shown to residents)</Text>
                <TextInput testID="blockout-reason" value={reason} onChangeText={setReason} placeholder="e.g. Resurfacing the court"
                  placeholderTextColor={A.textMuted} style={s.input} accessibilityLabel="Reason" />
                <Text style={s.label}>Extra message for residents (optional)</Text>
                <TextInput value={residentMessage} onChangeText={setResidentMessage} multiline placeholder="Anything residents should know"
                  placeholderTextColor={A.textMuted} style={[s.input, { minHeight: 72 }]} accessibilityLabel="Message for residents" />
                <Text style={s.label}>Internal notes (admins only)</Text>
                <TextInput value={internalNotes} onChangeText={setInternalNotes} multiline placeholder="Vendor, cost, access details…"
                  placeholderTextColor={A.textMuted} style={[s.input, { minHeight: 72 }]} accessibilityLabel="Internal notes" />
              </Card>
              {formError ? <Text style={[s.body, { color: A.errorText }]} accessibilityLiveRegion="polite">{formError}</Text> : null}
            </ScrollView>
            <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <Button testID="review-blockout" label="Review blockout" onPress={goToConfirm} loading={submitting} />
            </View>
          </>
        )}

        {step === 'confirm' && (
          <>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
              <Card style={{ gap: 6 }}>
                <Text style={s.sectionTitle}>Blockout summary</Text>
                <Text style={s.body}>{court.name}</Text>
                <Text style={s.body}>{formatDateFull(date)}{multiDay ? ` – ${formatDateFull(endDate)}` : ''}</Text>
                <Text style={s.body}>{formatMinutes(startMin)} – {formatMinutes(endMin)}{multiDay ? ' each day' : ''}</Text>
                <Text style={[s.body, { fontFamily: FontFamily.manropeBold }]}>{reason.trim()}</Text>
              </Card>

              {conflicts.length > 0 ? (
                <Card style={{ gap: 10, borderColor: '#F6C3C9' }}>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <AlertTriangle size={20} color={A.errorText} />
                    <Text style={[s.sectionTitle, { color: A.errorText, flex: 1 }]}>
                      {conflicts.length} reservation{conflicts.length === 1 ? '' : 's'} will be cancelled
                    </Text>
                  </View>
                  {conflicts.map((c) => (
                    <View key={c.booking_id} style={s.conflictRow} testID="conflict-row">
                      <View style={{ flex: 1 }}>
                        <Text style={[s.body, { fontFamily: FontFamily.manropeBold }]}>{c.resident_name}</Text>
                        <Text style={s.meta}>{formatDateFull(c.booking_date)} · {formatMinutes(toMinutes(c.slot_start))} – {formatMinutes(toMinutes(c.slot_end))}</Text>
                      </View>
                      <StatusBadge status={c.booking_status} />
                    </View>
                  ))}
                  <Text style={s.label}>Cancellation reason (residents will see this)</Text>
                  <TextInput testID="cancel-reason" value={cancelReason} onChangeText={setCancelReason} multiline
                    style={[s.input, { minHeight: 72 }]} placeholderTextColor={A.textMuted} accessibilityLabel="Cancellation reason" />
                  <Text style={s.meta}>Each affected resident gets an in-app notification and their reservation shows as cancelled with this reason. Reservation history is kept.</Text>
                </Card>
              ) : (
                <Card><Text style={s.body}>No reservations overlap this time. Residents will not be able to book it.</Text></Card>
              )}
              {formError ? <Text style={[s.body, { color: A.errorText }]} accessibilityLiveRegion="polite">{formError}</Text> : null}
            </ScrollView>
            <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <Button
                testID="confirm-blockout"
                variant={conflicts.length ? 'danger' : 'primary'}
                label={conflicts.length ? `Cancel ${conflicts.length} reservation${conflicts.length === 1 ? '' : 's'} & block` : 'Create blockout'}
                onPress={submitBlockout}
                loading={submitting}
              />
            </View>
          </>
        )}

        {step === 'reservation' && detailBooking && (
          <>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
              <Card style={{ gap: 8 }}>
                <StatusBadge status={detailBooking.status} />
                <Text style={s.detailTitle}>{detailBooking.residentName}</Text>
                <Text style={s.body}>{formatDateFull(date)}</Text>
                <Text style={s.body}>{formatMinutes(toMinutes(detailBooking.startTime))} – {formatMinutes(toMinutes(detailBooking.endTime))}</Text>
                <Text style={s.meta}>{court.name}{detailBooking.playType ? ` · ${detailBooking.playType}` : ''}</Text>
              </Card>
              <Card style={{ gap: 6 }}>
                <Text style={s.body}>
                  To make this time unavailable, cancel the reservation and block the slot. You will review every affected
                  reservation and enter a reason before anything changes.
                </Text>
              </Card>
            </ScrollView>
            <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <Button
                testID="cancel-and-block"
                variant="danger"
                label="Cancel Reservation & Block Slot"
                Icon={Ban}
                onPress={() => openForm({ start: toMinutes(detailBooking.startTime), end: toMinutes(detailBooking.endTime) })}
              />
            </View>
          </>
        )}

        {step === 'blockout' && detailBlockout && (
          <>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
              <Card style={{ gap: 6 }}>
                <Pill tone="error" label="BLOCKED OUT" Icon={Ban} />
                <Text style={s.body}>
                  {formatDateFull(detailBlockout.date)}{detailBlockout.end_date ? ` – ${formatDateFull(detailBlockout.end_date)}` : ''}
                </Text>
                <Text style={s.body}>{formatMinutes(toMinutes(detailBlockout.startTime))} – {formatMinutes(toMinutes(detailBlockout.endTime))}</Text>
                <Text style={s.meta}>{(detailBlockout.blockoutType ?? 'maintenance').replace('_', ' ')}</Text>
              </Card>
              <Card style={{ gap: 8 }}>
                <Text style={s.label}>Reason (shown to residents)</Text>
                <TextInput value={editReason} onChangeText={setEditReason} style={s.input} placeholderTextColor={A.textMuted} accessibilityLabel="Reason" />
                <Text style={s.label}>Message for residents</Text>
                <TextInput value={editMessage} onChangeText={setEditMessage} multiline style={[s.input, { minHeight: 64 }]} placeholderTextColor={A.textMuted} accessibilityLabel="Message for residents" />
                <Text style={s.label}>Internal notes (admins only)</Text>
                <TextInput value={editNotes} onChangeText={setEditNotes} multiline style={[s.input, { minHeight: 64 }]} placeholderTextColor={A.textMuted} accessibilityLabel="Internal notes" />
                <Text style={s.meta}>To change the time range, remove this blockout and create a new one.</Text>
              </Card>
            </ScrollView>
            <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}><Button testID="remove-blockout" variant="secondary" label="Remove" Icon={Trash2} onPress={confirmRemoveBlockout} disabled={detailBusy} /></View>
                <View style={{ flex: 1 }}><Button testID="save-blockout" label="Save" onPress={saveBlockoutEdits} loading={detailBusy} /></View>
              </View>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Legend() {
  const items: SlotState[] = ['available', 'reserved', 'pending', 'blocked', 'past'];
  return (
    <View style={s.legend} accessibilityLabel="Legend">
      {items.map((k) => {
        const st = SLOT_STYLE[k];
        return (
          <View key={k} style={s.legendItem}>
            <View style={[s.swatch, { backgroundColor: st.bg, borderColor: k === 'available' ? A.borderStrong : st.border }]}>
              <st.Icon size={10} color={st.fg} />
            </View>
            <Text style={s.legendText}>{SLOT_STATE_LABEL[k]}</Text>
          </View>
        );
      })}
    </View>
  );
}

function Stepper({ label, value, onMinus, onPlus }: { label: string; value: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <View style={s.stepper}>
      <Text style={[s.label, { width: 52 }]}>{label}</Text>
      <Pressable onPress={onMinus} style={s.stepBtn} accessibilityRole="button" accessibilityLabel={`${label} earlier by 30 minutes`}><Minus size={18} color={A.text} /></Pressable>
      <Text style={s.stepValue}>{value}</Text>
      <Pressable onPress={onPlus} style={s.stepBtn} accessibilityRole="button" accessibilityLabel={`${label} later by 30 minutes`}><Plus size={18} color={A.text} /></Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 8,
    backgroundColor: A.surface, borderBottomWidth: 1, borderBottomColor: A.border,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 18, color: A.text },
  headerSub: { fontFamily: FontFamily.manropeMedium, fontSize: 13, color: A.textMuted },
  dateBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, backgroundColor: A.surface, borderBottomWidth: 1, borderBottomColor: A.border },
  dateText: { fontFamily: FontFamily.manropeBold, fontSize: 16, color: A.text },
  todayLabel: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 11, color: A.accent, letterSpacing: 0.5 },
  todayLink: { fontFamily: FontFamily.manropeBold, fontSize: 13, color: A.primary, minHeight: 24 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingVertical: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 18, height: 18, borderRadius: 5, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  legendText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 12, color: A.textSecondary },
  slot: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  slotTime: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 13, color: A.text, width: 76 },
  slotState: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  slotStateText: { fontFamily: FontFamily.manropeBold, fontSize: 14 },
  slotDetail: { fontFamily: FontFamily.manropeMedium, fontSize: 13, color: A.textSecondary, marginTop: 2 },
  footer: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: A.surface, borderTopWidth: 1, borderTopColor: A.border },
  body: { fontFamily: FontFamily.manropeMedium, fontSize: 15, color: A.text },
  meta: { fontFamily: FontFamily.manropeMedium, fontSize: 13, color: A.textMuted },
  label: { fontFamily: FontFamily.manropeSemiBold, fontSize: 13, color: A.textSecondary, marginTop: 4 },
  sectionTitle: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 18, color: A.text },
  detailTitle: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 22, color: A.text },
  input: {
    borderRadius: 12, borderWidth: 1, borderColor: A.borderStrong, backgroundColor: A.surface, minHeight: 48,
    paddingHorizontal: 12, paddingVertical: 10, fontFamily: FontFamily.manropeMedium, fontSize: 16, color: A.text, textAlignVertical: 'top',
  },
  conflictRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: A.border, paddingTop: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: A.borderStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: A.surface },
  stepValue: { flex: 1, textAlign: 'center', fontFamily: FontFamily.spaceGroteskBold, fontSize: 18, color: A.text },
});
