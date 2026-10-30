import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps as RNBottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Colors, FontFamily, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';

// Expo Router 58 passes `navigateToTab` instead of a `navigation` prop to custom tab bars.
type BottomTabBarProps = Pick<RNBottomTabBarProps, 'state' | 'descriptors'> & {
  navigateToTab: (routeKey: string) => void;
};

export function BottomNav(props: BottomTabBarProps) {
  const { state, descriptors, navigateToTab } = props;
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  return (
    <View testID="bottom-nav" style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8), backgroundColor: theme.navBg, borderTopColor: theme.navBorder, ...theme.shadowNav }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];

        const itemStyle = StyleSheet.flatten(options.tabBarItemStyle);
        if (itemStyle?.display === 'none') return null;
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
              if (!isFocused) navigateToTab(route.key);
            }}
            accessibilityLabel={
              typeof options.tabBarBadge === 'number' && options.tabBarBadge > 0
                ? `${label}, ${options.tabBarBadge} unread`
                : undefined
            }
            activeOpacity={0.7}>
            <View>
              {icon}
              {typeof options.tabBarBadge === 'number' && options.tabBarBadge > 0 ? (
                <View style={styles.badge} pointerEvents="none">
                  <Text style={styles.badgeText}>{options.tabBarBadge > 9 ? '9+' : options.tabBarBadge}</Text>
                </View>
              ) : null}
            </View>
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
    fontSize: 11, // DESIGN.md Bottom Navigation: JetBrains Mono 11px
    letterSpacing: 0.5,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#C62828',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: FontFamily.manropeBold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
});
