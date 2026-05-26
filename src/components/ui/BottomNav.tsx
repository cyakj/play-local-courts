import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Colors, FontFamily } from '@/constants/design';

export function BottomNav(props: BottomTabBarProps) {
  const { state, descriptors, navigation } = props;
  const insets = useSafeAreaInsets();

  return (
    <View testID="bottom-nav" style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label =
          typeof options.tabBarLabel === 'string'
            ? options.tabBarLabel
            : options.title ?? route.name;
        const isFocused = state.index === index;
        const icon = options.tabBarIcon?.({
          focused: isFocused,
          color: isFocused ? Colors.accentCyan : Colors.textMuted,
          size: 26,
        });

        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tab}
            onPress={() => {
              if (!isFocused) {
                navigation.navigate(route.name);
              }
            }}
            activeOpacity={0.7}>
            {icon}
            <Text
              style={[
                styles.label,
                { color: isFocused ? Colors.accentCyan : Colors.textMuted },
              ]}>
              {label.toUpperCase()}
            </Text>
            {isFocused && <View style={styles.dot} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(15,31,61,0.08)',
    paddingTop: 10,
    minHeight: 70,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingTop: 4,
  },
  label: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.accentCyan,
    marginTop: 2,
  },
});
