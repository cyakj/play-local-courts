import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { BarChart2 } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing,
} from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { useTheme } from '@/context/ThemeContext';
import { useActiveCommunity } from '@/hooks/useActiveCommunity';
import { fetchAnnouncements, type AnnouncementCategory } from '@/lib/announcements';
import { UrgentDot, CategoryChip } from '@/components/community/AnnouncementMeta';

interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  created_at: string;
  isSurveyResult?: boolean;
  surveyId?: string;
  isUrgent?: boolean;
  category?: AnnouncementCategory;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins <= 1 ? 'just now' : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default function AnnouncementsScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { community, loading: communityLoading } = useActiveCommunity();
  const hoaId = community?.hoaId;

  // Always the ACTIVE community (same as the Community screen that links here); stale responses are discarded.
  useEffect(() => {
    let cancelled = false;
    setItems([]);
    setExpandedId(null);
    async function load() {
      try {
        if (communityLoading) { setLoading(true); return; }
        if (!hoaId) { setLoading(false); return; }
        setLoading(true);

        const [announcementsRes, surveysRes] = await Promise.all([
          fetchAnnouncements(hoaId, 200),
          supabase
            .from('hoa_surveys')
            .select('id, title, created_at, closes_at')
            .eq('hoa_id', hoaId)
            .eq('status', 'closed')
            .eq('results_visibility', 'community')
            .order('closes_at', { ascending: false }),
        ]);
        if (cancelled) return;

        const announcements: AnnouncementItem[] = announcementsRes.rows.map((a) => ({
          id: a.id,
          title: a.title,
          body: a.body,
          created_at: a.created_at ?? new Date(0).toISOString(),
          isUrgent: a.isUrgent,
          category: a.category,
        }));

        const surveyResults: AnnouncementItem[] = (surveysRes.data ?? []).map((s: any) => ({
          id: `survey-results-${s.id}`,
          surveyId: s.id,
          isSurveyResult: true,
          title: `Survey Results: ${s.title}`,
          body: `Results are now available for "${s.title}" — tap to view the community results.`,
          created_at: s.closes_at ?? s.created_at,
        }));

        const merged = [...announcements, ...surveyResults]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        setItems(merged);
        setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [hoaId, communityLoading]);

  return (
    <View style={styles.screen}>
      <Header
        variant="inner"
        title="Announcements"
        onBack={() => router.back()}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={Colors.cyan} size="large" />
            </View>
          ) : items.length === 0 ? (
            <View testID="announcements-empty" style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No announcements yet</Text>
              <Text style={styles.emptySubtitle}>
                Check back later for HOA updates and announcements.
              </Text>
            </View>
          ) : (
            items.map((item) => {
              const isExpanded = expandedId === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  testID="announcement-item"
                  style={styles.card}
                  onPress={() => setExpandedId(isExpanded ? null : item.id)}
                  activeOpacity={0.8}>
                  <View style={styles.itemTitleRow}>
                    {item.isUrgent ? <UrgentDot /> : null}
                    <Text style={[styles.itemTitle, { flex: 1, marginBottom: 0 }]}>{item.title}</Text>
                  </View>
                  {item.category ? <CategoryChip category={item.category} theme={theme} /> : null}
                  <Text style={styles.itemBody} numberOfLines={isExpanded ? undefined : 2}>
                    {item.body}
                  </Text>
                  <Text style={styles.itemTime}>{timeAgo(item.created_at)}</Text>
                  {item.isSurveyResult && (
                    <TouchableOpacity
                      testID="survey-view-results-btn"
                      style={styles.viewResultsBtn}
                      onPress={() => router.push({ pathname: '/survey-results/[id]', params: { id: item.surveyId } } as any)}>
                      <BarChart2 color={Colors.cyan} size={15} strokeWidth={1.75} />
                      <Text style={styles.viewResultsBtnText}>View Results →</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })
          )}

        </View>
      </ScrollView>
    </View>
  );
}

function useStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return useMemo(() => StyleSheet.create({
    screen:  { flex: 1, backgroundColor: theme.pageBg },
    content: { padding: Spacing.pagePx, paddingBottom: 60 },

    loadingBox: { alignItems: 'center', paddingVertical: 60 },

    emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 8 },
    emptyTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.sectionTitle,
      color: theme.textPrimary,
    },
    emptySubtitle: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textMuted,
      textAlign: 'center' as const,
      paddingHorizontal: 24,
    },

    card: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
      ...theme.shadowCard,
    },
    itemTitle: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: 15,
      color: theme.textPrimary,
      marginBottom: 6,
    },
    itemTitleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginBottom: 6 },
    itemBody: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textSecondary,
      lineHeight: 20,
    },
    itemTime: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 11,
      color: theme.textMuted,
      marginTop: 8,
    },
    viewResultsBtn: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 6,
      backgroundColor: theme.selectedBg,
      borderRadius: Radius.button,
      borderWidth: 1.5,
      borderColor: theme.selectedBorder,
      paddingHorizontal: 14,
      paddingVertical: 9,
      marginTop: 12,
      alignSelf: 'flex-start' as const,
    },
    viewResultsBtnText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: 13,
      color: theme.selectedBorder,
    },
  }), [theme]);
}
