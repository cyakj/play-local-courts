import { useEffect, useState } from 'react';
import {
  RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { router } from 'expo-router';
import { Building2 } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, Spacing, getHealthColor, getHealthAccent, MaxWidth,
} from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { StatsGrid } from '@/components/ui/StatsGrid';
import { HealthBar } from '@/components/ui/HealthBar';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Database } from '@/lib/types';

type Hoa = Database['public']['Tables']['hoas']['Row'];

interface CommunityWithStats extends Hoa {
  memberCount: number;
  openIssues: number;
  activeBookings: number;
  healthScore: number;
}

export default function AdminHubScreen() {
  const [communities, setCommunities] = useState<CommunityWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState('');

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      if (profile) setUserName(profile.full_name?.trim() ?? '');
    }

    const { data: hoas } = await supabase.from('hoas').select('*');
    if (!hoas) { setLoading(false); return; }

    const enriched: CommunityWithStats[] = await Promise.all(
      hoas.map(async (hoa) => {
        const [membersRes, issuesRes, courtsRes] = await Promise.all([
          supabase.from('hoa_memberships').select('id', { count: 'exact' }).eq('hoa_id', hoa.id),
          supabase.from('maintenance_reports').select('id', { count: 'exact' }).eq('hoa_id', hoa.id).eq('status', 'open'),
          supabase.from('courts').select('id').eq('hoa_id', hoa.id),
        ]);
        const memberCount = membersRes.count ?? 0;
        const openIssues = issuesRes.count ?? 0;

        let activeBookings = 0;
        const courtIds = (courtsRes.data ?? []).map((c) => c.id);
        if (courtIds.length > 0) {
          const bookingsRes = await supabase
            .from('bookings')
            .select('id', { count: 'exact' })
            .in('court_id', courtIds);
          activeBookings = bookingsRes.count ?? 0;
        }

        const healthScore = Math.max(0, Math.min(100, 100 - openIssues * 5));
        return { ...hoa, memberCount, openIssues, activeBookings, healthScore };
      })
    );

    setCommunities(enriched);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const totalCommunities = communities.length;
  const totalOpenIssues = communities.reduce((s, c) => s + c.openIssues, 0);
  const totalBookings = communities.reduce((s, c) => s + c.activeBookings, 0);
  const totalMembers = communities.reduce((s, c) => s + c.memberCount, 0);
  const avgHealth = communities.length
    ? Math.round(communities.reduce((s, c) => s + c.healthScore, 0) / communities.length)
    : 0;

  const firstName = userName ? userName.split(' ')[0] : '';
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning,' : hour < 18 ? 'Good afternoon,' : 'Good evening,';

  return (
    <View style={styles.screen}>
      <Header
        variant="cm-portfolio"
        greeting={firstName ? `${timeGreeting}\n${firstName}` : timeGreeting}
        subCopy="Your portfolio is being monitored for performance and occupancy efficiency."
        onBell={() => router.push('/notifications')}
        onMenu={() => router.push('/settings')}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accentCyan} />}
        showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          {/* Portfolio health score */}
          <Card style={styles.healthCard}>
            <Text style={styles.healthLabel}>PORTFOLIO HEALTH</Text>
            <Text style={[styles.healthScore, { color: getHealthColor(avgHealth) }]}>{avgHealth}</Text>
            <HealthBar score={avgHealth} height={6} />
          </Card>

          {/* Portfolio stats */}
          <StatsGrid stats={[
            { value: totalCommunities, label: 'Communities' },
            { value: totalOpenIssues, label: 'Issues' },
            { value: totalBookings, label: 'Bookings' },
            { value: totalMembers, label: 'Members' },
          ]} />

          {/* Community list */}
          <Text style={styles.sectionTitle}>Your Communities</Text>

          {loading && [0, 1, 2].map((i) => <CardSkeleton key={i} />)}

          {!loading && communities.length === 0 && (
            <EmptyState
              icon={<Building2 color={Colors.textMuted} size={48} strokeWidth={1.5} />}
              title="No communities yet"
              subtitle="Communities you manage will appear here."
            />
          )}

          {!loading && communities.map((c) => (
            <Card key={c.id} accent={getHealthAccent(c.healthScore)} style={styles.communityCard}>
              <View style={styles.communityHeader}>
                <Text style={styles.communityName} numberOfLines={1}>{c.name}</Text>
                <StatusPill status={c.healthScore >= 70 ? 'optimal' : c.healthScore >= 40 ? 'needs-attention' : 'critical'} />
              </View>

              <View style={styles.healthRow}>
                <Text style={styles.healthRowLabel}>HEALTH SCORE</Text>
                <Text style={[styles.healthRowValue, { color: getHealthColor(c.healthScore) }]}>{c.healthScore}</Text>
              </View>
              <HealthBar score={c.healthScore} />

              <View style={styles.divider} />
              <StatsGrid stats={[
                { value: c.memberCount, label: 'Members' },
                { value: 0, label: 'Amenities' },
                { value: c.activeBookings, label: 'Bookings' },
                { value: c.openIssues, label: 'Issues' },
              ]} />

              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.manageRow}
                onPress={() => router.push({ pathname: '/(admin)/manage-amenities', params: { hoaId: c.id } })}>
                <Text style={styles.manageLink}>Manage →</Text>
              </TouchableOpacity>
            </Card>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },
  scroll: { flex: 1 },
  content: { padding: Spacing.pagePx, gap: Spacing.cardGap, paddingBottom: 100 },
  healthCard: { alignItems: 'center', gap: 8, marginBottom: 4 },
  healthLabel: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.metadata, color: Colors.textMuted, letterSpacing: 1.2 },
  healthScore: { fontFamily: FontFamily.manropeBlack, fontSize: FontSize.keyMetric },
  sectionTitle: { fontFamily: FontFamily.manropeExtraBold, fontSize: FontSize.sectionTitle, color: Colors.navy, marginTop: Spacing.sectionGap, marginBottom: 4 },
  communityCard: { gap: 12, marginBottom: 0 },
  communityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  communityName: { fontFamily: FontFamily.manropeExtraBold, fontSize: FontSize.cardTitle, color: Colors.navy, flex: 1, marginRight: 8 },
  healthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  healthRowLabel: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.metadata, color: Colors.textMuted, letterSpacing: 1.2 },
  healthRowValue: { fontFamily: FontFamily.manropeBold, fontSize: 20 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 4 },
  manageRow: { alignItems: 'flex-end' },
  manageLink: { fontFamily: FontFamily.manropeExtraBold, fontSize: 14, color: Colors.accentCyan, fontWeight: '800' },
});
