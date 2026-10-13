import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  AlertTriangle, Building2, CalendarCheck, ChevronRight, Clock, Plus, UserCheck, Users,
} from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errors';
import { communityToday } from '@/lib/communityTime';
import { A } from '@/constants/adminTheme';
import { FontFamily } from '@/constants/design';
import {
  AdminHeader, AdminScreen, Card, EmptyBlock, ErrorBlock, LoadingBlock, MetricCard,
  MetricGrid, Pill, SectionTitle,
} from '@/components/admin/kit';
import { CommunityLogo } from '@/components/branding/BrandLogos';

interface CommunityStats {
  id: string;
  name: string;
  logoUrl: string | null;
  members: number;
  amenities: number;
  openIssues: number;
  pendingJoin: number;
  pendingBookings: number;
  todayBookings: number;
}


export default function PortfolioScreen() {
  const [communities, setCommunities] = useState<CommunityStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const [{ data: profile }, notif] = await Promise.all([
          supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
          supabase.from('hoa_notifications').select('id', { count: 'exact', head: true })
            .eq('user_id', user.id).eq('read', false),
        ]);
        setFirstName(profile?.full_name?.trim().split(' ')[0] ?? '');
        setUnread(notif.count ?? 0);
      }

      const { data: hoas, error: hoaErr } = await supabase.from('hoas').select('id, name, logo_url').order('name');
      if (hoaErr) throw hoaErr;

      const today = communityToday(); // community wall-clock date, not the device's
      const stats = await Promise.all((hoas ?? []).map(async (hoa): Promise<CommunityStats> => {
        const [members, issues, courts, joins] = await Promise.all([
          supabase.from('hoa_memberships').select('id', { count: 'exact', head: true })
            .eq('hoa_id', hoa.id).eq('status', 'approved'),
          supabase.from('maintenance_reports').select('id', { count: 'exact', head: true })
            .eq('hoa_id', hoa.id).in('status', ['open', 'in_progress']),
          supabase.from('courts').select('id').eq('hoa_id', hoa.id).eq('is_active', true),
          supabase.from('community_join_requests').select('id', { count: 'exact', head: true })
            .eq('hoa_id', hoa.id).eq('status', 'pending'),
        ]);
        const firstFailure = [members, issues, courts, joins].find((r) => r.error);
        if (firstFailure?.error) throw firstFailure.error;

        const courtIds = (courts.data ?? []).map((c) => c.id);
        let todayBookings = 0;
        let pendingBookings = 0;
        if (courtIds.length > 0) {
          const [t, p] = await Promise.all([
            supabase.from('bookings').select('id', { count: 'exact', head: true })
              .in('court_id', courtIds).eq('date', today).in('status', ['confirmed', 'pending']),
            supabase.from('bookings').select('id', { count: 'exact', head: true })
              .in('court_id', courtIds).eq('status', 'pending').gte('date', today),
          ]);
          if (t.error) throw t.error;
          if (p.error) throw p.error;
          todayBookings = t.count ?? 0;
          pendingBookings = p.count ?? 0;
        }
        return {
          id: hoa.id,
          name: hoa.name,
          logoUrl: (hoa as { logo_url?: string | null }).logo_url ?? null,
          members: members.count ?? 0,
          amenities: courtIds.length,
          openIssues: issues.count ?? 0,
          pendingJoin: joins.count ?? 0,
          pendingBookings,
          todayBookings,
        };
      }));
      setCommunities(stats);
    } catch (e) {
      setError(errorMessage(e, 'Could not load your communities.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sum = (f: (c: CommunityStats) => number) => communities.reduce((n, c) => n + f(c), 0);
  const totalPending = sum((c) => c.pendingJoin + c.pendingBookings);

  // Communities are never created directly: a new one is a registration application that a TenisX
  // platform administrator reviews (hoa_applications -> approve_hoa_application). new=1 starts a
  // fresh application even if an earlier one exists.
  function addCommunity() {
    router.push('/hoa-application?new=1' as never);
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <AdminScreen
      testID="admin-portfolio"
      header={<AdminHeader title="Portfolio" unread={unread} showMenu subtitle={`${greeting}${firstName ? `, ${firstName}` : ''}`} />}
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); load(); }}>
      {error ? <ErrorBlock message={error} onRetry={load} /> : null}

      <SectionTitle>Portfolio summary</SectionTitle>
      {loading ? <LoadingBlock rows={2} /> : (
        <MetricGrid>
          <MetricCard testID="metric-open-issues" Icon={AlertTriangle} tone="warning" value={sum((c) => c.openIssues)}
            label="Open issues" onPress={() => router.push('/(cm)/maintenance')} />
          <MetricCard testID="metric-today" Icon={CalendarCheck} tone="info" value={sum((c) => c.todayBookings)}
            label="Today's bookings" onPress={() => router.push('/(cm)/calendar')} />
          <MetricCard testID="metric-members" Icon={Users} tone="accent" value={sum((c) => c.members)}
            label="Active members" />
          <MetricCard testID="metric-pending" Icon={Clock} tone={totalPending ? 'warning' : 'success'} value={totalPending}
            label="Pending approvals" onPress={() => router.push('/(admin)/pending-requests')} />
        </MetricGrid>
      )}

      <SectionTitle
        action={
          <Pressable
            onPress={addCommunity}
            accessibilityRole="button"
            accessibilityLabel="Register a community"
            style={s.addBtn}>
            <Plus size={16} color={A.primary} strokeWidth={2.25} />
            <Text style={s.addText}>Register</Text>
          </Pressable>
        }>
        My communities
      </SectionTitle>

      {loading ? <LoadingBlock /> : communities.length === 0 && !error ? (
        <Card><EmptyBlock Icon={Building2} title="No communities yet" body="Add a community to start managing amenities, members and reports." /></Card>
      ) : communities.map((c) => {
        const pending = c.pendingJoin + c.pendingBookings;
        return (
          <Card
            key={c.id}
            testID={`community-${c.id}`}
            onPress={() => router.push(`/(cm)/community/${c.id}` as never)}
            accessibilityLabel={`Manage ${c.name}`}
            style={{ gap: 12 }}>
            <View style={s.cardTop}>
              <View style={{ flex: 1, minHeight: 28, justifyContent: 'center' }}>
                {c.logoUrl ? (
                  <CommunityLogo hoaId={c.id} name={c.name} logoUrl={c.logoUrl} height={26} maxWidth={160} />
                ) : null}
                <Text style={s.cardName} numberOfLines={1}>{c.name}</Text>
              </View>
              {pending > 0 ? <Pill tone="warning" label={`${pending} pending`} Icon={UserCheck} />
                : c.openIssues > 0 ? <Pill tone="info" label={`${c.openIssues} open`} />
                : <Pill tone="success" label="All clear" />}
            </View>
            <View style={s.statsRow}>
              <Stat value={c.members} label="Members" />
              <Stat value={c.amenities} label="Amenities" />
              <Stat value={c.openIssues} label="Issues" />
              <Stat value={pending} label="Pending" />
            </View>
            <View style={s.manageRow}>
              <Text style={s.manageText}>Manage</Text>
              <ChevronRight size={18} color={A.primary} />
            </View>
          </Card>
        );
      })}

    </AdminScreen>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 40, paddingHorizontal: 12,
    borderRadius: 12, backgroundColor: A.infoBg,
  },
  addText: { fontFamily: FontFamily.manropeBold, fontSize: 14, color: A.link },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardName: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 19, color: A.text, letterSpacing: -0.2 },
  statsRow: { flexDirection: 'row', backgroundColor: A.surfaceAlt, borderRadius: 12, paddingVertical: 10 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 20, color: A.text },
  statLabel: { fontFamily: FontFamily.manropeSemiBold, fontSize: 12, color: A.textSecondary },
  manageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  manageText: { fontFamily: FontFamily.manropeBold, fontSize: 14, color: A.link },
});
