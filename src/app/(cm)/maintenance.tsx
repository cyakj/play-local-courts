import { useEffect, useMemo, useState } from 'react';
import {
  Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle, ChevronDown, X } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, Radius, Spacing, MaxWidth, Shadow,
} from '@/constants/design';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

interface Report {
  id: string;
  community: string;
  communityId: string;
  amenity: string | null;
  displayTitle: string;
  status: string;
  priority: string;
  category: string;
  description: string;
  reporter: string;
  date: string;
  report_type?: string;
  location_text?: string;
  is_urgent: boolean;
  admin_notes: string | null;
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active (all open)' },
  { value: 'all', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const CATEGORY_OPTIONS = [
  { value: 'all',                 label: 'All Categories' },
  { value: 'plumbing',            label: 'Water & Plumbing' },
  { value: 'electrical',          label: 'Lighting & Electrical' },
  { value: 'structural',          label: 'Buildings & Structures' },
  { value: 'grounds_landscaping', label: 'Grounds & Landscaping' },
  { value: 'equipment',           label: 'Amenities & Equipment' },
  { value: 'safety',              label: 'Safety' },
  { value: 'other',               label: 'Other' },
];

const DETAIL_STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

function getCategoryLabel(cat: string): string {
  const map: Record<string, string> = {
    plumbing:            'Water & Plumbing',
    electrical:          'Lighting & Electrical',
    structural:          'Buildings & Structures',
    grounds_landscaping: 'Grounds & Landscaping',
    equipment:           'Amenities & Equipment',
    safety:              'Safety',
    other:               'Other',
  };
  return map[cat] ?? cat.charAt(0).toUpperCase() + cat.slice(1);
}

function getStatusPill(status: string): { bg: string; text: string; border: string; label: string } {
  const map: Record<string, { bg: string; text: string; border: string; label: string }> = {
    open:        { bg: '#FFF5F5', text: '#C0392B', border: '#F97066', label: 'Open' },
    in_progress: { bg: '#EFF6FF', text: '#1D4ED8', border: '#3B82F6', label: 'In Progress' },
    resolved:    { bg: '#E0F9FF', text: '#0369A1', border: '#00D4FF', label: 'Resolved' },
    closed:      { bg: '#E0F9FF', text: '#0369A1', border: '#00D4FF', label: 'Closed' },
  };
  return map[status] || { bg: '#F3F4F6', text: '#6B7280', border: '#E5E7EB', label: status };
}

function getPriorityBadge(priority: string): { bg: string; text: string; label: string } {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    high:   { bg: '#FEF2F2', text: '#EF4444', label: 'High' },
    medium: { bg: '#FFF7ED', text: '#EA580C', label: 'Medium' },
    low:    { bg: '#F0FDF4', text: '#16A34A', label: 'Low' },
  };
  return map[priority] || { bg: '#F3F4F6', text: '#6B7280', label: priority };
}

function FilterPicker({
  options, value, onChange,
}: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={styles.pickerWrap}>
      <TouchableOpacity
        style={[styles.pickerBtn, open && styles.pickerBtnOpen]}
        onPress={() => setOpen((v) => !v)}>
        <Text style={styles.pickerLabel} numberOfLines={1}>{selected?.label ?? 'Select'}</Text>
        <ChevronDown color={Colors.textMuted} size={14} strokeWidth={1.5} />
      </TouchableOpacity>
      {open && (
        <View style={styles.pickerDropdown}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={styles.pickerOption}
              onPress={() => { onChange(opt.value); setOpen(false); }}>
              <Text style={[styles.pickerOptionLabel, opt.value === value && styles.pickerOptionActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export default function MaintenanceReportsScreen() {
  const insets = useSafeAreaInsets();
  const [reports, setReports] = useState<Report[]>([]);
  const [communities, setCommunities] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [communityFilter, setCommunityFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('active');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [amenityFilter, setAmenityFilter] = useState('All');
  const [selected, setSelected] = useState<Report | null>(null);
  const [detailStatus, setDetailStatus] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data: hoas } = await supabase.from('hoas').select('id, name');
    if (!hoas || hoas.length === 0) { setLoading(false); setRefreshing(false); return; }

    setCommunities(hoas);
    const hoaIds = hoas.map((h) => h.id);
    const hoaMap = new Map(hoas.map((h) => [h.id, h.name]));

    let query = supabase
      .from('maintenance_reports')
      .select('id, hoa_id, amenity_id, status, priority, category, description, reporter_id, created_at, report_type, location_text, is_urgent, title, admin_notes')
      .in('hoa_id', hoaIds)
      .order('created_at', { ascending: false });

    if (statusFilter === 'active') {
      query = query.in('status', ['open', 'in_progress']);
    } else if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }
    if (categoryFilter !== 'all') query = query.eq('category', categoryFilter);

    const { data } = await query;
    if (!data) { setLoading(false); setRefreshing(false); return; }

    const reporterIds = [...new Set(data.map((r: any) => r.reporter_id).filter(Boolean))];
    const amenityIds = [...new Set(data.map((r: any) => r.amenity_id).filter(Boolean))];

    const [profilesRes, courtsRes] = await Promise.all([
      reporterIds.length > 0
        ? supabase.from('profiles').select('id, full_name').in('id', reporterIds as string[])
        : { data: [] },
      amenityIds.length > 0
        ? supabase.from('courts').select('id, name').in('id', amenityIds as string[])
        : { data: [] },
    ]);

    const profileMap = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p.full_name as string]));
    const courtMap = new Map((courtsRes.data ?? []).map((c: any) => [c.id, c.name as string]));

    const enriched: Report[] = (data as any[]).map((r) => {
      const amenityName = r.amenity_id ? (courtMap.get(r.amenity_id) ?? null) : null;
      const locationText = r.location_text as string | undefined;
      const displayTitle = r.report_type === 'location'
        ? `${(locationText ?? 'Unknown location').slice(0, 30)}${(locationText ?? '').length > 30 ? '…' : ''}`
        : (r.title ?? amenityName ?? getCategoryLabel(r.category));
      return {
        id: r.id,
        community: hoaMap.get(r.hoa_id) ?? '',
        communityId: r.hoa_id,
        amenity: amenityName,
        displayTitle,
        status: r.status,
        priority: r.priority ?? 'medium',
        category: r.category,
        description: r.description,
        reporter: profileMap.get(r.reporter_id) ?? 'Unknown',
        date: new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        report_type: r.report_type,
        location_text: r.location_text,
        is_urgent: r.is_urgent ?? false,
        admin_notes: r.admin_notes ?? null,
      };
    });

    enriched.sort((a, b) => (b.is_urgent ? 1 : 0) - (a.is_urgent ? 1 : 0));

    setReports(enriched);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, [statusFilter, categoryFilter]);

  useEffect(() => {
    const sub = supabase
      .channel('maintenance_reports_cm')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_reports' }, load)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load();
  }

  async function saveDetail() {
    if (!selected) return;
    setSaving(true);
    await supabase
      .from('maintenance_reports')
      .update({ status: detailStatus, admin_notes: adminNote || undefined })
      .eq('id', selected.id);
    setSaving(false);
    setSelected(null);
    load();
  }

  const openCount = reports.filter((r) => ['open'].includes(r.status)).length;
  const inProgressCount = reports.filter((r) => r.status === 'in_progress').length;

  const communityOptions = ['All', ...communities.map((c) => c.name)];

  const amenityTabs = useMemo(() => {
    const names = [...new Set(reports.map((r) => r.amenity).filter((n): n is string => !!n))];
    return ['All', ...names];
  }, [reports]);

  const visibleReports = useMemo(() => reports.filter((r) => {
    if (communityFilter !== 'All' && r.community !== communityFilter) return false;
    if (amenityFilter !== 'All' && r.amenity !== amenityFilter) return false;
    return true;
  }), [reports, communityFilter, amenityFilter]);

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <View style={styles.headerInner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Maintenance Reports</Text>
            <Text style={styles.headerSub}>
              {communityFilter === 'All' ? 'All communities' : communityFilter} · real time
            </Text>
          </View>
          <View style={styles.headerBadges}>
            <View style={[styles.headerBadge, { backgroundColor: openCount > 0 ? Colors.coral : 'rgba(255,255,255,0.16)' }]}>
              <Text style={styles.headerBadgeText}>{openCount} Open</Text>
            </View>
            <View style={[styles.headerBadge, { backgroundColor: inProgressCount > 0 ? Colors.accentCyan : 'rgba(255,255,255,0.16)' }]}>
              <Text style={styles.headerBadgeText}>{inProgressCount} In Prog</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Community filter chips */}
      <View style={styles.chipBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipContent}>
          {communityOptions.map((opt) => {
            const active = communityFilter === opt;
            return (
              <TouchableOpacity
                key={opt}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setCommunityFilter(opt)}
                activeOpacity={0.7}>
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Amenity filter tabs */}
      {amenityTabs.length > 2 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.amenityTabsScroll}
          contentContainerStyle={styles.amenityTabsContent}>
          {amenityTabs.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.amenityTab, amenityFilter === tab && styles.amenityTabActive]}
              onPress={() => setAmenityFilter(tab)}>
              <Text style={[styles.amenityTabLabel, amenityFilter === tab && styles.amenityTabLabelActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Status + Category pickers */}
      <View style={styles.filterRow}>
        <View style={{ flex: 1 }}>
          <FilterPicker options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
        </View>
        <View style={{ flex: 1 }}>
          <FilterPicker options={CATEGORY_OPTIONS} value={categoryFilter} onChange={setCategoryFilter} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accentCyan} />}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          {loading && [0, 1, 2].map((i) => <CardSkeleton key={i} />)}

          {!loading && visibleReports.length === 0 && (
            <EmptyState
              icon={<CheckCircle color={Colors.accentCyan} size={48} strokeWidth={1.5} />}
              title="No Reports Found"
              subtitle={statusFilter === 'all' ? 'No reports submitted yet.' : 'No matching reports found.'}
            />
          )}

          {!loading && visibleReports.map((r) => {
            const pill = getStatusPill(r.status);
            const pBadge = getPriorityBadge(r.priority);
            return (
              <TouchableOpacity
                key={r.id}
                style={styles.reportCard}
                activeOpacity={0.85}
                onPress={() => { setSelected(r); setDetailStatus(r.status); setAdminNote(r.admin_notes ?? ''); }}>
                {/* Top: urgent badge + title block + status/priority badges */}
                <View style={styles.reportTop}>
                  <View style={styles.reportTitleBlock}>
                    {r.is_urgent && (
                      <View style={styles.urgentBadge}>
                        <Text style={styles.urgentBadgeText}>URGENT</Text>
                      </View>
                    )}
                    <Text style={styles.reportTitle} numberOfLines={1}>{r.displayTitle}</Text>
                    <Text style={styles.reportCommunity}>{r.community}</Text>
                  </View>
                  <View style={styles.badgeCol}>
                    <View style={[styles.statusBadge, { backgroundColor: pill.bg, borderColor: pill.border }]}>
                      <Text style={[styles.statusBadgeText, { color: pill.text }]}>{pill.label}</Text>
                    </View>
                    <View style={[styles.priorityBadge, { backgroundColor: pBadge.bg }]}>
                      <Text style={[styles.priorityBadgeText, { color: pBadge.text }]}>{pBadge.label}</Text>
                    </View>
                  </View>
                </View>

                {/* Description */}
                <Text style={styles.reportDesc} numberOfLines={2}>{r.description}</Text>

                {/* Reporter · date */}
                <Text style={styles.reportMeta}>{r.reporter}  ·  {r.date}</Text>

                {/* View Details */}
                <View style={styles.reportDivider} />
                <View style={styles.viewDetailsBtn}>
                  <Text style={styles.viewDetailsLabel}>View Details →</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Detail modal */}
      <Modal
        visible={!!selected}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelected(null)}>
        {selected && (
          <SafeAreaView style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report Details</Text>
              <TouchableOpacity onPress={() => setSelected(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X color={Colors.textMuted} size={22} strokeWidth={1.5} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">

              <Text style={styles.modalReportTitle}>{selected.displayTitle}</Text>
              <Text style={styles.modalCommunity}>{selected.community}</Text>
              <Text style={styles.modalReporter}>
                Reported by {selected.reporter} · {selected.date}
              </Text>
              <Text style={styles.modalCategory}>
                {getCategoryLabel(selected.category).toUpperCase()}{selected.report_type ? ` · ${selected.report_type.toUpperCase()}` : ''}
              </Text>

              <Text style={styles.fieldLabel}>DESCRIPTION</Text>
              <View style={styles.descBlock}>
                <Text style={styles.descText}>{selected.description}</Text>
              </View>

              <View style={styles.dividerLine} />
              <Text style={styles.modalSectionTitle}>Admin Actions</Text>

              <Text style={styles.fieldLabel}>STATUS</Text>
              <View style={styles.statusRow}>
                {DETAIL_STATUS_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.statusOption, detailStatus === opt.value && styles.statusOptionActive]}
                    onPress={() => setDetailStatus(opt.value)}>
                    <Text style={[styles.statusOptionLabel, detailStatus === opt.value && styles.statusOptionLabelActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>ADMIN NOTES</Text>
              <TextInput
                style={styles.noteInput}
                value={adminNote}
                onChangeText={setAdminNote}
                placeholder="Add notes about progress, resolution, etc."
                placeholderTextColor={Colors.textPlaceholder}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setSelected(null)}>
                  <Text style={styles.cancelBtnLabel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={saveDetail} disabled={saving}>
                  <Text style={styles.saveBtnLabel}>{saving ? 'Saving…' : 'Save Changes'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },

  header: {
    backgroundColor: Colors.navy,
    paddingHorizontal: Spacing.pagePx,
    paddingBottom: 16,
  },
  headerInner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerTitle: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: 20,
    color: Colors.white,
  },
  headerSub: {
    fontFamily: FontFamily.interRegular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
  },
  headerBadges: { flexDirection: 'row', gap: 4, marginTop: 2 },
  headerBadge: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 },
  headerBadgeText: { fontFamily: FontFamily.interSemiBold, fontSize: 11, color: Colors.white },

  chipBar: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 10,
    paddingHorizontal: Spacing.pagePx,
  },
  chipContent: { gap: 8 },
  chip: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: Colors.pageBg,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipLabel: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.uiLabel, color: Colors.textMuted },
  chipLabelActive: { color: Colors.white },

  amenityTabsScroll: { backgroundColor: Colors.cardBg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  amenityTabsContent: { flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.pagePx, paddingVertical: 10 },
  amenityTab: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99,
    backgroundColor: Colors.pageBg, borderWidth: 1, borderColor: Colors.border,
  },
  amenityTabActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  amenityTabLabel: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.uiLabel, color: Colors.textMuted },
  amenityTabLabelActive: { color: Colors.white },

  scroll: { flex: 1 },
  content: { padding: Spacing.pagePx, gap: 10, paddingBottom: 100 },

  filterRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: Spacing.pagePx,
    paddingVertical: 10,
    backgroundColor: Colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickerWrap: { position: 'relative', zIndex: 10 },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.cardBg,
    minHeight: 44,
    gap: 6,
  },
  pickerBtnOpen: { borderColor: Colors.accentCyan },
  pickerLabel: { fontFamily: FontFamily.interRegular, fontSize: 13, color: Colors.textPrimary, flex: 1 },
  pickerDropdown: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    zIndex: 100,
    ...Shadow,
  },
  pickerOption: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pickerOptionLabel: { fontFamily: FontFamily.interRegular, fontSize: 13, color: Colors.textPrimary },
  pickerOptionActive: { color: Colors.accentCyan, fontFamily: FontFamily.interSemiBold },

  reportCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow,
  },
  reportTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  reportTitleBlock: { flex: 1 },
  urgentBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 4,
  },
  urgentBadgeText: { fontFamily: FontFamily.interSemiBold, fontSize: 10, color: '#EF4444' },
  reportTitle: { fontFamily: FontFamily.manropeBold, fontSize: 15, color: Colors.navy, marginBottom: 2 },
  reportCommunity: { fontFamily: FontFamily.interSemiBold, fontSize: 11, color: Colors.accentCyan, letterSpacing: 0.5 },
  badgeCol: { gap: 4, alignItems: 'flex-end' },
  statusBadge: { borderRadius: 99, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeText: { fontFamily: FontFamily.interSemiBold, fontSize: 11 },
  priorityBadge: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  priorityBadgeText: { fontFamily: FontFamily.interSemiBold, fontSize: 10 },
  reportDesc: { fontFamily: FontFamily.interRegular, fontSize: 14, color: Colors.textSubtle, lineHeight: 20, marginBottom: 8 },
  reportMeta: { fontFamily: FontFamily.interSemiBold, fontSize: 12, color: Colors.textMuted },
  reportDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 10 },
  viewDetailsBtn: { alignItems: 'flex-end' },
  viewDetailsLabel: { fontFamily: FontFamily.interSemiBold, fontSize: 13, color: Colors.accentCyan },

  modal: { flex: 1, backgroundColor: Colors.cardBg },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.pagePx, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: { fontFamily: FontFamily.manropeExtraBold, fontSize: 18, color: Colors.navy },
  modalContent: { padding: Spacing.pagePx, gap: 8, paddingBottom: 40 },
  modalReportTitle: { fontFamily: FontFamily.manropeExtraBold, fontSize: 16, color: Colors.navy },
  modalCommunity: { fontFamily: FontFamily.interSemiBold, fontSize: 12, color: Colors.accentCyan },
  modalReporter: { fontFamily: FontFamily.interSemiBold, fontSize: 14, color: Colors.textPrimary },
  modalCategory: { fontFamily: FontFamily.interSemiBold, fontSize: 11, color: Colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' },
  fieldLabel: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.metadata, color: Colors.textMuted, letterSpacing: 1.2, marginTop: 12, marginBottom: 6 },
  descBlock: { backgroundColor: Colors.pageBg, borderRadius: Radius.input, padding: 14 },
  descText: { fontFamily: FontFamily.interRegular, fontSize: 14, color: Colors.textPrimary, lineHeight: 21 },
  dividerLine: { height: 1, backgroundColor: Colors.border, marginVertical: 8 },
  modalSectionTitle: { fontFamily: FontFamily.manropeBold, fontSize: 15, color: Colors.navy },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusOption: {
    borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Colors.cardBg,
  },
  statusOptionActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  statusOptionLabel: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.uiLabel, color: Colors.textMuted },
  statusOptionLabelActive: { color: Colors.white },
  noteInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.input,
    padding: 12, fontFamily: FontFamily.interRegular, fontSize: FontSize.body,
    color: Colors.textPrimary, backgroundColor: Colors.cardBg, minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: Radius.button,
    backgroundColor: '#F3F4F6', alignItems: 'center',
  },
  cancelBtnLabel: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.body, color: Colors.navy },
  saveBtn: {
    flex: 1, paddingVertical: 14, borderRadius: Radius.button,
    backgroundColor: Colors.navy, alignItems: 'center',
  },
  saveBtnLabel: { fontFamily: FontFamily.manropeExtraBold, fontSize: FontSize.body, color: Colors.white },
});
