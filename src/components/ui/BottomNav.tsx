import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Colors, FontFamily, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';

export function BottomNav(props: BottomTabBarProps) {
  const { state, descriptors, navigation } = props;
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  return (
    <View testID="bottom-nav" style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8), backgroundColor: theme.navBg, borderTopColor: theme.navBorder, ...theme.shadowNav }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];

        if (!options.tabBarIcon) return null;

        const label =
          typeof options.tabBarLabel === 'string'
            ? options.tabBarLabel
            : options.title ?? route.name;
        const isFocused = state.index === index;
        const activeColor = theme.cyanOnLight;
        const icon = options.tabBarIcon({
          focused: isFocused,
          color: isFocused ? activeColor : theme.textMuted,
          size: 26,
        });

        return (
          <TouchableOpacity
            key={route.key}
            testID={`tab-${route.name}`}
            style={styles.tab}
            onPress={() => {
              if (!isFocused) navigation.navigate(route.name);
            }}
            activeOpacity={0.7}>
            {icon}
            {label !== 'VS' && (
              <Text style={[styles.label, { color: isFocused ? activeColor : theme.textMuted }]}>
                {label.toUpperCase()}
              </Text>
            )}
            {isFocused && <View style={[styles.dot, { backgroundColor: activeColor }]} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 10,
    minHeight: Spacing.bottomNavHeight,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingTop: 4,
    minWidth: 48,
  },
  label: {
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
});
