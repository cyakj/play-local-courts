import { useEffect, useState } from 'react';
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
  Colors, FontFamily, FontSize, MaxWidth, Radius, Shadow, Spacing,
} from '@/constants/design';
import { Header } from '@/components/ui/Header';

interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  created_at: string;
  isSurveyResult?: boolean;
  surveyId?: string;
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
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user ?? null;
        if (!user) { setLoading(false); return; }

        const { data: membership } = await supabase
          .from('hoa_memberships')
          .select('hoa_id')
          .eq('user_id', user.id)
          .eq('status', 'approved')
          .limit(1)
          .single();

        const hoaId = membership?.hoa_id;
        if (!hoaId) { setLoading(false); return; }

        const [announcementsRes, surveysRes] = await Promise.all([
          supabase
            .from('hoa_announcements')
            .select('id, title, body, created_at')
            .eq('hoa_id', hoaId)
            .order('created_at', { ascending: false }),
          supabase
            .from('hoa_surveys')
            .select('id, title, created_at, closes_at')
            .eq('hoa_id', hoaId)
            .eq('status', 'closed')
            .eq('results_visibility', 'community')
            .order('closes_at', { ascending: false }),
        ]);

        const announcements: AnnouncementItem[] = (announcementsRes.data ?? []).map((a: any) => ({
          id: a.id,
          title: a.title,
          body: a.body,
          created_at: a.created_at,
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
        setLoading(false);
      }
    }
    load();
  }, []);

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
              <ActivityIndicator color={Colors.accentCyan} size="large" />
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
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemBody} numberOfLines={isExpanded ? undefined : 2}>
                    {item.body}
                  </Text>
                  <Text style={styles.itemTime}>{timeAgo(item.created_at)}</Text>
                  {item.isSurveyResult && (
                    <TouchableOpacity
                      testID="survey-view-results-btn"
                      style={styles.viewResultsBtn}
                      onPress={() => router.push({ pathname: '/survey-results/[id]', params: { id: item.surveyId } } as any)}>
                      <BarChart2 color={Colors.accentCyan} size={15} strokeWidth={1.75} />
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },
  content: { padding: Spacing.pagePx, paddingBottom: 60 },

  loadingBox: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: FontFamily.manropeBold,
    fontSize: FontSize.sectionTitle,
    color: Colors.navy,
  },
  emptySubtitle: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 24,
  },

  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow,
  },
  itemTitle: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: 15,
    color: Colors.navy,
    marginBottom: 6,
  },
  itemBody: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: Colors.textMuted,
    lineHeight: 20,
  },
  itemTime: {
    fontFamily: FontFamily.interRegular,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 8,
  },
  viewResultsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,212,255,0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.25)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  viewResultsBtnText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 13,
    color: Colors.accentCyan,
  },
});
