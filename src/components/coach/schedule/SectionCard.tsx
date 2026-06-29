import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

interface Props {
  title: string;
  description: string;
  children: ReactNode;
  action?: ReactNode;
}

export function SectionCard({ title, description, children, action }: Props) {
  const { theme } = useTheme();
  const styles = useStyles(theme);

  return (
    <View style={styles.card}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.cardPadding,
      gap: 16,
      ...theme.shadowCard,
    },
    headingRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    headingCopy: { flex: 1, gap: 4 },
    title: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
    },
    description: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      lineHeight: 20,
      color: theme.textMuted,
    },
  }), [theme]);
}

