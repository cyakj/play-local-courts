import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Megaphone, Trash2 } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { db } from '@/lib/untypedDb';
import { errorMessage } from '@/lib/errors';
import { platformAlert } from '@/lib/platformAlert';
import { fetchAnnouncements, type AnnouncementRow } from '@/lib/announcements';
import {
  ANNOUNCEMENT_CATEGORIES, BODY_MAX, TITLE_MAX, buildInsert, postErrorMessage, removeErrorMessage, validateDraft,
  type AnnouncementCategory,
} from '@/lib/announcementCompose';
import { A } from '@/constants/adminTheme';
import { FontFamily } from '@/constants/design';
import {
  AdminHeader, AdminScreen, Button, Card, Chip, ChipRow, EmptyBlock, ErrorBlock, LoadingBlock, Pill, SectionTitle, Toggle, timeAgo,
} from '@/components/admin/kit';

interface AdminHoa { id: string; name: string }

/**
 * Community Pulse authoring: post an announcement (optionally urgent / categorised) to the residents of a community the signed-in
 * user ADMINISTERS, and take a posted one down. Visibility, cross-community isolation and who may post/remove are enforced by the
 * database (hoa_announcements RLS, archive_announcement); this screen only offers communities the user administers.
 */
export default function AnnouncementsAdminScreen() {
  const params = useLocalSearchParams<{ hoaId?: string }>();
  const [userId, setUserId] = useState<string | null>(null);
  const [hoas, setHoas] = useState<AdminHoa[]>([]);
  const [hoaId, setHoaId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<AnnouncementRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const listGen = useRef(0); // only the newest list request may update the screen

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [category, setCategory] = useState<AnnouncementCategory>('general');
  const [posting, setPosting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setError('You are signed out.'); return; }
        setUserId(user.id);
        const { data, error: err } = await supabase
          .from('hoa_memberships').select('hoa_id, hoas(name)')
          .eq('user_id', user.id).eq('role', 'admin').eq('status', 'approved');
        if (err) throw err;
        const list: AdminHoa[] = (data ?? []).map((m) => ({
          id: m.hoa_id as string, name: ((m as { hoas?: { name?: string } | null }).hoas?.name) || 'Community',
        })).sort((a, b) => a.name.localeCompare(b.name));
        setHoas(list);
        setHoaId(list.find((h) => h.id === params.hoaId)?.id ?? list[0]?.id ?? '');
      } catch (e) {
        setError(errorMessage(e, 'Could not load your communities.'));
      } finally {
        setLoading(false);
      }
    })();
  }, [params.hoaId]);

  const loadList = useCallback(async () => {
    const gen = ++listGen.current;
    setRows([]); // never show (or act on) another community's rows while this one loads
    if (!hoaId) return;
    setListLoading(true);
    const res = await fetchAnnouncements(hoaId, 20);
    if (gen !== listGen.current) return; // the community changed (or a newer load started) while this request was in flight
    setListLoading(false);
    if (res.error) { setError(res.error.message); return; }
    setError(null);
    setRows(res.rows);
  }, [hoaId]);

  useEffect(() => { void loadList(); }, [loadList]);

  async function post() {
    if (posting || !userId || !hoaId) return;
    const postedTo = hoaId;
    setNotice(null);
    const draft = { title, body, urgent, category };
    const problem = validateDraft(draft);
    if (problem) { setFormError(problem); return; }
    setFormError(null);
    setPosting(true);
    const { error: err } = await db.from('hoa_announcements').insert(buildInsert(draft, hoaId, userId));
    setPosting(false);
    if (err) { setFormError(postErrorMessage(err, draft)); return; }
    setTitle(''); setBody(''); setUrgent(false); setCategory('general');
    setNotice('Posted. Residents will see it in Community Pulse.');
    if (postedTo === hoaId) void loadList();
  }

  function confirmRemove(row: AnnouncementRow) {
    platformAlert('Remove this announcement?', `"${row.title}" will disappear for residents. This cannot be undone from the app.`, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => { void remove(row); } },
    ]);
  }

  async function remove(row: AnnouncementRow) {
    if (removingId) return;
    if (!rows.some((r) => r.id === row.id)) return; // only a row of the community currently displayed can be removed
    setRemovingId(row.id);
    setNotice(null);
    const { data, error: err } = await db.rpc('archive_announcement', { p_id: row.id });
    setRemovingId(null);
    if (err) { setFormError(removeErrorMessage(err)); return; }
    if (data === false) { setFormError('That announcement was already removed.'); }
    else { setFormError(null); setNotice('Removed.'); }
    void loadList();
  }

  return (
    <AdminScreen
      testID="admin-announcements"
      header={<AdminHeader title="Announcements" onBack={() => router.back()} showBell={false} />}
      refreshing={false}
      onRefresh={loadList}>
      {loading ? <LoadingBlock /> : null}
      {error ? <ErrorBlock message={error} onRetry={loadList} /> : null}

      {!loading && hoas.length === 0 && !error ? (
        <Card><EmptyBlock Icon={Megaphone} title="No community to post to" body="Only community administrators can post announcements." /></Card>
      ) : null}

      {hoas.length > 1 ? (
        <ChipRow>
          {hoas.map((h) => <Chip key={h.id} testID={`announce-hoa-${h.id}`} label={h.name} selected={hoaId === h.id} onPress={() => { setFormError(null); setNotice(null); setHoaId(h.id); }} />)}
        </ChipRow>
      ) : null}

      {hoas.length > 0 ? (
        <Card style={{ gap: 12 }}>
          <Text style={s.label}>Title</Text>
          <TextInput testID="announce-title" value={title} onChangeText={setTitle} maxLength={TITLE_MAX} placeholder="Pool closed Thursday for resurfacing"
            placeholderTextColor={A.textMuted} style={s.input} accessibilityLabel="Title" />
          <Text style={s.label}>Message</Text>
          <TextInput testID="announce-body" value={body} onChangeText={setBody} maxLength={BODY_MAX} multiline placeholder="What residents need to know"
            placeholderTextColor={A.textMuted} style={[s.input, { minHeight: 110, textAlignVertical: 'top' }]} accessibilityLabel="Message" />
          <Text style={s.label}>Category</Text>
          <ChipRow>
            {ANNOUNCEMENT_CATEGORIES.map((c) => (
              <Chip key={c.value} testID={`announce-cat-${c.value}`} label={c.label} selected={category === c.value} onPress={() => setCategory(c.value)} />
            ))}
          </ChipRow>
          <Toggle testID="announce-urgent" label="Mark as urgent" hint="Urgent notices are shown first, with a coral marker." value={urgent} onChange={setUrgent} />
          {formError ? <Text style={[s.body, { color: A.errorText }]} accessibilityLiveRegion="polite">{formError}</Text> : null}
          {notice ? <Text style={[s.body, { color: A.successText }]} accessibilityLiveRegion="polite">{notice}</Text> : null}
          <Button testID="announce-post" label="Post announcement" loading={posting} onPress={post} />
        </Card>
      ) : null}

      {hoas.length > 0 ? <SectionTitle>Posted announcements</SectionTitle> : null}
      {hoas.length > 0 && listLoading && rows.length === 0 ? <LoadingBlock rows={2} /> : null}
      {hoas.length > 0 && !listLoading && rows.length === 0 && !error ? (
        <Card><EmptyBlock Icon={Megaphone} title="Nothing posted yet" body="Announcements you post appear here and in residents' Community Pulse." /></Card>
      ) : null}
      {rows.map((r) => (
        <Card key={r.id} testID={`announcement-${r.id}`} style={{ gap: 8 }}>
          <View style={s.top}>
            <Text style={[s.name, { flex: 1 }]}>{r.title}</Text>
            {r.isUrgent ? <Pill tone="error" label="URGENT" /> : null}
            {r.category !== 'general' ? <Pill tone="neutral" label={r.category.toUpperCase()} /> : null}
          </View>
          <Text style={s.body} numberOfLines={4}>{r.body}</Text>
          <View style={s.top}>
            <Text style={[s.meta, { flex: 1 }]}>{r.created_at ? timeAgo(r.created_at) : ''}</Text>
            <View style={{ minWidth: 130 }}>
              <Button testID={`remove-${r.id}`} label="Remove" variant="secondary" Icon={Trash2} loading={removingId === r.id} onPress={() => confirmRemove(r)} />
            </View>
          </View>
        </Card>
      ))}
    </AdminScreen>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontFamily: FontFamily.manropeSemiBold, fontSize: 14, color: A.text },
  name: { fontFamily: FontFamily.manropeBold, fontSize: 17, color: A.text },
  meta: { fontFamily: FontFamily.manropeMedium, fontSize: 13, color: A.textMuted },
  body: { fontFamily: FontFamily.manropeMedium, fontSize: 15, color: A.text },
  input: {
    borderRadius: 12, borderWidth: 1, borderColor: A.borderStrong, backgroundColor: A.surface, minHeight: 48,
    paddingHorizontal: 12, paddingVertical: 10, fontFamily: FontFamily.manropeMedium, fontSize: 16, color: A.text,
  },
});
