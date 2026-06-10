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
import { ScheduleTimePicker } from './ScheduleTimePicker';

function lessonDate(request: CoachLessonRequest): string {
  return request.confirmedDate ?? request.preferredDate;
}

function lessonStart(request: CoachLessonRequest): string {
  return (request.confirmedTimeStart ?? request.preferredTimeStart).slice(0, 5);
}

function lessonEnd(request: CoachLessonRequest): string {
  return (request.confirmedTimeEnd ?? request.preferredTimeEnd).slice(0, 5);
}

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

export function RescheduleLessonSheet({
  request,
  onClose,
}: {
  request: CoachLessonRequest | null;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!request) return;
    setDate(lessonDate(request));
    setStartTime(lessonStart(request));
    setNote('');
  }, [request]);

  if (!request) return null;
  return (
    <Sheet visible title="Reschedule Lesson" onClose={onClose}>
      <View style={styles.currentLesson}>
        <Text style={styles.eyebrow}>CURRENT LESSON</Text>
        <Text style={styles.currentValue}>
          {new Date(`${lessonDate(request)}T12:00:00`).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })}
          {'  '}
          {formatTime(lessonStart(request))} - {formatTime(lessonEnd(request))}
        </Text>
      </View>
      <View style={styles.field}>
        <Text style={styles.eyebrow}>NEW DATE</Text>
        <TextInput
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={theme.textMuted}
          style={styles.input}
          autoCapitalize="none"
        />
      </View>
      <ScheduleTimePicker label="NEW START TIME" value={startTime} onChange={setStartTime} />
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
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => Alert.alert(
          'Reschedule Lesson',
          'Reschedule request workflow is not connected yet.',
        )}>
        <Text style={styles.primaryLabel}>Send Reschedule Request</Text>
      </TouchableOpacity>
    </Sheet>
  );
}

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
        placeholder={loading ? 'Loading notes...' : 'Add private coaching notes'}
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
          <Text style={styles.primaryLabel}>{saving ? 'Saving...' : 'Save Notes'}</Text>
        </TouchableOpacity>
      </View>
    </Sheet>
  );
}

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
