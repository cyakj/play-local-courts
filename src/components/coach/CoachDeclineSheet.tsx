import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

interface Props {
  visible: boolean;
  playerName: string | null;
  onClose: () => void;
  onDecline: (reason?: string) => Promise<void>;
}

const QUICK_REASONS = [
  'Not available at that time',
  'Fully booked',
  'Location not available',
  'Skill level mismatch',
];

export function CoachDeclineSheet({ visible, playerName, onClose, onDecline }: Props) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const insets = useSafeAreaInsets();
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState('');
  const [loading, setLoading] = useState(false);

  function reset() {
    setSelectedReason(null);
    setCustomReason('');
    setLoading(false);
  }

  async function handleDecline() {
    setLoading(true);
    const reason = customReason.trim() || selectedReason || undefined;
    await onDecline(reason);
    reset();
    onClose();
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.handle} />

          <Text style={styles.title}>Decline Request</Text>
          {playerName && (
            <Text style={styles.subtitle}>Let {playerName} know why you can't take this session.</Text>
          )}

          <Text style={styles.label}>REASON (OPTIONAL)</Text>

          {QUICK_REASONS.map(r => (
            <TouchableOpacity
              key={r}
              style={[styles.reasonChip, selectedReason === r && styles.reasonChipActive]}
              onPress={() => { setSelectedReason(r === selectedReason ? null : r); setCustomReason(''); }}
              activeOpacity={0.7}>
              <Text style={[styles.reasonChipText, selectedReason === r && styles.reasonChipTextActive]}>
                {r}
              </Text>
            </TouchableOpacity>
          ))}

          <TextInput
            style={styles.input}
            value={customReason}
            onChangeText={v => { setCustomReason(v); setSelectedReason(null); }}
            placeholder="Or write your own reason…"
            placeholderTextColor={Colors.fgDisabled}
            multiline
            numberOfLines={2}
          />

          <TouchableOpacity
            style={[styles.declineBtn, loading && styles.btnDisabled]}
            onPress={handleDecline}
            disabled={loading}
            activeOpacity={0.85}>
            <Text style={styles.declineBtnText}>{loading ? 'Declining…' : 'Decline Request'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} activeOpacity={0.7}>
            <Text style={styles.cancelBtnText}>Keep Request</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    kav: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
    },
    sheet: {
      backgroundColor: theme.cardBg,
      borderTopLeftRadius: Radius.xl,
      borderTopRightRadius: Radius.xl,
      borderTopWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: Spacing.pagePx,
      paddingTop: 12,
      gap: 10,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.border,
      alignSelf: 'center',
      marginBottom: 8,
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
      lineHeight: 20,
    },
    label: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      color: theme.textMuted,
      letterSpacing: 0.18,
      marginTop: 4,
    },
    reasonChip: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: Radius.chip,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: 'transparent',
    },
    reasonChipActive: {
      borderColor: Colors.negative,
      backgroundColor: 'rgba(255,92,107,0.10)',
    },
    reasonChipText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    reasonChipTextActive: {
      color: Colors.negative,
    },
    input: {
      backgroundColor: theme.border,
      borderRadius: Radius.sm,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textPrimary,
      minHeight: 60,
      textAlignVertical: 'top',
    },
    declineBtn: {
      backgroundColor: Colors.negative,
      borderRadius: Radius.button,
      paddingVertical: 15,
      alignItems: 'center',
      marginTop: 4,
    },
    btnDisabled: { opacity: 0.5 },
    declineBtnText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: '#FFFFFF',
    },
    cancelBtn: {
      alignItems: 'center',
      paddingVertical: 12,
    },
    cancelBtnText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textMuted,
    },
  }), [theme]);
}
