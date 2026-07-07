import { StyleSheet, Text, View } from 'react-native';
import { FontFamily } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import { Button } from './Button';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export function EmptyState({ icon, title, subtitle, ctaLabel, onCta }: EmptyStateProps) {
  const { theme } = useTheme();
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>{icon}</View>
      <Text style={[styles.title, { color: theme.textPrimary }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: theme.textMuted }]}>{subtitle}</Text>
      {ctaLabel && onCta && (
        <Button variant="primary" label={ctaLabel} onPress={onCta} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  iconWrap: { marginBottom: 4 },
  title: {
    fontFamily: FontFamily.manropeBold,
    fontSize: 18,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
