import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
  AlertTriangle, Building2, CalendarClock, CheckCircle, Search, Send, UserX, Users, X,
} from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Shadow, Spacing,
} from '@/constants/design';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/ui/Header';

type Tab = 'overview' | 'reports' | 'amenities' | 'members';

interface ActivityItem { id: string; text: string; time: string; }

interface ReportRow {
  id: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  is_urgent: boolean;
  created_at: string;
  reporter_id: string;
  reporterName: string;
  admin_notes: string | null;
  amenityName: string | null;
}

interface AmenityRow { id: string; name: string; court_type: string; is_active: boolean; }

interface MemberRow {
  membershipId: string;
  userId: string;
  fullName: string;
  unitNumber: string | null;
  role: string;
  status: string;
  email: string | null;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins <= 1 ? 'Just now' : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const REPORT_STATUS_TABS = [
  { value: 'active', label: 'Active' },
  { value: 'all', label: 'All' },
  { value: 'resolved', label: 'Resolved' },
] as const;

export default function CommunityDetailScreen() {
  const { hoaId } = useLocalSearchParams<{ hoaId: string }>();
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hoaName, setHoaName] = useState('');

  // Overview
  const [activeMembers, setActiveMembers] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [openIssues, setOpenIssues] = useState(0);
  const [amenitiesCount, setAmenitiesCount] = useState(0);
  const [upcomingReservations, setUpcomingReservations] = useState(0);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);

  // Reports
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [reportFilter, setReportFilter] = useState<typeof REPORT_STATUS_TABS[number]['value']>('active');
  const [selectedReport, setSelectedReport] = useState<ReportRow | null>(null);
  const [reportDetailStatus, setReportDetailStatus] = useState('');
  const [reportAdminNote, setReportAdminNote] = useState('');
  const [reportSaving, setReportSaving] = useState(false);
  const [messageDraft, setMessageDraft] = useState('');
  const [messageSending, setMessageSending] = useState(false);
  const [messageSent, setMessageSent] = useState(false);

  // Amenities
  const [amenities, setAmenities] = useState<AmenityRow[]>([]);

  // Members
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [memberSearch, setMemberSearch] = useState('');

  async function load() {
    if (!hoaId) return;
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id ?? null);

    const { data: hoa } = await supabase.from('hoas').select('name').eq('id', hoaId).single();
    setHoaName(hoa?.name ?? '');

    const [membershipsRes, joinReqRes, reportsRes, courtsRes] = await Promise.all([
      supabase.from('hoa_memberships').select('id, user_id, role, status').eq('hoa_id', hoaId),
      supabase.from('community_join_requests').select('id, user_id, created_at').eq('hoa_id', hoaId).eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('maintenance_reports').select('id, description, category, status, priority, is_urgent, created_at, reporter_id, admin_notes, amenity_id').eq('hoa_id', hoaId).order('created_at', { ascending: false }),
      supabase.from('courts').select('id, name, court_type, is_active').eq('hoa_id', hoaId).order('name'),
    ]);

    const memberships = (membershipsRes.data ?? []) as any[];
    const joinReqs = (joinReqRes.data ?? []) as any[];

    const memberUserIds = [...new Set([
      ...memberships.map((m) => m.user_id),
      ...joinReqs.map((j) => j.user_id),
    ].filter(Boolean))];
    const { data: memberProfiles } = memberUserIds.length > 0
      ? await supabase.from('profiles').select('id, full_name, unit_number').in('id', memberUserIds)
      : { data: [] as { id: string; full_name: string | null; unit_number: string | null }[] };
    const profileMap = new Map((memberProfiles ?? []).map((p) => [p.id, p]));

    const active = memberships.filter((m) => m.status === 'approved');
    setActiveMembers(active.length);
    setMembers(memberships.filter((m) => m.status !== 'removed').map((m) => ({
      membershipId: m.id,
      userId: m.user_id,
      fullName: profileMap.get(m.user_id)?.full_name ?? 'Unknown',
      unitNumber: profileMap.get(m.user_id)?.unit_number ?? null,
      role: m.role,
      status: m.status,
      email: null,
    })));

    setPendingApprovals(joinReqs.length);

    const reportRows = (reportsRes.data ?? []) as any[];
    const courts = (courtsRes.data ?? []) as AmenityRow[];
    setAmenities(courts);
    setAmenitiesCount(courts.length);
    const courtMap = new Map(courts.map((c) => [c.id, c.name]));

    const reporterIds = [...new Set(reportRows.map((r) => r.reporter_id).filter(Boolean))];
    const { data: profiles } = reporterIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', reporterIds)
      : { data: [] as { id: string; full_name: string | null }[] };
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? 'Resident']));

    const enrichedReports: ReportRow[] = reportRows.map((r) => ({
      id: r.id,
      description: r.description,
      category: r.category,
      status: r.status,
      priority: r.priority ?? 'medium',
      is_urgent: r.is_urgent ?? false,
      created_at: r.created_at,
      reporter_id: r.reporter_id,
      reporterName: nameMap.get(r.reporter_id) ?? 'Resident',
      admin_notes: r.admin_notes,
      amenityName: r.amenity_id ? (courtMap.get(r.amenity_id) ?? null) : null,
    }));
    setReports(enrichedReports);
    setOpenIssues(enrichedReports.filter((r) => r.status === 'open' || r.status === 'in_progress').length);

    let upcoming = 0;
    if (courts.length > 0) {
      const { count } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .in('court_id', courts.map((c) => c.id))
        .gte('date', todayISO())
        .neq('status', 'cancelled');
      upcoming = count ?? 0;
    }
    setUpcomingReservations(upcoming);

    const activity: ActivityItem[] = [
      ...joinReqs.map((j: any) => ({
        id: `join-${j.id}`,
        text: `${profileMap.get(j.user_id)?.full_name ?? 'Someone'} requested to join`,
        time: j.created_at,
      })),
      ...enrichedReports.slice(0, 5).map((r) => ({
        id: `report-${r.id}`,
        text: `${r.reporterName} reported: ${r.description.slice(0, 60)}`,
        time: r.created_at,
      })),
    ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 6);
    setRecentActivity(activity);

    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, [hoaId]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
  }

  function openReport(r: ReportRow) {
    setSelectedReport(r);
    setReportDetailStatus(r.status);
    setReportAdminNote(r.admin_notes ?? '');
    setMessageDraft('');
    setMessageSent(false);
  }

  async function saveReport() {
    if (!selectedReport) return;
    setReportSaving(true);
    await supabase
      .from('maintenance_reports')
      .update({ status: reportDetailStatus, admin_notes: reportAdminNote || undefined })
      .eq('id', selectedReport.id);
    setReportSaving(false);
    setSelectedReport(null);
    load();
  }

  async function sendMessage() {
    if (!selectedReport || !currentUserId || !messageDraft.trim()) return;
    setMessageSending(true);
    const { error } = await supabase.from('messages').insert({
      sender_id: currentUserId,
      receiver_id: selectedReport.reporter_id,
      content: messageDraft.trim(),
    });
    setMessageSending(false);
    if (!error) {
      setMessageDraft('');
      setMessageSent(true);
    }
  }

  function confirmDeactivate(m: MemberRow) {
    Alert.alert(
      'Deactivate Member',
      `Remove ${m.fullName}'s access to this community? This can be reversed by re-approving their membership.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('hoa_memberships').update({ status: 'removed' }).eq('id', m.membershipId);
            load();
          },
        },
      ],
    );
  }

  async function resendInvite(m: MemberRow) {
    await supabase.from('hoa_notifications').insert({
      user_id: m.userId,
      hoa_id: hoaId ?? '',
      title: 'Community Invite Reminder',
      body: `A reminder to finish setting up your account for ${hoaName}.`,
      type: 'invite_reminder',
      read: false,
    });
    Alert.alert('Reminder Sent', `${m.fullName} will see a reminder notification in their app.`);
  }

  const filteredReports = useMemo(() => reports.filter((r) => {
    if (reportFilter === 'active') return r.status === 'open' || r.status === 'in_progress';
    if (reportFilter === 'resolved') return r.status === 'resolved' || r.status === 'closed';
    return true;
  }), [reports, reportFilter]);

  const filteredMembers = useMemo(() => members.filter((m) => {
    if (!memberSearch.trim()) return true;
    const q = memberSearch.toLowerCase();
    return m.fullName.toLowerCase().includes(q) || (m.unitNumber ?? '').toLowerCase().includes(q);
  }), [members, memberSearch]);

  const activeMemberCount = members.filter((m) => m.status === 'approved').length;
  const activeAmenities = amenities.filter((a) => a.is_active).length;

  return (
    <View style={styles.screen}>
      <Header variant="inner" title={hoaName || 'Community'} onBack={() => router.back()} />

      <View style={styles.tabBar}>
        {(['overview', 'reports', 'amenities', 'members'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => setTab(t)}>
            <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accentCyan} />}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          {/* ── OVERVIEW ─────────────────────────────────────────────── */}
          {tab === 'overview' && (
            <>
              <View style={styles.statGrid}>
                {[
                  { value: activeMemberCount, label: 'Active Members' },
                  { value: pendingApprovals, label: 'Pending Approvals' },
                  { value: openIssues, label: 'Open Issues' },
                  { value: amenitiesCount, label: 'Amenities' },
                  { value: upcomingReservations, label: 'Upcoming Reservations' },
                ].map((s) => (
                  <Card key={s.label} style={styles.statCard}>
                    <Text style={styles.statValue}>{s.value}</Text>
                    <Text style={styles.statLabel}>{s.label.toUpperCase()}</Text>
                  </Card>
                ))}
              </View>

              <Text style={styles.sectionTitle}>Recent Activity</Text>
              {loading ? (
                <Text style={styles.emptyText}>Loading…</Text>
              ) : recentActivity.length === 0 ? (
                <EmptyState
                  icon={<CalendarClock color={Colors.textMuted} size={40} strokeWidth={1.5} />}
                  title="No recent activity"
                  subtitle="New requests and reports will show up here."
                />
              ) : recentActivity.map((a) => (
                <Card key={a.id} style={styles.activityCard}>
                  <Text style={styles.activityText}>{a.text}</Text>
                  <Text style={styles.activityTime}>{timeAgo(a.time)}</Text>
                </Card>
              ))}
            </>
          )}

          {/* ── REPORTS ──────────────────────────────────────────────── */}
          {tab === 'reports' && (
            <>
              <View style={styles.chipRow}>
                {REPORT_STATUS_TABS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.chip, reportFilter === opt.value && styles.chipActive]}
                    onPress={() => setReportFilter(opt.value)}>
                    <Text style={[styles.chipLabel, reportFilter === opt.value && styles.chipLabelActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {!loading && filteredReports.length === 0 && (
                <EmptyState
                  icon={<CheckCircle color={Colors.accentCyan} size={40} strokeWidth={1.5} />}
                  title="No reports"
                  subtitle="Nothing matches this filter."
                />
              )}

              {filteredReports.map((r) => (
                <TouchableOpacity key={r.id} onPress={() => openReport(r)} activeOpacity={0.85}>
                  <Card style={styles.reportCard}>
                    <View style={styles.reportTop}>
                      <View style={{ flex: 1 }}>
                        {r.is_urgent && <View style={styles.urgentBadge}><Text style={styles.urgentBadgeText}>URGENT</Text></View>}
                        <Text style={styles.reportTitle} numberOfLines={1}>
                          {r.amenityName ?? r.category}
                        </Text>
                        <Text style={styles.reportMeta}>{r.reporterName} · {timeAgo(r.created_at)}</Text>
                      </View>
                      <StatusPill status={r.status === 'in_progress' ? 'in-progress' : (r.status as any)} />
                    </View>
                    <Text style={styles.reportDesc} numberOfLines={2}>{r.description}</Text>
                  </Card>
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* ── AMENITIES ────────────────────────────────────────────── */}
          {tab === 'amenities' && (
            <>
              <View style={styles.statGrid}>
                <Card style={styles.statCard}>
                  <Text style={styles.statValue}>{amenitiesCount}</Text>
                  <Text style={styles.statLabel}>TOTAL</Text>
                </Card>
                <Card style={styles.statCard}>
                  <Text style={styles.statValue}>{activeAmenities}</Text>
                  <Text style={styles.statLabel}>AVAILABLE</Text>
                </Card>
                <Card style={styles.statCard}>
                  <Text style={styles.statValue}>{amenitiesCount - activeAmenities}</Text>
                  <Text style={styles.statLabel}>CLOSED</Text>
                </Card>
              </View>

              {amenities.map((a) => (
                <Card key={a.id} style={styles.amenityRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reportTitle}>{a.name}</Text>
                    <Text style={styles.reportMeta}>{a.court_type.toUpperCase()}</Text>
                  </View>
                  <StatusPill status={a.is_active ? 'optimal' : 'needs-attention'} label={a.is_active ? 'Available' : 'Closed'} />
                </Card>
              ))}

              <TouchableOpacity
                style={styles.manageBtn}
                onPress={() => router.push({ pathname: '/(admin)/manage-amenities', params: { hoaId: hoaId ?? '' } })}>
                <Text style={styles.manageBtnLabel}>Manage Amenities →</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── MEMBERS ──────────────────────────────────────────────── */}
          {tab === 'members' && (
            <>
              <View style={styles.statGrid}>
                <Card style={styles.statCard}>
                  <Text style={styles.statValue}>{activeMemberCount}</Text>
                  <Text style={styles.statLabel}>ACTIVE</Text>
                </Card>
                <Card style={styles.statCard}>
                  <Text style={styles.statValue}>{pendingApprovals}</Text>
                  <Text style={styles.statLabel}>PENDING</Text>
                </Card>
                <Card style={styles.statCard}>
                  <Text style={styles.statValue}>{activeMemberCount + pendingApprovals}</Text>
                  <Text style={styles.statLabel}>TOTAL UNITS</Text>
                </Card>
              </View>

              {pendingApprovals > 0 && (
                <TouchableOpacity
                  style={styles.manageBtn}
                  onPress={() => router.push('/(admin)/pending-requests' as any)}>
                  <Text style={styles.manageBtnLabel}>View {pendingApprovals} Pending Application{pendingApprovals === 1 ? '' : 's'} →</Text>
                </TouchableOpacity>
              )}

              <View style={styles.searchRow}>
                <Search color={Colors.textMuted} size={16} strokeWidth={1.5} />
                <TextInput
                  style={styles.searchInput}
                  value={memberSearch}
                  onChangeText={setMemberSearch}
                  placeholder="Search members or unit…"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              {!loading && filteredMembers.length === 0 && (
                <EmptyState
                  icon={<Users color={Colors.textMuted} size={40} strokeWidth={1.5} />}
                  title="No members found"
                  subtitle="Approved members will appear here."
                />
              )}

              {filteredMembers.map((m) => (
                <Card key={m.membershipId} style={styles.memberCard}>
                  <View style={styles.memberTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reportTitle}>{m.fullName}</Text>
                      <Text style={styles.reportMeta}>
                        {m.unitNumber ? `Unit ${m.unitNumber} · ` : ''}{m.role.toUpperCase()}
                      </Text>
                    </View>
                    <StatusPill status={m.status === 'approved' ? 'approved' : m.status === 'pending' ? 'pending' : 'rejected'} />
                  </View>
                  <View style={styles.memberActions}>
                    <TouchableOpacity style={styles.memberActionBtn} onPress={() => resendInvite(m)}>
                      <Send color={Colors.accentCyan} size={14} strokeWidth={1.5} />
                      <Text style={styles.memberActionLabel}>Resend Invite</Text>
                    </TouchableOpacity>
                    {m.status === 'approved' && (
                      <TouchableOpacity style={styles.memberActionBtn} onPress={() => confirmDeactivate(m)}>
                        <UserX color={Colors.negative} size={14} strokeWidth={1.5} />
                        <Text style={[styles.memberActionLabel, { color: Colors.negative }]}>Deactivate</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </Card>
              ))}
            </>
          )}
        </View>
      </ScrollView>

      {/* Report Detail Modal */}
      <Modal
        visible={!!selectedReport}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedReport(null)}>
        {selectedReport && (
          <SafeAreaView style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report Detail</Text>
              <TouchableOpacity onPress={() => setSelectedReport(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X color={Colors.textMuted} size={22} strokeWidth={1.5} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.reportTitle}>{selectedReport.amenityName ?? selectedReport.category}</Text>
              <Text style={styles.reportMeta}>Reported by {selectedReport.reporterName} · {timeAgo(selectedReport.created_at)}</Text>
              <Text style={styles.fieldLabel}>DESCRIPTION</Text>
              <View style={styles.descBlock}>
                <Text style={styles.descText}>{selectedReport.description}</Text>
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>STATUS</Text>
              <View style={styles.chipRow}>
                {['open', 'in_progress', 'resolved', 'closed'].map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, reportDetailStatus === s && styles.chipActive]}
                    onPress={() => setReportDetailStatus(s)}>
                    <Text style={[styles.chipLabel, reportDetailStatus === s && styles.chipLabelActive]}>{s.replace('_', ' ')}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>ADMIN NOTES</Text>
              <TextInput
                style={styles.noteInput}
                value={reportAdminNote}
                onChangeText={setReportAdminNote}
                placeholder="Internal notes about progress/resolution"
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <TouchableOpacity style={styles.saveBtn} onPress={saveReport} disabled={reportSaving}>
                <Text style={styles.saveBtnLabel}>{reportSaving ? 'Saving…' : 'Save Changes'}</Text>
              </TouchableOpacity>

              <View style={styles.dividerLine} />
              <Text style={styles.fieldLabel}>MESSAGE RESIDENT</Text>
              <TextInput
                style={styles.noteInput}
                value={messageDraft}
                onChangeText={setMessageDraft}
                placeholder={`Send a message to ${selectedReport.reporterName}…`}
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={2}
                textAlignVertical="top"
              />
              {messageSent && <Text style={styles.sentText}>Message sent.</Text>}
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: Colors.accentCyan }]}
                onPress={sendMessage}
                disabled={messageSending || !messageDraft.trim()}>
                <Text style={styles.saveBtnLabel}>{messageSending ? 'Sending…' : 'Send Message'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.pagePx,
  },
  tabBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: Colors.navy },
  tabLabel: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.uiLabel, color: Colors.textMuted },
  tabLabelActive: { color: Colors.navy },

  content: { padding: Spacing.pagePx, paddingBottom: 100, gap: 12 },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  statCard: { flexGrow: 1, minWidth: 100, padding: 14, alignItems: 'flex-start' },
  statValue: { fontFamily: FontFamily.manropeExtraBold, fontSize: 24, color: Colors.navy },
  statLabel: { fontFamily: FontFamily.interSemiBold, fontSize: 10, color: Colors.textMuted, letterSpacing: 0.6, marginTop: 2 },

  sectionTitle: { fontFamily: FontFamily.manropeExtraBold, fontSize: FontSize.sectionTitle, color: Colors.navy, marginTop: 8 },

  activityCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  activityText: { flex: 1, fontFamily: FontFamily.interRegular, fontSize: FontSize.body, color: Colors.navy, marginRight: 8 },
  activityTime: { fontFamily: FontFamily.interRegular, fontSize: 11, color: Colors.textMuted },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 7, backgroundColor: Colors.white,
  },
  chipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipLabel: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.uiLabel, color: Colors.textMuted, textTransform: 'capitalize' },
  chipLabelActive: { color: Colors.white },

  reportCard: { padding: 14 },
  reportTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  urgentBadge: { alignSelf: 'flex-start', backgroundColor: '#FEF2F2', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4 },
  urgentBadgeText: { fontFamily: FontFamily.interSemiBold, fontSize: 10, color: '#EF4444' },
  reportTitle: { fontFamily: FontFamily.manropeBold, fontSize: FontSize.cardTitle, color: Colors.navy },
  reportMeta: { fontFamily: FontFamily.interSemiBold, fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  reportDesc: { fontFamily: FontFamily.interRegular, fontSize: 13, color: Colors.textSubtle, lineHeight: 19 },

  amenityRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },

  manageBtn: {
    backgroundColor: Colors.navy, borderRadius: Radius.button, paddingVertical: 14,
    alignItems: 'center', marginTop: 4,
  },
  manageBtnLabel: { fontFamily: FontFamily.manropeExtraBold, fontSize: FontSize.body, color: Colors.white },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.white, borderRadius: Radius.input, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, ...Shadow,
  },
  searchInput: { flex: 1, height: 44, fontFamily: FontFamily.interRegular, fontSize: FontSize.body, color: Colors.navy },

  memberCard: { padding: 14 },
  memberTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  memberActions: { flexDirection: 'row', gap: 16, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  memberActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memberActionLabel: { fontFamily: FontFamily.interSemiBold, fontSize: 12, color: Colors.accentCyan },

  emptyText: { fontFamily: FontFamily.interRegular, fontSize: FontSize.body, color: Colors.textMuted, textAlign: 'center', paddingVertical: 24 },

  modal: { flex: 1, backgroundColor: Colors.white },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.pagePx, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: { fontFamily: FontFamily.manropeExtraBold, fontSize: 18, color: Colors.navy },
  modalContent: { padding: Spacing.pagePx, paddingBottom: 40 },
  fieldLabel: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.metadata, color: Colors.textMuted, letterSpacing: 1.2, marginTop: 12, marginBottom: 6 },
  descBlock: { backgroundColor: Colors.pageBg, borderRadius: Radius.input, padding: 14 },
  descText: { fontFamily: FontFamily.interRegular, fontSize: 14, color: Colors.navy, lineHeight: 21 },
  noteInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.input, padding: 12,
    fontFamily: FontFamily.interRegular, fontSize: FontSize.body, color: Colors.navy,
    backgroundColor: Colors.white, minHeight: 70, textAlignVertical: 'top',
  },
  saveBtn: { backgroundColor: Colors.navy, borderRadius: Radius.button, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  saveBtnLabel: { fontFamily: FontFamily.manropeExtraBold, fontSize: FontSize.body, color: Colors.white },
  dividerLine: { height: 1, backgroundColor: Colors.border, marginVertical: 20 },
  sentText: { fontFamily: FontFamily.interSemiBold, fontSize: 12, color: Colors.accentCyan, marginTop: 8 },
});
