import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Info } from 'lucide-react-native';

import { FontFamily, FontSize, Radius } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';

interface InfoTooltipProps {
  text: string;
  label?: string;
  size?: number;
}

export function InfoTooltip({ text, label, size = 14 }: InfoTooltipProps) {
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);

  return (
    <>
      <TouchableOpacity
        onPress={() => setVisible(true)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={label ? `${label} info` : 'More info'}>
        <Info size={size} color={theme.textMuted} strokeWidth={1.75} />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <Pressable style={[styles.bubble, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            {label ? <Text style={[styles.label, { color: theme.textPrimary }]}>{label}</Text> : null}
            <Text style={[styles.text, { color: theme.textSecondary }]}>{text}</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  bubble: {
    maxWidth: 320,
    width: '100%',
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: 18,
    gap: 6,
  },
  label: {
    fontFamily: FontFamily.spaceGroteskBold,
    fontSize: FontSize.cardTitle,
    marginBottom: 2,
  },
  text: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.body,
    lineHeight: 22,
  },
});
