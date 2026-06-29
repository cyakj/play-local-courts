import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { useTheme } from '@/context/ThemeContext';
import type { CoachLessonRequest } from '@/hooks/useCoachRequests';
import { supabase } from '@/lib/supabase';
import { formatTime } from '@/types/coachSchedule';
import { WeatherTimeWheel } from '@/components/ui/WeatherTimeWheel';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDate(dateStr: string): Date {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(y, mo - 1, d);
}

function lessonDuration(request: CoachLessonRequest): number {
  if (request.durationMinutes) return request.durationMinutes;
  const start = (request.confirmedTimeStart ?? request.preferredTimeStart).slice(0, 5);
  const end = (request.confirmedTimeEnd ?? request.preferredTimeEnd).slice(0, 5);
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return Math.max(30, eh * 60 + em - (sh * 60 + sm));
}

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.slice(0, 5).split(':').map(Number);
  const total = (h * 60 + m + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function lessonDateStr(request: CoachLessonRequest): string {
  return request.confirmedDate ?? request.preferredDate;
}

function lessonStart(request: CoachLessonRequest): string {
  return (request.confirmedTimeStart ?? request.preferredTimeStart).slice(0, 5);
}

function lessonEnd(request: CoachLessonRequest): string {
  return (request.confirmedTimeEnd ?? request.preferredTimeEnd).slice(0, 5);
}

// ─── Sheet wrapper ────────────────────────────────────────────────────────────

function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── RescheduleLessonSheet ────────────────────────────────────────────────────

export function RescheduleLessonSheet({
  request,
  onClose,
  onSuccess,
}: {
  request: CoachLessonRequest | null;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles(theme);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [startTime, setStartTime] = useState('09:00');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!request) return;
    setSelectedDate(parseDate(lessonDateStr(request)));
    setStartTime(lessonStart(request));
    setNote('');
  }, [request]);

  const location = request?.facilityName ?? request?.locationNote ?? null;

  // 60-day window for reschedule, computed once per mount
  const reschedDates = useMemo(() =>
    Array.from({ length: 60 }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + i);
      return d;
    }),
  []);

  if (!request) return null;

  const duration = lessonDuration(request);
  const endTime = addMinutes(startTime, duration);

  async function sendReschedule() {
    if (!request) return;
    setSending(true);
    const { error } = await supabase
      .from('lesson_requests')
      .update({
        counter_proposed_date: dateKey,
        counter_proposed_time_start: startTime,
        counter_proposed_time_end: endTime,
        counter_proposed_notes: note.trim() || null,
      })
      .eq('id', request.id);
    setSending(false);
    if (error) {
      console.error('[RescheduleLessonSheet] backend error:', error.message, error);
      Alert.alert('Unable to send reschedule request', error.message);
      return;
    }
    onSuccess?.();
    onClose();
  }

  return (
    <Sheet visible title="Reschedule Lesson" onClose={onClose}>
      {/* Current lesson summary */}
      <View style={styles.currentLesson}>
        <Text style={styles.eyebrow}>CURRENT LESSON</Text>
        <Text style={styles.currentValue}>
          {new Date(`${lessonDateStr(request)}T12:00:00`).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })}
          {'  '}
          {formatTime(lessonStart(request))} – {formatTime(lessonEnd(request))}
        </Text>
      </View>

      {/* Date + time picker */}
      <View style={[styles.field, { marginHorizontal: -Spacing.pagePx }]}>
        <View style={{ height: 400 }}>
          <WeatherTimeWheel
            availableDates={reschedDates}
            allowedDurations={[duration]}
            mode="outdoor"
            locationCity={location ?? undefined}
            selectedDate={selectedDate}
            selectedTime={startTime}
            onDateChange={(d) => { setSelectedDate(d); setStartTime('09:00'); }}
            onSelectSlot={(d, t) => { setSelectedDate(d); setStartTime(t); }}
            theme={theme}
          />
        </View>
      </View>

      {/* Optional note */}
      <View style={styles.field}>
        <Text style={styles.eyebrow}>NOTE TO STUDENT (OPTIONAL)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Add context for the proposed change"
          placeholderTextColor={theme.textMuted}
          style={[styles.input, styles.multiline]}
          multiline
          textAlignVertical="top"
        />
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[styles.primaryButton, sending && styles.disabled]}
        onPress={sendReschedule}
        disabled={sending}
        activeOpacity={0.82}>
        <Text style={styles.primaryLabel}>
          {sending ? 'Sending…' : 'Send Reschedule Request'}
        </Text>
      </TouchableOpacity>

    </Sheet>
  );
}

// ─── CoachNotesSheet ──────────────────────────────────────────────────────────

export function CoachNotesSheet({
  request,
  onClose,
  onSaved,
}: {
  request: CoachLessonRequest | null;
  onClose: () => void;
  onSaved: (note: string) => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const [coachId, setCoachId] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!request) return;
    let active = true;
    setLoading(true);
    Promise.all([
      supabase.auth.getUser(),
      supabase
        .from('client_notes')
        .select('coach_id, notes')
        .eq('client_id', request.playerId)
        .maybeSingle(),
    ]).then(([userResult, noteResult]) => {
      if (!active) return;
      const userId = userResult.data.user?.id ?? '';
      setCoachId(userId);
      setNote(
        noteResult.data?.coach_id === userId
          ? noteResult.data.notes ?? ''
          : '',
      );
      setLoading(false);
    });
    return () => { active = false; };
  }, [request]);

  if (!request) return null;

  async function save() {
    if (!coachId || saving) return;
    setSaving(true);
    const cleaned = note.trim();
    const { error } = await supabase
      .from('client_notes')
      .upsert({
        coach_id: coachId,
        client_id: request!.playerId,
        notes: cleaned || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'coach_id,client_id' });
    setSaving(false);
    if (error) {
      Alert.alert('Unable to save coach notes', error.message);
      return;
    }
    onSaved(cleaned);
    onClose();
  }

  return (
    <Sheet visible title="Coach Notes" onClose={onClose}>
      <Text style={styles.helper}>
        Private notes for {request.playerName ?? 'this student'}. Only you can view them.
      </Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        editable={!loading && !saving}
        placeholder={loading ? 'Loading notes…' : 'Add private coaching notes'}
        placeholderTextColor={theme.textMuted}
        style={[styles.input, styles.notesInput]}
        multiline
        textAlignVertical="top"
      />
      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
          <Text style={styles.cancelLabel}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, styles.saveButton, (loading || saving) && styles.disabled]}
          onPress={save}
          disabled={loading || saving}>
          <Text style={styles.primaryLabel}>{saving ? 'Saving…' : 'Save Notes'}</Text>
        </TouchableOpacity>
      </View>
    </Sheet>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.backdrop },
    sheet: {
      maxHeight: '90%',
      backgroundColor: theme.sheetBg,
      borderTopLeftRadius: Radius.xl,
      borderTopRightRadius: Radius.xl,
      borderWidth: 1,
      borderColor: theme.border,
      ...theme.shadowSheet,
    },
    header: {
      minHeight: 68,
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: Spacing.pagePx,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    title: {
      flex: 1,
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
    },
    closeButton: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
    content: { padding: Spacing.pagePx, gap: 18 },
    currentLesson: {
      gap: 6,
      padding: 14,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface2,
    },
    currentValue: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: theme.textPrimary,
    },
    field: { gap: 8 },
    eyebrow: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      color: theme.textMuted,
      letterSpacing: 1.1,
    },
    input: {
      minHeight: 52,
      borderRadius: Radius.input,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.inputBg,
      paddingHorizontal: 14,
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textPrimary,
    },
    multiline: { minHeight: 96, paddingTop: 14 },
    notesInput: { minHeight: 180, paddingTop: 14 },
    helper: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      lineHeight: 22,
      color: theme.textSecondary,
    },
    actions: { flexDirection: 'row', gap: 10 },
    cancelButton: {
      flex: 1,
      minHeight: 50,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.button,
      borderWidth: 1,
      borderColor: theme.borderStrong,
    },
    cancelLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    primaryButton: {
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.button,
      backgroundColor: Colors.blue,
      paddingHorizontal: 18,
    },
    saveButton: { flex: 1.6 },
    primaryLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: '#F5F8FF',
    },
    disabled: { opacity: 0.5 },
  }), [theme]);
}
