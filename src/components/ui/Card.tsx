import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Colors, Radius } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';

type AccentVariant = 'optimal' | 'attention' | 'critical' | 'none';

const accentColors: Record<AccentVariant, string> = {
  optimal: Colors.cyan,
  attention: Colors.negative,
  critical: Colors.negative,
  none: 'transparent',
};

interface CardProps {
  children: React.ReactNode;
  accent?: AccentVariant;
  onPress?: () => void;
  style?: object;
}

export function Card({ children, accent = 'none', onPress, style }: CardProps) {
  const { theme } = useTheme();
  const borderLeftColor = accentColors[accent];
  const accentStyle = accent !== 'none' ? { borderLeftWidth: 2, borderLeftColor } : {};
  const cardStyle = [
    styles.card,
    { backgroundColor: theme.cardBg, borderColor: theme.border, ...theme.shadowCard },
    accentStyle,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity style={cardStyle} onPress={onPress} activeOpacity={0.85}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
    padding: 20,
    borderWidth: 1,
  },
});
