import { useEffect, useState, useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { FileClock, Mail } from 'lucide-react-native';

import { Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing } from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { LEGAL_DOCUMENTS, SUPPORT_EMAIL, type LegalDocKey } from '@/config/support';
import { openSupportEmail } from '@/lib/support';

// Terms / Privacy viewer. With an approved hosted URL it opens that document in the in-app
// browser; without one it says so plainly (the app never invents legal text).
export default function LegalDocumentScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const entry = LEGAL_DOCUMENTS[doc as LegalDocKey];
  const [opening, setOpening] = useState(false);
  const [failed, setFailed] = useState(false);

  async function openHosted() {
    if (!entry?.url) return;
    setOpening(true);
    setFailed(false);
    try {
      await WebBrowser.openBrowserAsync(entry.url, { toolbarColor: '#0C0F18', controlsColor: '#2DE0FF' });
    } catch {
      setFailed(true);
    } finally {
      setOpening(false);
    }
  }

  useEffect(() => { if (entry?.url) openHosted(); }, [entry?.url]);

  const goBack = () => { if (router.canGoBack()) router.back(); else router.replace('/settings-help' as any); };

  return (
    <View style={styles.screen}>
      <Header variant="inner" title={entry?.title ?? 'Document'} onBack={goBack} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>
          {!entry ? (
            <Text testID="legal-unknown" style={styles.body}>This document does not exist.</Text>
          ) : entry.url ? (
            <View style={styles.center}>
              {opening ? <ActivityIndicator color={theme.cyanOnLight} /> : null}
              <Text style={styles.body}>
                {failed ? 'We could not open the document. Check your connection and try again.' : 'Opening the document…'}
              </Text>
              <TouchableOpacity style={styles.primary} onPress={openHosted} accessibilityRole="button">
                <Text style={styles.primaryText}>Open {entry.title}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View testID="legal-unpublished" style={styles.card}>
              <FileClock color={theme.cyanOnLight} size={32} strokeWidth={1.5} />
              <Text style={styles.title}>{entry.title} isn’t published yet</Text>
              <Text style={styles.body}>
                The approved {entry.title} has not been published in the app yet. {entry.summary}
              </Text>
              <Text style={styles.body}>
                If you need a copy now, contact support and we’ll send it to you.
              </Text>
              <TouchableOpacity
                testID="legal-contact-support"
                style={styles.primary}
                onPress={() => openSupportEmail(`${entry.title} request`)}
                accessibilityRole="button">
                <Mail color={Colors.white} size={18} strokeWidth={1.75} />
                <Text style={styles.primaryText}>Email {SUPPORT_EMAIL}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.pageBg },
  content: { padding: Spacing.pagePx, paddingBottom: 60 },
  center: { alignItems: 'center', gap: 16, paddingVertical: 40 },
  card: {
    backgroundColor: theme.cardBg, borderRadius: Radius.card, borderWidth: 1, borderColor: theme.border,
    padding: 22, gap: 14, alignItems: 'flex-start',
  },
  title: { fontFamily: FontFamily.spaceGroteskBold, fontSize: FontSize.sectionTitle, color: theme.textPrimary, lineHeight: 28 },
  body: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, lineHeight: 24, color: theme.textSecondary },
  primary: {
    minHeight: 48, paddingHorizontal: 18, borderRadius: Radius.button, backgroundColor: Colors.blue,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'stretch',
  },
  primaryText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body, color: Colors.white },
}), [theme]);
}
