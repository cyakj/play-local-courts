import { useEffect, useState } from 'react';
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

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Shadow, Spacing,
} from '@/constants/design';
import { Header } from '@/components/ui/Header';

// ─── Category label map ───────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  plumbing:            'Water & Plumbing',
  electrical:          'Lighting & Electrical',
  structural:          'Buildings & Structures',
  grounds_landscaping: 'Grounds & Landscaping',
  equipment:           'Amenities & Equipment',
  safety:              'Safety',
  other:               'Other',
};

function getCategoryLabel(cat: string) {
  return CATEGORY_LABELS[cat] ?? cat.charAt(0).toUpperCase() + cat.slice(1);
}

// ─── Status helpers ───────────────────────────────────────────────────────────

function getStatusStyle(status: string): { bg: string; color: string; label: string } {
  switch (status) {
    case 'open':
    case 'accepted':
      return { bg: '#FFF5F5', color: '#F97066', label: 'Open' };
    case 'in_progress':
      return { bg: '#FEF3C7', color: '#D97706', label: 'In Progress' };
    case 'resolved':
    case 'completed':
      return { bg: '#ECFDF5', color: '#059669', label: 'Resolved' };
    case 'closed':
      return { bg: '#F3F4F6', color: '#6B7280', label: 'Closed' };
    case 'reopened':
      return { bg: '#FEF2F2', color: '#DC2626', label: 'Reopened' };
    default:
      return { bg: '#F3F4F6', color: '#6B7280', label: status };
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportDetail {
  id: string;
  category: string;
  description: string;
  status: string;
  priority: string | null;
  photo_url: string | null;
  resolution_notes: string | null;
  admin_notes: string | null;
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
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [notes, setNotes] = useState<ReportNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    load();
  }, [id]);

  async function load() {
    try {
      const { data, error: err } = await supabase
        .from('maintenance_reports')
        .select('id, category, description, status, priority, photo_url, resolution_notes, admin_notes, location_text, report_type, is_urgent, created_at, updated_at, amenity_id')
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
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', authorIds);
        const profileMap: Record<string, string> = {};
        (profiles ?? []).forEach((p: any) => { profileMap[p.id] = p.full_name ?? 'Staff'; });
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

  const getTitle = (r: ReportDetail) => {
    if (r.report_type === 'location' && r.location_text) {
      return r.location_text.length > 40
        ? r.location_text.slice(0, 40) + '…'
        : r.location_text;
    }
    return r.amenity_name ?? getCategoryLabel(r.category);
  };

  return (
    <View style={styles.screen} testID="report-detail-screen">
      <Header
        variant="inner"
        title="Report Detail"
        onBack={() => router.back()}
      />

      {loading ? (
        <View style={styles.loadingBox} testID="detail-loading">
          <ActivityIndicator color={Colors.accentCyan} size="large" />
        </View>
      ) : error ? (
        <View style={styles.errorBox} testID="detail-error">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : report ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

            {/* Title + status row */}
            <View style={styles.titleRow} testID="detail-title-row">
              <Text style={styles.title} testID="detail-title">{getTitle(report)}</Text>
              {report.is_urgent && (
                <View style={styles.urgentPill}>
                  <Text style={styles.urgentText}>URGENT</Text>
                </View>
              )}
            </View>
            <View style={styles.pillRow}>
              <View style={[styles.statusPill, { backgroundColor: getStatusStyle(report.status).bg }]}>
                <Text style={[styles.statusText, { color: getStatusStyle(report.status).color }]}
                  testID="detail-status">
                  {getStatusStyle(report.status).label}
                </Text>
              </View>
              <View style={styles.catPill}>
                <Text style={styles.catPillText} testID="detail-category">
                  {getCategoryLabel(report.category)}
                </Text>
              </View>
              {report.priority && (
                <View style={styles.priorityPill}>
                  <Text style={styles.priorityText} testID="detail-priority">
                    {report.priority.charAt(0).toUpperCase() + report.priority.slice(1)}
                  </Text>
                </View>
              )}
            </View>

            {/* Photo */}
            {report.photo_url ? (
              <View style={styles.photoCard} testID="detail-photo-container">
                <Text style={styles.fieldLabel}>PHOTO</Text>
                <Image
                  source={{ uri: report.photo_url }}
                  style={styles.photo}
                  resizeMode="cover"
                  testID="detail-photo"
                />
              </View>
            ) : null}

            {/* Description */}
            <View style={styles.card} testID="detail-description-card">
              <Text style={styles.fieldLabel}>DESCRIPTION</Text>
              <Text style={styles.bodyText} testID="detail-description">{report.description}</Text>
            </View>

            {/* Meta grid */}
            <View style={styles.metaGrid}>
              <View style={[styles.metaItem, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>SUBMITTED</Text>
                <Text style={styles.metaValue} testID="detail-submitted-date">
                  {fmtDate(report.created_at)}
                </Text>
              </View>
              <View style={[styles.metaItem, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>LAST UPDATED</Text>
                <Text style={styles.metaValue}>{fmtDate(report.updated_at)}</Text>
              </View>
            </View>

            {report.location_text && report.report_type === 'location' && (
              <View style={styles.metaItem}>
                <Text style={styles.fieldLabel}>LOCATION</Text>
                <Text style={styles.metaValue}>{report.location_text}</Text>
              </View>
            )}

            {/* Resolution notes */}
            {report.resolution_notes ? (
              <View style={styles.resolutionCard} testID="detail-resolution-notes">
                <Text style={styles.fieldLabel}>RESOLUTION NOTES</Text>
                <Text style={styles.bodyText}>{report.resolution_notes}</Text>
              </View>
            ) : null}

            {/* Admin notes */}
            {report.admin_notes ? (
              <View style={styles.adminCard} testID="detail-admin-notes">
                <Text style={styles.fieldLabel}>ADMIN UPDATE</Text>
                <Text style={styles.bodyText}>{report.admin_notes}</Text>
              </View>
            ) : null}

            {/* Status timeline from report_notes */}
            {notes.length > 0 && (
              <View style={styles.timelineCard} testID="detail-timeline">
                <Text style={styles.fieldLabel}>ACTIVITY</Text>
                {notes.map((note, idx) => (
                  <View key={note.id} style={styles.timelineItem}
                    testID="detail-timeline-item">
                    <View style={[styles.timelineDot, idx === notes.length - 1 && styles.timelineDotLast]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.timelineBody}>{note.body}</Text>
                      <Text style={styles.timelineMeta}>
                        {note.author_name} · {fmtDate(note.created_at)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.body,
    color: Colors.textMuted,
    textAlign: 'center',
  },

  content: { padding: Spacing.pagePx, paddingBottom: 60, gap: 12 },

  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  title: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: 20,
    color: Colors.navy,
    flex: 1,
    lineHeight: 26,
  },
  urgentPill: {
    backgroundColor: '#FEF2F2',
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  urgentText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 10,
    color: '#DC2626',
    letterSpacing: 0.5,
  },

  pillRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 12 },
  statusPill: { borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontFamily: FontFamily.interSemiBold, fontSize: 12 },
  catPill: {
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  catPillText: { fontFamily: FontFamily.interSemiBold, fontSize: 12, color: '#4B5563' },
  priorityPill: {
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  priorityText: { fontFamily: FontFamily.interSemiBold, fontSize: 12, color: '#1D4ED8' },

  photoCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow,
  },
  photo: {
    width: '100%',
    height: 220,
    borderRadius: 10,
    marginTop: 8,
    backgroundColor: '#F3F4F6',
  },

  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow,
  },
  fieldLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: 6,
  },
  bodyText: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: Colors.navy,
    lineHeight: 22,
  },

  metaGrid: { flexDirection: 'row', gap: 12 },
  metaItem: {
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow,
  },
  metaValue: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 13,
    color: Colors.navy,
  },

  resolutionCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: Radius.card,
    padding: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },

  adminCard: {
    backgroundColor: '#E0F9FF',
    borderRadius: Radius.card,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.25)',
  },

  timelineCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accentCyan,
    marginTop: 5,
    flexShrink: 0,
  },
  timelineDotLast: { backgroundColor: '#10B981' },
  timelineBody: {
    fontFamily: FontFamily.interRegular,
    fontSize: 13,
    color: Colors.navy,
    lineHeight: 18,
  },
  timelineMeta: {
    fontFamily: FontFamily.interRegular,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 3,
  },
});
