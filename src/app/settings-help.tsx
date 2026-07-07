import { useMemo } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, BookOpen, ChevronRight, FileText, HelpCircle, Mail, Shield } from 'lucide-react-native';

import { Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

const SUPPORT_EMAIL = 'support@tenisx.ai';

const SECTIONS = [
  {
    title: 'SUPPORT',
    rows: [
      {
        icon: HelpCircle,
        label: 'FAQ',
        desc: 'Common questions and answers',
        onPress: () => Linking.openURL('https://tenisx.ai/faq').catch(() =>
          Alert.alert('FAQ', 'Visit tenisx.ai/faq for answers to common questions.')),
      },
      {
        icon: Mail,
        label: 'Contact Support',
        desc: SUPPORT_EMAIL,
        onPress: () => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=TenisX Support`).catch(() =>
          Alert.alert('Contact', `Email us at ${SUPPORT_EMAIL}`)),
      },
    ],
  },
  {
    title: 'LEGAL',
    rows: [
      {
        icon: FileText,
        label: 'Terms of Service',
        desc: 'Usage terms and conditions',
        onPress: () => Linking.openURL('https://tenisx.ai/terms').catch(() =>
          Alert.alert('Terms', 'Visit tenisx.ai/terms to read our Terms of Service.')),
      },
      {
        icon: Shield,
        label: 'Privacy Policy',
        desc: 'How we handle your data',
        onPress: () => Linking.openURL('https://tenisx.ai/privacy').catch(() =>
          Alert.alert('Privacy', 'Visit tenisx.ai/privacy to read our Privacy Policy.')),
      },
      {
        icon: BookOpen,
        label: 'Open Source Licenses',
        desc: 'Third-party library attributions',
        onPress: () => Alert.alert('Licenses', 'TenisX uses open-source software. A full list is available at tenisx.ai/licenses.'),
      },
    ],
  },
] as const;

export default function SettingsHelpScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = useStyles(theme);

  return (
    <View style={[styles.screen, { backgroundColor: theme.pageBg }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 24) + 8, backgroundColor: theme.headerBg }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/settings' as any); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft color={Colors.white} size={20} strokeWidth={1.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>
          {SECTIONS.map(section => (
            <View key={section.title}>
              <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{section.title}</Text>
              <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                {section.rows.map(({ icon: Icon, label, desc, onPress }, i) => (
                  <View key={label}>
                    {i > 0 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
                    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
                      <View style={[styles.iconBox, { backgroundColor: theme.surface2 }]}>
                        <Icon color={theme.textMuted} size={16} strokeWidth={1.5} />
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
        </View>
      </ScrollView>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen: { flex: 1 },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.pagePx, paddingBottom: 14,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 18, color: Colors.white },

    content: { padding: Spacing.pagePx, paddingBottom: 60 },
    sectionLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.eyebrow,
      letterSpacing: 1.6, marginBottom: 10,
    },
    card: { borderRadius: Radius.card, borderWidth: 1, overflow: 'hidden' },
    divider: { height: 1, marginHorizontal: 16 },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      padding: 14, paddingHorizontal: 16, minHeight: 56,
    },
    iconBox: {
      width: 34, height: 34, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    rowLabel: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body },
    rowDesc:  { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, marginTop: 1 },
  }), [theme]);
}
