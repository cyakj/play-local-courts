import { StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily } from '@/constants/design';
import { Button } from './Button';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export function EmptyState({ icon, title, subtitle, ctaLabel, onCta }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
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
    color: Colors.navy,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: FontFamily.interRegular,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
