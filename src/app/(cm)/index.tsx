import { useEffect, useState } from 'react';
import {
  RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { router } from 'expo-router';
import {
  AlertTriangle, Building2, Calendar, Clock, Plus, TrendingUp,
} from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, Spacing, getHealthColor, getHealthAccent, MaxWidth, Shadow,
} from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { StatusPill } from '@/components/ui/StatusPill';
import { HealthBar } from '@/components/ui/HealthBar';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Database } from '@/lib/types';

type Hoa = Database['public']['Tables']['hoas']['Row'];

interface CommunityWithStats extends Hoa {
  memberCount: number;
  openIssues: number;
  todayBookings: number;
  courtCount: number;
  pendingApprovals: number;
  healthScore: number;
}

export default function AdminHubScreen() {
  const [communities, setCommunities] = useState<CommunityWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState('');

  const todayIso = new Date().toISOString().split('T')[0];

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles').select('full_name').eq('id', user.id).single();
      if (profile) setUserName(profile.full_name?.trim() ?? '');
    }

    const { data: hoas } = await supabase.from('hoas').select('*');
    if (!hoas) { setLoading(false); return; }

    const enriched: CommunityWithStats[] = await Promise.all(
      hoas.map(async (hoa) => {
        const [membersRes, issuesRes, courtsRes, pendingRes] = await Promise.all([
          supabase.from('hoa_members').select('id', { count: 'exact' }).eq('hoa_id', hoa.id).eq('status', 'active'),
          supabase.from('maintenance_reports').select('id', { count: 'exact' }).eq('hoa_id', hoa.id).eq('status', 'open'),
          supabase.from('courts').select('id').eq('hoa_id', hoa.id),
          supabase.from('community_join_requests').select('id', { count: 'exact' }).eq('hoa_id', hoa.id).eq('status', 'pending'),
        ]);

        const memberCount = membersRes.count ?? 0;
        const openIssues = issuesRes.count ?? 0;
        const courtIds = (courtsRes.data ?? []).map((c) => c.id);
        const courtCount = courtIds.length;
        const pendingApprovals = pendingRes.count ?? 0;

        let todayBookings = 0;
        if (courtIds.length > 0) {
          const bookingsRes = await supabase
            .from('bookings')
            .select('id', { count: 'exact' })
            .in('court_id', courtIds)
            .eq('date', todayIso);
          todayBookings = bookingsRes.count ?? 0;
        }

        const healthScore = Math.max(0, Math.min(100, 100 - openIssues * 5));
        return { ...hoa, memberCount, openIssues, todayBookings, courtCount, pendingApprovals, healthScore };
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

  const totalOpenIssues = communities.reduce((s, c) => s + c.openIssues, 0);
  const totalTodayBookings = communities.reduce((s, c) => s + c.todayBookings, 0);
  const totalMembers = communities.reduce((s, c) => s + c.memberCount, 0);
  const totalPending = communities.reduce((s, c) => s + c.pendingApprovals, 0);
  const avgHealth = communities.length
    ? Math.round(communities.reduce((s, c) => s + c.healthScore, 0) / communities.length)
    : 0;
  const needsAttention = communities.find((c) => c.healthScore < 70);

  const firstName = userName ? userName.split(' ')[0] : '';
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning,' : hour < 18 ? 'Good afternoon,' : 'Good evening,';

  const statCards = [
    { Icon: AlertTriangle, value: totalOpenIssues, label: 'Open Issues', onPress: undefined },
    { Icon: Calendar, value: totalTodayBookings, label: "Today's Bookings", onPress: undefined },
    { Icon: Building2, value: totalMembers, label: 'Members', onPress: undefined },
    { Icon: Clock, value: totalPending, label: 'Pending', onPress: () => router.push('/(admin)/pending-requests') },
  ] as const;

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

          {/* 2×2 stats grid */}
          <View style={styles.statsGrid}>
            {statCards.map(({ Icon, value, label, onPress }) => (
              <TouchableOpacity
                key={label}
                style={styles.statCard}
                onPress={onPress}
                disabled={!onPress}
                activeOpacity={onPress ? 0.8 : 1}>
                <Icon color={Colors.accentCyan} size={20} strokeWidth={1.5} />
                <View style={styles.statBottom}>
                  <Text style={styles.statValue}>{value}</Text>
                  <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Portfolio Health Card */}
          <View style={styles.healthCard}>
            <View style={styles.healthCardTop}>
              <View>
                <Text style={styles.healthCardLabel}>Portfolio Health</Text>
                <View style={styles.healthScoreRow}>
                  <Text style={[styles.healthScoreNum, { color: getHealthColor(avgHealth) }]}>{avgHealth}</Text>
                  <Text style={styles.healthScoreDenom}>/100</Text>
                </View>
              </View>
              <View style={styles.trendingIcon}>
                <TrendingUp color={Colors.textMuted} size={16} strokeWidth={1.5} />
              </View>
            </View>
            <View style={styles.healthBarBg}>
              <View style={[styles.healthBarFill, { width: `${avgHealth}%`, backgroundColor: getHealthColor(avgHealth) }]} />
            </View>
            {needsAttention && (
              <View style={styles.needsAttentionRow}>
                <View style={[styles.attentionDot, { backgroundColor: Colors.coral }]} />
                <Text style={styles.attentionText}>Needs attention at {needsAttention.name}</Text>
              </View>
            )}
          </View>

          {/* My Communities */}
          <Text style={styles.sectionTitle}>My Communities</Text>

          {loading && [0, 1, 2].map((i) => <CardSkeleton key={i} />)}

          {!loading && communities.length === 0 && (
            <EmptyState
              icon={<Building2 color={Colors.textMuted} size={48} strokeWidth={1.5} />}
              title="No communities yet"
              subtitle="Communities you manage will appear here."
            />
          )}

          {!loading && communities.map((c) => {
            const alerts = c.openIssues + c.pendingApprovals;
            return (
              <TouchableOpacity
                key={c.id}
                style={styles.communityCard}
                onPress={() => router.push({ pathname: '/(admin)/manage-amenities', params: { hoaId: c.id } })}
                activeOpacity={0.85}>

                {/* Name + Status pill */}
                <View style={styles.communityHeader}>
                  <Text style={styles.communityName} numberOfLines={1}>{c.name}</Text>
                  <StatusPill status={c.healthScore >= 70 ? 'optimal' : c.healthScore >= 40 ? 'needs-attention' : 'critical'} />
                </View>

                {/* Health Score */}
                <View style={styles.healthRow}>
                  <Text style={styles.healthRowLabel}>HEALTH SCORE</Text>
                  <Text style={[styles.healthRowValue, { color: getHealthColor(c.healthScore) }]}>
                    {c.healthScore}/100
                  </Text>
                </View>
                <View style={styles.healthBarBg}>
                  <View style={[styles.healthBarFill, { width: `${c.healthScore}%`, backgroundColor: getHealthColor(c.healthScore) }]} />
                </View>

                {/* 4-column stats */}
                <View style={styles.communityStats}>
                  {[
                    { value: c.courtCount, label: 'Amenities' },
                    { value: c.memberCount, label: 'Members' },
                    { value: c.openIssues, label: 'Issues' },
                    { value: alerts, label: 'Alerts' },
                  ].map(({ value, label }) => (
                    <View key={label} style={styles.statCol}>
                      <Text style={styles.statColValue}>{value}</Text>
                      <Text style={styles.statColLabel}>{label.toUpperCase()}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.divider} />
                <View style={styles.manageRow}>
                  <Text style={styles.manageLink}>Manage →</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Add Community dashed card */}
          {!loading && (
            <View style={styles.addCommunityCard}>
              <View style={styles.addCommunityInner}>
                <Plus color={Colors.textMuted} size={20} strokeWidth={1.5} />
              </View>
              <Text style={styles.addCommunityLabel}>ADD COMMUNITY</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },
  scroll: { flex: 1 },
  content: { padding: Spacing.pagePx, gap: Spacing.cardGap, paddingBottom: 100 },

  // 2×2 stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    padding: 20,
    width: '47%',
    height: 112,
    flexDirection: 'column',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow,
  },
  statBottom: {},
  statValue: {
    fontFamily: FontFamily.manropeBold,
    fontSize: 24,
    color: Colors.navy,
    lineHeight: 28,
  },
  statLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.metadata,
    color: Colors.textSubtle,
    letterSpacing: 0.8,
    marginTop: 4,
  },

  // Portfolio health card
  healthCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow,
  },
  healthCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  healthCardLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.metadata,
    color: Colors.textSubtle,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  healthScoreRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  healthScoreNum: {
    fontFamily: FontFamily.manropeBlack,
    fontSize: 40,
    lineHeight: 44,
  },
  healthScoreDenom: {
    fontFamily: FontFamily.interRegular,
    fontSize: 18,
    color: Colors.textSubtle,
    marginBottom: 4,
  },
  trendingIcon: {
    width: 40, height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthBarBg: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 99,
    overflow: 'hidden',
    marginBottom: 12,
  },
  healthBarFill: { height: '100%', borderRadius: 99 },
  needsAttentionRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  attentionDot: { width: 6, height: 6, borderRadius: 3 },
  attentionText: {
    fontFamily: FontFamily.interRegular,
    fontSize: 13,
    color: Colors.textSubtle,
  },

  // Community cards
  sectionTitle: {
    fontFamily: FontFamily.manropeBold,
    fontSize: FontSize.sectionTitle,
    color: Colors.navy,
    marginTop: 4,
    marginBottom: 4,
  },
  communityCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow,
    gap: 10,
  },
  communityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  communityName: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: FontSize.sectionTitle,
    color: Colors.navy,
    flex: 1,
    marginRight: 8,
  },
  healthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  healthRowLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.metadata,
    color: Colors.textSubtle,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  healthRowValue: { fontFamily: FontFamily.manropeExtraBold, fontSize: 14 },
  communityStats: { flexDirection: 'row', marginTop: 4 },
  statCol: { flex: 1, alignItems: 'center' },
  statColValue: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: 20,
    color: Colors.navy,
    lineHeight: 24,
  },
  statColLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.metadata,
    color: Colors.textSubtle,
    letterSpacing: 0.8,
    marginTop: 4,
  },
  divider: { height: 1, backgroundColor: Colors.border },
  manageRow: { alignItems: 'flex-end', paddingTop: 4 },
  manageLink: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: 14,
    color: Colors.accentCyan,
  },

  // Add Community dashed card
  addCommunityCard: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#E5E7EB',
    borderRadius: 16,
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  addCommunityInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCommunityLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.metadata,
    color: Colors.textSubtle,
    letterSpacing: 1.2,
  },
});
