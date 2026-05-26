import { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  Plus, Droplet, Zap, Building2, Sparkles, Wrench, AlertTriangle, Image as ImageIcon,
} from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing,
} from '@/constants/design';
import { Header } from '@/components/ui/Header';

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'plumbing',    label: 'Plumbing',    Icon: Droplet },
  { key: 'electrical',  label: 'Electrical',  Icon: Zap },
  { key: 'structural',  label: 'Structural',  Icon: Building2 },
  { key: 'cleanliness', label: 'Cleanliness', Icon: Sparkles },
  { key: 'equipment',   label: 'Equipment',   Icon: Wrench },
  { key: 'safety',      label: 'Safety',      Icon: AlertTriangle },
] as const;
type CategoryKey = (typeof CATEGORIES)[number]['key'];

// ─── Severity config ──────────────────────────────────────────────────────────

const SEVERITY_LEVELS = [
  { key: 'low',      label: 'Low',      color: '#10B981' },
  { key: 'medium',   label: 'Medium',   color: '#F59E0B' },
  { key: 'high',     label: 'High',     color: '#F97066' },
  { key: 'critical', label: 'Critical', color: '#EF4444' },
] as const;
type SeverityKey = (typeof SEVERITY_LEVELS)[number]['key'];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Report {
  id: string;
  category: string;
  description: string;
  status: string;
  priority: string | null;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins <= 1 ? 'just now' : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReportScreen() {
  const [userId, setUserId] = useState('');
  const [hoaId, setHoaId] = useState('');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'all' | 'resolved'>('active');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [category, setCategory] = useState<CategoryKey>('plumbing');
  const [severity, setSeverity] = useState<SeverityKey>('medium');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  async function load() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) { setLoading(false); return; }

      setUserId(user.id);

      const { data: membership } = await supabase
        .from('hoa_memberships')
        .select('hoa_id')
        .eq('user_id', user.id)
        .eq('status', 'approved')
        .limit(1)
        .single();

      const hId = membership?.hoa_id ?? '';
      setHoaId(hId);

      if (hId) {
        const { data } = await supabase
          .from('maintenance_reports')
          .select('id, category, description, status, priority, created_at')
          .eq('reporter_id', user.id)
          .eq('hoa_id', hId)
          .order('created_at', { ascending: false });
        setReports(data ?? []);
      }

      setLoading(false);
    } catch {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useFocusEffect(useCallback(() => { load(); }, []));

  const activeReports = reports.filter((r) => ['open', 'in_progress'].includes(r.status));
  const resolvedReports = reports.filter((r) => ['resolved', 'closed'].includes(r.status));
  const filteredReports = filter === 'active' ? activeReports
    : filter === 'resolved' ? resolvedReports
    : reports;

  async function handleSubmit() {
    if (!description.trim() || !userId || !hoaId) return;
    setSubmitting(true);
    await supabase.from('maintenance_reports').insert({
      category,
      description: description.trim(),
      hoa_id: hoaId,
      reporter_id: userId,
      status: 'open',
      priority: severity,
      report_type: 'maintenance',
      is_urgent: severity === 'high' || severity === 'critical',
    });
    setSubmitSuccess(true);
    await load();
    setTimeout(() => {
      setShowForm(false);
      setSubmitSuccess(false);
      setStep(1);
      setCategory('plumbing');
      setSeverity('medium');
      setDescription('');
      setSubmitting(false);
    }, 1500);
  }

  function openForm() {
    setStep(1);
    setCategory('plumbing');
    setSeverity('medium');
    setDescription('');
    setSubmitSuccess(false);
    setSubmitting(false);
    setShowForm(true);
  }

  const FILTER_TABS = [
    { key: 'active',   label: 'Active',   count: activeReports.length },
    { key: 'all',      label: 'All',      count: reports.length },
    { key: 'resolved', label: 'Resolved', count: resolvedReports.length },
  ] as const;

  return (
    <View style={styles.screen}>
      <Header variant="resident" />

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <View style={styles.hero}>
        <View style={styles.heroContent}>
          <Text style={styles.heroLabel}>REPORTS</Text>
          <Text style={styles.heroTitle}>My Reports</Text>
          <Text style={styles.heroSub}>
            Track and submit maintenance issues in your community.
          </Text>
        </View>
        <TouchableOpacity
          testID="new-report-btn"
          style={styles.newReportBtn}
          onPress={openForm}
          activeOpacity={0.85}>
          <Plus color={Colors.navy} size={22} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      {/* ── Filter tabs ─────────────────────────────────────────────────── */}
      <View testID="filter-tabs" style={styles.filterRow}>
        {FILTER_TABS.map(({ key, label, count }) => {
          const active = filter === key;
          return (
            <TouchableOpacity
              key={key}
              testID={`filter-${key}`}
              onPress={() => setFilter(key)}
              style={[styles.filterTab, active && styles.filterTabActive]}>
              <Text style={[styles.filterTabLabel, active && styles.filterTabLabelActive]}>
                {label}
              </Text>
              {!loading && (
                <View style={[styles.countBadge, active && styles.countBadgeActive]}>
                  <Text style={[styles.countText, active && styles.countTextActive]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Reports list ────────────────────────────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>
          {loading ? (
            <View style={styles.loadingBox} />
          ) : filteredReports.length === 0 ? (
            <View testID="reports-empty" style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No reports yet</Text>
              <Text style={styles.emptySub}>
                Tap "+" to submit a new maintenance issue.
              </Text>
            </View>
          ) : (
            filteredReports.map((r) => {
              const catConfig = CATEGORIES.find((c) => c.key === r.category);
              const Icon = catConfig?.Icon ?? AlertTriangle;
              const isActive = ['open', 'in_progress'].includes(r.status);
              return (
                <View key={r.id} testID="report-card" style={styles.reportCard}>
                  <View style={[
                    styles.reportIconWrap,
                    { backgroundColor: isActive ? '#E0F9FF' : '#F0FDF4' },
                  ]}>
                    <Icon
                      color={isActive ? Colors.accentCyan : '#10B981'}
                      size={20}
                      strokeWidth={1.5}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.reportCategory}>
                      {r.category.charAt(0).toUpperCase() + r.category.slice(1)}
                    </Text>
                    <Text style={styles.reportDesc} numberOfLines={2}>
                      {r.description}
                    </Text>
                    <Text style={styles.reportTime}>{timeAgo(r.created_at)}</Text>
                  </View>
                  <View style={[
                    styles.statusPill,
                    { backgroundColor: isActive ? '#E0F9FF' : '#F0FDF4' },
                  ]}>
                    <Text style={[
                      styles.statusText,
                      { color: isActive ? Colors.accentCyan : '#10B981' },
                    ]}>
                      {r.status === 'in_progress'
                        ? 'In Progress'
                        : r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* ── 2-step form overlay ─────────────────────────────────────────── */}
      {showForm && (
        <View testID="report-form" style={styles.formOverlay}>
          <TouchableOpacity
            style={styles.formBackdrop}
            onPress={() => setShowForm(false)}
            activeOpacity={1}
          />
          <View style={styles.formSheet}>
            {/* Form header */}
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>New Report</Text>
              <TouchableOpacity
                onPress={() => setShowForm(false)}
                style={styles.formCloseBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.formCloseX}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Progress bar */}
            <View testID="form-progress" style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: step === 1 ? '50%' : '100%' }]} />
            </View>
            <Text style={styles.stepIndicator}>Step {step} of 2</Text>

            {submitSuccess ? (
              <View testID="submit-success" style={styles.successBox}>
                <Text style={styles.successText}>✓ Report submitted!</Text>
                <Text style={styles.successSub}>Your HOA admin has been notified.</Text>
              </View>
            ) : step === 1 ? (
              /* ── Step 1 ──────────────────────────────────────────────── */
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.formBody}
                keyboardShouldPersistTaps="handled">

                <Text style={styles.formSectionLabel}>SELECT CATEGORY</Text>
                <View testID="category-grid" style={styles.categoryGrid}>
                  {CATEGORIES.map(({ key, label, Icon }) => {
                    const sel = category === key;
                    return (
                      <TouchableOpacity
                        key={key}
                        testID="category-tile"
                        onPress={() => setCategory(key)}
                        style={[styles.categoryTile, sel && styles.categoryTileActive]}
                        activeOpacity={0.8}>
                        <Icon
                          color={sel ? Colors.white : Colors.navy}
                          size={22}
                          strokeWidth={1.5}
                        />
                        <Text style={[
                          styles.categoryTileLabel,
                          sel && styles.categoryTileLabelActive,
                        ]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.formSectionLabel, { marginTop: 20 }]}>SEVERITY</Text>
                <View testID="severity-selector" style={styles.severityRow}>
                  {SEVERITY_LEVELS.map(({ key, label, color }) => {
                    const sel = severity === key;
                    return (
                      <TouchableOpacity
                        key={key}
                        testID={`severity-${key}`}
                        onPress={() => setSeverity(key)}
                        style={[
                          styles.severityBtn,
                          sel && { backgroundColor: color, borderColor: color },
                        ]}
                        activeOpacity={0.8}>
                        <Text style={[styles.severityLabel, sel && { color: Colors.white }]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  testID="next-step-btn"
                  style={styles.primaryBtn}
                  onPress={() => setStep(2)}
                  activeOpacity={0.85}>
                  <Text style={styles.primaryBtnLabel}>Next Step →</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              /* ── Step 2 ──────────────────────────────────────────────── */
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.formBody}
                keyboardShouldPersistTaps="handled">

                <Text style={styles.formSectionLabel}>DESCRIPTION</Text>
                <TextInput
                  testID="description-input"
                  style={styles.descInput}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Describe the issue in detail…"
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                />

                <Text style={[styles.formSectionLabel, { marginTop: 16 }]}>
                  PHOTO (OPTIONAL)
                </Text>
                <TouchableOpacity
                  testID="photo-upload-area"
                  style={styles.photoUpload}
                  activeOpacity={0.7}>
                  <ImageIcon color={Colors.textMuted} size={28} strokeWidth={1.5} />
                  <Text style={styles.photoUploadLabel}>Tap to add a photo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setStep(1)}
                  style={styles.backLink}>
                  <Text style={styles.backLinkText}>← Back to Step 1</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  testID="submit-btn"
                  style={[
                    styles.primaryBtn,
                    (!description.trim() || submitting) && styles.primaryBtnDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={submitting || !description.trim()}
                  activeOpacity={0.85}>
                  <Text style={styles.primaryBtnLabel}>
                    {submitting ? 'Submitting…' : 'Submit Report'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },

  // Hero
  hero: {
    backgroundColor: Colors.headerBg,
    paddingHorizontal: Spacing.pagePx,
    paddingTop: 8,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroContent: { flex: 1 },
  heroLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.metadata,
    color: Colors.accentCyan,
    letterSpacing: 2.2,
    marginBottom: 4,
  },
  heroTitle: {
    fontFamily: FontFamily.manropeBlack,
    fontSize: 30,
    color: Colors.white,
    lineHeight: 34,
  },
  heroSub: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: 'rgba(0,212,255,0.7)',
    marginTop: 6,
    maxWidth: 240,
  },
  newReportBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accentCyan,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    flexShrink: 0,
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 4,
  },

  // Filter tabs
  filterRow: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.pagePx,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  filterTabActive: {
    borderBottomColor: Colors.accentCyan,
  },
  filterTabLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.uiLabel,
    color: Colors.textMuted,
  },
  filterTabLabelActive: {
    color: Colors.navy,
  },
  countBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  countBadgeActive: {
    backgroundColor: '#E0F9FF',
  },
  countText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 11,
    color: Colors.textMuted,
  },
  countTextActive: {
    color: Colors.accentCyan,
  },

  // Body
  body: {
    paddingHorizontal: Spacing.pagePx,
    paddingTop: 20,
    paddingBottom: 100,
  },
  loadingBox: {
    height: 80,
    backgroundColor: '#F3F4F6',
    borderRadius: Radius.card,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: FontFamily.manropeBold,
    fontSize: 18,
    color: Colors.navy,
  },
  emptySub: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  // Report card
  reportCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  reportIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  reportCategory: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: 15,
    color: Colors.navy,
  },
  reportDesc: {
    fontFamily: FontFamily.interRegular,
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
    lineHeight: 18,
  },
  reportTime: {
    fontFamily: FontFamily.interRegular,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
  statusPill: {
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  statusText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 11,
  },

  // Form overlay
  formOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  formBackdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  formSheet: {
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    minHeight: '60%',
    overflow: 'hidden',
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  formTitle: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: 20,
    color: Colors.navy,
  },
  formCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCloseX: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 14,
    color: Colors.textMuted,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 20,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: Colors.accentCyan,
    borderRadius: 2,
  },
  stepIndicator: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 12,
    color: Colors.textMuted,
    marginHorizontal: 20,
    marginTop: 6,
    marginBottom: 2,
  },
  formBody: {
    padding: 20,
    paddingBottom: 36,
  },
  formSectionLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 12,
  },

  // Category grid
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryTile: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 8,
  },
  categoryTileActive: {
    backgroundColor: Colors.navy,
    borderColor: Colors.accentCyan,
  },
  categoryTileLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 11,
    color: Colors.navy,
    textAlign: 'center',
  },
  categoryTileLabelActive: {
    color: Colors.white,
  },

  // Severity
  severityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  severityBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: Colors.white,
    alignItems: 'center',
  },
  severityLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 12,
    color: Colors.textMuted,
  },

  // Buttons
  primaryBtn: {
    marginTop: 20,
    backgroundColor: Colors.accentCyan,
    borderRadius: Radius.button,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.4,
  },
  primaryBtnLabel: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: FontSize.uiLabel,
    color: Colors.white,
  },

  // Description input
  descInput: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
    minHeight: 120,
  },

  // Photo upload
  photoUpload: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.white,
  },
  photoUploadLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.uiLabel,
    color: Colors.textMuted,
  },

  // Back link
  backLink: {
    marginTop: 12,
    alignItems: 'center',
  },
  backLinkText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.uiLabel,
    color: Colors.textMuted,
  },

  // Success
  successBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 32,
  },
  successText: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: 22,
    color: '#10B981',
  },
  successSub: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
