import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { MessageSquare, Bell, ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing,
} from '@/constants/design';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

interface NotificationItem {
  id: string;
  type: 'message';
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  senderId: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins <= 1 ? 'just now' : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: msgs } = await supabase
        .from('messages')
        .select('id, sender_id, content, created_at, read_at, profiles!sender_id(full_name)')
        .eq('receiver_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      const notifications: NotificationItem[] = (msgs ?? []).map((m: any) => ({
        id: m.id,
        type: 'message',
        title: `Message from ${m.profiles?.full_name ?? 'Someone'}`,
        body: m.content,
        createdAt: m.created_at,
        read: !!m.read_at,
        senderId: m.sender_id,
      }));

      setItems(notifications);
      setLoading(false);

      // mark all as read
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('receiver_id', user.id)
        .is('read_at', null);
    }
    load();
  }, []);

  return (
    <View style={[styles.screen]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={Colors.white} size={22} strokeWidth={1.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>
          {loading ? (
            <><CardSkeleton /><CardSkeleton /><CardSkeleton /></>
          ) : items.length === 0 ? (
            <EmptyState icon={null} title="No notifications" subtitle="You're all caught up!" />
          ) : (
            items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.item, !item.read && styles.itemUnread]}>
                <View style={styles.iconWrap}>
                  <MessageSquare color={Colors.navy} size={20} strokeWidth={1.5} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.itemTop}>
                    <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                    {!item.read && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.itemBody} numberOfLines={2}>{item.body}</Text>
                  <Text style={styles.itemTime}>{timeAgo(item.createdAt)}</Text>
                </View>
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
  header: {
    backgroundColor: Colors.headerBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.pagePx,
    paddingBottom: 20,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: 18,
    color: Colors.white,
  },
  content: { padding: Spacing.pagePx, paddingBottom: 60 },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.cardBg,
    paddingHorizontal: Spacing.pagePx,
    marginHorizontal: -Spacing.pagePx,
  },
  itemUnread: { backgroundColor: 'rgba(0,212,255,0.05)' },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,212,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemTitle: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
    flex: 1,
  },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accentCyan },
  itemBody: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.uiLabel,
    color: Colors.textMuted,
    marginTop: 2,
  },
  itemTime: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.metadata,
    color: Colors.textMuted,
    marginTop: 4,
  },
});
