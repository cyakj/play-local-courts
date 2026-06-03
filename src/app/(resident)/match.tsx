import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Swords } from 'lucide-react-native';
import { Header } from '@/components/ui/Header';
import { Colors, FontFamily, FontSize, MaxWidth, Spacing } from '@/constants/design';

export default function MatchScreen() {
  return (
    <View style={styles.screen}>
      <Header variant="resident" />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>MATCH</Text>
          <Text style={styles.heroTitle}>Find a Match</Text>
        </View>
        <View style={styles.emptyWrap}>
          <Swords color={Colors.fg3} size={40} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>Match coming soon</Text>
          <Text style={styles.emptyBody}>Challenge players in your community and track your record.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },
  body: { paddingBottom: 100 },
  hero: {
    backgroundColor: '#0A1628',
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
    color: Colors.white,
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
    color: Colors.white,
  },
  emptyBody: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.body,
    color: Colors.fg3,
    textAlign: 'center',
  },
});
