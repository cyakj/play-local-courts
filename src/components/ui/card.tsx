import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Colors, Radius, Shadow } from '@/constants/design';

type AccentVariant = 'optimal' | 'attention' | 'critical' | 'none';

const accentColors: Record<AccentVariant, string> = {
  optimal: Colors.accentCyan,
  attention: Colors.coral,
  critical: Colors.red,
  none: 'transparent',
};

interface CardProps {
  children: React.ReactNode;
  accent?: AccentVariant;
  onPress?: () => void;
  style?: object;
}

export function Card({ children, accent = 'none', onPress, style }: CardProps) {
  const borderLeftColor = accentColors[accent];
  const accentStyle = accent !== 'none' ? { borderLeftWidth: 2, borderLeftColor } : {};

  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.card, accentStyle, style]}
        onPress={onPress}
        activeOpacity={0.85}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[styles.card, accentStyle, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.card,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow,
  },
});
