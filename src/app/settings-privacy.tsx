import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronRight, FileText, ShieldCheck } from 'lucide-react-native';

import { Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { Header } from '@/components/ui/Header';
import { PRIVACY_FACTS, PRIVACY_PLANNED_NOTE } from '@/lib/privacyInfo';

// V1 privacy screen. The previous location, activity-status, distance and contact-until-match toggles
// belonged to the tennis matchmaking product: nothing in the HOA app reads them, so they were decorative and have been
// removed rather than promise protection the backend does not provide. This screen only states what is true today
// (see src/lib/privacyInfo.ts) and links the policy documents. Enforceable resident-to-resident visibility controls
// need a schema + policy change and are planned for V1.1.
export default function SettingsPrivacyScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);

  function goBack() {
    if (router.canGoBack()) router.back(); else router.replace('/settings' as any);
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.pageBg }]}>
      <Header variant="inner" title="Privacy" onBack={goBack} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>WHAT YOUR COMMUNITY CAN SEE</Text>
          <View testID="privacy-facts" style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            {PRIVACY_FACTS.map((f, i) => (
              <View key={f.title}>
                {i > 0 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
                <View style={styles.row}>
                  <ShieldCheck color={Colors.cyan} size={18} strokeWidth={1.5} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>{f.title}</Text>
                    <Text style={[styles.rowDesc, { color: theme.textMuted }]}>{f.body}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
          <Text testID="privacy-planned-note" style={[styles.note, { color: theme.textMuted }]}>{PRIVACY_PLANNED_NOTE}</Text>

          <Text style={[styles.sectionLabel, { color: theme.textMuted, marginTop: 28 }]}>POLICIES</Text>
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <TouchableOpacity testID="privacy-policy-link" style={styles.linkRow} onPress={() => router.push('/legal/privacy' as any)} activeOpacity={0.7} accessibilityRole="button">
              <FileText color={theme.textMuted} size={18} strokeWidth={1.5} />
              <Text style={[styles.rowLabel, { color: theme.textPrimary, flex: 1 }]}>Privacy Policy</Text>
              <ChevronRight color={theme.textMuted} size={16} strokeWidth={1.5} />
            </TouchableOpacity>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <TouchableOpacity testID="terms-link" style={styles.linkRow} onPress={() => router.push('/legal/terms' as any)} activeOpacity={0.7} accessibilityRole="button">
              <FileText color={theme.textMuted} size={18} strokeWidth={1.5} />
              <Text style={[styles.rowLabel, { color: theme.textPrimary, flex: 1 }]}>Terms of Service</Text>
              <ChevronRight color={theme.textMuted} size={16} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen: { flex: 1 },
    content: { padding: Spacing.pagePx, paddingBottom: 60 },
    sectionLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.eyebrow,
      letterSpacing: 1.6, marginBottom: 10,
    },
    card: { borderRadius: Radius.card, borderWidth: 1, overflow: 'hidden' },
    divider: { height: 1, marginHorizontal: 16 },
    linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 56 },
    row: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
    rowLabel: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body },
    rowDesc: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, marginTop: 2, lineHeight: 20 },
    note: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, marginTop: 12, lineHeight: 20 },
  }), [theme]);
}
