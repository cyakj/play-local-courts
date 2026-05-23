import { useEffect, useMemo, useState } from 'react';
import {
  Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle, ChevronDown, ClipboardList, X } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, Radius, Spacing, MaxWidth, Shadow,
} from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Database } from '@/lib/types';

type Report = Database['public']['Tables']['maintenance_reports']['Row'] & {
  reporter_name: string;
  amenity_name: string;
};

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active (all open)' },
  { value: 'all', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'structural', label: 'Structural' },
  { value: 'cleanliness', label: 'Cleanliness' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'safety', label: 'Safety' },
  { value: 'other', label: 'Other' },
];

const DETAIL_STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

function getStatusPill(status: string): { bg: string; text: string; border: string; label: string } {
  const map: Record<string, { bg: string; text: string; border: string; label: string }> = {
    open:        { bg: '#FFF5F5', text: '#C0392B', border: '#F97066', label: 'Open' },
    in_progress: { bg: '#EFF6FF', text: '#1D4ED8', border: '#3B82F6', label: 'In Progress' },
    resolved:    { bg: '#E0F9FF', text: '#0369A1', border: '#00D4FF', label: 'Resolved' },
    closed:      { bg: '#E0F9FF', text: '#0369A1', border: '#00D4FF', label: 'Closed' },
  };
  return map[status] || { bg: '#F3F4F6', text: '#6B7280', border: '#E5E7EB', label: status };
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
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('active');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [amenityFilter, setAmenityFilter] = useState('All');
  const [selected, setSelected] = useState<Report | null>(null);
  const [detailStatus, setDetailStatus] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    let query = supabase
      .from('maintenance_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (statusFilter === 'active') {
      query = query.in('status', ['open', 'in_progress']);
    } else if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }
    if (categoryFilter !== 'all') query = query.eq('category', categoryFilter);

    const { data } = await query;
    if (!data) { setLoading(false); return; }

    const reporterIds = [...new Set(data.map((r) => r.reporter_id).filter(Boolean))];
    const amenityIds = [...new Set(data.map((r) => r.amenity_id).filter(Boolean))];

    const [profilesRes, courtsRes] = await Promise.all([
      reporterIds.length > 0
        ? supabase.from('profiles').select('id, full_name').in('id', reporterIds)
        : { data: [] },
      amenityIds.length > 0
        ? supabase.from('courts').select('id, name').in('id', amenityIds)
        : { data: [] },
    ]);

    const profileMap: Record<string, string> = {};
    for (const p of profilesRes.data ?? []) profileMap[p.id] = p.full_name ?? 'Unknown';
    const courtMap: Record<string, string> = {};
    for (const c of courtsRes.data ?? []) courtMap[c.id] = c.name;

    const enriched: Report[] = data.map((r) => ({
      ...r,
      reporter_name: profileMap[r.reporter_id ?? ''] ?? 'Unknown',
      amenity_name: r.amenity_id ? (courtMap[r.amenity_id] ?? 'General') : 'General',
    }));

    setReports(enriched);
    setLoading(false);
  }

  useEffect(() => { load(); }, [statusFilter, categoryFilter]);

  useEffect(() => {
    const sub = supabase
      .channel('maintenance_reports_cm')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_reports' }, load)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

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

  const openCount = reports.filter((r) => r.status === 'open').length;
  const inProgressCount = reports.filter((r) => r.status === 'in_progress').length;

  const amenityTabs = useMemo(() => {
    const names = [...new Set(reports.map((r) => r.amenity_name))];
    return ['All', ...names];
  }, [reports]);

  const visibleReports = useMemo(() => {
    if (amenityFilter === 'All') return reports;
    return reports.filter((r) => r.amenity_name === amenityFilter);
  }, [reports, amenityFilter]);

  return (
    <View style={styles.screen}>
      <Header variant="inner" title="Maintenance Reports" rightIcon={
        <View style={styles.headerBadges}>
          <View style={[styles.headerBadge, { backgroundColor: Colors.coral }]}>
            <Text style={styles.headerBadgeText}>{openCount} Open</Text>
          </View>
          <View style={[styles.headerBadge, { backgroundColor: Colors.accentCyan }]}>
            <Text style={styles.headerBadgeText}>{inProgressCount} In Prog</Text>
          </View>
        </View>
      } />

      {/* Amenity filter tabs */}
      {amenityTabs.length > 1 && (
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
        showsVerticalScrollIndicator={false}>
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
            return (
              <View key={r.id} style={styles.reportCard}>
                {/* Top: title + status badge */}
                <View style={styles.reportTop}>
                  <View style={styles.reportTitleBlock}>
                    <Text style={styles.reportTitle} numberOfLines={1}>
                      {r.title || r.category.charAt(0).toUpperCase() + r.category.slice(1)}
                    </Text>
                    <Text style={styles.reportAmenity}>{r.amenity_name}</Text>
                  </View>
                  <View style={styles.badgeCol}>
                    <View style={[styles.statusBadge, { backgroundColor: pill.bg, borderColor: pill.border }]}>
                      <Text style={[styles.statusBadgeText, { color: pill.text }]}>{pill.label}</Text>
                    </View>
                  </View>
                </View>

                {/* Description */}
                <Text style={styles.reportDesc} numberOfLines={2}>{r.description}</Text>

                {/* Reporter · date */}
                <Text style={styles.reportMeta}>
                  {r.reporter_name}
                  {'  ·  '}
                  {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>

                {/* View Details */}
                <View style={styles.reportDivider} />
                <TouchableOpacity
                  style={styles.viewDetailsBtn}
                  onPress={() => {
                    setSelected(r);
                    setDetailStatus(r.status);
                    setAdminNote(r.admin_notes ?? '');
                  }}>
                  <Text style={styles.viewDetailsLabel}>View Details →</Text>
                </TouchableOpacity>
              </View>
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

              <Text style={styles.modalReportTitle}>{selected.title || selected.category.charAt(0).toUpperCase() + selected.category.slice(1)}</Text>
              <Text style={styles.modalReporter}>
                Reported by {selected.reporter_name} · {new Date(selected.created_at).toLocaleDateString()}
              </Text>
              <Text style={styles.modalCategory}>
                {selected.category.toUpperCase()}{selected.report_type ? ` · ${selected.report_type.toUpperCase()}` : ''}
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
  scroll: { flex: 1 },
  content: { padding: Spacing.pagePx, gap: 10, paddingBottom: 100 },

  headerBadges: { flexDirection: 'row', gap: 4 },
  headerBadge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  headerBadgeText: { fontFamily: FontFamily.interSemiBold, fontSize: 11, color: Colors.white },

  amenityTabsScroll: { backgroundColor: Colors.cardBg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  amenityTabsContent: { flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.pagePx, paddingVertical: 10 },
  amenityTab: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99,
    backgroundColor: Colors.pageBg, borderWidth: 1, borderColor: Colors.border,
  },
  amenityTabActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  amenityTabLabel: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.uiLabel, color: Colors.textMuted },
  amenityTabLabelActive: { color: Colors.white },

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

  // Report cards
  reportCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow,
  },
  reportTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  reportTitleBlock: { flex: 1 },
  reportTitle: { fontFamily: FontFamily.manropeBold, fontSize: 17, color: Colors.navy, marginBottom: 2 },
  reportAmenity: { fontFamily: FontFamily.interSemiBold, fontSize: 13, color: Colors.accentCyan },
  badgeCol: { gap: 4 },
  statusBadge: { borderRadius: 99, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeText: { fontFamily: FontFamily.interSemiBold, fontSize: 11 },
  reportDesc: { fontFamily: FontFamily.interRegular, fontSize: 14, color: Colors.textSubtle, lineHeight: 20, marginBottom: 8 },
  reportMeta: { fontFamily: FontFamily.interSemiBold, fontSize: 13, color: Colors.textMuted },
  reportDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 10 },
  viewDetailsBtn: { alignItems: 'flex-end' },
  viewDetailsLabel: { fontFamily: FontFamily.interSemiBold, fontSize: 13, color: Colors.accentCyan },

  // Modal
  modal: { flex: 1, backgroundColor: Colors.cardBg },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.pagePx, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: { fontFamily: FontFamily.manropeExtraBold, fontSize: 18, color: Colors.navy },
  modalContent: { padding: Spacing.pagePx, gap: 8, paddingBottom: 40 },
  modalReportTitle: { fontFamily: FontFamily.manropeExtraBold, fontSize: 16, color: Colors.navy },
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
