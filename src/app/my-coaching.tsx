import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  BookOpen,
  Calendar,
  CheckCircle,
  Clock,
  Star,
} from 'lucide-react-native';
import { Header } from '@/components/ui/Header';
import { LessonRequestRow, LessonRequestRowSkeleton } from '@/components/coaching/LessonRequestRow';
import { ReviewSheet } from '@/components/coaching/ReviewSheet';
import { Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { useLessonRequests, type LessonRequest } from '@/hooks/useLessonRequests';

type TabId = 'upcoming' | 'pending' | 'history' | 'reviews';

const TABS: { id: TabId; label: string }[] = [
  { id: 'upcoming',  label: 'Upcoming'  },
  { id: 'pending',   label: 'Pending'   },
  { id: 'history',   label: 'History'   },
  { id: 'reviews',   label: 'Reviews'   },
];

function isReviewEligible(r: LessonRequest): boolean {
  return (
    r.status === 'completed' &&
    r.attendanceStatus === 'attended' &&
    r.reviewEligibleAt != null &&
    new Date(r.reviewEligibleAt) <= new Date()
  );
}

export default function MyCoachingScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);

  const [activeTab, setActiveTab] = useState<TabId>('upcoming');
  const [reviewRequest, setReviewRequest] = useState<LessonRequest | null>(null);

  const { requests, loading, error, refresh } = useLessonRequests();

  useFocusEffect(useCallback(() => {
    refresh();
  }, [refresh]));

  // Tab data
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const upcoming = useMemo(() =>
    requests.filter(r => {
      if (!['approved','confirmed'].includes(r.status)) return false;
      const dateStr = r.confirmedDate ?? r.preferredDate;
      return dateStr ? new Date(dateStr + 'T00:00:00') >= today : true;
    }),
  [requests, today]);

  const pending = useMemo(() =>
    requests.filter(r => r.status === 'pending'),
  [requests]);

  const history = useMemo(() =>
    requests.filter(r =>
      ['completed','cancelled','coach_cancelled','no_show','expired','declined'].includes(r.status),
    ),
  [requests]);

  const reviewsNeeded = useMemo(() =>
    requests.filter(isReviewEligible),
  [requests]);

  function getTabData(): LessonRequest[] {
    switch (activeTab) {
      case 'upcoming': return upcoming;
      case 'pending':  return pending;
      case 'history':  return history;
      case 'reviews':  return reviewsNeeded;
    }
  }

  function getTabBadge(tab: TabId): number {
    switch (tab) {
      case 'upcoming': return upcoming.length;
      case 'pending':  return pending.length;
      case 'reviews':  return reviewsNeeded.length;
      default: return 0;
    }
  }

  function getEmptyState(tab: TabId): { icon: React.ReactNode; title: string; body: string } {
    switch (tab) {
      case 'upcoming': return {
        icon: <Calendar size={36} strokeWidth={1.5} color={theme.textMuted} />,
        title: 'No upcoming lessons',
        body: 'Lessons approved or confirmed will appear here.',
      };
      case 'pending': return {
        icon: <Clock size={36} strokeWidth={1.5} color={theme.textMuted} />,
        title: 'No pending requests',
        body: 'Lesson requests waiting for coach approval appear here.',
      };
      case 'history': return {
        icon: <BookOpen size={36} strokeWidth={1.5} color={theme.textMuted} />,
        title: 'No lesson history',
        body: 'Completed, declined, and expired requests appear here.',
      };
      case 'reviews': return {
        icon: <Star size={36} strokeWidth={1.5} color={theme.textMuted} />,
        title: 'No reviews needed',
        body: 'Completed lessons that need a review appear here.',
      };
    }
  }

  const tabData = getTabData();
  const emptyState = getEmptyState(activeTab);

  return (
    <View style={styles.screen}>
      <Header variant="inner" title="My Lessons" onBack={() => { if (router.canGoBack()) router.back(); else router.replace('/(resident)/me' as any); }} />

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarContent}>
          {TABS.map(tab => {
            const active = tab.id === activeTab;
            const badge = getTabBadge(tab.id);
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabBtn, active && styles.tabBtnActive]}
                onPress={() => setActiveTab(tab.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabBtnLabel, active && styles.tabBtnLabelActive]}>
                  {tab.label}
                </Text>
                {badge > 0 && (
                  <View style={[styles.badge, active && styles.badgeActive]}>
                    <Text style={[styles.badgeTxt, active && styles.badgeTxtActive]}>{badge}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Error */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorTxt}>Failed to load. Tap to retry.</Text>
          <TouchableOpacity onPress={refresh}>
            <Text style={styles.retryTxt}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* List */}
      {loading ? (
        <View style={styles.skeletonList}>
          <LessonRequestRowSkeleton />
          <LessonRequestRowSkeleton />
          <LessonRequestRowSkeleton />
        </View>
      ) : (
        <FlatList
          data={tabData}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={styles.rowWrap}>
              <LessonRequestRow
                request={item}
                onRefresh={refresh}
                onLeaveReview={isReviewEligible(item) ? () => setReviewRequest(item) : undefined}
              />
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              {emptyState.icon}
              <Text style={styles.emptyTitle}>{emptyState.title}</Text>
              <Text style={styles.emptyBody}>{emptyState.body}</Text>
              {activeTab === 'upcoming' || activeTab === 'pending' ? (
                <TouchableOpacity
                  style={styles.discoverBtn}
                  onPress={() => router.push('/(resident)/coaches' as any)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.discoverBtnLabel}>Find a Coach</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={refresh}
              tintColor={Colors.cyan}
            />
          }
        />
      )}

      {/* Review Sheet (Phase 6) */}
      {reviewRequest && (
        <ReviewSheet
          visible={!!reviewRequest}
          onClose={() => setReviewRequest(null)}
          onSuccess={() => { setReviewRequest(null); refresh(); }}
          lessonRequestId={reviewRequest.id}
          coachUserId={reviewRequest.coachId}
          coachName={reviewRequest.coachName ?? 'Coach'}
        />
      )}
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.pageBg,
    },
    tabBar: {
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    tabBarContent: {
      flexDirection: 'row',
      paddingHorizontal: Spacing.pagePx,
      gap: 4,
    },
    tabBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabBtnActive: {
      borderBottomColor: Colors.cyan,
    },
    tabBtnLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textMuted,
    },
    tabBtnLabelActive: {
      color: Colors.cyan,
    },
    badge: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    badgeActive: {
      backgroundColor: 'rgba(45,224,255,0.15)',
    },
    badgeTxt: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 10,
      color: theme.textMuted,
    },
    badgeTxtActive: {
      color: Colors.cyan,
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      margin: Spacing.pagePx,
      padding: 12,
      backgroundColor: 'rgba(255,92,107,0.10)',
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: 'rgba(255,92,107,0.25)',
    },
    errorTxt: {
      flex: 1,
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: Colors.negative,
    },
    retryTxt: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.negative,
    },
    skeletonList: {
      padding: Spacing.pagePx,
      gap: Spacing.cardGap,
    },
    rowWrap: {
      paddingHorizontal: Spacing.pagePx,
    },
    listContent: {
      paddingTop: 16,
      paddingBottom: 100,
      gap: Spacing.cardGap,
      maxWidth: MaxWidth,
      width: '100%',
      alignSelf: 'center',
    },
    emptyWrap: {
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
    discoverBtn: {
      marginTop: 8,
      backgroundColor: Colors.blue,
      paddingHorizontal: 24,
      paddingVertical: 13,
      borderRadius: Radius.sm,
    },
    discoverBtnLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.white,
    },
  }), [theme]);
}
