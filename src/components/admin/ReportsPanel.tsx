import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle2, ChevronRight, Flame, MapPin, X } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { db } from '@/lib/untypedDb';
import { platformAlert } from '@/lib/platformAlert';
import { A } from '@/constants/adminTheme';
import { FontFamily } from '@/constants/design';
import {
  Button, Card, Chip, ChipRow, EmptyBlock, ErrorBlock, LoadingBlock, Pill, StatusBadge, timeAgo,
} from '@/components/admin/kit';

export const CATEGORY_LABELS: Record<string, string> = {
  plumbing: 'Water & Plumbing',
  electrical: 'Lighting & Electrical',
  structural: 'Buildings & Structures',
  grounds_landscaping: 'Grounds & Landscaping',
  equipment: 'Amenities & Equipment',
  safety: 'Safety',
  other: 'Other',
};
export const categoryLabel = (c: string) =>
  CATEGORY_LABELS[c] ?? c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, ' ');

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];
const PRIORITY_FILTERS = [
  { value: 'all', label: 'Any priority' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export interface AdminReport {
  id: string;
  hoaId: string;
  community: string;
  amenityName: string | null;
  title: string;
  status: string;
  priority: string;
  category: string;
  description: string;
  reporterName: string;
  createdAt: string;
  locationText: string | null;
  isUrgent: boolean;
  photoUrl: string | null;
}

/** Loads reports for every community the signed-in admin can see, or for one community. */
export function useAdminReports(hoaId?: string) {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [communities, setCommunities] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      let hq = supabase.from('hoas').select('id, name').order('name');
      if (hoaId) hq = hq.eq('id', hoaId);
      const { data: hoas, error: hErr } = await hq;
      if (hErr) throw hErr;
      setCommunities(hoas ?? []);
      if (!hoas?.length) { setReports([]); return; }
      const nameById = new Map(hoas.map((h) => [h.id, h.name]));

      const { data, error: rErr } = await supabase
        .from('maintenance_reports')
        .select('id, hoa_id, amenity_id, status, priority, category, description, reporter_id, created_at, report_type, location_text, is_urgent, photo_url')
        .in('hoa_id', hoas.map((h) => h.id))
        .order('created_at', { ascending: false });
      if (rErr) throw rErr;
      const rows = data ?? [];

      const reporterIds = [...new Set(rows.map((r) => r.reporter_id).filter(Boolean))] as string[];
      const amenityIds = [...new Set(rows.map((r) => r.amenity_id).filter(Boolean))] as string[];
      const [people, courts] = await Promise.all([
        reporterIds.length ? supabase.from('profiles').select('id, full_name').in('id', reporterIds) : { data: [], error: null },
        amenityIds.length ? supabase.from('courts').select('id, name').in('id', amenityIds) : { data: [], error: null },
      ]);
      if (people.error) throw people.error;
      if (courts.error) throw courts.error;
      const personName = new Map((people.data ?? []).map((p) => [p.id, p.full_name as string | null]));
      const courtName = new Map((courts.data ?? []).map((c) => [c.id, c.name as string]));

      setReports(rows.map((r) => {
        const amenityName = r.amenity_id ? courtName.get(r.amenity_id) ?? null : null;
        const loc = r.location_text as string | null;
        return {
          id: r.id,
          hoaId: r.hoa_id,
          community: nameById.get(r.hoa_id) ?? '',
          amenityName,
          title: r.report_type === 'location' && loc ? loc : amenityName ?? categoryLabel(r.category),
          status: r.status,
          priority: r.priority ?? 'medium',
          category: r.category,
          description: r.description,
          reporterName: personName.get(r.reporter_id) ?? 'Resident',
          createdAt: r.created_at,
          locationText: loc,
          isUrgent: r.is_urgent ?? false,
          photoUrl: r.photo_url ?? null,
        };
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load reports.');
    } finally {
      setLoading(false);
    }
  }, [hoaId]);

  useEffect(() => { reload(); }, [reload]);
  return { reports, communities, loading, error, reload };
}

const PRIORITY_TONE = { high: 'error', medium: 'warning', low: 'success' } as const;

export function ReportCard({ report, showCommunity, onPress }: { report: AdminReport; showCommunity?: boolean; onPress: () => void }) {
  return (
    <Card onPress={onPress} testID={`report-${report.id}`} accessibilityLabel={`Open report ${report.title}`} style={{ gap: 8 }}>
      <View style={s.rowTop}>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>{report.title}</Text>
          <Text style={s.meta} numberOfLines={1}>
            {categoryLabel(report.category)}{showCommunity ? ` · ${report.community}` : ''}
          </Text>
        </View>
        <StatusBadge status={report.status} />
      </View>
      <Text style={s.desc} numberOfLines={2}>{report.description}</Text>
      <View style={s.rowBottom}>
        <Text style={s.meta} numberOfLines={1}>{report.reporterName} · {timeAgo(report.createdAt)}</Text>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          {report.isUrgent ? <Pill tone="error" label="URGENT" Icon={Flame} /> : null}
          <Pill tone={PRIORITY_TONE[report.priority as keyof typeof PRIORITY_TONE] ?? 'neutral'} label={report.priority.toUpperCase()} />
          <ChevronRight size={18} color={A.textMuted} />
        </View>
      </View>
    </Card>
  );
}

/** Filter bar + list + detail sheet. Filters (community / status / category / priority) combine. */
export function ReportsPanel({
  reports, communities, loading, error, reload, showCommunityFilter, initialStatus = 'all', openReportId,
}: {
  reports: AdminReport[]; communities: { id: string; name: string }[]; loading: boolean; error: string | null;
  reload: () => Promise<void> | void; showCommunityFilter?: boolean; initialStatus?: string; openReportId?: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [category, setCategory] = useState('all');
  const [priority, setPriority] = useState('all');
  const [community, setCommunity] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(openReportId ?? null);

  useEffect(() => { if (openReportId) setSelectedId(openReportId); }, [openReportId]);

  const filtered = useMemo(() => reports.filter((r) =>
    (status === 'all' || r.status === status)
    && (category === 'all' || r.category === category)
    && (priority === 'all' || r.priority === priority)
    && (community === 'all' || r.hoaId === community)), [reports, status, category, priority, community]);

  const base = useMemo(() => reports.filter((r) => community === 'all' || r.hoaId === community), [reports, community]);
  const countFor = (v: string) => (v === 'all' ? base.length : base.filter((r) => r.status === v).length);
  const selected = reports.find((r) => r.id === selectedId) ?? null;
  const usedCategories = useMemo(() => [...new Set(reports.map((r) => r.category))], [reports]);

  return (
    <>
      {showCommunityFilter && communities.length > 1 ? (
        <ChipRow>
          <Chip label="All communities" selected={community === 'all'} onPress={() => setCommunity('all')} />
          {communities.map((c) => (
            <Chip key={c.id} label={c.name} selected={community === c.id} onPress={() => setCommunity(c.id)} />
          ))}
        </ChipRow>
      ) : null}
      <ChipRow>
        {STATUS_FILTERS.map((f) => (
          <Chip key={f.value} testID={`status-${f.value}`} label={f.label} count={countFor(f.value)}
            selected={status === f.value} onPress={() => setStatus(f.value)} />
        ))}
      </ChipRow>
      <ChipRow>
        <Chip label="All categories" selected={category === 'all'} onPress={() => setCategory('all')} />
        {usedCategories.map((c) => (
          <Chip key={c} label={categoryLabel(c)} selected={category === c} onPress={() => setCategory(c)} />
        ))}
      </ChipRow>
      <ChipRow>
        {PRIORITY_FILTERS.map((f) => (
          <Chip key={f.value} label={f.label} selected={priority === f.value} onPress={() => setPriority(f.value)} />
        ))}
      </ChipRow>

      {error ? <ErrorBlock message={error} onRetry={() => reload()} /> : null}
      {loading ? <LoadingBlock /> : filtered.length === 0 && !error ? (
        <Card><EmptyBlock Icon={CheckCircle2} title="No reports found" body="Nothing matches these filters." /></Card>
      ) : filtered.map((r) => (
        <ReportCard key={r.id} report={r} showCommunity={showCommunityFilter} onPress={() => setSelectedId(r.id)} />
      ))}

      <ReportDetailSheet
        report={selected}
        onClose={() => setSelectedId(null)}
        onSaved={async () => { await reload(); }}
      />
    </>
  );
}

interface HistoryRow { id: string; from_status: string | null; to_status: string; created_at: string }
interface NoteRow { id: string; body: string; is_internal: boolean; created_at: string }

function isMissingTable(e: { code?: string } | null) {
  return !!e && (e.code === '42P01' || e.code === 'PGRST205');
}

export function ReportDetailSheet({
  report, onClose, onSaved,
}: { report: AdminReport | null; onClose: () => void; onSaved: () => Promise<void> | void }) {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState('');
  const [message, setMessage] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [privateDataIssue, setPrivateDataIssue] = useState<string | null>(null);

  const reportId = report?.id;
  useEffect(() => {
    if (!report) return;
    setStatus(report.status);
    setMessage('');
    setInternalNote('');
    setNotes([]);
    setHistory([]);
    setPrivateDataIssue(null);
    let cancelled = false;
    (async () => {
      const [n, h] = await Promise.all([
        db.from('report_notes').select('id, body, is_internal, created_at')
          .eq('report_id', report.id).order('created_at', { ascending: false }),
        db.from('maintenance_report_status_history').select('id, from_status, to_status, created_at')
          .eq('report_id', report.id).order('created_at', { ascending: false }),
      ]);
      if (cancelled) return;
      if (n.error) {
        setPrivateDataIssue(`Could not load notes: ${n.error.message}`);
      } else {
        setNotes((n.data ?? []) as NoteRow[]);
      }
      if (isMissingTable(h.error)) {
        setPrivateDataIssue((prev) => prev ?? 'Status history needs the latest database update (migration 20261013100000) before it can show.');
      } else if (h.error) {
        setPrivateDataIssue((prev) => prev ?? `Could not load status history: ${h.error.message}`);
      } else {
        setHistory((h.data ?? []) as HistoryRow[]);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  if (!report) return null;

  const statusChanged = status !== report.status;
  const messageChanged = message.trim().length > 0;
  const dirty = statusChanged || messageChanged || internalNote.trim().length > 0;

  function requestClose() {
    if (saving) return;
    if (!dirty) { onClose(); return; }
    platformAlert('Discard changes?', 'You have unsaved edits to this report.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onClose },
    ]);
  }

  async function save() {
    if (!report || saving || !dirty) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You are signed out.');

      if (statusChanged) {
        const { data, error } = await supabase.from('maintenance_reports').update({ status }).eq('id', report.id).select('id');
        if (error) throw error;
        if (!data?.length) throw new Error('You do not have permission to update this report.');
      }
      // Notes after the status change, so a combined action produces a single resident notification.
      const noteRows = [
        ...(message.trim() ? [{ report_id: report.id, author_id: user.id, body: message.trim(), is_internal: false }] : []),
        ...(internalNote.trim() ? [{ report_id: report.id, author_id: user.id, body: internalNote.trim(), is_internal: true }] : []),
      ];
      if (noteRows.length) {
        const { error } = await db.from('report_notes').insert(noteRows);
        if (error) {
          // Any status change above already succeeded — say so rather than implying a full failure.
          await onSaved();
          throw new Error(`${statusChanged ? 'Status was updated, but the' : 'The'} note was not saved: ${error.message}`);
        }
      }
      await onSaved();
      onClose();
    } catch (e) {
      platformAlert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={requestClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: A.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.sheetHeader}>
          <Text style={s.sheetTitle} accessibilityRole="header">Report details</Text>
          <Pressable onPress={requestClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close"
            style={s.closeBtn}>
            <X size={22} color={A.text} />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled">
          <Card style={{ gap: 8 }}>
            <Text style={s.detailTitle}>{report.title}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <StatusBadge status={report.status} />
              <Pill tone={PRIORITY_TONE[report.priority as keyof typeof PRIORITY_TONE] ?? 'neutral'} label={`${report.priority.toUpperCase()} PRIORITY`} />
              {report.isUrgent ? <Pill tone="error" label="URGENT" Icon={Flame} /> : null}
            </View>
            <Fact label="Category" value={categoryLabel(report.category)} />
            <Fact label="Community" value={report.community} />
            <Fact label="Reported by" value={report.reporterName} />
            <Fact label="Created" value={new Date(report.createdAt).toLocaleString()} />
            {report.locationText ? <Fact label="Location" value={report.locationText} Icon={MapPin} /> : null}
            <Text style={s.label}>Description</Text>
            <Text style={s.body}>{report.description}</Text>
            {report.photoUrl ? (
              <Image source={{ uri: report.photoUrl }} style={s.photo} resizeMode="cover" accessibilityLabel="Report photo" />
            ) : null}
          </Card>

          <Card style={{ gap: 10 }}>
            <Text style={s.sectionTitle}>Status</Text>
            <View style={s.statusGrid}>
              {STATUSES.map((st) => {
                const on = status === st;
                return (
                  <Pressable
                    key={st}
                    testID={`set-status-${st}`}
                    onPress={() => setStatus(st)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    style={[s.statusOpt, on && s.statusOptOn]}>
                    <Text style={[s.statusOptText, on && { color: '#FFFFFF' }]}>
                      {st === 'in_progress' ? 'In Progress' : st.charAt(0).toUpperCase() + st.slice(1)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={s.label}>Update for resident (visible to {report.reporterName})</Text>
            <TextInput
              testID="resident-message"
              value={message}
              onChangeText={setMessage}
              multiline
              placeholder="Optional. Sent to the resident and shown on their report page."
              placeholderTextColor={A.textMuted}
              style={[s.input, { minHeight: 84 }]}
              accessibilityLabel="Update visible to resident"
            />
            {statusChanged ? (
              <Text style={s.hint}>Saving will notify {report.reporterName} that this report is now {status.replace('_', ' ')}.</Text>
            ) : null}
          </Card>

          <Card style={{ gap: 10 }}>
            <Text style={s.sectionTitle}>Notes</Text>
            <Text style={s.hint}>Internal notes below are admin-only. Resident updates (above) are sent to the reporter.</Text>
            {privateDataIssue ? <Text style={s.hint}>{privateDataIssue}</Text> : null}
            <TextInput
              testID="internal-note"
              value={internalNote}
              onChangeText={setInternalNote}
              multiline
              placeholder="Add a private note for other administrators"
              placeholderTextColor={A.textMuted}
              style={[s.input, { minHeight: 72 }]}
              accessibilityLabel="Internal note"
            />
            {notes.map((n) => (
              <View key={n.id} style={s.noteRow}>
                <Pill tone={n.is_internal ? 'neutral' : 'info'} label={n.is_internal ? 'INTERNAL' : 'SENT TO RESIDENT'} />
                <Text style={s.body}>{n.body}</Text>
                <Text style={s.meta}>{timeAgo(n.created_at)}</Text>
              </View>
            ))}
          </Card>

          {history.length > 0 ? (
            <Card style={{ gap: 8 }}>
              <Text style={s.sectionTitle}>Status history</Text>
              {history.map((h) => (
                <View key={h.id} style={s.noteRow}>
                  <Text style={s.body}>
                    {(h.from_status ?? 'new').replace('_', ' ')} → {h.to_status.replace('_', ' ')}
                  </Text>
                  <Text style={s.meta}>{new Date(h.created_at).toLocaleString()}</Text>
                </View>
              ))}
            </Card>
          ) : null}
        </ScrollView>

        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={{ flex: 1 }}><Button label="Cancel" variant="secondary" onPress={requestClose} disabled={saving} /></View>
          <View style={{ flex: 1 }}><Button testID="save-report" label="Save changes" onPress={save} loading={saving} disabled={!dirty} /></View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Fact({ label, value, Icon }: { label: string; value: string; Icon?: typeof MapPin }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Text style={[s.meta, { width: 92 }]}>{label}</Text>
      <View style={{ flex: 1, flexDirection: 'row', gap: 4, alignItems: 'center' }}>
        {Icon ? <Icon size={14} color={A.textMuted} /> : null}
        <Text style={[s.body, { flex: 1 }]}>{value}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontFamily: FontFamily.manropeBold, fontSize: 16, color: A.text },
  meta: { fontFamily: FontFamily.manropeMedium, fontSize: 13, color: A.textMuted },
  desc: { fontFamily: FontFamily.manropeMedium, fontSize: 14, color: A.textSecondary },
  body: { fontFamily: FontFamily.manropeMedium, fontSize: 15, color: A.text },
  label: { fontFamily: FontFamily.manropeSemiBold, fontSize: 13, color: A.textSecondary, marginTop: 6 },
  hint: { fontFamily: FontFamily.manropeMedium, fontSize: 13, color: A.infoText },
  sectionTitle: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 18, color: A.text },
  detailTitle: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 22, color: A.text, letterSpacing: -0.3 },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16,
    paddingVertical: 14, backgroundColor: A.surface, borderBottomWidth: 1, borderBottomColor: A.border,
  },
  sheetTitle: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 20, color: A.text },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  photo: { width: '100%', height: 200, borderRadius: 12, marginTop: 8, backgroundColor: A.surfaceAlt },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusOpt: {
    flexGrow: 1, flexBasis: '45%', minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: A.borderStrong,
    backgroundColor: A.surface, alignItems: 'center', justifyContent: 'center',
  },
  statusOptOn: { backgroundColor: A.primary, borderColor: A.primary },
  statusOptText: { fontFamily: FontFamily.manropeBold, fontSize: 15, color: A.text },
  input: {
    borderRadius: 12, borderWidth: 1, borderColor: A.borderStrong, backgroundColor: A.surface, padding: 12,
    fontFamily: FontFamily.manropeMedium, fontSize: 16, color: A.text, textAlignVertical: 'top',
  },
  noteRow: { borderTopWidth: 1, borderTopColor: A.border, paddingTop: 8, gap: 2 },
  footer: {
    flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 12, backgroundColor: A.surface,
    borderTopWidth: 1, borderTopColor: A.border,
  },
});
