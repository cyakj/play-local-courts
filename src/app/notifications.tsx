import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { MessageSquare } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing } from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

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
  const { theme } = useTheme();
  const styles = useStyles(theme);
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

      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('receiver_id', user.id)
        .is('read_at', null);
    }
    load();
  }, []);

  return (
    <View style={styles.screen}>
      <Header variant="inner" title="Notifications" onBack={() => router.back()} />

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
                style={[styles.item, !item.read && styles.itemUnread]}
                activeOpacity={0.75}>
                <View style={styles.iconWrap}>
                  <MessageSquare color={Colors.accentCyan} size={20} strokeWidth={1.5} />
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

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen:  { flex: 1, backgroundColor: theme.pageBg },
    content: { padding: Spacing.pagePx, paddingBottom: 60 },

    item: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 14,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.cardBg,
      paddingHorizontal: Spacing.pagePx,
      marginHorizontal: -Spacing.pagePx,
    },
    itemUnread: { backgroundColor: 'rgba(45,224,255,0.05)' },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(45,224,255,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    itemTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    itemTitle: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: theme.textPrimary,
      flex: 1,
    },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accentCyan },
    itemBody: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.uiLabel,
      color: theme.textSecondary,
      marginTop: 2,
    },
    itemTime: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 11,
      color: theme.textMuted,
      marginTop: 4,
    },
  }), [theme]);
}
