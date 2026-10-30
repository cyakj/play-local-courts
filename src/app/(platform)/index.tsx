import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Building2, ChevronRight, LogOut, MapPin, Users } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { db } from '@/lib/untypedDb';
import { errorMessage } from '@/lib/errors';
import { roleText, type HoaApplicationRow } from '@/lib/platformApplications';
import { A } from '@/constants/adminTheme';
import { FontFamily } from '@/constants/design';
import {
  AdminHeader, AdminScreen, Card, Chip, ChipRow, EmptyBlock, ErrorBlock, IconButton, LoadingBlock,
  MetricCard, MetricGrid, SectionTitle, StatusBadge, timeAgo,
} from '@/components/admin/kit';


type Filter = 'pending' | 'needs_more_info' | 'approved' | 'rejected' | 'all';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'needs_more_info', label: 'Needs info' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];


export default function PlatformDashboard() {
  const [apps, setApps] = useState<HoaApplicationRow[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interestCount, setInterestCount] = useState<number | undefined>();

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    async function loadInterestCount() {
      try {
        const { count, error: countError } = await db.from('community_interest_requests')
          .select('id', { count: 'exact', head: true }).eq('status', 'new');
        if (!cancelled) setInterestCount(countError ? undefined : count ?? undefined);
      } catch { if (!cancelled) setInterestCount(undefined); }
    }
    void loadInterestCount();
    return () => { cancelled = true; };
  }, []));

  const load = useCallback(async () => {
    setError(null);
    const { data, error: err } = await supabase
      .from('hoa_applications')
      .select('id, applicant_id, hoa_name, community_location, estimated_residents, claimed_role, claimed_role_other, verification_documents, status, submitted_at, reviewed_at')
      .order('submitted_at', { ascending: false });
    if (err) setError(errorMessage(err, 'Could not load applications.'));
    else setApps((data ?? []) as HoaApplicationRow[]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // New submissions and status changes appear without a manual refresh (hoa_applications is in the
  // realtime publication; rows are still filtered by RLS, so only reviewers receive them).
  useEffect(() => {
    const channel = supabase
      .channel('platform-applications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hoa_applications' }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const counts = useMemo(() => {
    const c = { pending: 0, needs_more_info: 0, approved: 0, rejected: 0, all: apps.length };
    apps.forEach((a) => { c[a.status] += 1; });
    return c;
  }, [apps]);

  const visible = useMemo(
    () => (filter === 'all' ? apps : apps.filter((a) => a.status === filter)),
    [apps, filter],
  );

  async function signOut() {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  }

  return (
    <AdminScreen
      testID="platform-dashboard"
      header={
        <AdminHeader
          title="Platform Admin"
          subtitle="Community registrations"
          showBell={false}
          showMenu
          right={<IconButton label="Sign out" onPress={signOut} Icon={LogOut} dark />}
        />
      }
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); load(); }}>
      {error ? <ErrorBlock message={error} onRetry={load} /> : null}

      <SectionTitle>Review queue</SectionTitle>
      <ChipRow>
        <Chip label="Community interest" count={interestCount} onPress={() => router.push('/(platform)/interest' as never)} />
      </ChipRow>
      {loading ? <LoadingBlock rows={2} /> : (
        <MetricGrid columns={2}>
          <MetricCard testID="metric-pending" Icon={Building2} tone={counts.pending ? 'warning' : 'success'}
            value={counts.pending} label="Awaiting review" onPress={() => setFilter('pending')} />
          <MetricCard testID="metric-info" Icon={Users} tone="info"
            value={counts.needs_more_info} label="Needs information" onPress={() => setFilter('needs_more_info')} />
        </MetricGrid>
      )}

      <SectionTitle>Applications</SectionTitle>
      <ChipRow>
        {FILTERS.map((f) => (
          <Chip key={f.key} testID={`filter-${f.key}`} label={f.label} count={counts[f.key]}
            selected={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </ChipRow>

      {loading ? <LoadingBlock /> : visible.length === 0 && !error ? (
        <Card>
          <EmptyBlock
            Icon={Building2}
            title={filter === 'pending' ? 'No applications waiting' : 'Nothing here'}
            body="New community registrations appear here as soon as they are submitted." />
        </Card>
      ) : visible.map((a) => (
        <Card
          key={a.id}
          testID={`application-${a.id}`}
          onPress={() => router.push(`/(platform)/application/${a.id}` as never)}
          accessibilityLabel={`Review ${a.hoa_name}`}
          style={{ gap: 10 }}>
          <View style={s.top}>
            <Text style={s.name} numberOfLines={2}>{a.hoa_name}</Text>
            <StatusBadge status={a.status} />
          </View>
          <View style={s.meta}>
            <MapPin size={14} color={A.textSecondary} />
            <Text style={s.metaText} numberOfLines={1}>{a.community_location}</Text>
          </View>
          <View style={s.bottom}>
            <Text style={s.metaText}>
              {a.estimated_residents} residents · {roleText(a)}
            </Text>
            <View style={s.review}>
              <Text style={s.reviewText}>{timeAgo(a.submitted_at)}</Text>
              <ChevronRight size={18} color={A.primary} />
            </View>
          </View>
        </Card>
      ))}
    </AdminScreen>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontFamily: FontFamily.spaceGroteskBold, fontSize: 18, color: A.text, letterSpacing: -0.2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontFamily: FontFamily.manropeMedium, fontSize: 14, color: A.textSecondary, flexShrink: 1 },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  review: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  reviewText: { fontFamily: FontFamily.manropeBold, fontSize: 13, color: A.link },
});
