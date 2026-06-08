import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { UserCircle } from 'lucide-react-native';
import { Header } from '@/components/ui/Header';
import { Colors, FontFamily, FontSize, MaxWidth, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

export default function MeScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);

  return (
    <View style={styles.screen}>
      <Header variant="resident" />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>PROFILE</Text>
          <Text style={styles.heroTitle}>My Game</Text>
        </View>
        <View style={styles.emptyWrap}>
          <UserCircle color={theme.textMuted} size={40} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>Profile coming soon</Text>
          <Text style={styles.emptyBody}>Your tennis profile, stats, and community access.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.pageBg },
    body: { paddingBottom: 100 },
    hero: {
      backgroundColor: theme.pageBg,
      paddingHorizontal: Spacing.pagePx,
      paddingTop: 8,
      paddingBottom: 28,
    },
    heroLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      color: Colors.cyan,
      letterSpacing: 2.2,
      marginBottom: 4,
    },
    heroTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: 32,
      color: theme.textPrimary,
      lineHeight: 36,
      letterSpacing: -0.5,
    },
    emptyWrap: {
      maxWidth: MaxWidth,
      width: '100%',
      alignSelf: 'center',
      paddingHorizontal: Spacing.pagePx,
      paddingTop: 60,
      alignItems: 'center',
      gap: 12,
    },
    emptyTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.sectionTitle,
      color: theme.textPrimary,
    },
    emptyBody: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textMuted,
      textAlign: 'center',
    },
  }), [theme]);
}
