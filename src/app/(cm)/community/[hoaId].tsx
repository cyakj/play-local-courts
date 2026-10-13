import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  AlertTriangle, CalendarCheck, CalendarClock, Clock, FileText, Search, Send, UserCheck, UserX, Users, Wrench,
} from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errors';
import { platformAlert } from '@/lib/platformAlert';
import { A } from '@/constants/adminTheme';
import { FontFamily } from '@/constants/design';
import {
  AdminHeader, AdminScreen, Button, Card, EmptyBlock, Segmented, ErrorBlock, LoadingBlock, MetricCard,
  MetricGrid, Pill, SectionTitle, StatusBadge, timeAgo,
} from '@/components/admin/kit';
import { ReportsPanel, useAdminReports, categoryLabel } from '@/components/admin/ReportsPanel';
import { CommunityLogo } from '@/components/branding/BrandLogos';
import { bundledLogoFor } from '@/config/communityBranding';
import { communityToday } from '@/lib/communityTime';

type Tab = 'overview' | 'reports' | 'amenities' | 'members';
const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'reports', label: 'Reports' },
  { key: 'amenities', label: 'Amenities' },
  { key: 'members', label: 'Members' },
];

interface ActivityItem {
  id: string;
  kind: 'join' | 'report' | 'booking';
  title: string;
  detail: string;
  status: string;
  time: string;
  reportId?: string;
}
interface AmenityRow { id: string; name: string; court_type: string; is_active: boolean; requiresApproval: boolean }
interface MemberRow {
  membershipId: string; userId: string; fullName: string; unitNumber: string | null; role: string; status: string;
}


export default function CommunityDetailScreen() {
  const { hoaId, tab: tabParam } = useLocalSearchParams<{ hoaId: string; tab?: Tab }>();
  const [tab, setTab] = useState<Tab>(tabParam && TABS.some((t) => t.key === tabParam) ? tabParam : 'overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hoa, setHoa] = useState<{ name: string; logoUrl: string | null } | null>(null);

  const [pendingJoin, setPendingJoin] = useState(0);
  const [upcoming, setUpcoming] = useState(0);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [amenities, setAmenities] = useState<AmenityRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [busyMember, setBusyMember] = useState<string | null>(null);

  const [reportsKey, setReportsKey] = useState(0);
  const [reportsStatus, setReportsStatus] = useState('all');
  const [openReportId, setOpenReportId] = useState<string | undefined>();
  const reportsData = useAdminReports(hoaId);

  const load = useCallback(async () => {
    if (!hoaId) return;
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

      const { data: hoaRow, error: hErr } = await supabase.from('hoas').select('name, logo_url').eq('id', hoaId).maybeSingle();
      if (hErr) throw hErr;
      if (!hoaRow) throw new Error('This community was not found, or you do not have access to it.');
      setHoa({ name: hoaRow.name, logoUrl: hoaRow.logo_url ?? null });

      const [mRes, jRes, cRes] = await Promise.all([
        supabase.from('hoa_memberships').select('id, user_id, role, status').eq('hoa_id', hoaId),
        supabase.from('community_join_requests').select('id, user_id, created_at')
          .eq('hoa_id', hoaId).eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('courts').select('id, name, court_type, is_active').eq('hoa_id', hoaId).order('name'),
      ]);
      const firstErr = [mRes, jRes, cRes].find((r) => r.error)?.error;
      if (firstErr) throw firstErr;

      const memberships = mRes.data ?? [];
      const joins = jRes.data ?? [];
      const courts = cRes.data ?? [];
      const courtIds = courts.map((c) => c.id);

      const [rulesRes, bookingsRes, upcomingRes] = await Promise.all([
        courtIds.length
          ? supabase.from('amenity_rules').select('amenity_id, requires_admin_approval').in('amenity_id', courtIds)
          : { data: [], error: null },
        courtIds.length
          ? supabase.from('bookings').select('id, user_id, court_id, date, start_time, status, created_at')
              .in('court_id', courtIds).order('created_at', { ascending: false }).limit(6)
          : { data: [], error: null },
        courtIds.length
          ? supabase.from('bookings').select('id', { count: 'exact', head: true })
              .in('court_id', courtIds).gte('date', communityToday()).in('status', ['confirmed', 'pending'])
          : { count: 0, error: null },
      ]);
      const secondErr = [rulesRes, bookingsRes, upcomingRes].find((r) => r.error)?.error;
      if (secondErr) throw secondErr;

      const bookings = bookingsRes.data ?? [];
      const personIds = [...new Set([
        ...memberships.map((m) => m.user_id), ...joins.map((j) => j.user_id), ...bookings.map((b) => b.user_id),
      ])] as string[];
      const { data: people, error: pErr } = personIds.length
        ? await supabase.from('profiles').select('id, full_name, unit_number').in('id', personIds)
        : { data: [], error: null };
      if (pErr) throw pErr;
      const person = new Map((people ?? []).map((p) => [p.id, p]));
      const nameOf = (id: string) => person.get(id)?.full_name?.trim() || 'A resident';

      const approvalByCourt = new Map((rulesRes.data ?? []).map((r) => [r.amenity_id, !!r.requires_admin_approval]));
      setAmenities(courts.map((c) => ({ ...c, requiresApproval: approvalByCourt.get(c.id) ?? false })));
      setMembers(memberships.filter((m) => m.status !== 'removed').map((m) => ({
        membershipId: m.id, userId: m.user_id, fullName: nameOf(m.user_id),
        unitNumber: person.get(m.user_id)?.unit_number ?? null, role: m.role, status: m.status,
      })));
      setPendingJoin(joins.length);
      setUpcoming(upcomingRes.count ?? 0);

      const courtName = new Map(courts.map((c) => [c.id, c.name]));
      setActivity([
        ...joins.map((j): ActivityItem => ({
          id: `join-${j.id}`, kind: 'join', title: 'Join request', detail: `${nameOf(j.user_id)} requested to join`,
          status: 'pending', time: j.created_at,
        })),
        ...bookings.map((b): ActivityItem => ({
          id: `booking-${b.id}`, kind: 'booking', title: 'Reservation',
          detail: `${nameOf(b.user_id)} · ${courtName.get(b.court_id) ?? 'Amenity'} · ${b.date}`,
          status: b.status ?? 'confirmed', time: b.created_at ?? `${b.date}T00:00:00`,
        })),
      ]);
    } catch (e) {
      setError(errorMessage(e, 'Could not load this community.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [hoaId]);

  useEffect(() => { load(); }, [load]);

  const reportActivity: ActivityItem[] = reportsData.reports.slice(0, 6).map((r) => ({
    id: `report-${r.id}`, kind: 'report', title: r.title, detail: `${r.reporterName} · ${categoryLabel(r.category)}`,
    status: r.status, time: r.createdAt, reportId: r.id,
  }));
  const recent = useMemo(
    () => [...activity, ...reportActivity].sort((a, b) => +new Date(b.time) - +new Date(a.time)).slice(0, 8),
    [activity, reportActivity],
  );

  const activeMembers = members.filter((m) => m.status === 'approved').length;
  const openIssues = reportsData.reports.filter((r) => r.status === 'open' || r.status === 'in_progress').length;

  function openReports(status: string, reportId?: string) {
    setReportsStatus(status);
    setOpenReportId(reportId);
    setReportsKey((k) => k + 1);
    setTab('reports');
  }

  const filteredMembers = members.filter((m) => {
    const q = memberSearch.trim().toLowerCase();
    return !q || m.fullName.toLowerCase().includes(q) || (m.unitNumber ?? '').toLowerCase().includes(q);
  });
  const approvedAdmins = members.filter((m) => m.status === 'approved' && m.role === 'admin').length;

  async function setMembershipStatus(m: MemberRow, status: 'approved' | 'removed') {
    setBusyMember(m.membershipId);
    const { data, error: err } = await supabase.from('hoa_memberships').update({ status }).eq('id', m.membershipId).select('id');
    setBusyMember(null);
    if (err) { platformAlert('Could not update member', err.message); return; }
    if (!data?.length) { platformAlert('Could not update member', 'You do not have permission to change this membership.'); return; }
    load();
  }

  function confirmDeactivate(m: MemberRow) {
    platformAlert(
      'Deactivate member',
      `Remove ${m.fullName}'s access to ${hoa?.name ?? 'this community'}? Their history is kept, and they can be re-approved later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Deactivate', style: 'destructive', onPress: () => setMembershipStatus(m, 'removed') },
      ],
    );
  }

  async function sendReminder(m: MemberRow) {
    setBusyMember(m.membershipId);
    const { error: err } = await supabase.from('hoa_notifications').insert({
      user_id: m.userId, hoa_id: hoaId ?? '', title: 'Community invite reminder',
      body: `A reminder to finish setting up your account for ${hoa?.name ?? 'your community'}.`,
      type: 'invite_reminder', read: false,
    });
    setBusyMember(null);
    if (err) { platformAlert('Could not send reminder', err.message); return; }
    platformAlert('Reminder sent', `${m.fullName} will see a reminder in their app.`);
  }

  const kindIcon = { join: UserCheck, report: Wrench, booking: CalendarCheck } as const;

  return (
    <AdminScreen
      testID="admin-community"
      header={<AdminHeader onBack={() => router.back()} community={hoa ? { hoaId, name: hoa.name, logoUrl: hoa.logoUrl } : { name: 'Community' }} />}
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); load(); reportsData.reload(); }}>
      {hoa?.logoUrl || bundledLogoFor(hoaId) ? (
        <View style={{ minHeight: 40, justifyContent: 'center' }}>
          <CommunityLogo hoaId={hoaId} name={hoa?.name} logoUrl={hoa?.logoUrl} height={40} maxWidth={220} />
        </View>
      ) : null}
      <Segmented
        value={tab}
        onChange={setTab}
        options={TABS.map((t) => ({ value: t.key, label: t.label, testID: `tab-${t.key}` }))}
      />

      {error ? <ErrorBlock message={error} onRetry={load} /> : null}

      {tab === 'overview' && (
        <>
          {loading ? <LoadingBlock rows={2} /> : (
            <MetricGrid columns={3}>
              <MetricCard Icon={Users} tone="accent" value={activeMembers} label="Active members" onPress={() => setTab('members')} />
              <MetricCard Icon={Clock} tone={pendingJoin ? 'warning' : 'success'} value={pendingJoin} label="Pending approvals"
                onPress={() => router.push('/(admin)/pending-requests')} />
              <MetricCard Icon={AlertTriangle} tone="warning" value={openIssues} label="Open issues" onPress={() => openReports('open')} />
              <MetricCard Icon={FileText} tone="info" value={amenities.length} label="Amenities" onPress={() => setTab('amenities')} />
              <MetricCard Icon={CalendarCheck} tone="info" value={upcoming} label="Upcoming reservations" onPress={() => router.push('/(cm)/calendar')} />
            </MetricGrid>
          )}
          <SectionTitle>Recent activity</SectionTitle>
          {loading ? <LoadingBlock rows={2} /> : recent.length === 0 ? (
            <Card><EmptyBlock Icon={CalendarClock} title="No recent activity" body="New requests, reservations and reports will show up here." /></Card>
          ) : (
            <Card style={{ padding: 4 }}>
              {recent.map((a, i) => {
                const Icon = kindIcon[a.kind];
                const go = () => {
                  if (a.kind === 'report') openReports('all', a.reportId);
                  else if (a.kind === 'join') router.push('/(admin)/pending-requests');
                  else router.push('/(cm)/calendar');
                };
                return (
                  <Pressable key={a.id} onPress={go} accessibilityRole="button" accessibilityLabel={`${a.title}. ${a.detail}`}
                    style={[s.actRow, i > 0 && { borderTopWidth: 1, borderTopColor: A.border }]}>
                    <View style={s.actIcon}><Icon size={16} color={A.infoText} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.actTitle} numberOfLines={1}>{a.title}</Text>
                      <Text style={s.actDetail} numberOfLines={1}>{a.detail}</Text>
                      <Text style={s.actTime}>{timeAgo(a.time)}</Text>
                    </View>
                    <StatusBadge status={a.status} />
                  </Pressable>
                );
              })}
            </Card>
          )}
        </>
      )}

      {tab === 'reports' && (
        <ReportsPanel
          key={reportsKey}
          reports={reportsData.reports}
          communities={reportsData.communities}
          loading={reportsData.loading}
          error={reportsData.error}
          reload={reportsData.reload}
          initialStatus={reportsStatus}
          openReportId={openReportId}
        />
      )}

      {tab === 'amenities' && (
        <>
          {loading ? <LoadingBlock /> : amenities.length === 0 ? (
            <Card><EmptyBlock Icon={FileText} title="No amenities yet" body="Add courts, pools and other bookable spaces." /></Card>
          ) : amenities.map((a) => (
            <Card key={a.id} style={{ gap: 8 }}>
              <View style={s.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{a.name}</Text>
                  <Text style={s.sub}>{a.court_type.replace(/_/g, ' ')}</Text>
                </View>
                <Pill tone={a.is_active ? 'success' : 'neutral'} label={a.is_active ? 'AVAILABLE' : 'CLOSED'} />
              </View>
              <Pill tone={a.requiresApproval ? 'warning' : 'info'} label={a.requiresApproval ? 'ADMIN APPROVAL REQUIRED' : 'AUTO-CONFIRMED'} />
            </Card>
          ))}
          <Button label="Manage amenities" onPress={() => router.push({ pathname: '/(admin)/manage-amenities', params: { hoaId: hoaId ?? '' } })} />
        </>
      )}

      {tab === 'members' && (
        <>
          <MetricGrid>
            <MetricCard Icon={Users} tone="accent" value={activeMembers} label="Active" />
            <MetricCard Icon={Clock} tone={pendingJoin ? 'warning' : 'success'} value={pendingJoin} label="Pending applications"
              onPress={() => router.push('/(admin)/pending-requests')} />
          </MetricGrid>
          <View style={s.search}>
            <Search size={18} color={A.textMuted} />
            <TextInput
              testID="member-search" value={memberSearch} onChangeText={setMemberSearch}
              placeholder="Search by name or unit" placeholderTextColor={A.textMuted}
              style={s.searchInput} accessibilityLabel="Search members" />
          </View>
          {loading ? <LoadingBlock /> : filteredMembers.length === 0 ? (
            <Card><EmptyBlock Icon={Users} title="No members found" body="Approved members will appear here." /></Card>
          ) : filteredMembers.map((m) => {
            const isSelf = m.userId === currentUserId;
            const isAdmin = m.role === 'admin';
            // Admins are never deactivated from this screen (role hierarchy); the last admin is doubly protected.
            const canDeactivate = m.status === 'approved' && !isAdmin && !isSelf;
            const busy = busyMember === m.membershipId;
            return (
              <Card key={m.membershipId} style={{ gap: 10 }}>
                <View style={s.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{m.fullName}{isSelf ? ' (you)' : ''}</Text>
                    <Text style={s.sub}>{m.unitNumber ? `Unit ${m.unitNumber}` : 'No unit'} · {m.role.replace(/_/g, ' ')}</Text>
                  </View>
                  <StatusBadge status={m.status} />
                </View>
                {m.status === 'pending' ? (
                  <View style={s.actions}>
                    <View style={{ flex: 1 }}><Button label="Approve" Icon={UserCheck} loading={busy} onPress={() => setMembershipStatus(m, 'approved')} /></View>
                    <View style={{ flex: 1 }}><Button label="Remind" variant="secondary" Icon={Send} disabled={busy} onPress={() => sendReminder(m)} /></View>
                  </View>
                ) : null}
                {canDeactivate ? (
                  <Button label="Deactivate" variant="secondary" Icon={UserX} disabled={busy} onPress={() => confirmDeactivate(m)} />
                ) : null}
                {m.status === 'approved' && isAdmin && approvedAdmins <= 1 ? (
                  <Text style={s.sub}>Only administrator — cannot be removed.</Text>
                ) : null}
              </Card>
            );
          })}
        </>
      )}
    </AdminScreen>
  );
}

const s = StyleSheet.create({
  actRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, minHeight: 64 },
  actIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: A.infoBg, alignItems: 'center', justifyContent: 'center' },
  actTitle: { fontFamily: FontFamily.manropeBold, fontSize: 14, color: A.text },
  actDetail: { fontFamily: FontFamily.manropeMedium, fontSize: 13, color: A.textSecondary },
  actTime: { fontFamily: FontFamily.manropeMedium, fontSize: 12, color: A.textMuted },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontFamily: FontFamily.manropeBold, fontSize: 16, color: A.text },
  sub: { fontFamily: FontFamily.manropeMedium, fontSize: 13, color: A.textMuted },
  actions: { flexDirection: 'row', gap: 10 },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, borderRadius: 12, borderWidth: 1,
    borderColor: A.borderStrong, backgroundColor: A.surface, paddingHorizontal: 12,
  },
  searchInput: { flex: 1, fontFamily: FontFamily.manropeMedium, fontSize: 16, color: A.text, minHeight: 44 },
});
