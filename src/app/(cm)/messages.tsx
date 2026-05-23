import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Check, CheckCheck, Plus, Search, Send } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Shadow, Spacing,
} from '@/constants/design';
import { CardSkeleton } from '@/components/ui/Skeleton';

interface Conversation {
  partnerId: string;
  partnerName: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

interface ResidentProfile {
  id: string;
  full_name: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function CMMessagesScreen() {
  const insets = useSafeAreaInsets();
  const [userId, setUserId] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [residents, setResidents] = useState<ResidentProfile[]>([]);
  const [residentSearch, setResidentSearch] = useState('');
  const [loadingResidents, setLoadingResidents] = useState(false);
  const flatRef = useRef<FlatList>(null);

  async function load(uid: string) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, content, created_at, read_at')
      .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
      .order('created_at', { ascending: false });

    if (!msgs) { setLoading(false); return; }

    const partnerIds = [...new Set(msgs.map((m) =>
      m.sender_id === uid ? m.receiver_id : m.sender_id
    ))];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', partnerIds.length > 0 ? partnerIds : ['__none__']);

    const profileMap: Record<string, string> = {};
    (profiles ?? []).forEach((p) => { profileMap[p.id] = p.full_name ?? 'Unknown'; });

    const convoMap: Record<string, Conversation> = {};
    msgs.forEach((m) => {
      const partnerId = m.sender_id === uid ? m.receiver_id : m.sender_id;
      if (!convoMap[partnerId]) {
        convoMap[partnerId] = {
          partnerId,
          partnerName: profileMap[partnerId] ?? 'Unknown',
          lastMessage: m.content,
          lastAt: m.created_at,
          unread: 0,
        };
      }
      if (m.receiver_id === uid && !m.read_at) {
        convoMap[partnerId].unread += 1;
      }
    });

    const list = Object.values(convoMap);
    list.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
    setConversations(list);
    setLoading(false);
  }

  async function openConvo(convo: Conversation) {
    setActiveConvo(convo);
    setThreadLoading(true);
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${convo.partnerId}),and(sender_id.eq.${convo.partnerId},receiver_id.eq.${userId})`)
      .order('created_at', { ascending: true });
    setThread(data ?? []);
    setThreadLoading(false);
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('sender_id', convo.partnerId)
      .eq('receiver_id', userId)
      .is('read_at', null);
    load(userId);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 100);
  }

  async function sendMessage() {
    if (!draft.trim() || !activeConvo || !userId) return;
    setSending(true);
    const { data: newMsg } = await supabase
      .from('messages')
      .insert({ sender_id: userId, receiver_id: activeConvo.partnerId, content: draft.trim() })
      .select()
      .single();
    if (newMsg) setThread((prev) => [...prev, newMsg]);
    setDraft('');
    setSending(false);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
  }

  async function loadResidents() {
    setLoadingResidents(true);
    const { data: hoas } = await supabase.from('hoas').select('id');
    const hoaIds = (hoas ?? []).map((h: any) => h.id);
    if (hoaIds.length === 0) { setLoadingResidents(false); return; }

    const { data: members } = await supabase
      .from('hoa_members')
      .select('user_id')
      .in('hoa_id', hoaIds)
      .eq('status', 'approved')
      .neq('user_id', userId);

    const residentIds = [...new Set((members ?? []).map((m: any) => m.user_id))];
    if (residentIds.length === 0) { setResidents([]); setLoadingResidents(false); return; }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', residentIds);

    const sorted = ((profiles ?? []) as ResidentProfile[])
      .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
    setResidents(sorted);
    setLoadingResidents(false);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      load(user.id);
    });
  }, []);

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread, 0);
  const filtered = conversations.filter((c) =>
    c.partnerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── THREAD VIEW ──────────────────────────────────────────────────────────────
  if (activeConvo) {
    const firstUnreadIdx = thread.findIndex(
      (m) => m.sender_id === activeConvo.partnerId && !m.read_at
    );
    return (
      <View style={styles.screen}>
        <View style={[styles.threadHeader, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
          <TouchableOpacity
            onPress={() => { setActiveConvo(null); setThread([]); }}
            style={styles.frostedBack}>
            <ArrowLeft color={Colors.white} size={20} strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.threadAvatar}>
            <Text style={styles.threadAvatarText}>{getInitials(activeConvo.partnerName)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.threadName} numberOfLines={1}>{activeConvo.partnerName}</Text>
            <Text style={styles.threadSub}>Community member</Text>
          </View>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {threadLoading ? (
            <View style={{ padding: 20 }}><CardSkeleton /><CardSkeleton /></View>
          ) : (
            <FlatList
              ref={flatRef}
              data={thread}
              keyExtractor={(m) => m.id}
              contentContainerStyle={styles.threadContent}
              onLayout={() => flatRef.current?.scrollToEnd({ animated: false })}
              renderItem={({ item, index }) => {
                const isMe = item.sender_id === userId;
                const showNewDivider = index === firstUnreadIdx && firstUnreadIdx > 0;
                return (
                  <>
                    {showNewDivider && (
                      <View style={styles.newDivider}>
                        <View style={styles.newDividerLine} />
                        <Text style={styles.newDividerLabel}>NEW</Text>
                        <View style={styles.newDividerLine} />
                      </View>
                    )}
                    <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                      <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextThem]}>
                        {item.content}
                      </Text>
                      <View style={styles.bubbleFooter}>
                        <Text style={[styles.bubbleTime, isMe ? styles.bubbleTimeMe : styles.bubbleTimeThem]}>
                          {formatMessageTime(item.created_at)}
                        </Text>
                        {isMe && (
                          item.read_at
                            ? <CheckCheck color="rgba(255,255,255,0.5)" size={12} strokeWidth={2} />
                            : <Check color="rgba(255,255,255,0.5)" size={12} strokeWidth={2} />
                        )}
                      </View>
                    </View>
                  </>
                );
              }}
            />
          )}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Type a message…"
              placeholderTextColor={Colors.textPlaceholder}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendBtn, !draft.trim() && styles.sendBtnDisabled]}
              onPress={sendMessage}
              disabled={!draft.trim() || sending}>
              <Send color={Colors.white} size={18} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ── COMPOSE VIEW ─────────────────────────────────────────────────────────────
  if (showCompose) {
    const filteredResidents = residents.filter((r) =>
      r.full_name.toLowerCase().includes(residentSearch.toLowerCase())
    );
    return (
      <View style={styles.screen}>
        <View style={[styles.listHeader, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
          <TouchableOpacity
            onPress={() => { setShowCompose(false); setResidentSearch(''); }}
            style={styles.frostedBack}>
            <ArrowLeft color={Colors.white} size={20} strokeWidth={2} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.composeTitle}>New Message</Text>
            <Text style={styles.composeSub}>Select a resident</Text>
          </View>
        </View>

        <View style={styles.composeSearchBar}>
          <TextInput
            style={styles.composeSearchInput}
            value={residentSearch}
            onChangeText={setResidentSearch}
            placeholder="Search residents…"
            placeholderTextColor={Colors.textPlaceholder}
            autoFocus
          />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
          {loadingResidents ? (
            <View style={{ padding: 20 }}><CardSkeleton /><CardSkeleton /></View>
          ) : filteredResidents.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                {residentSearch ? 'No residents found' : 'No residents in your communities'}
              </Text>
            </View>
          ) : (
            filteredResidents.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={styles.residentRow}
                onPress={() => {
                  setShowCompose(false);
                  setResidentSearch('');
                  const existing = conversations.find((c) => c.partnerId === r.id);
                  if (existing) {
                    openConvo(existing);
                  } else {
                    setActiveConvo({
                      partnerId: r.id,
                      partnerName: r.full_name,
                      lastMessage: '',
                      lastAt: '',
                      unread: 0,
                    });
                    setThread([]);
                  }
                }}
                activeOpacity={0.7}>
                <View style={styles.convoAvatar}>
                  <Text style={styles.convoAvatarText}>{getInitials(r.full_name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.convoName}>{r.full_name}</Text>
                  <Text style={styles.convoSubLabel}>Resident</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
    );
  }

  // ── CONVERSATION LIST ─────────────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      <View style={[styles.listHeader, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <View style={styles.listHeaderTop}>
          <Text style={styles.inboxTag}>INBOX</Text>
          <View style={styles.listHeaderActions}>
            {totalUnread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{totalUnread} new</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.composeBtn}
              onPress={() => { setShowCompose(true); loadResidents(); }}
              activeOpacity={0.8}>
              <Plus color={Colors.accentCyan} size={16} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.headerTitle}>Messages</Text>

        {/* Search bar */}
        <View style={styles.searchBar}>
          <Search color="rgba(255,255,255,0.5)" size={15} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search conversations…"
            placeholderTextColor="rgba(255,255,255,0.4)"
          />
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 60, marginTop: 20 }}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>
          {loading ? (
            <View style={{ padding: 20 }}><CardSkeleton /><CardSkeleton /><CardSkeleton /></View>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No results' : 'No conversations yet'}
              </Text>
              <Text style={styles.emptySub}>
                {searchQuery ? 'Try a different name.' : 'Tap + to message a resident.'}
              </Text>
            </View>
          ) : (
            filtered.map((c) => (
              <TouchableOpacity
                key={c.partnerId}
                style={styles.convoRow}
                onPress={() => openConvo(c)}
                activeOpacity={0.7}>
                <View style={styles.convoAvatar}>
                  <Text style={styles.convoAvatarText}>{getInitials(c.partnerName)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.convoMeta}>
                    <Text style={styles.convoName}>{c.partnerName}</Text>
                    <Text style={styles.convoTime}>{formatMessageTime(c.lastAt)}</Text>
                  </View>
                  <Text style={styles.convoPreview} numberOfLines={1}>{c.lastMessage}</Text>
                </View>
                {c.unread > 0 && (
                  <View style={styles.unreadDot}>
                    <Text style={styles.unreadDotText}>{c.unread}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },

  listHeader: {
    backgroundColor: Colors.navy,
    paddingHorizontal: Spacing.pagePx,
    paddingBottom: 20,
  },
  listHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  inboxTag: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 13,
    color: Colors.accentCyan,
    letterSpacing: 2.4,
  },
  listHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  unreadBadge: {
    backgroundColor: Colors.coral,
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  unreadBadgeText: {
    fontFamily: FontFamily.manropeBold,
    fontSize: 12,
    color: Colors.white,
  },
  composeBtn: {
    width: 36, height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(0,212,255,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(0,212,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.manropeBlack,
    fontSize: 28,
    color: Colors.white,
    lineHeight: 32,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 14,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.interRegular,
    fontSize: 14,
    color: Colors.white,
  },

  threadHeader: {
    backgroundColor: Colors.navy,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.pagePx,
    paddingBottom: 16,
    gap: 12,
  },
  frostedBack: {
    width: 44, height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  threadAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,212,255,0.2)',
    borderWidth: 2, borderColor: 'rgba(0,212,255,0.5)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  threadAvatarText: { fontFamily: FontFamily.manropeBold, fontSize: 13, color: Colors.accentCyan },
  threadName: { fontFamily: FontFamily.manropeBold, fontSize: 16, color: Colors.white },
  threadSub: { fontFamily: FontFamily.interRegular, fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 1 },

  threadContent: { padding: Spacing.pagePx, paddingBottom: 20, gap: 6 },
  newDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  newDividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(0,212,255,0.3)' },
  newDividerLabel: {
    fontFamily: FontFamily.manropeBold,
    fontSize: 11,
    color: Colors.accentCyan,
    letterSpacing: 1.2,
  },
  bubble: { maxWidth: '75%', borderRadius: 14, padding: 12, gap: 2 },
  bubbleMe: { backgroundColor: Colors.navy, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleThem: {
    backgroundColor: Colors.cardBg,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow,
  },
  bubbleText: { fontFamily: FontFamily.interRegular, fontSize: FontSize.body, lineHeight: 21 },
  bubbleTextMe: { color: Colors.white },
  bubbleTextThem: { color: Colors.textPrimary },
  bubbleFooter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bubbleTime: { fontFamily: FontFamily.interRegular, fontSize: 10 },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.5)' },
  bubbleTimeThem: { color: Colors.textMuted },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    padding: Spacing.pagePx, borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.cardBg,
  },
  input: {
    flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 24,
    paddingHorizontal: 16, paddingVertical: 12,
    fontFamily: FontFamily.interRegular, fontSize: FontSize.body,
    color: Colors.textPrimary, backgroundColor: Colors.pageBg, maxHeight: 100,
  },
  sendBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#E5E7EB' },

  convoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: Spacing.pagePx, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(15,31,61,0.06)',
    backgroundColor: Colors.white,
  },
  convoAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  convoAvatarText: { fontFamily: FontFamily.manropeBold, fontSize: 15, color: Colors.white },
  convoMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convoName: { fontFamily: FontFamily.manropeBold, fontSize: FontSize.cardTitle, color: Colors.textPrimary },
  convoSubLabel: { fontFamily: FontFamily.interRegular, fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  convoTime: { fontFamily: FontFamily.interRegular, fontSize: FontSize.metadata, color: Colors.textMuted },
  convoPreview: { fontFamily: FontFamily.interRegular, fontSize: FontSize.uiLabel, color: Colors.textMuted, marginTop: 2 },
  unreadDot: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.accentCyan,
    alignItems: 'center', justifyContent: 'center',
  },
  unreadDotText: { fontFamily: FontFamily.interSemiBold, fontSize: 11, color: Colors.navy },

  composeTitle: { fontFamily: FontFamily.manropeBold, fontSize: 16, color: Colors.white },
  composeSub: { fontFamily: FontFamily.interRegular, fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 1 },
  composeSearchBar: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.pagePx,
    paddingVertical: 12,
  },
  composeSearchInput: {
    backgroundColor: Colors.pageBg,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, padding: 10,
    fontFamily: FontFamily.interRegular, fontSize: 14, color: Colors.textPrimary,
  },
  residentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: Spacing.pagePx, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(15,31,61,0.06)',
    backgroundColor: Colors.white,
  },
  emptyState: { paddingVertical: 60, paddingHorizontal: 32, alignItems: 'center' },
  emptyTitle: { fontFamily: FontFamily.manropeBold, fontSize: 15, color: Colors.navy, textAlign: 'center' },
  emptySub: { fontFamily: FontFamily.interRegular, fontSize: 13, color: Colors.textMuted, marginTop: 6, textAlign: 'center' },
});
