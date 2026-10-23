import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Building2 } from 'lucide-react-native';
import { A } from '@/constants/adminTheme';
import { FontFamily } from '@/constants/design';
import { supabase } from '@/lib/supabase';
import {
  fetchAllInterestRequests, fetchInterestNotes, updateCommunityInterest,
  type InterestNote, type InterestRequest,
} from '@/lib/communityInterest';
import { COMMUNITY_TYPES, INTEREST_STATUSES, classifyInterestError, interestStatusDisplay } from '@/lib/communityInterestLogic';
import {
  AdminHeader, AdminScreen, Button, Card, Chip, ChipRow, EmptyBlock, ErrorBlock, LoadingBlock, Pill,
} from '@/components/admin/kit';

interface ApplicationOption { id: string; hoa_name: string; status: string }

export default function CommunityInterestReview() {
  const [rows, setRows] = useState<InterestRequest[]>([]);
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshNotice, setRefreshNotice] = useState('');
  const hasRows = useRef(false);
  const seq = useRef(0);
  const load = useCallback(async (afterSave = false) => {
    const current = ++seq.current;
    setLoading(true);
    setError('');
    setRefreshNotice('');
    try {
      const data = await fetchAllInterestRequests();
      if (current === seq.current) { hasRows.current = data.length > 0; setRows(data); }
    } catch (e) {
      if (current === seq.current) {
        if (afterSave) setRefreshNotice('Saved, but the list could not be refreshed - pull to retry');
        else if (hasRows.current) setRefreshNotice('The list could not be refreshed - pull to retry');
        else setError(classifyInterestError(e));
      }
    }
    finally { if (current === seq.current) setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); return () => { ++seq.current; }; }, [load]));
  // Keep the open editor mounted even when a saved status leaves the selected filter.
  const visible = filter === 'all' ? rows : rows.filter((r) => r.status === filter || r.id === expanded);
  return <AdminScreen header={<AdminHeader title="Community interest" showBell={false} onBack={() => router.back()} />}
    refreshing={loading} onRefresh={() => { void load(); }}>
    <ChipRow>
      <Chip label="All" count={rows.length} selected={filter === 'all'} onPress={() => setFilter('all')} />
      {INTEREST_STATUSES.map((status) => <Chip key={status} label={interestStatusDisplay(status).label}
        count={rows.filter((r) => r.status === status).length} selected={filter === status} onPress={() => setFilter(status)} />)}
    </ChipRow>
    {!!refreshNotice && <Text accessibilityRole="alert" style={s.body}>{refreshNotice}</Text>}
    {error && rows.length === 0 ? <ErrorBlock message={error} onRetry={() => { void load(); }} /> : loading && rows.length === 0 ? <LoadingBlock /> : visible.length === 0 ?
      <EmptyBlock Icon={Building2} title="No community interest here" body="Resident community requests will appear here." /> : visible.map((row) => {
        const display = interestStatusDisplay(row.status);
        return <View key={row.id} style={s.group}>
          <Card onPress={() => setExpanded(expanded === row.id ? null : row.id)} accessibilityLabel={`Review ${row.community_name}`} style={s.group}>
            <Text style={s.title}>{row.community_name}</Text>
            <Text style={s.body}>{[row.city, row.region].filter(Boolean).join(', ')}</Text>
            <Text style={s.body}>{COMMUNITY_TYPES.find((t) => t.value === row.community_type)?.label ?? 'Other'} · {row.approx_units === null ? 'Units unknown' : `${row.approx_units} units`}</Text>
            <Text style={s.body}>Requested {new Date(row.created_at).toLocaleDateString()}</Text>
            <Pill label={display.label} tone={display.tone} />
          </Card>
          {expanded === row.id && <InterestEditor request={row} onSaved={() => load(true)} />}
        </View>;
      })}
  </AdminScreen>;
}

function InterestEditor({ request, onSaved }: { request: InterestRequest; onSaved: () => Promise<void> }) {
  const [status, setStatus] = useState(request.status);
  const [message, setMessage] = useState(request.status_message ?? '');
  const [note, setNote] = useState('');
  const [linked, setLinked] = useState<string | null>(request.linked_application_id);
  const [clearLink, setClearLink] = useState(false);
  const [notes, setNotes] = useState<InterestNote[]>([]);
  const [applications, setApplications] = useState<ApplicationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailError, setDetailError] = useState('');
  const [actionError, setActionError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const seq = useRef(0);
  const loadDetails = useCallback(async () => {
    const current = ++seq.current;
    setLoading(true);
    setDetailError('');
    try {
      const [history, apps] = await Promise.all([
        fetchInterestNotes(request.id),
        supabase.from('hoa_applications').select('id, hoa_name, status').order('hoa_name'),
      ]);
      if (apps.error) throw apps.error;
      if (current === seq.current) { setNotes(history); setApplications((apps.data ?? []) as ApplicationOption[]); }
    } catch (e) { if (current === seq.current) setDetailError(classifyInterestError(e)); }
    finally { if (current === seq.current) setLoading(false); }
  }, [request.id]);
  useEffect(() => { void loadDetails(); return () => { ++seq.current; }; }, [loadDetails]);
  useEffect(() => {
    setStatus(request.status);
    setMessage(request.status_message ?? '');
    setLinked(request.linked_application_id);
  }, [request.status, request.status_message, request.linked_application_id]);
  async function save() {
    if (saving.current || loading || detailError) return;
    if (message.trim().length > 500) { setActionError('Status message must be at most 500 characters.'); return; }
    saving.current = true;
    setBusy(true);
    setActionError('');
    setSaved(false);
    try {
      await updateCommunityInterest({ requestId: request.id, status, statusMessage: message, internalNote: note, linkedApplicationId: linked, clearLink });
      setNote('');
      setClearLink(false);
      setSaved(true);
      await loadDetails();
      await onSaved();
    } catch (e) { setActionError(classifyInterestError(e)); }
    finally { saving.current = false; setBusy(false); }
  }
  return <View style={s.editor}>
    <Text style={s.title}>Request details</Text>
    <Text style={s.body}>Contact: {request.contact_name || 'Not provided'}</Text>
    <Text style={s.body}>Email: {request.contact_email || 'Not provided'}</Text>
    <Text style={s.body}>Notes: {request.notes || 'Not provided'}</Text>
    <Text style={s.label}>Status</Text>
    <View pointerEvents={busy ? 'none' : 'auto'}><ChipRow>{INTEREST_STATUSES.map((value) =>
      <Chip key={value} label={interestStatusDisplay(value).label} selected={status === value} onPress={() => { setStatus(value); setSaved(false); }} />
    )}</ChipRow></View>
    <Text style={s.label}>Status message (visible to requester)</Text>
    <TextInput accessibilityLabel="Status message visible to requester" value={message} onChangeText={(value) => { setMessage(value); setSaved(false); }}
      editable={!busy} multiline maxLength={500} style={s.input} />
    <Text style={s.label}>Internal note (reviewers only)</Text>
    <TextInput accessibilityLabel="Internal note" value={note} onChangeText={(value) => { setNote(value); setSaved(false); }} editable={!busy} multiline style={s.input} />
    <Text style={s.label}>Link application</Text>
    {loading ? <LoadingBlock rows={1} /> : detailError ? <ErrorBlock message={detailError} onRetry={loadDetails} /> : <>
      <View pointerEvents={busy ? 'none' : 'auto'}><ChipRow>
        {linked && !applications.some((app) => app.id === linked) && <Chip label="Current linked application (unavailable)" selected onPress={() => undefined} />}
        {applications.map((app) => <Chip key={app.id} label={`${app.hoa_name} (${app.status})`} selected={linked === app.id}
          onPress={() => { setLinked(app.id); setClearLink(false); setSaved(false); }} />)}
      </ChipRow></View>
      {linked !== null && <Button label="Remove link" variant="ghost" disabled={busy}
        onPress={() => { setLinked(null); setClearLink(true); setSaved(false); }} />}
      {linked === null && <Text style={s.body}>{clearLink ? 'Link will be removed when you save.' : 'No linked application.'}</Text>}
      {applications.length === 0 && <Text style={s.body}>No visible applications to link.</Text>}
      <Text style={s.label}>Internal notes history</Text>
      {notes.length === 0 ? <Text style={s.body}>No internal notes yet.</Text> : notes.map((entry) => <View key={entry.id} style={s.group}>
        <Text style={s.body}>{entry.note}</Text><Text style={s.body}>{new Date(entry.created_at).toLocaleString()}</Text>
      </View>)}
    </>}
    {!!actionError && <ErrorBlock message={actionError} />}
    {saved && <Text style={s.body}>Changes saved.</Text>}
    <Button label={busy ? 'Saving…' : 'Save'} onPress={save} loading={busy} disabled={busy || loading || !!detailError} />
  </View>;
}

const s = StyleSheet.create({
  group: { gap: 12 }, editor: { gap: 16, padding: 20, backgroundColor: A.surface, borderRadius: 14, borderWidth: 1, borderColor: A.border },
  title: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 18, color: A.text },
  body: { fontFamily: FontFamily.manropeMedium, fontSize: 16, lineHeight: 24, color: A.textSecondary },
  label: { fontFamily: FontFamily.manropeSemiBold, fontSize: 16, color: A.text },
  input: { minHeight: 88, borderWidth: 1, borderColor: A.borderStrong, borderRadius: 10, padding: 12, fontFamily: FontFamily.manropeMedium, fontSize: 16, color: A.text, textAlignVertical: 'top' },
});
