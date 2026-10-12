import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { Colors, FontFamily, FontSize, Radius } from '@/constants/design';

interface Props {
  onPress: () => void;
  saving?: boolean;
  /** Dim and disable when there is nothing to save. */
  disabled?: boolean;
}

// Save action for the inner Header's right slot: a labelled, 44pt-tall touch target.
export function HeaderSaveButton({ onPress, saving, disabled }: Props) {
  return (
    <TouchableOpacity
      testID="header-save"
      onPress={onPress}
      disabled={saving || disabled}
      style={[styles.btn, (saving || disabled) && styles.dim]}
      accessibilityRole="button"
      accessibilityLabel="Save changes"
      accessibilityState={{ disabled: !!(saving || disabled) }}>
      <Text style={styles.text}>{saving ? 'Saving…' : 'Save'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 44,
    minWidth: 64,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.button,
    backgroundColor: Colors.blue,
  },
  dim: { opacity: 0.45 },
  text: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label, color: Colors.white },
});
