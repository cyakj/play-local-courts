import { useEffect, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Calendar, ChevronRight, ClipboardList, Plus,
} from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Shadow, Spacing,
} from '@/constants/design';

interface UserReport {
  id: string;
  category: string;
  description: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  amenity_id: string | null;
  amenity_name: string | null;
  report_type: string | null;
  location_text: string | null;
  hoa_id: string;
}

type FilterVal = 'active' | 'all' | 'resolved';

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

function getStatusPill(status: string) {
  switch (status) {
    case 'open':
    case 'accepted':
      return { bg: '#FFF5F5', color: Colors.coral, label: 'Open' };
    case 'in_progress':
      return { bg: '#FFF5F5', color: Colors.coral, label: 'In Progress' };
    case 'completed':
    case 'resolved':
      return { bg: '#E0F9FF', color: Colors.accentCyan, label: 'Resolved' };
    case 'reopened':
      return { bg: '#FEF2F2', color: Colors.red, label: 'Reopened' };
    default:
      return { bg: Colors.pageBg, color: Colors.textMuted, label: status };
  }
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

const ACTIVE_STATUSES = ['open', 'in_progress', 'accepted', 'reopened'];
const RESOLVED_STATUSES = ['completed', 'resolved'];

export default function MyReportsScreen() {
  const insets = useSafeAreaInsets();
  const [reports, setReports] = useState<UserReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterVal>('active');
  const [selectedReport, setSelectedReport] = useState<UserReport | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from('maintenance_reports')
      .select('id, category, description, status, admin_notes, created_at, updated_at, amenity_id, report_type, location_text, hoa_id')
      .eq('reporter_id', user.id)
      .order('created_at', { ascending: false });

    if (!data) { setLoading(false); return; }

    const amenityIds = [...new Set(data.filter((r) => r.amenity_id).map((r) => r.amenity_id!))];
    const amenityMap: Record<string, string> = {};
    if (amenityIds.length > 0) {
      const { data: courts } = await supabase.from('courts').select('id, name').in('id', amenityIds);
      (courts ?? []).forEach((c) => { amenityMap[c.id] = c.name; });
    }

    setReports(data.map((r) => ({
      ...r,
      amenity_name: r.amenity_id ? (amenityMap[r.amenity_id] ?? null) : null,
    })));
    setLoading(false);
  }

  const getReportTitle = (r: UserReport) => {
    if (r.report_type === 'location') {
      const loc = r.location_text || 'Unknown location';
      return loc.length > 30 ? loc.slice(0, 30) + '…' : loc;
    }
    return r.amenity_name || getCategoryLabel(r.category);
  };

  const counts = {
    active: reports.filter((r) => ACTIVE_STATUSES.includes(r.status)).length,
    all: reports.length,
    resolved: reports.filter((r) => RESOLVED_STATUSES.includes(r.status)).length,
  };

  const filtered = filter === 'active'
    ? reports.filter((r) => ACTIVE_STATUSES.includes(r.status))
    : filter === 'resolved'
    ? reports.filter((r) => RESOLVED_STATUSES.includes(r.status))
    : reports;

  const FILTERS: { value: FilterVal; label: string }[] = [
    { value: 'active', label: 'Active' },
    { value: 'all', label: 'All' },
    { value: 'resolved', label: 'Resolved' },
  ];

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <Text style={styles.headerLabel}>MAINTENANCE</Text>
        <View style={styles.headerTopRow}>
          <Text style={styles.headerTitle}>My Reports</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/(resident)/report')}
            activeOpacity={0.8}>
            <Plus color={Colors.white} size={20} strokeWidth={2} />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSub}>Track and submit maintenance issues in your community.</Text>
      </View>

      {/* Filter chips bar */}
      <View style={styles.chipBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipContent}>
          {FILTERS.map(({ value, label }) => {
            const active = filter === value;
            return (
              <TouchableOpacity
                key={value}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setFilter(value)}
                activeOpacity={0.7}>
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                  {label} ({counts[value]})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>
          {loading ? (
            <View style={styles.loadingRow}>
              <View style={styles.spinner} />
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyCard}>
              <ClipboardList color={Colors.textMuted} size={40} strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>
                {filter === 'all' ? 'No Reports Yet' : `No ${filter} reports`}
              </Text>
              <Text style={styles.emptyDesc}>
                {filter === 'all'
                  ? 'Submit a maintenance report to track issues in your community.'
                  : 'No reports match the selected filter.'}
              </Text>
            </View>
          ) : (
            filtered.map((r) => {
              const pill = getStatusPill(r.status);
              const isActive = ACTIVE_STATUSES.includes(r.status);
              return (
                <TouchableOpacity
                  key={r.id}
                  testID="my-report-card"
                  style={styles.card}
                  onPress={() => router.push(`/report-detail/${r.id}` as any)}
                  activeOpacity={0.85}>
                  {/* Left status accent bar */}
                  <View style={[styles.cardAccentBar, { backgroundColor: pill.color }]} />
                  <View style={styles.cardMain}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{getReportTitle(r)}</Text>
                      <View style={styles.pillRow}>
                        <View style={[styles.statusPill, {
                          backgroundColor: pill.bg,
                          borderWidth: 1,
                          borderColor: pill.color + '40',
                        }]}>
                          <Text style={[styles.statusPillText, { color: pill.color }]}>{pill.label}</Text>
                        </View>
                        <View style={styles.catPill}>
                          <Text style={styles.catPillText}>{getCategoryLabel(r.category)}</Text>
                        </View>
                      </View>
                      <Text style={styles.cardDesc} numberOfLines={2}>{r.description}</Text>
                      <View style={styles.dateRow}>
                        <Calendar color="#4B5563" size={12} strokeWidth={2} />
                        <Text style={styles.dateText}>{fmtDate(r.created_at)}</Text>
                      </View>
                      {r.admin_notes && (
                        <View style={styles.adminNotes}>
                          <Text style={styles.adminNotesText}>
                            <Text style={styles.adminNotesBold}>Admin update: </Text>
                            {r.admin_notes}
                          </Text>
                        </View>
                      )}
                    </View>
                    <ChevronRight color={Colors.textMuted} size={16} strokeWidth={2} />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Report Detail Modal */}
      <Modal
        visible={!!selectedReport}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedReport(null)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedReport(null)}>
          {selectedReport && (
            <TouchableOpacity activeOpacity={1} style={styles.detailSheet}>
              <View style={styles.detailHandle} />
              <View style={styles.detailHeaderRow}>
                <Text style={styles.detailTitle}>Report Details</Text>
                <TouchableOpacity onPress={() => setSelectedReport(null)} style={styles.detailClose}>
                  <ArrowLeft color={Colors.textMuted} size={20} strokeWidth={1.5} />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.detailReportTitle}>{getReportTitle(selectedReport)}</Text>
                <View style={styles.pillRow}>
                  {(() => {
                    const pill = getStatusPill(selectedReport.status);
                    return (
                      <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
                        <Text style={[styles.statusPillText, { color: pill.color }]}>{pill.label}</Text>
                      </View>
                    );
                  })()}
                  <View style={styles.catPill}>
                    <Text style={styles.catPillText}>{getCategoryLabel(selectedReport.category)}</Text>
                  </View>
                </View>

                <Text style={styles.detailField}>DESCRIPTION</Text>
                <View style={styles.descBlock}>
                  <Text style={styles.descBlockText}>{selectedReport.description}</Text>
                </View>

                <View style={styles.detailGrid}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailField}>SUBMITTED</Text>
                    <Text style={styles.detailValue}>{fmtDateTime(selectedReport.created_at)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailField}>LAST UPDATED</Text>
                    <Text style={styles.detailValue}>{fmtDateTime(selectedReport.updated_at)}</Text>
                  </View>
                </View>

                {selectedReport.admin_notes && (
                  <>
                    <Text style={[styles.detailField, { marginTop: 16 }]}>ADMIN NOTES</Text>
                    <View style={styles.adminNotesDetail}>
                      <Text style={styles.adminNotesDetailText}>{selectedReport.admin_notes}</Text>
                    </View>
                  </>
                )}
              </ScrollView>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },

  header: {
    backgroundColor: Colors.navy,
    paddingHorizontal: Spacing.pagePx,
    paddingBottom: 24,
    overflow: 'hidden',
  },
  headerLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 11,
    color: Colors.accentCyan,
    letterSpacing: 2.2,
    marginBottom: 6,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.accentCyan,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerTitle: {
    fontFamily: FontFamily.manropeBlack,
    fontSize: 32,
    color: Colors.white,
    lineHeight: 36,
    letterSpacing: -0.5,
    flex: 1,
  },
  headerSub: {
    fontFamily: FontFamily.interRegular,
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 4,
    lineHeight: 22,
  },

  chipBar: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 10,
    paddingHorizontal: Spacing.pagePx,
  },
  chipContent: { gap: 8 },
  chip: {
    borderRadius: Radius.chip,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.pageBg,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.uiLabel,
    color: '#374151',
  },
  chipLabelActive: { color: Colors.white },

  content: { padding: Spacing.pagePx, paddingBottom: 60, gap: 12 },

  loadingRow: { alignItems: 'center', paddingVertical: 40 },
  spinner: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(0,212,255,0.2)',
    borderTopColor: Colors.accentCyan,
  },
  emptyCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: 15,
    color: Colors.navy,
    marginTop: 4,
  },
  emptyDesc: { fontFamily: FontFamily.interRegular, fontSize: 14, color: '#4B5563', textAlign: 'center' },

  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    paddingVertical: 16,
    paddingRight: 16,
    paddingLeft: 0,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadow,
  },
  cardAccentBar: {
    width: 4,
    alignSelf: 'stretch',
    flexShrink: 0,
    borderRadius: 0,
  },
  cardMain: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingLeft: 12 },
  cardTitle: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: 16,
    color: Colors.navy,
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' },
  statusPill: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  statusPillText: { fontFamily: FontFamily.interSemiBold, fontSize: 11 },
  catPill: {
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  catPillText: { fontFamily: FontFamily.interSemiBold, fontSize: 12, color: '#4B5563' },
  cardDesc: {
    fontFamily: FontFamily.interRegular,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 8,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateText: { fontFamily: FontFamily.interRegular, fontSize: 13, color: '#4B5563' },
  adminNotes: {
    backgroundColor: '#E0F9FF',
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
  },
  adminNotesText: { fontFamily: FontFamily.interRegular, fontSize: 12, color: Colors.blueMid },
  adminNotesBold: { fontFamily: FontFamily.interSemiBold },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  detailSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  detailHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  detailTitle: { fontFamily: FontFamily.manropeExtraBold, fontSize: FontSize.sectionTitle, color: Colors.navy },
  detailClose: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  detailReportTitle: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: 15,
    color: Colors.navy,
    marginBottom: 8,
  },
  detailField: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 12,
    color: '#374151',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 4,
  },
  descBlock: {
    backgroundColor: Colors.pageBg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  descBlockText: { fontFamily: FontFamily.interRegular, fontSize: 14, color: Colors.navy },
  detailGrid: { flexDirection: 'row', gap: 16, marginTop: 8 },
  detailValue: { fontFamily: FontFamily.interSemiBold, fontSize: 13, color: Colors.navy },
  adminNotesDetail: {
    backgroundColor: '#E0F9FF',
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
  },
  adminNotesDetailText: { fontFamily: FontFamily.interRegular, fontSize: 13, color: Colors.blueMid },
});
