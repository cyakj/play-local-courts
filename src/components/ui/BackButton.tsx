import { StyleSheet, TouchableOpacity } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';

import { BACK_BUTTON } from '@/constants/headerBrand';

/**
 * The one back control. A 48x48 touch target, a visible circular chip (so it never disappears into the header) and a
 * heavier arrow than the old 1.5px hairline. `tone` picks the chip for a dark header or a light page.
 */
export function BackButton({
  onPress, label = 'Back', tone = 'onDark', testID = 'header-back',
}: { onPress: () => void; label?: string; tone?: 'onDark' | 'onLight'; testID?: string }) {
  const dark = tone === 'onDark';
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.7}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      style={[styles.btn, dark ? styles.onDark : styles.onLight]}>
      <ArrowLeft color={dark ? '#FFFFFF' : '#0C0F18'} size={BACK_BUTTON.icon} strokeWidth={BACK_BUTTON.stroke} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: BACK_BUTTON.size,
    height: BACK_BUTTON.size,
    borderRadius: BACK_BUTTON.size / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  onDark: { backgroundColor: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.28)' },
  onLight: { backgroundColor: '#FFFFFF', borderColor: '#D5DAE6' },
});
