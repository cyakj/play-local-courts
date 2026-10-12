import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { BookOpen, ChevronRight, FileText, HelpCircle, Mail, Shield } from 'lucide-react-native';

import { Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { Header } from '@/components/ui/Header';
import { LEGAL_DOCUMENTS, SUPPORT_EMAIL } from '@/config/support';
import { openSupportEmail } from '@/lib/support';

type Row = { icon: typeof Mail; label: string; desc: string; testID: string; onPress: () => void };

const SECTIONS: { title: string; rows: Row[] }[] = [
  {
    title: 'SUPPORT',
    rows: [
      {
        icon: HelpCircle, label: 'FAQ', desc: 'Answers to common questions', testID: 'help-faq',
        onPress: () => router.push('/faq' as any),
      },
      {
        icon: Mail, label: 'Contact Support', desc: SUPPORT_EMAIL, testID: 'help-contact',
        onPress: () => { openSupportEmail('TenisX Support'); },
      },
    ],
  },
  {
    title: 'LEGAL',
    rows: [
      {
        icon: FileText, label: LEGAL_DOCUMENTS.terms.title, desc: LEGAL_DOCUMENTS.terms.summary, testID: 'help-terms',
        onPress: () => router.push('/legal/terms' as any),
      },
      {
        icon: Shield, label: LEGAL_DOCUMENTS.privacy.title, desc: LEGAL_DOCUMENTS.privacy.summary, testID: 'help-privacy',
        onPress: () => router.push('/legal/privacy' as any),
      },
      {
        icon: BookOpen, label: 'Open Source Licenses', desc: 'Third-party library attributions', testID: 'help-licenses',
        onPress: () => router.push('/licenses' as any),
      },
    ],
  },
];

export default function SettingsHelpScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const goBack = () => { if (router.canGoBack()) router.back(); else router.replace('/settings' as any); };
  const version = Constants.expoConfig?.version;

  return (
    <View style={[styles.screen, { backgroundColor: theme.pageBg }]}>
      <Header variant="inner" title="Help & Support" onBack={goBack} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>
          {SECTIONS.map(section => (
            <View key={section.title}>
              <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{section.title}</Text>
              <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                {section.rows.map(({ icon: Icon, label, desc, onPress, testID }, i) => (
                  <View key={label}>
                    {i > 0 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
                    <TouchableOpacity testID={testID} style={styles.row} onPress={onPress} activeOpacity={0.7}
                      accessibilityRole="button" accessibilityLabel={label}>
                      <View style={[styles.iconBox, { backgroundColor: theme.surface2 }]}>
                        <Icon color={theme.cyanOnLight} size={18} strokeWidth={1.6} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>{label}</Text>
                        <Text style={[styles.rowDesc, { color: theme.textMuted }]}>{desc}</Text>
                      </View>
                      <ChevronRight color={theme.textMuted} size={16} strokeWidth={1.5} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
              <View style={{ height: 28 }} />
            </View>
          ))}
          {!!version && <Text style={[styles.version, { color: theme.textMuted }]}>TenisX version {version}</Text>}
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
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      padding: 14, paddingHorizontal: 16, minHeight: 64,
    },
    iconBox: {
      width: 36, height: 36, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    rowLabel: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body },
    rowDesc:  { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, marginTop: 1, lineHeight: 20 },
    version: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, textAlign: 'center' },
  }), [theme]);
}
