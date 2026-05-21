import { useEffect, useState } from 'react';
import {
  Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ClipboardList, X } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, Radius, Spacing, MaxWidth,
} from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import type { Database } from '@/lib/types';

// NOTE: maintenance_reports has no `title` column.
// `description` is used as the primary display text; `report_type` and `category` are supplementary.
type Report = Database['public']['Tables']['maintenance_reports']['Row'];
type ReportStatus = 'open' | 'in-progress' | 'resolved';

const STATUS_FILTERS: { value: ReportStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
];

export default function MaintenanceReportsScreen() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ReportStatus | 'all'>('all');
  const [selected, setSelected] = useState<Report | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    let query = supabase
      .from('maintenance_reports')
      .select('*')
      .order('created_at', { ascending: false });
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    const { data } = await query;
    setReports(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    const subscription = supabase
      .channel('maintenance_reports')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'maintenance_reports' },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(subscription);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateStatus(id: string, status: string) {
    setSaving(true);
    await supabase
      .from('maintenance_reports')
      .update({ status, admin_notes: adminNote || undefined })
      .eq('id', id);
    setSaving(false);
    setSelected(null);
    load();
  }

  const openCount = reports.filter((r) => r.status === 'open').length;
  const inProgressCount = reports.filter((r) => r.status === 'in-progress').length;

  return (
    <View style={styles.screen}>
      <Header variant="inner" title="Maintenance Reports" onBack={() => {}} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          {/* Count badges */}
          <View style={styles.countRow}>
            <View style={[styles.countBadge, { backgroundColor: '#EFF6FF' }]}>
              <Text style={[styles.countNum, { color: '#1D4ED8' }]}>{openCount}</Text>
              <Text style={styles.countLabel}>OPEN</Text>
            </View>
            <View style={[styles.countBadge, { backgroundColor: '#FFF9E6' }]}>
              <Text style={[styles.countNum, { color: '#92400E' }]}>{inProgressCount}</Text>
              <Text style={styles.countLabel}>IN PROGRESS</Text>
            </View>
          </View>

          {/* Status filter pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filterContent}>
            {STATUS_FILTERS.map((f) => (
              <TouchableOpacity
                key={f.value}
                style={[styles.filterPill, statusFilter === f.value && styles.filterPillActive]}
                onPress={() => setStatusFilter(f.value)}>
                <Text
                  style={[
                    styles.filterLabel,
                    statusFilter === f.value && styles.filterLabelActive,
                  ]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {loading && [0, 1, 2].map((i) => <CardSkeleton key={i} />)}

          {!loading && reports.length === 0 && (
            <EmptyState
              icon={<ClipboardList color={Colors.textMuted} size={48} strokeWidth={1.5} />}
              title="No reports found"
              subtitle={
                statusFilter === 'all'
                  ? 'No maintenance reports have been submitted.'
                  : `No ${statusFilter} reports.`
              }
            />
          )}

          {!loading &&
            reports.map((r) => (
              <Card
                key={r.id}
                accent={
                  r.status === 'open'
                    ? 'critical'
                    : r.status === 'in-progress'
                      ? 'attention'
                      : 'optimal'
                }
                onPress={() => {
                  setSelected(r);
                  setAdminNote(r.admin_notes ?? '');
                }}
                style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <Text style={styles.reportTitle} numberOfLines={2}>
                    {r.description}
                  </Text>
                  <StatusPill status={(r.status as ReportStatus) ?? 'open'} />
                </View>
                <Text style={styles.reportMeta}>
                  {r.category.toUpperCase()}
                  {r.report_type ? ` · ${r.report_type.toUpperCase()}` : ''}
                </Text>
                {r.location_text && (
                  <Text style={styles.reportLocation} numberOfLines={1}>
                    {r.location_text}
                  </Text>
                )}
                <Text style={styles.reportDate}>
                  {new Date(r.created_at).toLocaleDateString()}
                </Text>
              </Card>
            ))}
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
              <Text style={styles.modalTitle} numberOfLines={2}>
                {selected.description}
              </Text>
              <TouchableOpacity
                onPress={() => setSelected(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X color={Colors.textMuted} size={22} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={{ gap: 12, padding: Spacing.pagePx }}>
              <StatusPill status={(selected.status as ReportStatus) ?? 'open'} />
              <Text style={styles.reportMeta}>
                {selected.category.toUpperCase()}
                {selected.report_type ? ` · ${selected.report_type.toUpperCase()}` : ''}
              </Text>
              {selected.location_text && (
                <Text style={styles.modalDesc}>{selected.location_text}</Text>
              )}
              {selected.resolution_notes && (
                <>
                  <Text style={styles.modalLabel}>RESOLUTION NOTES</Text>
                  <Text style={styles.modalDesc}>{selected.resolution_notes}</Text>
                </>
              )}
              <Text style={styles.modalLabel}>ADMIN NOTES</Text>
              <TextInput
                style={styles.noteInput}
                value={adminNote}
                onChangeText={setAdminNote}
                placeholder="Add notes…"
                placeholderTextColor={Colors.textPlaceholder}
                multiline
                numberOfLines={3}
              />
              <View style={styles.actionRow}>
                <Button
                  variant="accent"
                  label="Mark Resolved"
                  onPress={() => updateStatus(selected.id, 'resolved')}
                  loading={saving}
                />
                <Button
                  variant="ghost"
                  label="In Progress"
                  onPress={() => updateStatus(selected.id, 'in-progress')}
                  loading={saving}
                />
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
  content: { padding: Spacing.pagePx, gap: Spacing.cardGap, paddingBottom: 100 },
  countRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  countBadge: { flex: 1, borderRadius: Radius.card, padding: 16, alignItems: 'center', gap: 4 },
  countNum: { fontFamily: FontFamily.manropeBlack, fontSize: 28 },
  countLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.metadata,
    color: Colors.textSubtle,
    letterSpacing: 1,
  },
  filterScroll: { marginBottom: 4 },
  filterContent: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  filterPill: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: Colors.cardBg,
  },
  filterPillActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  filterLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.uiLabel,
    color: Colors.textMuted,
  },
  filterLabelActive: { color: Colors.white },
  reportCard: { gap: 8 },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  reportTitle: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: 15,
    color: Colors.navy,
    flex: 1,
  },
  reportMeta: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.metadata,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  reportLocation: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.uiLabel,
    color: Colors.textSubtle,
  },
  reportDate: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.min,
    color: Colors.textMuted,
  },
  modal: { flex: 1, backgroundColor: Colors.cardBg },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: Spacing.pagePx,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: FontSize.sectionTitle,
    color: Colors.navy,
    flex: 1,
    marginRight: 12,
  },
  modalDesc: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: Colors.textSubtle,
    lineHeight: 22,
  },
  modalLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.metadata,
    color: Colors.textMuted,
    letterSpacing: 1.2,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    padding: 12,
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
    backgroundColor: Colors.cardBg,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actionRow: { flexDirection: 'row', gap: 12 },
  modalScroll: { flex: 1 },
});
