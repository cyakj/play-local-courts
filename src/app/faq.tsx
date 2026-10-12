import { useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronDown, ChevronUp, Mail } from 'lucide-react-native';

import { Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing } from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { openSupportEmail } from '@/lib/support';

// How-to answers about what the app does. Community-specific rules (hours, limits,
// approval, cancellation cutoffs) are set by each community, so the answers point to where
// the app shows them rather than stating a policy.
const FAQ: { q: string; a: string }[] = [
  {
    q: 'How do I reserve an amenity?',
    a: 'Open the Reserve tab, choose an amenity, pick a date, then a time and duration, and confirm. The available times already exclude anything taken or blocked.',
  },
  {
    q: 'Why does my reservation say “Pending approval”?',
    a: 'Your community decides, amenity by amenity, whether reservations need an administrator’s approval. If this amenity does, your request stays pending until an administrator approves or declines it, and the time is not held for you until it is approved. Amenities that don’t need approval are confirmed immediately.',
  },
  {
    q: 'Why can’t I book a particular time?',
    a: 'A time can be unavailable because someone already reserved it, the amenity is blocked for maintenance, it falls outside the amenity’s hours, it is beyond how far ahead your community allows booking, or you have reached your community’s daily limit for that amenity.',
  },
  {
    q: 'How do I cancel a reservation?',
    a: 'Go to Me → My Reservations, open the reservation and choose Cancel. Each amenity has a cancellation cutoff set by your community. If the reservation starts sooner than that cutoff, cancelling is unavailable and the screen explains why.',
  },
  {
    q: 'How do I report a maintenance issue?',
    a: 'On Home, choose Report Issue. You’ll see your existing reports; tap + to start a new one, choose a category and severity, describe the problem, optionally add a photo, and submit. Your community’s administrators are notified.',
  },
  {
    q: 'Where do I find community documents?',
    a: 'Open the Community tab and choose Documents & Rules. View opens a document inside the app; Download lets you save it to Files or share it.',
  },
  {
    q: 'How do I update my profile or home location?',
    a: 'Go to Me → Edit Profile. Search for your city or municipality, select it from the list, and tap Save.',
  },
  {
    q: 'How do I change notification or privacy settings?',
    a: 'Go to Me → Settings, open Notifications or Privacy, adjust the switches and tap Save. If you leave without saving, the app asks whether to save, discard or keep editing.',
  },
];

export default function FaqScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const [open, setOpen] = useState<number | null>(null);
  const goBack = () => { if (router.canGoBack()) router.back(); else router.replace('/settings-help' as any); };

  return (
    <View style={styles.screen}>
      <Header variant="inner" title="FAQ" onBack={goBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center', gap: 10 }}>
          {FAQ.map((item, i) => {
            const expanded = open === i;
            return (
              <View key={item.q} style={styles.card}>
                <TouchableOpacity
                  testID="faq-question"
                  style={styles.qRow}
                  onPress={() => setOpen(expanded ? null : i)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}>
                  <Text style={styles.q}>{item.q}</Text>
                  {expanded
                    ? <ChevronUp color={theme.textMuted} size={20} strokeWidth={1.75} />
                    : <ChevronDown color={theme.textMuted} size={20} strokeWidth={1.75} />}
                </TouchableOpacity>
                {expanded && <Text testID="faq-answer" style={styles.a}>{item.a}</Text>}
              </View>
            );
          })}

          <View style={styles.more}>
            <Text style={styles.moreTitle}>Still need help?</Text>
            <TouchableOpacity
              testID="faq-contact-support"
              style={styles.primary}
              onPress={() => openSupportEmail('TenisX Support')}
              accessibilityRole="button">
              <Mail color={Colors.white} size={18} strokeWidth={1.75} />
              <Text style={styles.primaryText}>Contact Support</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.pageBg },
  content: { padding: Spacing.pagePx, paddingBottom: 60 },
  card: {
    backgroundColor: theme.cardBg, borderRadius: Radius.card, borderWidth: 1, borderColor: theme.border,
    overflow: 'hidden',
  },
  qRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, minHeight: 56 },
  q: { flex: 1, fontFamily: FontFamily.manropeBold, fontSize: FontSize.body, color: theme.textPrimary, lineHeight: 22 },
  a: {
    fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, lineHeight: 24, color: theme.textSecondary,
    paddingHorizontal: 16, paddingBottom: 18,
  },
  more: { marginTop: 14, gap: 12 },
  moreTitle: { fontFamily: FontFamily.spaceGroteskBold, fontSize: FontSize.cardTitle, color: theme.textPrimary },
  primary: {
    minHeight: 48, borderRadius: Radius.button, backgroundColor: Colors.blue,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  primaryText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body, color: Colors.white },
}), [theme]);
}
