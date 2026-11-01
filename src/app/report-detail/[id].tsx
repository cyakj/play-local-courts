import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Calendar, MapPin, Tag } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { FontFamily, FontSize, MaxWidth, Radius, Spacing } from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { useTheme } from '@/context/ThemeContext';
import { fetchMemberNames } from '@/lib/memberNames';
import type { ThemeTokens } from '@/constants/theme-tokens';
import {
  categoryLabel, fmtDateTime, reportTitle, reportWhere, severityPill, showUpdated, statusPill,
} from '@/lib/reportDetailView';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportDetail {
  id: string;
  category: string;
  description: string;
  status: string;
  priority: string | null;
  photo_url: string | null;
  resolution_notes: string | null;
  location_text: string | null;
  report_type: string;
  is_urgent: boolean;
  created_at: string;
  updated_at: string;
  amenity_name: string | null;
}

interface ReportNote {
  id: string;
  body: string;
  created_at: string;
  is_internal: boolean;
  author_name: string;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [notes, setNotes] = useState<ReportNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    load();
  }, [id]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('maintenance_reports')
        .select('id, category, description, status, priority, photo_url, resolution_notes, location_text, report_type, is_urgent, created_at, updated_at, amenity_id')
        .eq('id', id)
        .single();

      if (err || !data) { setError('Report not found.'); setLoading(false); return; }

      let amenity_name: string | null = null;
      if (data.amenity_id) {
        const { data: court } = await supabase
          .from('courts').select('name').eq('id', data.amenity_id).single();
        amenity_name = court?.name ?? null;
      }

      setReport({ ...data, amenity_name });

      // Fetch public notes (not internal)
      const { data: noteRows } = await supabase
        .from('report_notes')
        .select('id, body, created_at, is_internal, author_id')
        .eq('report_id', id)
        .eq('is_internal', false)
        .order('created_at', { ascending: true });

      if (noteRows && noteRows.length > 0) {
        const authorIds = [...new Set(noteRows.map((n: any) => n.author_id))];
        const names = await fetchMemberNames(authorIds as string[]).catch(() => new Map<string, string | null>());
        const profileMap: Record<string, string> = {};
        names.forEach((name, id) => { profileMap[id] = name ?? 'Staff'; });
        setNotes(noteRows.map((n: any) => ({
          id: n.id,
          body: n.body,
          created_at: n.created_at,
          is_internal: n.is_internal,
          author_name: profileMap[n.author_id] ?? 'Staff',
        })));
      }

      setLoading(false);
    } catch {
      setError('Failed to load report.');
      setLoading(false);
    }
  }

  const status = report ? statusPill(report.status) : null;
  const severity = report ? severityPill(report.priority) : null;
  const where = report ? reportWhere(report) : null;

  return (
    <View style={styles.screen} testID="report-detail-screen">
      <Header
        variant="inner"
        title="Report Detail"
        onBack={() => router.back()}
      />

      {loading ? (
        <View style={styles.loadingBox} testID="detail-loading">
          <ActivityIndicator color={theme.cyanOnLight} size="large" />
        </View>
      ) : error ? (
        <View style={styles.errorBox} testID="detail-error">
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity testID="detail-retry" onPress={load} style={styles.retryBtn} accessibilityRole="button">
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : report && status ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center', gap: 14 }}>

            {/* Summary card: what, how serious, where it stands */}
            <View style={styles.card} testID="detail-title-row">
              <Text style={styles.eyebrow}>{report.is_urgent ? 'URGENT REPORT' : 'MAINTENANCE REPORT'}</Text>
              <Text style={styles.title} testID="detail-title">{reportTitle(report)}</Text>
              <View style={styles.pillRow}>
                <View style={[styles.pill, { backgroundColor: status.bg }]}>
                  <Text style={[styles.pillText, { color: status.fg }]} testID="detail-status">{status.label}</Text>
                </View>
                {severity && (
                  <View style={[styles.pill, { backgroundColor: severity.bg }]}>
                    <Text style={[styles.pillText, { color: severity.fg }]} testID="detail-priority">{severity.label}</Text>
                  </View>
                )}
                {report.is_urgent && (
                  <View style={[styles.pill, { backgroundColor: '#FEE4E2' }]}>
                    <Text style={[styles.pillText, { color: '#B42318' }]}>Urgent</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Facts */}
            <View style={styles.card} testID="detail-facts">
              <View style={styles.factRow}>
                <Tag color={theme.textMuted} size={16} strokeWidth={2} />
                <Text style={styles.factLabel}>Category</Text>
                <Text style={styles.factValue} testID="detail-category">{categoryLabel(report.category)}</Text>
              </View>
              {where && (
                <View style={styles.factRow}>
                  <MapPin color={theme.textMuted} size={16} strokeWidth={2} />
                  <Text style={styles.factLabel}>Location</Text>
                  <Text style={styles.factValue} testID="detail-location">{where}</Text>
                </View>
              )}
              <View style={styles.factRow}>
                <Calendar color={theme.textMuted} size={16} strokeWidth={2} />
                <Text style={styles.factLabel}>Submitted</Text>
                <Text style={styles.factValue} testID="detail-submitted-date">{fmtDateTime(report.created_at)}</Text>
              </View>
              {showUpdated(report.created_at, report.updated_at) && (
                <View style={styles.factRow}>
                  <Calendar color={theme.textMuted} size={16} strokeWidth={2} />
                  <Text style={styles.factLabel}>Last updated</Text>
                  <Text style={styles.factValue} testID="detail-updated-date">{fmtDateTime(report.updated_at)}</Text>
                </View>
              )}
            </View>

            {/* Description */}
            <View style={styles.card} testID="detail-description-card">
              <Text style={styles.sectionLabel}>DESCRIPTION</Text>
              <Text style={styles.bodyText} testID="detail-description">{report.description}</Text>
            </View>

            {/* Photo */}
            {report.photo_url ? (
              <View style={styles.card} testID="detail-photo-container">
                <Text style={styles.sectionLabel}>PHOTO</Text>
                <Image
                  source={{ uri: report.photo_url }}
                  style={styles.photo}
                  resizeMode="cover"
                  accessibilityLabel="Photo attached to this report"
                  testID="detail-photo"
                />
              </View>
            ) : null}

            {/* Resolution notes */}
            {report.resolution_notes ? (
              <View style={styles.resolutionCard} testID="detail-resolution-notes">
                <Text style={[styles.sectionLabel, { color: '#05603A' }]}>RESOLUTION</Text>
                <Text style={[styles.bodyText, { color: '#05603A' }]}>{report.resolution_notes}</Text>
              </View>
            ) : null}

            {/* admin_notes is deprecated and never shown to residents; resident-visible updates are
                non-internal report_notes, rendered in the updates timeline below. */}

            {/* Updates from management */}
            <View style={styles.card} testID="detail-timeline">
              <Text style={styles.sectionLabel}>UPDATES</Text>
              {notes.length === 0 ? (
                <Text style={styles.emptyText} testID="detail-no-updates">No updates from management yet.</Text>
              ) : notes.map((note, idx) => (
                <View key={note.id} style={[styles.timelineItem, idx === 0 && { borderTopWidth: 0, paddingTop: 0 }]}
                  testID="detail-timeline-item">
                  <View style={[styles.timelineDot, idx === notes.length - 1 && styles.timelineDotLast]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timelineBody}>{note.body}</Text>
                    <Text style={styles.timelineMeta}>{note.author_name} · {fmtDateTime(note.created_at)}</Text>
                  </View>
                </View>
              ))}
            </View>

          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.pageBg },

    loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    errorBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
    errorText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body, color: theme.textSecondary, textAlign: 'center' },
    retryBtn: { minHeight: 44, paddingHorizontal: 20, borderRadius: Radius.sm, borderWidth: 1, borderColor: theme.borderStrong, alignItems: 'center', justifyContent: 'center' },
    retryText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label, color: theme.textPrimary },

    content: { padding: Spacing.pagePx, paddingBottom: 60 },

    card: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 10,
    },
    eyebrow: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 11, letterSpacing: 1.8, color: theme.textMuted },
    title: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 24, lineHeight: 30, color: theme.textPrimary, letterSpacing: -0.3 },
    pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    pill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
    pillText: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 12 },

    factRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 28 },
    factLabel: { fontFamily: FontFamily.manropeSemiBold, fontSize: 14, color: theme.textMuted, width: 96 },
    factValue: { flex: 1, fontFamily: FontFamily.manropeSemiBold, fontSize: 15, color: theme.textPrimary, textAlign: 'right' },

    sectionLabel: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 11, letterSpacing: 1.6, color: theme.textMuted },
    bodyText: { fontFamily: FontFamily.manropeMedium, fontSize: 16, lineHeight: 24, color: theme.textPrimary },
    emptyText: { fontFamily: FontFamily.manropeMedium, fontSize: 15, color: theme.textMuted },

    photo: { width: '100%', height: 240, borderRadius: Radius.sm, backgroundColor: theme.surface2 },

    resolutionCard: {
      backgroundColor: '#ECFDF3', borderRadius: Radius.card, padding: 18, borderWidth: 1, borderColor: '#A6F4C5', gap: 8,
    },

    timelineItem: { flexDirection: 'row', gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border },
    timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.cyanOnLight, marginTop: 6, flexShrink: 0 },
    timelineDotLast: { backgroundColor: '#12B76A' },
    timelineBody: { fontFamily: FontFamily.manropeMedium, fontSize: 15, lineHeight: 22, color: theme.textPrimary },
    timelineMeta: { fontFamily: FontFamily.manropeMedium, fontSize: 13, color: theme.textMuted, marginTop: 4 },
  }), [theme]);
}
