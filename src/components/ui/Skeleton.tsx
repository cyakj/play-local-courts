import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { Radius } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: object;
}

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
}: SkeletonProps) {
  const { theme } = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 750, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { backgroundColor: theme.surface2 },
        { width: width as number, height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

export function CardSkeleton() {
  const { theme } = useTheme();
  return (
    <View style={{
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
    }}>
      <Skeleton width="60%" height={16} borderRadius={8} />
      <Skeleton width="100%" height={12} borderRadius={6} style={{ marginTop: 10 }} />
      <Skeleton width="100%" height={12} borderRadius={6} style={{ marginTop: 6 }} />
      <Skeleton width="40%" height={12} borderRadius={6} style={{ marginTop: 6 }} />
    </View>
  );
}
