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
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Send } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing,
} from '@/constants/design';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

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

function getInitials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins <= 1 ? 'just now' : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const [userId, setUserId] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
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

    setConversations(Object.values(convoMap));
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

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      load(user.id);
    });
  }, []);

  // Thread view
  if (activeConvo) {
    return (
      <View style={styles.screen}>
        <View style={[styles.threadHeader, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
          <TouchableOpacity onPress={() => { setActiveConvo(null); setThread([]); }} style={styles.backBtn}>
            <ArrowLeft color={Colors.white} size={22} strokeWidth={1.5} />
          </TouchableOpacity>
          <View style={styles.threadAvatar}>
            <Text style={styles.threadAvatarText}>{getInitials(activeConvo.partnerName)}</Text>
          </View>
          <Text style={styles.threadName} numberOfLines={1}>{activeConvo.partnerName}</Text>
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
              renderItem={({ item }) => {
                const isMe = item.sender_id === userId;
                return (
                  <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                    <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextThem]}>
                      {item.content}
                    </Text>
                    <Text style={[styles.bubbleTime, isMe ? styles.bubbleTimeMe : styles.bubbleTimeThem]}>
                      {timeAgo(item.created_at)}
                    </Text>
                  </View>
                );
              }}
            />
          )}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Message…"
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

  // Conversation list
  return (
    <View style={styles.screen}>
      <View style={[styles.listHeader, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={Colors.white} size={22} strokeWidth={1.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>
          {loading ? (
            <View style={{ padding: 20 }}><CardSkeleton /><CardSkeleton /><CardSkeleton /></View>
          ) : conversations.length === 0 ? (
            <EmptyState icon={null} title="No messages yet" subtitle="You haven't received any messages." />
          ) : (
            conversations.map((c) => (
              <TouchableOpacity key={c.partnerId} style={styles.convoRow} onPress={() => openConvo(c)}>
                <View style={styles.convoAvatar}>
                  <Text style={styles.convoAvatarText}>{getInitials(c.partnerName)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.convoMeta}>
                    <Text style={styles.convoName}>{c.partnerName}</Text>
                    <Text style={styles.convoTime}>{timeAgo(c.lastAt)}</Text>
                  </View>
                  <Text style={styles.convoPreview} numberOfLines={1}>{c.lastMessage}</Text>
                </View>
                {c.unread > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{c.unread}</Text>
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
    backgroundColor: Colors.headerBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.pagePx,
    paddingBottom: 20,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FontFamily.manropeExtraBold, fontSize: 18, color: Colors.white },
  threadHeader: {
    backgroundColor: Colors.headerBg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.pagePx,
    paddingBottom: 16,
    gap: 12,
  },
  threadAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.accentCyan,
    alignItems: 'center', justifyContent: 'center',
  },
  threadAvatarText: { fontFamily: FontFamily.manropeBold, fontSize: 13, color: Colors.navy },
  threadName: { fontFamily: FontFamily.manropeExtraBold, fontSize: 16, color: Colors.white, flex: 1 },
  threadContent: { padding: Spacing.pagePx, paddingBottom: 20, gap: 8 },
  bubble: { maxWidth: '75%', borderRadius: 16, padding: 12, gap: 4 },
  bubbleMe: { backgroundColor: Colors.navy, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: Colors.cardBg, alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: Colors.border },
  bubbleText: { fontFamily: FontFamily.interRegular, fontSize: FontSize.body },
  bubbleTextMe: { color: Colors.white },
  bubbleTextThem: { color: Colors.textPrimary },
  bubbleTime: { fontFamily: FontFamily.interRegular, fontSize: FontSize.metadata },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.5)', textAlign: 'right' },
  bubbleTimeThem: { color: Colors.textMuted },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    padding: Spacing.pagePx, borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.cardBg,
  },
  input: {
    flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.input,
    padding: 12, fontFamily: FontFamily.interRegular, fontSize: FontSize.body,
    color: Colors.textPrimary, backgroundColor: Colors.pageBg, maxHeight: 100,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.textMuted },
  convoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: Spacing.pagePx, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  convoAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  convoAvatarText: { fontFamily: FontFamily.manropeBold, fontSize: 15, color: Colors.white },
  convoMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convoName: { fontFamily: FontFamily.interSemiBold, fontSize: FontSize.body, color: Colors.textPrimary },
  convoTime: { fontFamily: FontFamily.interRegular, fontSize: FontSize.metadata, color: Colors.textMuted },
  convoPreview: { fontFamily: FontFamily.interRegular, fontSize: FontSize.uiLabel, color: Colors.textMuted, marginTop: 2 },
  unreadBadge: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.accentCyan,
    alignItems: 'center', justifyContent: 'center',
  },
  unreadText: { fontFamily: FontFamily.interSemiBold, fontSize: 11, color: Colors.navy },
});
