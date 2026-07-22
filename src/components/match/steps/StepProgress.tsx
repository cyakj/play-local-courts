// src/components/match/steps/StepProgress.tsx
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { Colors, CyanGlow, Spacing } from '@/constants/design';

export function StepProgress({ stepIndex, totalSteps }: { stepIndex: number; totalSteps: number }) {
  const { theme } = useTheme();

  // One Animated.Value per dot, driving a transform-only scale so the
  // active-dot size change is GPU-composited instead of re-laying-out height.
  const scales = useRef(
    Array.from({ length: totalSteps }, (_, i) => new Animated.Value(i === stepIndex ? 1 : 0)),
  ).current;

  useEffect(() => {
    scales.forEach((value, i) => {
      Animated.spring(value, {
        toValue: i === stepIndex ? 1 : 0,
        friction: 8,
        tension: 60,
        useNativeDriver: true,
      }).start();
    });
  }, [stepIndex, scales]);

  return (
    <View style={styles.row}>
      {Array.from({ length: totalSteps }, (_, i) => {
        const isActive = i === stepIndex;
        const isDone = i < stepIndex;
        const scaleY = scales[i].interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] });

        return (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: isDone ? Colors.blue : isActive ? Colors.cyan : theme.border },
              isActive && CyanGlow,
              { transform: [{ scaleY }] },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, paddingHorizontal: Spacing.pagePx, paddingVertical: 10 },
  dot: { flex: 1, height: 4, borderRadius: 2 },
});
