import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, CheckCheck, MessageSquare, Plus, Search, Send, X } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errors';
import { A } from '@/constants/adminTheme';
import { FontFamily } from '@/constants/design';
import {
  AdminHeader, Card, EmptyBlock, ErrorBlock, LoadingBlock, Pill,
} from '@/components/admin/kit';

// Community messaging (V1): resident <-> HOA administrator direct conversations, backed by public.messages.
// Authorisation lives in Postgres (RLS + can_send_message + guard_message_update); this component only
// decides what to show. Realtime: incoming rows and read receipts arrive via postgres_changes.

type Role = 'admin' | 'resident';

interface Msg {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

interface Conversation {
  partnerId: string;
  partnerName: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
}

interface Contact {
  user_id: string;
  full_name: string;
  hoa_id: string;
  hoa_name: string;
  contact_is_admin: boolean;
}

const MAX_LENGTH = 2000;

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length >= 2) return (p[0][0] + p[p.length - 1][0]).toUpperCase();
  return (name.trim().slice(0, 2) || '?').toUpperCase();
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (dayKey(iso) === dayKey(new Date().toISOString())) return 'Today';
  if (diff <= 1) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function listTime(iso: string): string {
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (dayKey(iso) === dayKey(new Date().toISOString())) return timeLabel(iso);
  if (diff <= 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** Contacts the caller may start a conversation with (admins for residents, members for admins). */
async function fetchContacts(uid: string, role: Role): Promise<Contact[]> {
  const rpc = await supabase.rpc('my_message_contacts' as never);
  if (!rpc.error) return ((rpc.data ?? []) as unknown) as Contact[];

  // my_message_contacts() ships in migration 20261013120000. Until it is applied, fall back to what RLS
  // already allows so the screen still works (admin: members of their communities; resident: HOA owner).
  const { data: hoas } = await supabase.from('hoas').select('id, name, admin_id');
  const rows = hoas ?? [];
  if (rows.length === 0) return [];
  if (role === 'resident') {
    const adminIds = [...new Set(rows.map((h) => h.admin_id).filter((x): x is string => !!x && x !== uid))];
    const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', adminIds.length ? adminIds : ['__none__']);
    const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? '']));
    return rows
      .filter((h) => h.admin_id && h.admin_id !== uid)
      .map((h) => ({
        user_id: h.admin_id as string,
        full_name: names.get(h.admin_id as string) || 'Community administrator',
        hoa_id: h.id, hoa_name: h.name, contact_is_admin: true,
      }));
  }
  const { data: members } = await supabase
    .from('hoa_memberships').select('user_id, hoa_id')
    .in('hoa_id', rows.map((h) => h.id)).eq('status', 'approved').neq('user_id', uid);
  const ids = [...new Set((members ?? []).map((m) => m.user_id))];
  const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', ids.length ? ids : ['__none__']);
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? '']));
  const hoaName = new Map(rows.map((h) => [h.id, h.name]));
  return (members ?? []).map((m) => ({
    user_id: m.user_id, full_name: names.get(m.user_id) || 'Resident',
    hoa_id: m.hoa_id, hoa_name: hoaName.get(m.hoa_id) ?? '', contact_is_admin: false,
  }));
}

export default function CommunityMessages({ role, tabScreen = false }: { role: Role; tabScreen?: boolean }) {
  const insets = useSafeAreaInsets();
  const { partner: partnerParam } = useLocalSearchParams<{ partner?: string }>();

  const [userId, setUserId] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [active, setActive] = useState<{ partnerId: string; partnerName: string } | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const [thread, setThread] = useState<Msg[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const flatRef = useRef<FlatList<Msg>>(null);
  const didDeepLink = useRef(false);

  const hoaByPartner = useMemo(() => {
    const m = new Map<string, string>();
    contacts.forEach((c) => { if (!m.has(c.user_id)) m.set(c.user_id, c.hoa_name); });
    return m;
  }, [contacts]);

  const loadConversations = useCallback(async (uid: string) => {
    const { data: msgs, error } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, content, created_at, read_at')
      .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
      .order('created_at', { ascending: false });
    if (error) { setLoadError(errorMessage(error, 'Could not load your messages.')); setLoading(false); return; }
    setLoadError(null);

    const rows = (msgs ?? []) as Msg[];
    const partnerIds = [...new Set(rows.map((m) => (m.sender_id === uid ? m.receiver_id : m.sender_id)))];
    const { data: profiles } = await supabase.from('profiles').select('id, full_name')
      .in('id', partnerIds.length ? partnerIds : ['__none__']);
    const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? '']));

    const map = new Map<string, Conversation>();
    rows.forEach((m) => {
      const pid = m.sender_id === uid ? m.receiver_id : m.sender_id;
      if (!map.has(pid)) {
        map.set(pid, { partnerId: pid, partnerName: names.get(pid) || 'Community member', lastMessage: m.content, lastAt: m.created_at, unread: 0 });
      }
      if (m.receiver_id === uid && !m.read_at) map.get(pid)!.unread += 1;
    });
    setConversations([...map.values()].sort((a, b) => +new Date(b.lastAt) - +new Date(a.lastAt)));
    setLoading(false);
  }, []);

  const markRead = useCallback(async (uid: string, partnerId: string) => {
    await supabase.from('messages').update({ read_at: new Date().toISOString() })
      .eq('sender_id', partnerId).eq('receiver_id', uid).is('read_at', null);
  }, []);

  const openThread = useCallback(async (uid: string, partnerId: string, partnerName: string) => {
    setActive({ partnerId, partnerName });
    setThread([]);
    setThreadError(null);
    setSendError(null);
    setThreadLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, content, created_at, read_at')
      .or(`and(sender_id.eq.${uid},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${uid})`)
      .order('created_at', { ascending: true });
    if (error) setThreadError(errorMessage(error, 'Could not load this conversation.'));
    else setThread((data ?? []) as Msg[]);
    setThreadLoading(false);
    await markRead(uid, partnerId);
    loadConversations(uid);
  }, [loadConversations, markRead]);

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user || cancelled) { setLoading(false); return; }
      setUserId(user.id);
      await loadConversations(user.id);
      const list = await fetchContacts(user.id, role).catch(() => [] as Contact[]);
      if (!cancelled) setContacts(list);
    });
    return () => { cancelled = true; };
  }, [loadConversations, role]);

  // Deep link: /messages?partner=<uid> (from a notification).
  useEffect(() => {
    if (didDeepLink.current || !userId || !partnerParam) return;
    didDeepLink.current = true;
    const known = conversations.find((c) => c.partnerId === partnerParam);
    const contact = contacts.find((c) => c.user_id === partnerParam);
    openThread(userId, partnerParam, known?.partnerName ?? contact?.full_name ?? 'Community member');
  }, [userId, partnerParam, conversations, contacts, openThread]);

  // Realtime: incoming messages and read receipts for the signed-in user.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`community-messages-${userId}-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` },
        (payload) => {
          const m = payload.new as Msg;
          if (activeRef.current?.partnerId === m.sender_id) {
            setThread((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
            markRead(userId, m.sender_id);
            setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 50);
          }
          loadConversations(userId);
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `sender_id=eq.${userId}` },
        (payload) => {
          const m = payload.new as Msg;
          setThread((prev) => prev.map((x) => (x.id === m.id ? { ...x, read_at: m.read_at } : x)));
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, loadConversations, markRead]);

  async function send() {
    const body = draft.trim();
    if (!body || !active || !userId || sending) return;
    setSending(true);
    setSendError(null);
    const { data, error } = await supabase
      .from('messages')
      .insert({ sender_id: userId, receiver_id: active.partnerId, content: body })
      .select('id, sender_id, receiver_id, content, created_at, read_at')
      .single();
    setSending(false);
    if (error || !data) {
      setSendError(
        error?.code === '42501'
          ? 'You can only message the administrators of your community.'
          : errorMessage(error, 'Your message was not sent. Please try again.'),
      );
      return;
    }
    setThread((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data as Msg]));
    setDraft('');
    loadConversations(userId);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 50);
  }

  function back() {
    if (active) { setActive(null); setThread([]); if (userId) loadConversations(userId); return; }
    if (picking) { setPicking(false); return; }
    router.back();
  }

  const totalUnread = conversations.reduce((n, c) => n + c.unread, 0);
  const filtered = conversations.filter((c) => c.partnerName.toLowerCase().includes(search.trim().toLowerCase()));
  const pickable = contacts.filter((c) => c.full_name.toLowerCase().includes(search.trim().toLowerCase()));

  // ───────────── Thread view ─────────────
  if (active) {
    const lastOwnIdx = thread.map((m) => m.sender_id === userId).lastIndexOf(true);
    return (
      <View style={s.screen} testID="messages-thread">
        <AdminHeader title={active.partnerName} subtitle={hoaByPartner.get(active.partnerId)} showBell={false} onBack={back} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {threadLoading ? <View style={s.pad}><LoadingBlock rows={3} /></View>
            : threadError ? <View style={s.pad}><ErrorBlock message={threadError} onRetry={() => openThread(userId, active.partnerId, active.partnerName)} /></View>
            : (
              <FlatList
                ref={flatRef}
                data={thread}
                keyExtractor={(m) => m.id}
                contentContainerStyle={s.threadContent}
                onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
                ListEmptyComponent={<EmptyBlock Icon={MessageSquare} title="Start the conversation" body="Your message goes only to this person." />}
                renderItem={({ item, index }) => {
                  const mine = item.sender_id === userId;
                  const showDay = index === 0 || dayKey(thread[index - 1].created_at) !== dayKey(item.created_at);
                  return (
                    <View>
                      {showDay ? <Text style={s.day}>{dayLabel(item.created_at)}</Text> : null}
                      <View style={[s.row, mine ? s.rowMine : s.rowTheirs]}>
                        <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleTheirs]}>
                          <Text style={[s.bubbleText, mine && { color: A.onPrimary }]}>{item.content}</Text>
                        </View>
                      </View>
                      <View style={[s.metaRow, mine ? s.rowMine : s.rowTheirs]}>
                        <Text style={s.time}>{timeLabel(item.created_at)}</Text>
                        {mine && index === lastOwnIdx ? (
                          item.read_at
                            ? <><CheckCheck size={14} color={A.success} /><Text style={[s.time, { color: A.success }]}>Read</Text></>
                            : <><Check size={14} color={A.textSecondary} /><Text style={s.time}>Sent</Text></>
                        ) : null}
                      </View>
                    </View>
                  );
                }}
              />
            )}
          {sendError ? <Text style={s.sendError} accessibilityRole="alert">{sendError}</Text> : null}
          <View style={[s.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <TextInput
              testID="message-input"
              value={draft}
              onChangeText={setDraft}
              placeholder="Write a message"
              placeholderTextColor={A.textMuted}
              multiline
              maxLength={MAX_LENGTH}
              accessibilityLabel="Message"
              style={s.input}
            />
            <Pressable
              testID="message-send"
              onPress={send}
              disabled={!draft.trim() || sending}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              accessibilityState={{ disabled: !draft.trim() || sending, busy: sending }}
              style={[s.sendBtn, (!draft.trim() || sending) && { backgroundColor: A.disabledBg }]}>
              <Send size={20} color={draft.trim() && !sending ? A.onPrimary : A.textMuted} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ───────────── Contact picker ─────────────
  if (picking) {
    return (
      <View style={s.screen} testID="messages-picker">
        <AdminHeader title="New message" showBell={false} onBack={back} />
        <View style={s.pad}>
          <View style={s.searchBox}>
            <Search size={18} color={A.textSecondary} />
            <TextInput value={search} onChangeText={setSearch} placeholder={role === 'admin' ? 'Search residents' : 'Search administrators'}
              placeholderTextColor={A.textMuted} style={s.searchInput} accessibilityLabel="Search contacts" />
            {search ? <Pressable onPress={() => setSearch('')} accessibilityLabel="Clear search" hitSlop={8}><X size={18} color={A.textSecondary} /></Pressable> : null}
          </View>
        </View>
        <FlatList
          data={pickable}
          keyExtractor={(c) => `${c.user_id}-${c.hoa_id}`}
          contentContainerStyle={s.listContent}
          ListEmptyComponent={<Card><EmptyBlock Icon={MessageSquare} title="No one to message yet"
            body={role === 'admin' ? 'Approved members of your communities appear here.' : 'Your community administrators appear here once your membership is approved.'} /></Card>}
          renderItem={({ item }) => (
            <Card onPress={() => { setPicking(false); setSearch(''); openThread(userId, item.user_id, item.full_name); }}
              accessibilityLabel={`Message ${item.full_name}`} style={s.contact}>
              <View style={s.avatar}><Text style={s.avatarText}>{initials(item.full_name)}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.name} numberOfLines={1}>{item.full_name}</Text>
                <Text style={s.sub} numberOfLines={1}>{item.hoa_name}{item.contact_is_admin ? ' · Administrator' : ''}</Text>
              </View>
            </Card>
          )}
        />
      </View>
    );
  }

  // ───────────── Conversation list ─────────────
  return (
    <View style={s.screen} testID="messages-list">
      <AdminHeader
        title="Messages"
        subtitle={totalUnread ? `${totalUnread} unread` : undefined}
        showBell={false}
        onBack={tabScreen ? undefined : back}
        right={
          <Pressable testID="new-message" onPress={() => setPicking(true)} accessibilityRole="button" accessibilityLabel="New message" hitSlop={8} style={s.newBtn}>
            <Plus size={22} color="#FFFFFF" />
          </Pressable>
        }
      />
      {loadError ? <View style={s.pad}><ErrorBlock message={loadError} onRetry={() => { setLoading(true); loadConversations(userId); }} /></View> : null}
      {conversations.length > 4 ? (
        <View style={s.pad}>
          <View style={s.searchBox}>
            <Search size={18} color={A.textSecondary} />
            <TextInput value={search} onChangeText={setSearch} placeholder="Search conversations" placeholderTextColor={A.textMuted}
              style={s.searchInput} accessibilityLabel="Search conversations" />
          </View>
        </View>
      ) : null}
      {loading ? <View style={s.pad}><LoadingBlock rows={3} /></View> : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.partnerId}
          contentContainerStyle={s.listContent}
          ListEmptyComponent={loadError ? null : (
            <Card><EmptyBlock Icon={MessageSquare} title="No conversations yet"
              body={role === 'admin' ? 'Message a resident to get started.' : 'Message your community administrators with questions or requests.'} /></Card>
          )}
          renderItem={({ item }) => (
            <Card testID={`conversation-${item.partnerId}`} onPress={() => openThread(userId, item.partnerId, item.partnerName)}
              accessibilityLabel={`${item.partnerName}${item.unread ? `, ${item.unread} unread` : ''}`} style={s.contact}>
              <View style={s.avatar}><Text style={s.avatarText}>{initials(item.partnerName)}</Text></View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={s.rowBetween}>
                  <Text style={[s.name, item.unread > 0 && { fontFamily: FontFamily.manropeBold }]} numberOfLines={1}>{item.partnerName}</Text>
                  <Text style={s.sub}>{listTime(item.lastAt)}</Text>
                </View>
                {hoaByPartner.get(item.partnerId) ? <Text style={s.sub} numberOfLines={1}>{hoaByPartner.get(item.partnerId)}</Text> : null}
                <View style={s.rowBetween}>
                  <Text style={[s.preview, item.unread > 0 && { color: A.text, fontFamily: FontFamily.manropeSemiBold }]} numberOfLines={1}>{item.lastMessage}</Text>
                  {item.unread > 0 ? <Pill label={String(item.unread)} tone="info" /> : null}
                </View>
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.background },
  pad: { paddingHorizontal: 16, paddingTop: 12 },
  listContent: { padding: 16, gap: 10, paddingBottom: 112 },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: A.infoBg, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 16, color: A.link },
  name: { flexShrink: 1, fontFamily: FontFamily.manropeSemiBold, fontSize: 16, color: A.text },
  sub: { fontFamily: FontFamily.manropeMedium, fontSize: 13, color: A.textSecondary },
  preview: { flex: 1, fontFamily: FontFamily.manropeMedium, fontSize: 14, color: A.textSecondary },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  newBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, borderRadius: 12, borderWidth: 1,
    borderColor: A.borderStrong, backgroundColor: A.surface, paddingHorizontal: 12,
  },
  searchInput: { flex: 1, fontFamily: FontFamily.manropeMedium, fontSize: 16, color: A.text, paddingVertical: 10 },
  threadContent: { padding: 16, gap: 4, flexGrow: 1 },
  day: { alignSelf: 'center', marginVertical: 10, fontFamily: FontFamily.manropeSemiBold, fontSize: 12, color: A.textSecondary },
  row: { flexDirection: 'row', marginTop: 6 },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: A.primary, borderBottomRightRadius: 6 },
  bubbleTheirs: { backgroundColor: A.surface, borderWidth: 1, borderColor: A.border, borderBottomLeftRadius: 6 },
  bubbleText: { fontFamily: FontFamily.manropeMedium, fontSize: 16, lineHeight: 22, color: A.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  time: { fontFamily: FontFamily.manropeMedium, fontSize: 12, color: A.textSecondary },
  sendError: { marginHorizontal: 16, marginBottom: 6, fontFamily: FontFamily.manropeSemiBold, fontSize: 14, color: A.error },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: A.border, backgroundColor: A.surface,
  },
  input: {
    flex: 1, minHeight: 48, maxHeight: 120, borderRadius: 24, borderWidth: 1, borderColor: A.borderStrong,
    backgroundColor: A.background, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
    fontFamily: FontFamily.manropeMedium, fontSize: 16, color: A.text,
  },
  sendBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: A.primary, alignItems: 'center', justifyContent: 'center' },
});
