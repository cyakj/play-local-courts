import { useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { X, MessageCircle } from 'lucide-react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import type { CoachStudent } from '@/hooks/useCoachStudents';

interface Props {
  student: CoachStudent | null;
  visible: boolean;
  onClose: () => void;
  onSaveNotes: (notes: string) => Promise<string | null>;
}

export function CoachStudentDetail({ student, visible, onClose, onSaveNotes }: Props) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const insets = useSafeAreaInsets();
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  useMemo(() => {
    setNotes(student?.notes ?? '');
  }, [student]);

  if (!student) return null;

  const initials = (student.playerName ?? 'P')
    .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  async function handleSaveNotes() {
    setSavingNotes(true);
    await onSaveNotes(notes);
    setSavingNotes(false);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.playerName}>{student.playerName ?? 'Player'}</Text>
              <Text style={styles.lessonCount}>{student.lessonCount} total lessons</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
              <X size={20} color={theme.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: Colors.positive }]}>{student.completedCount}</Text>
                <Text style={styles.statLabel}>COMPLETED</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, student.noShowCount > 0 && { color: Colors.negative }]}>{student.noShowCount}</Text>
                <Text style={styles.statLabel}>NO-SHOW</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {student.lessonCount > 0 ? `${Math.round((student.completedCount / student.lessonCount) * 100)}%` : '—'}
                </Text>
                <Text style={styles.statLabel}>ATTENDANCE</Text>
              </View>
            </View>

            {/* Notes */}
            <Text style={styles.sectionLabel}>PRIVATE NOTES</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add private notes about this student…"
              placeholderTextColor={Colors.fgDisabled}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.saveNotesBtn, savingNotes && styles.btnDisabled]}
              onPress={handleSaveNotes}
              disabled={savingNotes}
              activeOpacity={0.85}>
              <Text style={styles.saveNotesBtnText}>{savingNotes ? 'Saving…' : 'Save Notes'}</Text>
            </TouchableOpacity>

            {/* Message */}
            <TouchableOpacity
              style={styles.messageBtn}
              onPress={() => {
                onClose();
                router.push({ pathname: '/messages', params: { partner: student.playerId } } as any);
              }}
              activeOpacity={0.8}>
              <MessageCircle size={16} color={Colors.cyan} strokeWidth={2} />
              <Text style={styles.messageBtnText}>Send Message</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: theme.cardBg,
      borderTopLeftRadius: Radius.xl,
      borderTopRightRadius: Radius.xl,
      borderTopWidth: 1,
      borderColor: theme.border,
      maxHeight: '85%',
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: Spacing.pagePx,
      paddingTop: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    avatar: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: 'rgba(45,107,255,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitials: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: 16,
      color: Colors.blue,
    },
    headerInfo: { flex: 1, gap: 3 },
    playerName: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
      letterSpacing: -0.2,
    },
    lessonCount: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    content: {
      padding: Spacing.pagePx,
      gap: 14,
      paddingBottom: 20,
    },
    statsRow: {
      flexDirection: 'row',
      backgroundColor: theme.cardBg,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.s4,
    },
    statItem: { flex: 1, alignItems: 'center', gap: 4 },
    statValue: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: 22,
      color: theme.textPrimary,
    },
    statLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 9,
      color: theme.textMuted,
      letterSpacing: 0.15,
    },
    statDivider: { width: 1, backgroundColor: theme.border },
    sectionLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      color: theme.textMuted,
      letterSpacing: 0.18,
    },
    notesInput: {
      backgroundColor: theme.border,
      borderRadius: Radius.sm,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textPrimary,
      minHeight: 100,
    },
    saveNotesBtn: {
      backgroundColor: Colors.blue,
      borderRadius: Radius.button,
      paddingVertical: 13,
      alignItems: 'center',
    },
    btnDisabled: { opacity: 0.5 },
    saveNotesBtnText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: '#FFFFFF',
    },
    messageBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: Radius.button,
      borderWidth: 1,
      borderColor: 'rgba(45,224,255,0.35)',
      backgroundColor: 'rgba(45,224,255,0.08)',
    },
    messageBtnText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: Colors.cyan,
    },
  }), [theme]);
}
