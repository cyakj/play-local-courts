import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Wrench } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Shadow, Spacing,
} from '@/constants/design';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusPill } from '@/components/ui/StatusPill';

interface Report {
  id: string;
  category: string;
  description: string;
  status: string;
  created_at: string;
}

type ReportStatus = 'open' | 'in-progress' | 'resolved';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

export default function MyReportsScreen() {
  const insets = useSafeAreaInsets();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'all'>('active');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from('maintenance_reports')
        .select('id, category, description, status, created_at')
        .eq('reporter_id', user.id)
        .order('created_at', { ascending: false });

      setReports(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = filter === 'active'
    ? reports.filter((r) => r.status !== 'resolved')
    : reports;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={Colors.white} size={22} strokeWidth={1.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Reports</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          <View style={styles.filterRow}>
            {(['active', 'all'] as const).map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterPill, filter === f && styles.filterPillActive]}
                onPress={() => setFilter(f)}>
                <Text style={[styles.filterLabel, filter === f && styles.filterLabelActive]}>
                  {f === 'active' ? 'Active' : 'All'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading ? (
            <><CardSkeleton /><CardSkeleton /></>
          ) : filtered.length === 0 ? (
            <EmptyState icon={null} title="No reports" subtitle={filter === 'active' ? 'No open issues — great!' : 'You haven\'t submitted any reports yet.'} />
          ) : (
            filtered.map((r) => (
              <View key={r.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.iconWrap}>
                    <Wrench color={Colors.navy} size={16} strokeWidth={1.5} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardCategory}>{r.category}</Text>
                    <Text style={styles.cardTime}>{timeAgo(r.created_at)}</Text>
                  </View>
                  <StatusPill
                    status={(['open', 'in-progress', 'resolved'].includes(r.status) ? r.status : 'open') as ReportStatus}
                  />
                </View>
                <Text style={styles.cardDesc} numberOfLines={3}>{r.description}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },
  header: {
    backgroundColor: Colors.headerBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.pagePx,
    paddingBottom: 20,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FontFamily.manropeExtraBold, fontSize: 18, color: Colors.white },
  content: { padding: Spacing.pagePx, paddingBottom: 60 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  filterPill: {
    borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.cardBg,
  },
  filterPillActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  filterLabel: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.uiLabel, color: Colors.textMuted },
  filterLabelActive: { color: Colors.white },
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.card,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  iconWrap: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: Colors.pageBg,
    alignItems: 'center', justifyContent: 'center',
  },
  cardCategory: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.uiLabel,
    color: Colors.textPrimary,
    textTransform: 'capitalize',
  },
  cardTime: { fontFamily: FontFamily.interRegular, fontSize: FontSize.metadata, color: Colors.textMuted },
  cardDesc: { fontFamily: FontFamily.interRegular, fontSize: FontSize.body, color: Colors.textSubtle, lineHeight: 22 },
});
