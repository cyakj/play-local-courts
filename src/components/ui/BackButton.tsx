import { StyleSheet, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';

import { BACK_BUTTON } from '@/constants/headerBrand';
import { FontFamily } from '@/constants/design';

/**
 * The one back control: a rounded pill with an arrow and a visible "Back" label (more discoverable than a bare arrow).
 * Height 48 / minimum width 48, always a >= 44pt touch target. On very narrow screens (< 360 px) the label is dropped
 * and it falls back to the 48x48 arrow chip so the TenisX and community logos are never squeezed; the accessibility
 * label stays "Back". `tone` picks the chip for a dark header or a light page.
 */
export function BackButton({
  onPress, label = 'Back', tone = 'onDark', testID = 'header-back',
}: { onPress: () => void; label?: string; tone?: 'onDark' | 'onLight'; testID?: string }) {
  const { width } = useWindowDimensions();
  const dark = tone === 'onDark';
  const showLabel = width >= BACK_BUTTON.labelMinWindowWidth;
  const color = dark ? '#FFFFFF' : '#0C0F18';
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.7}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      style={[styles.btn, showLabel ? styles.withLabel : styles.iconOnly, dark ? styles.onDark : styles.onLight]}>
      <ArrowLeft color={color} size={BACK_BUTTON.icon} strokeWidth={BACK_BUTTON.stroke} />
      {showLabel ? <Text testID={`${testID}-label`} style={[styles.label, { color }]}>{label}</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: BACK_BUTTON.size,
    minWidth: BACK_BUTTON.size,
    borderRadius: BACK_BUTTON.size / 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderWidth: 1,
  },
  iconOnly: { width: BACK_BUTTON.size },
  withLabel: { paddingLeft: 12, paddingRight: 16, gap: 6 },
  label: { fontFamily: FontFamily.manropeSemiBold, fontSize: 15 },
  onDark: { backgroundColor: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.28)' },
  onLight: { backgroundColor: '#FFFFFF', borderColor: '#D5DAE6' },
});
