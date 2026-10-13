import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Bell, CalendarClock, MessageSquare } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { Colors, FontFamily, FontSize, MaxWidth, Spacing } from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

interface NotificationItem {
  id: string;
  type: 'message' | 'match_invite' | 'hoa';
  /** Deep link for community notifications (validated against an allowlist before navigating). */
  route?: string | null;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  senderId: string;
  listingId: string | null;
}

// Community notifications may carry a deep link in metadata.route. Only these in-app destinations are
// ever navigated to — never an arbitrary string from the database.
const SAFE_ROUTE = new RegExp(
  '^/(reservation-detail/[0-9a-fA-F-]{36}|report-detail/[0-9a-fA-F-]{36}|my-reservations|my-reports|announcements)$',
);
const FALLBACK_ROUTE: Record<string, string> = {
  booking_pending: '/my-reservations', booking_confirmed: '/my-reservations', booking_cancelled: '/my-reservations',
  booking_rejected: '/my-reservations', booking_reminder: '/my-reservations',
  report_status_changed: '/my-reports', report_update: '/my-reports', report_unresolved: '/my-reports',
  announcement: '/announcements',
};
export function safeNotificationRoute(route: unknown, type: string): string | null {
  if (typeof route === 'string' && SAFE_ROUTE.test(route)) return route;
  return FALLBACK_ROUTE[type] ?? null;
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

  async function openItem(item: NotificationItem) {
    if (item.type === 'hoa') {
      if (!item.read) {
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read: true } : i)));
        await supabase.from('hoa_notifications').update({ read: true }).eq('id', item.id.replace(/^hoa-/, ''));
      }
      if (item.route) router.push(item.route as any);
      return;
    }
    if (item.type === 'match_invite' && item.listingId) router.push(`/match/${item.listingId}` as any);
    else router.push({ pathname: '/messages', params: { partner: item.senderId } });
  }

  async function markAllRead() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    await supabase.from('hoa_notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: msgs } = await supabase
        .from('messages')
        .select('id, sender_id, content, created_at, read_at, message_type, related_listing_id, profiles!sender_id(full_name)')
        .eq('receiver_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      const { data: hoaRows } = await supabase
        .from('hoa_notifications')
        .select('id, type, title, body, metadata, read, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      const hoaItems: NotificationItem[] = (hoaRows ?? []).map((n: any) => ({
        id: `hoa-${n.id}`,
        type: 'hoa',
        title: n.title,
        body: n.body,
        createdAt: n.created_at,
        read: !!n.read,
        senderId: '',
        listingId: null,
        route: safeNotificationRoute(n.metadata?.route, n.type),
      }));

      const notifications: NotificationItem[] = (msgs ?? []).map((m: any) => ({
        id: m.id,
        type: m.message_type === 'match_invite' ? 'match_invite' : 'message',
        title: m.message_type === 'match_invite'
          ? `Match invite from ${m.profiles?.full_name ?? 'a player'}`
          : `Message from ${m.profiles?.full_name ?? 'Someone'}`,
        body: m.content,
        createdAt: m.created_at,
        read: !!m.read_at,
        senderId: m.sender_id,
        listingId: m.related_listing_id ?? null,
      }));

      setItems([...notifications, ...hoaItems].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)));
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
            <>
            {items.some((i) => !i.read) ? (
              <TouchableOpacity onPress={markAllRead} accessibilityRole="button" style={{ alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' }}>
                <Text style={{ fontFamily: FontFamily.manropeBold, fontSize: FontSize.label, color: theme.cyanOnLight }}>Mark all as read</Text>
              </TouchableOpacity>
            ) : null}
            {items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.item, !item.read && styles.itemUnread]}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`${item.read ? '' : 'Unread. '}${item.title}`}
                onPress={() => openItem(item)}>
                <View style={styles.iconWrap}>
                  {item.type === 'match_invite'
                    ? <CalendarClock color={theme.cyanOnLight} size={20} strokeWidth={1.5} />
                    : item.type === 'hoa'
                      ? <Bell color={theme.cyanOnLight} size={20} strokeWidth={1.5} />
                      : <MessageSquare color={theme.cyanOnLight} size={20} strokeWidth={1.5} />}
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
            ))}
            </>
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
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.cyanOnLight },
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
