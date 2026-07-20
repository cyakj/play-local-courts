import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
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
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Calendar, Check, CheckCheck, MapPin, Search, Send } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { Colors, FontFamily, FontSize, MaxWidth, Spacing } from '@/constants/design';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

const LESSON_TYPE_LABELS: Record<string, string> = {
  private_lesson:      'Private Lesson',
  semi_private_lesson: 'Semi-Private',
  group_lesson:        'Group Lesson',
  hitting_partner:     'Hitting Partner',
  group_clinic:        'Group Lesson',    // legacy
  practice_session:    'Hitting Partner', // legacy
  private:             'Private Lesson',
  'semi-private':      'Semi-Private',
  group:               'Group Lesson',
};

interface Conversation {
  partnerId: string;
  partnerName: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
}

type InviteStatus = 'invited' | 'accepted' | 'declined' | 'joined';

interface MatchInviteMeta {
  listing_id: string;
  match_date: string;
  start_time: string;
  end_time: string;
  location: string;
  format: string;
  organizer_name: string;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
  message_type?: 'text' | 'match_invite';
  related_listing_id?: string | null;
  metadata?: MatchInviteMeta | null;
}

function formatInviteTime(value: string) {
  const [hour, minute] = value.slice(0, 5).split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function MatchInviteCard({
  message,
  status,
  isMe,
  busy,
  onAccept,
  onDecline,
  theme,
}: {
  message: Message;
  status: InviteStatus | null;
  isMe: boolean;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
  theme: ThemeTokens;
}) {
  const meta = message.metadata;
  return (
    <View style={[inviteStyles.card, { backgroundColor: theme.cardBg, borderColor: Colors.blue }]}>
      <Text style={[inviteStyles.title, { color: theme.textPrimary }]}>
        {isMe ? 'Match invite sent' : 'Match invite'}
      </Text>
      {!!meta && (
        <>
          <View style={inviteStyles.row}>
            <Calendar size={14} color={Colors.blue} />
            <Text style={[inviteStyles.rowText, { color: theme.textSecondary }]}>
              {new Date(`${meta.match_date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {formatInviteTime(meta.start_time)}–{formatInviteTime(meta.end_time)}
            </Text>
          </View>
          <View style={inviteStyles.row}>
            <MapPin size={14} color={Colors.blue} />
            <Text style={[inviteStyles.rowText, { color: theme.textSecondary }]} numberOfLines={1}>{meta.location}</Text>
          </View>
        </>
      )}
      <View style={inviteStyles.actions}>
        <TouchableOpacity
          style={[inviteStyles.actionBtn, inviteStyles.viewBtn, { borderColor: theme.border }]}
          onPress={() => message.related_listing_id && router.push(`/match/${message.related_listing_id}` as any)}>
          <Text style={[inviteStyles.viewBtnText, { color: theme.textPrimary }]}>View Match</Text>
        </TouchableOpacity>
        {!isMe && status === 'invited' && (
          <>
            <TouchableOpacity style={[inviteStyles.actionBtn, inviteStyles.declineBtn]} disabled={busy} onPress={onDecline}>
              <Text style={inviteStyles.declineBtnText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[inviteStyles.actionBtn, inviteStyles.acceptBtn]} disabled={busy} onPress={onAccept}>
              <Text style={inviteStyles.acceptBtnText}>Accept</Text>
            </TouchableOpacity>
          </>
        )}
        {!isMe && status && status !== 'invited' && (
          <Text style={[inviteStyles.statusText, { color: status === 'accepted' ? Colors.positive : Colors.negative }]}>
            {status === 'accepted' ? 'Accepted' : 'Declined'}
          </Text>
        )}
      </View>
    </View>
  );
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

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const [userId, setUserId] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const { partner: partnerParam, lessonRequestId: lessonRequestIdParam } = useLocalSearchParams<{ partner?: string; lessonRequestId?: string }>();
  const [lessonRequestContext, setLessonRequestContext] = useState<{ type: string; date: string } | null>(null);
  const didDeepLink = useRef(false);
  const [inviteStatuses, setInviteStatuses] = useState<Record<string, InviteStatus>>({});
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null);

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

  async function loadInviteStatuses(msgs: Message[]) {
    const listingIds = [...new Set(msgs.filter(m => m.message_type === 'match_invite' && m.related_listing_id).map(m => m.related_listing_id as string))];
    if (!listingIds.length) return;
    const { data } = await (supabase as any)
      .from('open_match_listing_participants')
      .select('listing_id, status')
      .in('listing_id', listingIds)
      .eq('user_id', userId);
    const next: Record<string, InviteStatus> = {};
    (data ?? []).forEach((row: any) => { next[row.listing_id] = row.status; });
    setInviteStatuses(prev => ({ ...prev, ...next }));
  }

  async function respondToInvite(message: Message, status: 'accepted' | 'declined') {
    if (!message.related_listing_id) return;
    setInviteBusyId(message.id);
    const { error } = await (supabase as any)
      .from('open_match_listing_participants')
      .update({ status })
      .eq('listing_id', message.related_listing_id)
      .eq('user_id', userId);
    setInviteBusyId(null);
    if (error) {
      Alert.alert('Unable to respond', error.message);
      return;
    }
    setInviteStatuses(prev => ({ ...prev, [message.related_listing_id as string]: status }));
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
    void loadInviteStatuses((data ?? []) as Message[]);
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
    const { data: newMsg, error } = await supabase
      .from('messages')
      .insert({ sender_id: userId, receiver_id: activeConvo.partnerId, content: draft.trim() })
      .select()
      .single();
    setSending(false);
    if (error || !newMsg) {
      Alert.alert('Message not sent', 'Could not send your message. Please try again.');
      return;
    }
    setThread((prev) => [...prev, newMsg]);
    // Notify recipient — throttled to once per 30 min per conversation
    supabase.functions
      .invoke('send-message-notification', {
        body: { senderId: userId, receiverId: activeConvo.partnerId },
      })
      .catch(() => {});
    setDraft('');
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      load(user.id);
    });
  }, []);

  useEffect(() => {
    if (!partnerParam || !userId || didDeepLink.current) return;
    didDeepLink.current = true;
    (async () => {
      const [profileRes, requestRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name').eq('id', partnerParam).single(),
        lessonRequestIdParam
          ? supabase.from('lesson_requests').select('lesson_type, preferred_date').eq('id', lessonRequestIdParam).single()
          : Promise.resolve({ data: null }),
      ]);
      if (profileRes.data) {
        const convo: Conversation = {
          partnerId: profileRes.data.id,
          partnerName: profileRes.data.full_name ?? 'Player',
          lastMessage: '',
          lastAt: new Date().toISOString(),
          unread: 0,
        };
        openConvo(convo);
      }
      if (requestRes.data) {
        setLessonRequestContext({
          type: (requestRes.data as { lesson_type: string; preferred_date: string }).lesson_type,
          date: (requestRes.data as { lesson_type: string; preferred_date: string }).preferred_date,
        });
      }
    })();
  }, [userId, partnerParam, lessonRequestIdParam]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`messages-invites-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'open_match_listing_participants', filter: `user_id=eq.${userId}` }, (payload) => {
        const row = (payload.new ?? payload.old) as { listing_id: string; status: InviteStatus } | undefined;
        if (row?.listing_id) setInviteStatuses(prev => ({ ...prev, [row.listing_id]: row.status }));
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId]);

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

        {lessonRequestContext && (
          <View style={styles.requestBanner}>
            <Text style={styles.requestBannerText}>
              Re: {LESSON_TYPE_LABELS[lessonRequestContext.type] ?? lessonRequestContext.type} · {new Date(lessonRequestContext.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Text>
          </View>
        )}

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
                if (item.message_type === 'match_invite') {
                  return (
                    <>
                      {showNewDivider && (
                        <View style={styles.newDivider}>
                          <View style={styles.newDividerLine} />
                          <Text style={styles.newDividerLabel}>NEW</Text>
                          <View style={styles.newDividerLine} />
                        </View>
                      )}
                      <MatchInviteCard
                        message={item}
                        status={item.related_listing_id ? inviteStatuses[item.related_listing_id] ?? null : null}
                        isMe={isMe}
                        busy={inviteBusyId === item.id}
                        onAccept={() => respondToInvite(item, 'accepted')}
                        onDecline={() => respondToInvite(item, 'declined')}
                        theme={theme}
                      />
                    </>
                  );
                }
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
              placeholderTextColor={theme.textMuted}
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

  // ── CONVERSATION LIST ─────────────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      <View style={[styles.listHeader, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
          <ArrowLeft color={Colors.white} size={22} strokeWidth={1.5} />
        </TouchableOpacity>
        <View style={styles.listHeaderTop}>
          <Text style={styles.inboxTag}>INBOX</Text>
          {totalUnread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{totalUnread} new</Text>
            </View>
          )}
        </View>
        <Text style={styles.headerTitle}>Messages</Text>
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
                {searchQuery
                  ? 'Try a different name.'
                  : "Start a conversation from a community member's profile."}
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

const inviteStyles = StyleSheet.create({
  card: { alignSelf: 'stretch', maxWidth: '85%', borderWidth: 1.5, borderRadius: 14, padding: 14, gap: 8, marginVertical: 2 },
  title: { fontFamily: FontFamily.manropeBold, fontSize: FontSize.body },
  row: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  rowText: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, flexShrink: 1 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4, alignItems: 'center' },
  actionBtn: { minHeight: 38, paddingHorizontal: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  viewBtn: { borderWidth: 1, flex: 1 },
  viewBtnText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label },
  acceptBtn: { backgroundColor: Colors.positive },
  acceptBtnText: { color: Colors.white, fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label },
  declineBtn: { borderWidth: 1, borderColor: Colors.negative },
  declineBtnText: { color: Colors.negative, fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label },
  statusText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label },
});

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.pageBg },

    // ── List header ──
    listHeader: {
      backgroundColor: Colors.navy,
      paddingHorizontal: Spacing.pagePx,
      paddingBottom: 20,
    },
    backBtn: {
      width: 44, height: 44,
      alignItems: 'center', justifyContent: 'center',
      marginLeft: -4, marginBottom: 4,
    },
    listHeaderTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    inboxTag: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 11,
      color: Colors.accentCyan,
      letterSpacing: 2.4,
    },
    unreadBadge: {
      backgroundColor: Colors.negative,
      borderRadius: 99,
      paddingHorizontal: 10,
      paddingVertical: 2,
    },
    unreadBadgeText: { fontFamily: FontFamily.manropeBold, fontSize: 12, color: Colors.white },
    headerTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: 28,
      color: Colors.white,
      lineHeight: 32,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: 'rgba(255,255,255,0.10)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.15)',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginTop: 14,
    },
    searchInput: {
      flex: 1,
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: Colors.white,
    },

    // ── Thread header ──
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
      backgroundColor: 'rgba(45,224,255,0.15)',
      borderWidth: 2, borderColor: 'rgba(45,224,255,0.40)',
      alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    },
    threadAvatarText: { fontFamily: FontFamily.manropeBold, fontSize: 13, color: Colors.accentCyan },
    threadName: { fontFamily: FontFamily.manropeBold, fontSize: 16, color: Colors.white },
    threadSub: { fontFamily: FontFamily.manropeMedium, fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 1 },

    // ── Thread messages ──
    threadContent: { padding: Spacing.pagePx, paddingBottom: 20, gap: 6 },
    newDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
    newDividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(45,224,255,0.25)' },
    newDividerLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 11,
      color: Colors.accentCyan,
      letterSpacing: 1.2,
    },
    bubble: { maxWidth: '75%', borderRadius: 14, padding: 12, gap: 2 },
    bubbleMe:   { backgroundColor: Colors.blue, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
    bubbleThem: {
      backgroundColor: theme.cardBg,
      alignSelf: 'flex-start',
      borderBottomLeftRadius: 4,
      borderWidth: 1,
      borderColor: theme.border,
      ...theme.shadowCard,
    },
    bubbleText:     { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, lineHeight: 21 },
    bubbleTextMe:   { color: Colors.white },
    bubbleTextThem: { color: theme.textPrimary },
    bubbleFooter:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
    bubbleTime:     { fontFamily: FontFamily.manropeMedium, fontSize: 10 },
    bubbleTimeMe:   { color: 'rgba(255,255,255,0.5)' },
    bubbleTimeThem: { color: theme.textMuted },

    // ── Input row ──
    inputRow: {
      flexDirection: 'row', alignItems: 'flex-end', gap: 10,
      padding: Spacing.pagePx, borderTopWidth: 1, borderTopColor: theme.border,
      backgroundColor: theme.cardBg,
    },
    input: {
      flex: 1, borderWidth: 1, borderColor: theme.border, borderRadius: 24,
      paddingHorizontal: 16, paddingVertical: 12,
      fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body,
      color: theme.textPrimary, backgroundColor: theme.inputBg, maxHeight: 100,
    },
    sendBtn: {
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: Colors.blue, alignItems: 'center', justifyContent: 'center',
    },
    sendBtnDisabled: { backgroundColor: theme.surface2 },

    // ── Conversation list ──
    convoRow: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      paddingHorizontal: Spacing.pagePx, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: theme.border,
      backgroundColor: theme.cardBg,
    },
    convoAvatar: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: 'rgba(45,107,255,0.20)',
      borderWidth: 1, borderColor: 'rgba(45,107,255,0.35)',
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    convoAvatarText: { fontFamily: FontFamily.manropeBold, fontSize: 15, color: Colors.blue },
    convoMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    convoName: { fontFamily: FontFamily.manropeBold, fontSize: FontSize.cardTitle, color: theme.textPrimary },
    convoTime: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.metadata, color: theme.textMuted },
    convoPreview: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.uiLabel, color: theme.textSecondary, marginTop: 2 },
    unreadDot: {
      width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.accentCyan,
      alignItems: 'center', justifyContent: 'center',
    },
    unreadDotText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 11, color: Colors.navy },

    emptyState: { paddingVertical: 60, paddingHorizontal: 32, alignItems: 'center' },
    emptyTitle: { fontFamily: FontFamily.spaceGroteskBold, fontSize: FontSize.sectionTitle, color: theme.textPrimary, textAlign: 'center' },
    emptySub: { fontFamily: FontFamily.manropeMedium, fontSize: 13, color: theme.textMuted, marginTop: 6, textAlign: 'center' },

    // ── Lesson request context banner ──
    requestBanner: {
      backgroundColor: 'rgba(45,107,255,0.12)',
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(45,107,255,0.25)',
      paddingHorizontal: Spacing.pagePx,
      paddingVertical: 10,
    },
    requestBannerText: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      color: Colors.blue,
      letterSpacing: 0.18,
    },
  }), [theme]);
}
