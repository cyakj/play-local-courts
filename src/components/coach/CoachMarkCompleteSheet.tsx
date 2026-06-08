import { useMemo, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle, XCircle } from 'lucide-react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

interface Props {
  visible: boolean;
  playerName: string | null;
  onClose: () => void;
  onMarkComplete: () => Promise<void>;
  onMarkNoShow: () => Promise<void>;
}

export function CoachMarkCompleteSheet({ visible, playerName, onClose, onMarkComplete, onMarkNoShow }: Props) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState<'complete' | 'no_show' | null>(null);

  async function handleComplete() {
    setLoading('complete');
    await onMarkComplete();
    setLoading(null);
    onClose();
  }

  async function handleNoShow() {
    setLoading('no_show');
    await onMarkNoShow();
    setLoading(null);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <View style={styles.handle} />

        <Text style={styles.title}>Mark Attendance</Text>
        <Text style={styles.subtitle}>
          {playerName ? `How did the session with ${playerName} go?` : 'How did the session go?'}
        </Text>

        <TouchableOpacity
          style={[styles.optionBtn, styles.completeBtn, loading === 'no_show' && styles.btnDisabled]}
          onPress={handleComplete}
          disabled={loading !== null}
          activeOpacity={0.85}>
          <CheckCircle size={20} color="#FFFFFF" strokeWidth={2} />
          <Text style={styles.completeBtnText}>
            {loading === 'complete' ? 'Marking…' : 'Lesson Completed'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.optionBtn, styles.noShowBtn, loading === 'complete' && styles.btnDisabled]}
          onPress={handleNoShow}
          disabled={loading !== null}
          activeOpacity={0.85}>
          <XCircle size={20} color={Colors.negative} strokeWidth={2} />
          <Text style={styles.noShowBtnText}>
            {loading === 'no_show' ? 'Marking…' : 'Player No-Show'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelRow} onPress={onClose} disabled={loading !== null} activeOpacity={0.7}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    sheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.cardBg,
      borderTopLeftRadius: Radius.xl,
      borderTopRightRadius: Radius.xl,
      borderTopWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: Spacing.pagePx,
      paddingTop: 12,
      gap: 12,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.border,
      alignSelf: 'center',
      marginBottom: 4,
    },
    title: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
      letterSpacing: -0.2,
    },
    subtitle: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    optionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      borderRadius: Radius.button,
      paddingVertical: 16,
    },
    completeBtn: {
      backgroundColor: Colors.positive,
    },
    completeBtnText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: '#FFFFFF',
    },
    noShowBtn: {
      backgroundColor: 'rgba(255,92,107,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(255,92,107,0.35)',
    },
    noShowBtnText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: Colors.negative,
    },
    btnDisabled: { opacity: 0.4 },
    cancelRow: {
      alignItems: 'center',
      paddingVertical: 10,
    },
    cancelText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textMuted,
    },
  }), [theme]);
}
