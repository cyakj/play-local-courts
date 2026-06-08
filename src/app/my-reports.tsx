import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import {
  Calendar, ChevronRight, ClipboardList, Plus,
} from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing } from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

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
    case 'in_progress':
      return { bg: 'rgba(255,92,107,0.15)', color: Colors.negative, label: status === 'in_progress' ? 'In Progress' : 'Open' };
    case 'completed':
    case 'resolved':
      return { bg: 'rgba(45,224,255,0.12)', color: Colors.accentCyan, label: 'Resolved' };
    case 'reopened':
      return { bg: 'rgba(255,92,107,0.15)', color: Colors.negative, label: 'Reopened' };
    default:
      return { bg: 'rgba(154,163,184,0.12)', color: Colors.textMuted, label: status };
  }
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const ACTIVE_STATUSES = ['open', 'in_progress', 'accepted', 'reopened'];
const RESOLVED_STATUSES = ['completed', 'resolved'];

export default function MyReportsScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const [reports, setReports] = useState<UserReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterVal>('active');

  useEffect(() => { load(); }, []);

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

  function getReportTitle(r: UserReport) {
    if (r.report_type === 'location') {
      const loc = r.location_text || 'Unknown location';
      return loc.length > 30 ? loc.slice(0, 30) + '…' : loc;
    }
    return r.amenity_name || getCategoryLabel(r.category);
  }

  const counts = {
    active:   reports.filter((r) => ACTIVE_STATUSES.includes(r.status)).length,
    all:      reports.length,
    resolved: reports.filter((r) => RESOLVED_STATUSES.includes(r.status)).length,
  };

  const filtered = filter === 'active'
    ? reports.filter((r) => ACTIVE_STATUSES.includes(r.status))
    : filter === 'resolved'
    ? reports.filter((r) => RESOLVED_STATUSES.includes(r.status))
    : reports;

  const FILTERS: { value: FilterVal; label: string }[] = [
    { value: 'active',   label: 'Active' },
    { value: 'all',      label: 'All' },
    { value: 'resolved', label: 'Resolved' },
  ];

  return (
    <View style={styles.screen}>
      <Header
        variant="inner"
        title="My Reports"
        onBack={() => router.back()}
        rightIcon={
          <TouchableOpacity
            onPress={() => router.push('/(resident)/report')}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
            <Plus color={Colors.accentCyan} size={22} strokeWidth={2} />
          </TouchableOpacity>
        }
      />

      {/* Filter chips */}
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
            <View style={styles.loadingBox}>
              <ActivityIndicator color={Colors.accentCyan} size="large" />
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyCard}>
              <ClipboardList color={theme.textMuted} size={40} strokeWidth={1.5} />
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
              return (
                <TouchableOpacity
                  key={r.id}
                  testID="my-report-card"
                  style={styles.card}
                  onPress={() => router.push(`/report-detail/${r.id}` as any)}
                  activeOpacity={0.85}>
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
                        <Calendar color={theme.textMuted} size={12} strokeWidth={2} />
                        <Text style={styles.dateText}>{fmtDate(r.created_at)}</Text>
                      </View>
                      {r.admin_notes && (
                        <View style={styles.adminNotes}>
                          <Text style={styles.adminNotesText}>
                            <Text style={styles.adminNotesBold}>Admin: </Text>
                            {r.admin_notes}
                          </Text>
                        </View>
                      )}
                    </View>
                    <ChevronRight color={theme.textMuted} size={16} strokeWidth={2} />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen:  { flex: 1, backgroundColor: theme.pageBg },

    chipBar: {
      backgroundColor: theme.cardBg,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      paddingVertical: 10,
      paddingHorizontal: Spacing.pagePx,
    },
    chipContent: { gap: 8 },
    chip: {
      borderRadius: Radius.chip,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: theme.pageBg,
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipActive: { backgroundColor: theme.chipActiveBg, borderColor: theme.chipActiveBg },
    chipLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.uiLabel,
      color: theme.textSecondary,
    },
    chipLabelActive: { color: Colors.white },

    content:    { padding: Spacing.pagePx, paddingBottom: 60, gap: 12 },
    loadingBox: { alignItems: 'center', paddingVertical: 40 },

    emptyCard: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      padding: 32,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      gap: 8,
    },
    emptyTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.sectionTitle,
      color: theme.textPrimary,
      marginTop: 4,
    },
    emptyDesc: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textMuted,
      textAlign: 'center',
    },

    card: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      paddingVertical: 16,
      paddingRight: 16,
      paddingLeft: 0,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
      ...theme.shadowCard,
      flexDirection: 'row',
    },
    cardAccentBar: {
      width: 4,
      alignSelf: 'stretch',
      flexShrink: 0,
    },
    cardMain: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingLeft: 12, flex: 1 },
    cardTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
      marginBottom: 6,
    },
    pillRow: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' },
    statusPill: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
    statusPillText: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 11 },
    catPill: {
      borderRadius: 99,
      paddingHorizontal: 8,
      paddingVertical: 2,
      backgroundColor: theme.surface2,
      borderWidth: 1,
      borderColor: theme.border,
    },
    catPillText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 11, color: theme.textSecondary },
    cardDesc: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textSecondary,
      lineHeight: 20,
      marginBottom: 8,
    },
    dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dateText: { fontFamily: FontFamily.manropeMedium, fontSize: 13, color: theme.textMuted },
    adminNotes: {
      backgroundColor: 'rgba(45,224,255,0.08)',
      borderRadius: Radius.button,
      borderWidth: 1,
      borderColor: 'rgba(45,224,255,0.18)',
      padding: 10,
      marginTop: 8,
    },
    adminNotesText: { fontFamily: FontFamily.manropeMedium, fontSize: 12, color: Colors.accentCyan },
    adminNotesBold: { fontFamily: FontFamily.manropeSemiBold },
  }), [theme]);
}
