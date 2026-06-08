import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Header } from '@/components/ui/Header';
import { useTheme } from '@/context/ThemeContext';
import { useCoachRequests } from '@/hooks/useCoachRequests';
import type { CoachLessonRequest } from '@/hooks/useCoachRequests';
import { CoachRequestCard } from '@/components/coach/CoachRequestCard';
import { CoachLessonCard } from '@/components/coach/CoachLessonCard';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import type { ThemeTokens } from '@/constants/theme-tokens';

type Tab = 'pending' | 'upcoming' | 'past';

export default function CoachRequestsScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const [activeTab, setActiveTab] = useState<Tab>('pending');

  const { pending, upcoming, past, loading, error, accept, decline, markComplete, markNoShow, cancelLesson } =
    useCoachRequests();

  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  async function handleAccept(req: CoachLessonRequest) {
    setAcceptingId(req.id);
    const err = await accept(
      req.id,
      req.preferredDate,
      req.preferredTimeStart,
      req.preferredTimeEnd,
    );
    setAcceptingId(null);
    if (err) Alert.alert('Error', err);
  }

  async function handleDecline(id: string, reason?: string) {
    const err = await decline(id, reason);
    if (err) Alert.alert('Error', err);
  }

  async function handleMarkComplete(id: string) {
    const err = await markComplete(id);
    if (err) Alert.alert('Error', err);
  }

  async function handleMarkNoShow(id: string) {
    const err = await markNoShow(id);
    if (err) Alert.alert('Error', err);
  }

  async function handleCancel(id: string) {
    const err = await cancelLesson(id);
    if (err) Alert.alert('Error', err);
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'pending',  label: 'Pending',  count: pending.length },
    { key: 'upcoming', label: 'Upcoming', count: upcoming.length },
    { key: 'past',     label: 'Past',     count: 0 },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: theme.pageBg }]}>
      <Header variant="coach" />

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {tabs.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}
            activeOpacity={0.7}>
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
            {t.count > 0 && (
              <View style={[styles.tabBadge, t.key === 'pending' && styles.tabBadgePending]}>
                <Text style={styles.tabBadgeText}>{t.count}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading && (
          <Text style={styles.emptyText}>Loading…</Text>
        )}

        {!loading && error && (
          <Text style={styles.errorText}>{error}</Text>
        )}

        {/* Pending */}
        {!loading && activeTab === 'pending' && (
          <>
            {pending.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No pending requests</Text>
                <Text style={styles.emptySubtitle}>New lesson requests will appear here.</Text>
              </View>
            ) : (
              pending.map(req => (
                <CoachRequestCard
                  key={req.id}
                  request={req}
                  onAccept={handleAccept}
                  onDecline={handleDecline}
                  accepting={acceptingId === req.id}
                />
              ))
            )}
          </>
        )}

        {/* Upcoming */}
        {!loading && activeTab === 'upcoming' && (
          <>
            {upcoming.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No upcoming lessons</Text>
                <Text style={styles.emptySubtitle}>Accepted lessons will appear here.</Text>
              </View>
            ) : (
              upcoming.map(req => (
                <CoachLessonCard
                  key={req.id}
                  request={req}
                  showActions
                  onMarkComplete={handleMarkComplete}
                  onMarkNoShow={handleMarkNoShow}
                  onCancel={handleCancel}
                />
              ))
            )}
          </>
        )}

        {/* Past */}
        {!loading && activeTab === 'past' && (
          <>
            {past.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No past lessons</Text>
                <Text style={styles.emptySubtitle}>Completed and past lessons will appear here.</Text>
              </View>
            ) : (
              past.map(req => (
                <CoachLessonCard
                  key={req.id}
                  request={req}
                  showActions
                  onMarkComplete={handleMarkComplete}
                  onMarkNoShow={handleMarkNoShow}
                  onCancel={handleCancel}
                />
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen: { flex: 1 },
    tabBar: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      paddingHorizontal: Spacing.pagePx,
    },
    tab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 14,
      marginRight: 24,
    },
    tabActive: {
      borderBottomWidth: 2,
      borderBottomColor: Colors.cyan,
    },
    tabText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textMuted,
    },
    tabTextActive: {
      color: Colors.cyan,
    },
    tabBadge: {
      backgroundColor: theme.border,
      borderRadius: Radius.pill,
      minWidth: 18,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
    },
    tabBadgePending: {
      backgroundColor: 'rgba(255,92,107,0.20)',
    },
    tabBadgeText: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 9,
      color: theme.textSecondary,
    },
    content: {
      padding: Spacing.pagePx,
      paddingBottom: 100,
      gap: Spacing.cardGap,
    },
    emptyState: {
      paddingTop: 60,
      alignItems: 'center',
      gap: 8,
    },
    emptyTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textSecondary,
      letterSpacing: -0.2,
    },
    emptySubtitle: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
      textAlign: 'center',
    },
    emptyText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
      textAlign: 'center',
      paddingTop: 40,
    },
    errorText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: Colors.negative,
      textAlign: 'center',
      paddingTop: 40,
    },
  }), [theme]);
}
