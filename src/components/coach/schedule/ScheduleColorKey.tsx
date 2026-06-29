import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily, FontSize, Radius } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { SectionCard } from './SectionCard';

const ITEMS = [
  { code: 'F', label: 'Facility Coaching Rules', color: Colors.blue, textColor: '#FFFFFF' },
  { code: 'T', label: 'Travel Coaching Rules', color: Colors.volt, textColor: '#0C0F18' },
  { code: 'E', label: 'Flexible / Either', color: Colors.cyan, textColor: '#0C0F18' },
  { code: 'B', label: 'Unavailable Time', color: '#5A6379', textColor: '#FFFFFF' },
  { code: 'L', label: 'Booked Lesson', color: '#0F1F3D', textColor: '#FFFFFF' },
  { code: 'P', label: 'Pending Request', color: '#FF8C42', textColor: '#0C0F18' },
];

export function ScheduleColorKey() {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  return (
    <SectionCard
      title="Color Key"
      description="Every schedule state uses a letter label in addition to color.">
      <View style={styles.grid}>
        {ITEMS.map(item => (
          <View key={item.code} style={styles.item}>
            <View style={[styles.swatch, { backgroundColor: item.color }]}>
              <Text style={[styles.code, { color: item.textColor }]}>{item.code}</Text>
            </View>
            <Text style={styles.label}>{item.label}</Text>
          </View>
        ))}
      </View>
      <View style={styles.visibilityRow}>
        <View style={[styles.visibilitySample, styles.publicSample]}>
          <Text style={styles.visibilityCode}>F</Text>
        </View>
        <Text style={styles.visibilityText}>Emphasized outline = publicly visible</Text>
      </View>
      <View style={styles.visibilityRow}>
        <View style={[styles.visibilitySample, styles.privateSample]}>
          <Text style={styles.visibilityCode}>F</Text>
        </View>
        <Text style={styles.visibilityText}>Muted treatment = private / internal</Text>
      </View>
    </SectionCard>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    item: {
      width: '47%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    swatch: {
      width: 30,
      height: 30,
      borderRadius: Radius.xs,
      alignItems: 'center',
      justifyContent: 'center',
    },
    code: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 12,
    },
    label: {
      flex: 1,
      fontFamily: FontFamily.manropeMedium,
      fontSize: 12,
      color: theme.textSecondary,
    },
    visibilityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    visibilitySample: {
      width: 34,
      height: 28,
      borderRadius: Radius.xs,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(45,107,255,0.12)',
    },
    publicSample: { borderWidth: 2, borderColor: Colors.cyan },
    privateSample: { borderWidth: 1, borderColor: theme.border, opacity: 0.48 },
    visibilityCode: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 10,
      color: theme.textSecondary,
    },
    visibilityText: {
      flex: 1,
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
    },
  }), [theme]);
}
