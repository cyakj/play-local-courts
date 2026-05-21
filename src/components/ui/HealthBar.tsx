import { StyleSheet, View } from 'react-native';
import { getHealthColor } from '@/constants/design';

interface HealthBarProps {
  score: number;
  height?: number;
}

export function HealthBar({ score, height = 4 }: HealthBarProps) {
  const fillColor = getHealthColor(score);
  const widthPercent = Math.min(Math.max(score, 0), 100);

  return (
    <View style={[styles.track, { height }]}>
      <View
        style={[
          styles.fill,
          { width: `${widthPercent}%`, backgroundColor: fillColor, height },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: '#F3F4F6',
    borderRadius: 99,
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    borderRadius: 99,
  },
});
