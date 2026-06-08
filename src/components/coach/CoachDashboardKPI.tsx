import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

interface Props {
  label: string;
  value: string;
  sub?: string;
  tint?: 'cyan' | 'amber' | 'green' | 'red' | 'default';
}

export function CoachDashboardKPI({ label, value, sub, tint = 'default' }: Props) {
  const { theme } = useTheme();
  const styles = useStyles(theme);

  const valueColor = {
    cyan:    Colors.cyan,
    amber:   Colors.volt,
    green:   Colors.positive,
    red:     Colors.negative,
    default: theme.textPrimary,
  }[tint];

  const bgColor = {
    cyan:    'rgba(45,224,255,0.06)',
    amber:   'rgba(214,255,61,0.06)',
    green:   'rgba(47,217,139,0.06)',
    red:     'rgba(255,92,107,0.06)',
    default: 'transparent',
  }[tint];

  return (
    <View style={[styles.card, { backgroundColor: bgColor }]}>
      <Text style={[styles.value, { color: valueColor }]} numberOfLines={1}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {sub && <Text style={styles.sub}>{sub}</Text>}
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    card: {
      flex: 1,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.s4,
      gap: 4,
      minHeight: 80,
      justifyContent: 'center',
    },
    value: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.statValue,
      letterSpacing: -0.4,
    },
    label: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      color: theme.textMuted,
      letterSpacing: 0.18,
      textTransform: 'uppercase',
    },
    sub: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.eyebrow,
      color: theme.textMuted,
    },
  }), [theme]);
}
