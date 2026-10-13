import { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CheckCircle2, FileText, HelpCircle, XCircle } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errors';
import { platformAlert } from '@/lib/platformAlert';
import { roleText, type HoaApplicationRow } from '@/lib/platformApplications';
import { A } from '@/constants/adminTheme';
import { FontFamily } from '@/constants/design';
import {
  AdminHeader, AdminScreen, Button, Card, EmptyBlock, ErrorBlock, LoadingBlock, SectionTitle, StatusBadge, timeAgo,
} from '@/components/admin/kit';

interface NoteRow {
  id: string;
  note: string;
  status_change: string | null;
  created_at: string;
}

const NOTE_LABEL: Record<string, string> = {
  approved: 'Approved',
  rejected: 'Rejected',
  needs_more_info: 'Information requested',
  pending: 'Returned to pending',
};

export default function ApplicationReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [app, setApp] = useState<HoaApplicationRow | null>(null);
  const [applicantName, setApplicantName] = useState<string>('');
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [docs, setDocs] = useState<{ path: string; url: string | null }[]>([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data, error: err } = await supabase.from('hoa_applications').select('*').eq('id', id).maybeSingle();
      if (err) throw err;
      if (!data) throw new Error('This application could not be found.');
      const row = data as HoaApplicationRow;
      setApp(row);

      const [profile, noteRes] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', row.applicant_id).maybeSingle(),
        supabase.from('hoa_application_notes').select('id, note, status_change, created_at')
          .eq('application_id', row.id).order('created_at', { ascending: true }),
      ]);
      setApplicantName(profile.data?.full_name?.trim() || 'Applicant');
      setNotes((noteRes.data ?? []) as NoteRow[]);

      // Verification documents live in a private bucket: short-lived signed URLs only.
      const paths = row.verification_documents ?? [];
      const signed = await Promise.all(paths.map(async (path) => {
        const { data: s } = await supabase.storage.from('hoa-verification-documents').createSignedUrl(path, 600);
        return { path, url: s?.signedUrl ?? null };
      }));
      setDocs(signed);
    } catch (e) {
      setError(errorMessage(e, 'Could not load this application.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const trimmed = note.trim();
  const canDecide = app?.status === 'pending';
  const canReject = app?.status === 'pending' || app?.status === 'needs_more_info';

  function confirmAction(kind: 'approve' | 'info' | 'reject') {
    if (!app) return;
    if (kind !== 'approve' && !trimmed) {
      platformAlert('A note is required', kind === 'reject'
        ? 'Tell the applicant why the application was not approved.'
        : 'Tell the applicant what additional information you need.');
      return;
    }
    const title = kind === 'approve' ? `Approve "${app.hoa_name}"?`
      : kind === 'info' ? 'Request more information?' : `Reject "${app.hoa_name}"?`;
    const message = kind === 'approve'
      ? 'This activates the community and gives the applicant administrator access.'
      : 'The applicant is notified with your note.';
    platformAlert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: kind === 'approve' ? 'Approve' : kind === 'info' ? 'Send request' : 'Reject',
        style: kind === 'reject' ? 'destructive' : 'default',
        onPress: () => { void run(kind); },
      },
    ]);
  }

  async function run(kind: 'approve' | 'info' | 'reject') {
    if (!app) return;
    setBusy(kind);
    try {
      if (kind === 'approve') {
        const { error: err } = await supabase.rpc('approve_hoa_application', {
          application_id: app.id, reviewer_note: trimmed || undefined,
        });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.rpc('update_hoa_application_status', {
          application_id: app.id,
          new_status: kind === 'info' ? 'needs_more_info' : 'rejected',
          reviewer_note: trimmed,
        });
        if (err) throw err;
      }
      setNote('');
      await load();
    } catch (e) {
      platformAlert('Could not update the application', errorMessage(e, 'Please try again.'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminScreen
      testID="platform-application"
      header={<AdminHeader title="Review application" showBell={false} onBack={() => router.back()} />}>
      {error ? <ErrorBlock message={error} onRetry={load} /> : null}
      {loading ? <LoadingBlock rows={4} /> : app ? (
        <>
          <Card style={{ gap: 12 }}>
            <View style={s.top}>
              <Text style={s.title}>{app.hoa_name}</Text>
              <StatusBadge status={app.status} />
            </View>
            <Field label="Location" value={app.community_location} />
            <Field label="Estimated residents" value={String(app.estimated_residents)} />
            <Field label="Applicant" value={applicantName} />
            <Field label="Role claimed" value={roleText(app)} />
            <Field label="Submitted" value={timeAgo(app.submitted_at)} />
          </Card>

          <SectionTitle>Verification documents</SectionTitle>
          <Card>
            {docs.length === 0 ? (
              <EmptyBlock Icon={FileText} title="No documents attached"
                body="Ask the applicant for proof of authority (board resolution, management contract) before approving." />
            ) : docs.map((d) => (
              <View key={d.path} style={s.docRow}>
                <FileText size={18} color={A.textSecondary} />
                <Text style={s.docName} numberOfLines={1}>{d.path.split('/').pop()}</Text>
                <Button
                  label={d.url ? 'Open' : 'Unavailable'}
                  variant="secondary"
                  disabled={!d.url}
                  onPress={() => { if (d.url) Linking.openURL(d.url); }} />
              </View>
            ))}
          </Card>

          <SectionTitle>Review history</SectionTitle>
          {notes.length === 0 ? (
            <Card><EmptyBlock Icon={HelpCircle} title="No review activity yet" /></Card>
          ) : notes.map((n) => (
            <Card key={n.id} style={{ gap: 6 }}>
              <Text style={s.noteMeta}>
                {n.status_change ? NOTE_LABEL[n.status_change] ?? n.status_change : 'Note'} · {timeAgo(n.created_at)}
              </Text>
              <Text style={s.noteBody}>{n.note}</Text>
            </Card>
          ))}

          {canReject ? (
            <>
              <SectionTitle>Decision</SectionTitle>
              <Card style={{ gap: 12 }}>
                <Text style={s.label}>Note to the applicant{canDecide ? ' (required to reject or request information)' : ' (required)'}</Text>
                <TextInput
                  testID="review-note"
                  value={note}
                  onChangeText={setNote}
                  multiline
                  placeholder="Explain your decision"
                  placeholderTextColor={A.textMuted}
                  accessibilityLabel="Note to the applicant"
                  style={s.input}
                />
                {canDecide ? (
                  <Button testID="approve" label="Approve & activate community" Icon={CheckCircle2}
                    onPress={() => confirmAction('approve')} loading={busy === 'approve'} disabled={!!busy} />
                ) : null}
                {canDecide ? (
                  <Button testID="request-info" label="Request more information" variant="secondary" Icon={HelpCircle}
                    onPress={() => confirmAction('info')} loading={busy === 'info'} disabled={!!busy} />
                ) : null}
                <Button testID="reject" label="Reject application" variant="danger" Icon={XCircle}
                  onPress={() => confirmAction('reject')} loading={busy === 'reject'} disabled={!!busy} />
              </Card>
            </>
          ) : (
            <Card>
              <Text style={s.noteBody}>
                {app.status === 'approved'
                  ? 'This community is active. The applicant now administers it.'
                  : 'This application is closed. The applicant can resubmit it from their account.'}
              </Text>
            </Card>
          )}
        </>
      ) : null}
    </AdminScreen>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Text style={s.fieldValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, fontFamily: FontFamily.spaceGroteskBold, fontSize: 22, color: A.text, letterSpacing: -0.2 },
  field: { gap: 2 },
  fieldLabel: { fontFamily: FontFamily.manropeSemiBold, fontSize: 13, color: A.textSecondary },
  fieldValue: { fontFamily: FontFamily.manropeMedium, fontSize: 16, color: A.text },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  docName: { flex: 1, fontFamily: FontFamily.manropeMedium, fontSize: 15, color: A.text },
  noteMeta: { fontFamily: FontFamily.manropeSemiBold, fontSize: 13, color: A.textSecondary },
  noteBody: { fontFamily: FontFamily.manropeMedium, fontSize: 15, color: A.text, lineHeight: 22 },
  label: { fontFamily: FontFamily.manropeSemiBold, fontSize: 14, color: A.textSecondary },
  input: {
    minHeight: 96, borderRadius: 12, borderWidth: 1, borderColor: A.borderStrong, backgroundColor: A.surface,
    padding: 14, fontFamily: FontFamily.manropeMedium, fontSize: 16, color: A.text, textAlignVertical: 'top',
  },
});
