import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CalendarCheck, Check, UserCheck, X } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errors';
import { sendNotificationEmail } from '@/lib/emailNotifications';
import { communityToday } from '@/lib/communityTime';
import { formatDateFull, formatTime12h } from '@/lib/format';
import { A } from '@/constants/adminTheme';
import { FontFamily } from '@/constants/design';
import {
  AdminHeader, AdminScreen, Button, Card, Chip, ChipRow, EmptyBlock, ErrorBlock, LoadingBlock, Pill, timeAgo,
} from '@/components/admin/kit';
import type { Database } from '@/lib/types';

type JoinRequest = Database['public']['Tables']['community_join_requests']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

interface MemberRequest extends JoinRequest { profile: Profile | null; communityName: string }
interface ReservationRequest {
  id: string; userId: string; residentName: string; courtName: string; communityName: string;
  date: string; startTime: string; endTime: string; playType: string | null; createdAt: string | null;
}

type Segment = 'members' | 'reservations';

export default function ApprovalsScreen() {
  const { tab } = useLocalSearchParams<{ tab?: Segment }>();
  const [segment, setSegment] = useState<Segment>(tab === 'reservations' ? 'reservations' : 'members');
  const [members, setMembers] = useState<MemberRequest[]>([]);
  const [reservations, setReservations] = useState<ReservationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data: hoas, error: hErr } = await supabase.from('hoas').select('id, name');
      if (hErr) throw hErr;
      const hoaName = new Map((hoas ?? []).map((h) => [h.id, h.name]));

      const { data: raw, error: jErr } = await supabase
        .from('community_join_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false });
      if (jErr) throw jErr;
      const userIds = (raw ?? []).map((r) => r.user_id);
      const { data: profiles, error: pErr } = userIds.length
        ? await supabase.from('profiles').select('*').in('id', userIds)
        : { data: [] as Profile[], error: null };
      if (pErr) throw pErr;
      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      setMembers((raw ?? []).map((r) => ({ ...r, profile: profileMap.get(r.user_id) ?? null, communityName: hoaName.get(r.hoa_id) ?? '' })));

      const { data: courts, error: cErr } = await supabase.from('courts').select('id, name, hoa_id');
      if (cErr) throw cErr;
      const courtById = new Map((courts ?? []).map((c) => [c.id, c]));
      const courtIds = (courts ?? []).map((c) => c.id);
      const { data: bookings, error: bErr } = courtIds.length
        ? await supabase.from('bookings')
            .select('id, user_id, court_id, date, start_time, end_time, play_type, created_at')
            .in('court_id', courtIds).eq('status', 'pending').gte('date', communityToday())
            .order('date').order('start_time')
        : { data: [], error: null };
      if (bErr) throw bErr;
      const residentIds = [...new Set((bookings ?? []).map((b) => b.user_id))];
      const { data: residents, error: rErr } = residentIds.length
        ? await supabase.from('profiles').select('id, full_name').in('id', residentIds)
        : { data: [], error: null };
      if (rErr) throw rErr;
      const residentName = new Map((residents ?? []).map((p) => [p.id, p.full_name as string | null]));
      setReservations((bookings ?? []).map((b) => {
        const court = courtById.get(b.court_id);
        return {
          id: b.id, userId: b.user_id, residentName: residentName.get(b.user_id)?.trim() || 'Resident',
          courtName: court?.name ?? 'Amenity', communityName: court ? hoaName.get(court.hoa_id) ?? '' : '',
          date: b.date, startTime: b.start_time, endTime: b.end_time, playType: b.play_type, createdAt: b.created_at,
        };
      }));
    } catch (e) {
      setError(errorMessage(e, 'Could not load requests.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('admin_approvals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_join_requests' }, () => { load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  async function updateMember(req: MemberRequest, action: 'approved' | 'rejected') {
    if (busyId) return;
    setBusyId(req.id);
    setActionError(null);

    const { data: membership } = await supabase
      .from('hoa_memberships').select('id').eq('user_id', req.user_id).eq('hoa_id', req.hoa_id).eq('status', 'pending').maybeSingle();

    let finalError: string | null = null;
    if (membership) {
      // The RPCs are SECURITY DEFINER and update both tables; fall back to direct updates if the caller lacks them.
      const fnName = action === 'approved' ? 'approve_hoa_membership' : 'reject_hoa_membership';
      const { error: rpcError } = await supabase.rpc(fnName, { membership_id: membership.id });
      if (rpcError) {
        const now = new Date().toISOString();
        const [memRes, jrRes] = await Promise.all([
          supabase.from('hoa_memberships').update({ status: action, updated_at: now }).eq('id', membership.id),
          supabase.from('community_join_requests').update({ status: action, updated_at: now }).eq('id', req.id),
        ]);
        if (memRes.error || jrRes.error) finalError = memRes.error?.message ?? jrRes.error?.message ?? 'Unknown error';
      }
    } else {
      const { error: jrErr } = await supabase
        .from('community_join_requests').update({ status: action, updated_at: new Date().toISOString() }).eq('id', req.id);
      if (jrErr) finalError = jrErr.message;
    }

    setBusyId(null);
    if (finalError) { setActionError(finalError); return; }
    sendNotificationEmail({ type: action === 'approved' ? 'hoa_approved' : 'hoa_rejected', userId: req.user_id });
    load();
  }

  async function reviewReservation(r: ReservationRequest, decision: 'confirmed' | 'rejected') {
    if (busyId) return;
    setBusyId(r.id);
    setActionError(null);
    const patch = decision === 'rejected'
      ? { status: decision, cancellation_reason: declineReason.trim() || null }
      : { status: decision };
    const { data, error: err } = await supabase.from('bookings').update(patch).eq('id', r.id).eq('status', 'pending').select('id');
    setBusyId(null);
    if (err) {
      let message = err.message;
      if (err.code === '23P01') message = 'Another confirmed reservation already holds this time, so this request cannot be approved.';
      else if (err.code === '23514' && /bookings_status_check/.test(err.message)) message = 'Declining requests needs the latest database update (migration 20261012190000).';
      setActionError(message);
      return;
    }
    if (!data?.length) { setActionError('This request is no longer pending.'); load(); return; }
    setDecliningId(null);
    setDeclineReason('');
    load(); // the resident's in-app notification is created by the database trigger
  }

  const empty = segment === 'members' ? members.length === 0 : reservations.length === 0;

  return (
    <AdminScreen
      testID="admin-approvals"
      header={<AdminHeader title="Approvals" onBack={() => router.back()} showBell={false} />}
      refreshing={false}
      onRefresh={load}>
      <ChipRow>
        <Chip testID="seg-members" label="Members" count={members.length} selected={segment === 'members'} onPress={() => setSegment('members')} />
        <Chip testID="seg-reservations" label="Reservations" count={reservations.length} selected={segment === 'reservations'} onPress={() => setSegment('reservations')} />
      </ChipRow>

      {error ? <ErrorBlock message={error} onRetry={load} /> : null}
      {actionError ? (
        <Card style={{ backgroundColor: A.errorBg, borderColor: '#F6C3C9' }}>
          <Text style={[s.body, { color: A.errorText }]} accessibilityLiveRegion="polite">{actionError}</Text>
        </Card>
      ) : null}

      {loading ? <LoadingBlock /> : empty && !error ? (
        <Card>
          <EmptyBlock
            Icon={segment === 'members' ? UserCheck : CalendarCheck}
            title="All clear"
            body={segment === 'members' ? 'No pending member requests right now.' : 'No reservation requests are waiting for approval.'}
          />
        </Card>
      ) : null}

      {segment === 'members' && members.map((req) => {
        const busy = busyId === req.id;
        const phone = (req.profile as { phone_number?: string | null } | null)?.phone_number;
        return (
          <Card key={req.id} testID={`member-request-${req.id}`} style={{ gap: 8 }}>
            <View style={s.top}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{req.profile?.full_name ?? 'Unknown user'}</Text>
                <Text style={s.meta}>{req.communityName} · applied {timeAgo(req.created_at)}</Text>
              </View>
              <Pill tone="warning" label="PENDING" />
            </View>
            {req.profile?.unit_number ? <Text style={s.body}>Unit {req.profile.unit_number}</Text> : null}
            {phone ? <Text style={s.body}>{phone}</Text> : null}
            {req.message ? <Text style={[s.body, { fontStyle: 'italic' }]} numberOfLines={3}>“{req.message}”</Text> : null}
            <View style={s.actions}>
              <View style={{ flex: 1 }}><Button label="Decline" variant="secondary" Icon={X} disabled={busy} onPress={() => updateMember(req, 'rejected')} /></View>
              <View style={{ flex: 1 }}><Button label="Approve" Icon={Check} loading={busy} onPress={() => updateMember(req, 'approved')} /></View>
            </View>
          </Card>
        );
      })}

      {segment === 'reservations' && reservations.map((r) => {
        const busy = busyId === r.id;
        const declining = decliningId === r.id;
        return (
          <Card key={r.id} testID={`reservation-request-${r.id}`} style={{ gap: 8 }}>
            <View style={s.top}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{r.courtName}</Text>
                <Text style={s.meta}>{r.communityName}</Text>
              </View>
              <Pill tone="warning" label="PENDING" />
            </View>
            <Text style={s.body}>{r.residentName}</Text>
            <Text style={s.body}>{formatDateFull(r.date)} · {formatTime12h(r.startTime)}–{formatTime12h(r.endTime)}</Text>
            {declining ? (
              <>
                <TextInput
                  value={declineReason} onChangeText={setDeclineReason} multiline placeholder="Reason for declining (optional, shown to the resident)"
                  placeholderTextColor={A.textMuted} style={s.input} accessibilityLabel="Decline reason" />
                <View style={s.actions}>
                  <View style={{ flex: 1 }}><Button label="Back" variant="secondary" disabled={busy} onPress={() => { setDecliningId(null); setDeclineReason(''); }} /></View>
                  <View style={{ flex: 1 }}><Button label="Decline request" variant="danger" loading={busy} onPress={() => reviewReservation(r, 'rejected')} /></View>
                </View>
              </>
            ) : (
              <View style={s.actions}>
                <View style={{ flex: 1 }}><Button testID={`decline-${r.id}`} label="Decline" variant="secondary" Icon={X} disabled={busy} onPress={() => { setDecliningId(r.id); setDeclineReason(''); }} /></View>
                <View style={{ flex: 1 }}><Button testID={`approve-${r.id}`} label="Approve" Icon={Check} loading={busy} onPress={() => reviewReservation(r, 'confirmed')} /></View>
              </View>
            )}
          </Card>
        );
      })}
    </AdminScreen>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontFamily: FontFamily.manropeBold, fontSize: 17, color: A.text },
  meta: { fontFamily: FontFamily.manropeMedium, fontSize: 13, color: A.textMuted },
  body: { fontFamily: FontFamily.manropeMedium, fontSize: 15, color: A.text },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  input: {
    borderRadius: 12, borderWidth: 1, borderColor: A.borderStrong, backgroundColor: A.surface, minHeight: 72,
    padding: 12, fontFamily: FontFamily.manropeMedium, fontSize: 16, color: A.text, textAlignVertical: 'top',
  },
});
