import { StyleSheet, Text, View } from 'react-native';
import { Wrench } from 'lucide-react-native';

import { Colors, FontFamily, Radius } from '@/constants/design';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { categoryLabel, type AnnouncementCategory } from '@/lib/announcements';

/** Small coral dot for an announcement the administrator marked urgent. Not a banner, not a recoloured card. */
export function UrgentDot({ testID = 'announcement-urgent-dot' }: { testID?: string }) {
  return <View testID={testID} accessible accessibilityLabel="Urgent" style={styles.dot} />;
}

/** "Maintenance" / "Service" chip for resident-facing maintenance and service notices; nothing for general announcements. */
export function CategoryChip({ category, theme }: { category: AnnouncementCategory; theme: ThemeTokens }) {
  const label = categoryLabel(category);
  if (!label) return null;
  return (
    <View testID="announcement-category" style={[styles.chip, { backgroundColor: theme.surface2, borderColor: theme.border }]}>
      <Wrench color={theme.textSecondary} size={10} strokeWidth={2} />
      <Text style={[styles.chipText, { color: theme.textSecondary }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.coral, flexShrink: 0 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill, borderWidth: 1 },
  chipText: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 10, letterSpacing: 0.8 },
});
