import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Bell, CalendarCheck, CalendarClock, Megaphone, MessageSquare, UserCheck, Wrench } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { FontFamily, FontSize, MaxWidth, Spacing } from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { categoryLabel } from '@/lib/reportDetailView';
import {
  bookingLine, collapseDuplicates, groupByDay, kindOf, notificationRoute, reportLine, timeAgo,
  type ListItem, type NotificationKind,
} from '@/lib/notificationView';

export { safeNotificationRoute } from '@/lib/notificationView';

type Source = 'hoa' | 'message' | 'match_invite';

interface Row extends ListItem {
  source: Source;
  senderId: string;
  listingId: string | null;
  /** What the notification is actually about (report/booking facts), when they could be loaded. */
  detail: string | null;
}

const KIND_COLOR: Record<NotificationKind | 'message', string> = {
  booking: '#12B76A',
  report: '#F79009',
  member: '#2D6BFF',
  announcement: '#7A5AF8',
  other: '#1A7FBF',
  message: '#1A7FBF',
};

export default function NotificationsScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setItems([]); setLoading(false); return; }

      const [msgsRes, hoaRes] = await Promise.all([
        supabase
          .from('messages')
          .select('id, sender_id, content, created_at, read_at, message_type, related_listing_id, profiles!sender_id(full_name)')
          .eq('receiver_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('hoa_notifications')
          .select('id, type, title, body, metadata, read, created_at, dedupe_key')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100),
      ]);
      // An unreadable list must be an error, never an empty "all caught up".
      if (hoaRes.error) { setLoadError(true); setLoading(false); return; }

      const hoaRaw: ListItem[] = (hoaRes.data ?? []).map((n: any) => ({
        id: `hoa-${n.id}`, ids: [n.id], type: n.type, title: n.title, body: n.body, createdAt: n.created_at,
        read: !!n.read, metadata: (n.metadata ?? null) as Record<string, unknown> | null, dedupeKey: n.dedupe_key ?? null, count: 1,
      }));
      const hoaItems = collapseDuplicates(hoaRaw);

      // Describe each row by what it is about. Facts that cannot be read (RLS, deleted rows) simply leave the generic text.
      const reportIds = [...new Set(hoaItems.map((i) => i.metadata?.report_id).filter((v): v is string => typeof v === 'string'))];
      const bookingIds = [...new Set(hoaItems.map((i) => i.metadata?.booking_id).filter((v): v is string => typeof v === 'string'))];
      const reportFacts = new Map<string, string>();
      const bookingFacts = new Map<string, string>();
      if (reportIds.length > 0) {
        const { data: reps } = await supabase.from('maintenance_reports').select('id, category, location_text, amenity_id').in('id', reportIds);
        const amenityIds = [...new Set((reps ?? []).map((r: any) => r.amenity_id).filter(Boolean))] as string[];
        const names = new Map<string, string>();
        if (amenityIds.length > 0) {
          const { data: courts } = await supabase.from('courts').select('id, name').in('id', amenityIds);
          (courts ?? []).forEach((c: any) => names.set(c.id, c.name));
        }
        (reps ?? []).forEach((r: any) => reportFacts.set(r.id, reportLine({
          where: (r.amenity_id && names.get(r.amenity_id)) || (r.location_text?.trim() || null),
          category: categoryLabel(r.category),
        })));
      }
      if (bookingIds.length > 0) {
        const { data: bks } = await supabase.from('bookings').select('id, date, start_time, end_time, courts(name)').in('id', bookingIds);
        (bks ?? []).forEach((b: any) => bookingFacts.set(b.id, bookingLine({
          court: b.courts?.name ?? 'Amenity', date: b.date, start: b.start_time, end: b.end_time,
        })));
      }

      const hoaRows: Row[] = hoaItems.map((i) => ({
        ...i,
        source: 'hoa',
        senderId: '',
        listingId: null,
        detail: bookingFacts.get(String(i.metadata?.booking_id ?? '')) ?? reportFacts.get(String(i.metadata?.report_id ?? '')) ?? null,
      }));

      const msgRows: Row[] = (msgsRes.data ?? []).map((m: any) => ({
        id: m.id, ids: [m.id], count: 1, metadata: null,
        source: m.message_type === 'match_invite' ? 'match_invite' : 'message',
        type: m.message_type === 'match_invite' ? 'match_invite' : 'message',
        title: m.message_type === 'match_invite'
          ? `Match invite from ${m.profiles?.full_name ?? 'a player'}`
          : `Message from ${m.profiles?.full_name ?? 'Someone'}`,
        body: m.content,
        createdAt: m.created_at,
        read: !!m.read_at,
        senderId: m.sender_id,
        listingId: m.related_listing_id ?? null,
        detail: null,
      }));

      setItems([...msgRows, ...hoaRows].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)));
      setLoading(false);

      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('receiver_id', user.id)
        .is('read_at', null);
    } catch {
      setLoadError(true);
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function openItem(item: Row) {
    if (item.source === 'hoa') {
      if (!item.read) {
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read: true } : i)));
        await supabase.from('hoa_notifications').update({ read: true }).in('id', item.ids);
      }
      const dest = notificationRoute(item.type, item.metadata);
      if (dest) router.push(dest as any);
      return;
    }
    if (item.source === 'match_invite' && item.listingId) router.push(`/match/${item.listingId}` as any);
    else router.push({ pathname: '/messages', params: { partner: item.senderId } });
  }

  async function markAllRead() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    await supabase.from('hoa_notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
  }

  const sections = useMemo(() => groupByDay(items), [items]);

  function iconFor(item: Row) {
    const color = KIND_COLOR[item.source === 'hoa' ? kindOf(item.type) : 'message'];
    const props = { color, size: 20, strokeWidth: 2 } as const;
    if (item.source === 'match_invite') return <CalendarClock {...props} />;
    if (item.source === 'message') return <MessageSquare {...props} />;
    switch (kindOf(item.type)) {
      case 'booking': return <CalendarCheck {...props} />;
      case 'report': return <Wrench {...props} />;
      case 'member': return <UserCheck {...props} />;
      case 'announcement': return <Megaphone {...props} />;
      default: return <Bell {...props} />;
    }
  }

  return (
    <View style={styles.screen}>
      <Header variant="inner" title="Notifications" onBack={() => router.back()} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>
          {loading ? (
            <><CardSkeleton /><CardSkeleton /><CardSkeleton /></>
          ) : loadError ? (
            <View testID="notifications-error" style={styles.errorBox}>
              <Text style={styles.errorText}>Could not load your notifications.</Text>
              <TouchableOpacity testID="notifications-retry" onPress={load} accessibilityRole="button" style={styles.retryBtn}>
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : items.length === 0 ? (
            <EmptyState icon={null} title="No notifications" subtitle="You're all caught up!" />
          ) : (
            <>
              {items.some((i) => !i.read) ? (
                <TouchableOpacity testID="mark-all-read" onPress={markAllRead} accessibilityRole="button" style={styles.markAll}>
                  <Text style={styles.markAllText}>Mark all as read</Text>
                </TouchableOpacity>
              ) : null}
              {sections.map((section) => (
                <View key={section.label} testID="notification-section">
                  <Text style={styles.sectionLabel}>{section.label.toUpperCase()}</Text>
                  <View style={styles.sectionCard}>
                    {section.items.map((item, idx) => {
                      const color = KIND_COLOR[item.source === 'hoa' ? kindOf(item.type) : 'message'];
                      return (
                        <TouchableOpacity
                          key={item.id}
                          testID="notification-item"
                          style={[styles.item, idx > 0 && styles.itemDivider, !item.read && styles.itemUnread]}
                          activeOpacity={0.75}
                          accessibilityRole="button"
                          accessibilityLabel={`${item.read ? '' : 'Unread. '}${item.title}${item.detail ? `. ${item.detail}` : ''}`}
                          onPress={() => openItem(item)}>
                          <View style={[styles.iconWrap, { backgroundColor: `${color}1F` }]}>{iconFor(item)}</View>
                          <View style={{ flex: 1 }}>
                            <View style={styles.itemTop}>
                              <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                              {!item.read && <View style={styles.unreadDot} />}
                            </View>
                            {item.detail ? <Text testID="notification-detail" style={styles.itemDetail} numberOfLines={2}>{item.detail}</Text> : null}
                            <Text style={styles.itemBody} numberOfLines={2}>{item.body}</Text>
                            <Text style={styles.itemTime}>{timeAgo(item.createdAt)}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
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

    errorBox: { alignItems: 'center', paddingVertical: 48, gap: 12 },
    errorText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body, color: theme.textSecondary },
    retryBtn: { minHeight: 44, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1, borderColor: theme.borderStrong, alignItems: 'center', justifyContent: 'center' },
    retryText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label, color: theme.textPrimary },

    markAll: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' },
    markAllText: { fontFamily: FontFamily.manropeBold, fontSize: FontSize.label, color: theme.cyanOnLight },

    sectionLabel: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 11, letterSpacing: 1.8, color: theme.textMuted, marginTop: 14, marginBottom: 8 },
    sectionCard: { backgroundColor: theme.cardBg, borderRadius: 14, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' },

    item: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 14, paddingHorizontal: 16 },
    itemDivider: { borderTopWidth: 1, borderTopColor: theme.border },
    itemUnread: { backgroundColor: 'rgba(45,224,255,0.06)' },
    iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    itemTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    itemTitle: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body, color: theme.textPrimary, flex: 1 },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.cyanOnLight },
    itemDetail: { fontFamily: FontFamily.manropeSemiBold, fontSize: 14, color: theme.textPrimary, marginTop: 3 },
    itemBody: { fontFamily: FontFamily.manropeMedium, fontSize: 14, color: theme.textSecondary, marginTop: 2 },
    itemTime: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 11, color: theme.textMuted, marginTop: 6 },
  }), [theme]);
}
