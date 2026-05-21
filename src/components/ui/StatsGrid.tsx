import { StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily } from '@/constants/design';

interface StatItem {
  value: string | number;
  label: string;
}

interface StatsGridProps {
  stats: [StatItem, StatItem, StatItem, StatItem];
}

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <View style={styles.grid}>
      {stats.map((stat, i) => (
        <View key={i} style={styles.col}>
          <Text style={styles.value}>{stat.value}</Text>
          <Text style={styles.label}>{stat.label.toUpperCase()}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
  },
  col: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  value: {
    fontFamily: FontFamily.manropeBold,
    fontSize: 20,
    color: Colors.navy,
  },
  label: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 11,
    color: Colors.textSubtle,
    letterSpacing: 1.0,
  },
});
