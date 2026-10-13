import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Bell, CalendarClock, ChevronRight, Flame, UserCheck, Wrench, type LucideIcon } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errors';
import { communityToday, hoursUntilStart } from '@/lib/communityTime';
import { formatDateFull, formatTime12h } from '@/lib/format';
import { A } from '@/constants/adminTheme';
import { FontFamily } from '@/constants/design';
import {
  AdminHeader, AdminScreen, Card, Chip, ChipRow, EmptyBlock, ErrorBlock, LoadingBlock, Pill, timeAgo,
} from '@/components/admin/kit';

type Kind = 'approval' | 'issue' | 'booking';
type Filter = 'all' | 'urgent' | 'approval' | 'issue' | 'booking';

interface AlertItem {
  id: string;            // stable per underlying record, so a refresh never creates a second alert
  kind: Kind;
  urgent: boolean;
  community: string;
  title: string;
  summary: string;
  createdAt: string;
  actionLabel: string;
  go: () => void;
}

const SEEN_KEY = '@tenisx/admin_alerts_seen';
const KIND_META: Record<Kind, { Icon: LucideIcon; label: string }> = {
  approval: { Icon: UserCheck, label: 'MEMBER' },
  booking: { Icon: CalendarClock, label: 'BOOKING' },
  issue: { Icon: Wrench, label: 'ISSUE' },
};

// What "urgent" means (it is NOT "any open issue"):
//   issue    -> flagged urgent by the reporter, or high priority
//   booking  -> a pending request whose start time is within 24 hours
//   approval -> a member request that has waited more than 72 hours
const APPROVAL_URGENT_HOURS = 72;
const BOOKING_URGENT_HOURS = 24;

export default function AlertsScreen() {
  const [items, setItems] = useState<AlertItem[]>([]);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY)
      .then((raw) => { if (raw) setSeen(new Set(JSON.parse(raw) as string[])); })
      .catch(() => { /* read state is a per-device convenience; alerts still work without it */ });
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data: hoas, error: hErr } = await supabase.from('hoas').select('id, name');
      if (hErr) throw hErr;
      const hoaName = new Map((hoas ?? []).map((h) => [h.id, h.name]));
      const hoaIds = (hoas ?? []).map((h) => h.id);
      if (hoaIds.length === 0) { setItems([]); return; }

      const [joins, reports, courts] = await Promise.all([
        supabase.from('community_join_requests').select('id, hoa_id, user_id, created_at')
          .in('hoa_id', hoaIds).eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('maintenance_reports').select('id, hoa_id, description, category, priority, is_urgent, status, created_at')
          .in('hoa_id', hoaIds).in('status', ['open', 'in_progress']).order('created_at', { ascending: false }).limit(200),
        supabase.from('courts').select('id, name, hoa_id').in('hoa_id', hoaIds),
      ]);
      const failed = [joins, reports, courts].find((r) => r.error)?.error;
      if (failed) throw failed;

      const courtById = new Map((courts.data ?? []).map((c) => [c.id, c]));
      const courtIds = (courts.data ?? []).map((c) => c.id);
      const { data: pending, error: bErr } = courtIds.length
        ? await supabase.from('bookings').select('id, user_id, court_id, date, start_time, created_at')
            .in('court_id', courtIds).eq('status', 'pending').gte('date', communityToday()).order('date').order('start_time')
        : { data: [], error: null };
      if (bErr) throw bErr;

      const personIds = [...new Set([...(joins.data ?? []).map((j) => j.user_id), ...(pending ?? []).map((b) => b.user_id)])];
      const { data: people, error: pErr } = personIds.length
        ? await supabase.from('profiles').select('id, full_name').in('id', personIds)
        : { data: [], error: null };
      if (pErr) throw pErr;
      const nameOf = (id: string) => (people ?? []).find((p) => p.id === id)?.full_name?.trim() || 'A resident';

      const out: AlertItem[] = [];
      for (const j of joins.data ?? []) {
        out.push({
          id: `approval:${j.id}`, kind: 'approval',
          urgent: (Date.now() - new Date(j.created_at).getTime()) / 3_600_000 > APPROVAL_URGENT_HOURS,
          community: hoaName.get(j.hoa_id) ?? '', title: `${nameOf(j.user_id)} wants to join`,
          summary: 'Membership request waiting for review', createdAt: j.created_at, actionLabel: 'Review member',
          go: () => router.push({ pathname: '/(admin)/pending-requests', params: { tab: 'members' } }),
        });
      }
      for (const b of pending ?? []) {
        const court = courtById.get(b.court_id);
        out.push({
          id: `booking:${b.id}`, kind: 'booking',
          urgent: hoursUntilStart(b.date, b.start_time) <= BOOKING_URGENT_HOURS,
          community: court ? hoaName.get(court.hoa_id) ?? '' : '', title: `${court?.name ?? 'Amenity'} request`,
          summary: `${nameOf(b.user_id)} · ${formatDateFull(b.date)} at ${formatTime12h(b.start_time)}`,
          createdAt: b.created_at ?? `${b.date}T00:00:00`, actionLabel: 'Approve booking',
          go: () => router.push({ pathname: '/(admin)/pending-requests', params: { tab: 'reservations' } }),
        });
      }
      for (const r of reports.data ?? []) {
        const text = (r.description ?? '').trim();
        out.push({
          id: `issue:${r.id}`, kind: 'issue', urgent: !!r.is_urgent || r.priority === 'high',
          community: hoaName.get(r.hoa_id) ?? '',
          title: r.category.replace(/_/g, ' ').replace(/^\w/, (c: string) => c.toUpperCase()),
          summary: text.length > 90 ? `${text.slice(0, 90)}…` : text || 'Maintenance issue reported',
          createdAt: r.created_at, actionLabel: 'Review issue',
          go: () => router.push({ pathname: '/(cm)/maintenance', params: { reportId: r.id, status: 'all' } }),
        });
      }
      out.sort((a, b) => Number(b.urgent) - Number(a.urgent) || +new Date(b.createdAt) - +new Date(a.createdAt));
      setItems(out);
    } catch (e) {
      setError(errorMessage(e, 'Could not load alerts.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('admin_alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_reports' }, () => { load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_join_requests' }, () => { load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const markSeen = useCallback((ids: string[]) => {
    setSeen((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      // Keep only ids that still exist so the stored set cannot grow forever.
      const live = new Set(items.map((i) => i.id));
      const pruned = [...next].filter((id) => live.has(id) || ids.includes(id));
      AsyncStorage.setItem(SEEN_KEY, JSON.stringify(pruned)).catch(() => { /* per-device convenience only */ });
      return new Set(pruned);
    });
  }, [items]);

  const counts = useMemo(() => ({
    all: items.length,
    urgent: items.filter((i) => i.urgent).length,
    approval: items.filter((i) => i.kind === 'approval').length,
    issue: items.filter((i) => i.kind === 'issue').length,
    booking: items.filter((i) => i.kind === 'booking').length,
  }), [items]);

  const visible = items.filter((i) => filter === 'all' || (filter === 'urgent' ? i.urgent : i.kind === filter));
  const unread = items.filter((i) => !seen.has(i.id)).length;

  return (
    <AdminScreen
      testID="admin-alerts"
      header={<AdminHeader title="Alerts" subtitle={unread ? `${unread} unread · ${counts.urgent} urgent` : `${counts.urgent} urgent`} />}
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); load(); }}>
      <ChipRow>
        <Chip testID="alerts-all" label="All" count={counts.all} selected={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip testID="alerts-urgent" label="Urgent" count={counts.urgent} selected={filter === 'urgent'} onPress={() => setFilter('urgent')} />
        <Chip testID="alerts-approvals" label="Approvals" count={counts.approval} selected={filter === 'approval'} onPress={() => setFilter('approval')} />
        <Chip testID="alerts-issues" label="Issues" count={counts.issue} selected={filter === 'issue'} onPress={() => setFilter('issue')} />
        <Chip testID="alerts-bookings" label="Bookings" count={counts.booking} selected={filter === 'booking'} onPress={() => setFilter('booking')} />
      </ChipRow>

      {unread > 0 ? (
        <Pressable onPress={() => markSeen(items.map((i) => i.id))} accessibilityRole="button" style={s.markAll}>
          <Text style={s.markAllText}>Mark all as read</Text>
        </Pressable>
      ) : null}

      {error ? <ErrorBlock message={error} onRetry={load} /> : null}
      {loading ? <LoadingBlock /> : visible.length === 0 && !error ? (
        <Card><EmptyBlock Icon={Bell} title="Nothing needs attention" body="Pending approvals, issues and booking requests appear here until they are handled." /></Card>
      ) : visible.map((a) => {
        const { Icon, label } = KIND_META[a.kind];
        const isUnread = !seen.has(a.id);
        return (
          <Card
            key={a.id}
            testID={`alert-${a.id}`}
            onPress={() => { markSeen([a.id]); a.go(); }}
            accessibilityLabel={`${a.urgent ? 'Urgent. ' : ''}${a.title}. ${a.actionLabel}`}
            style={{ gap: 8, padding: 14 }}>
            <View style={s.row}>
              <View style={[s.icon, { backgroundColor: a.urgent ? A.errorBg : A.infoBg }]}>
                <Icon size={18} color={a.urgent ? A.errorText : A.infoText} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.titleRow}>
                  {isUnread ? <View style={s.dot} accessibilityLabel="Unread" /> : null}
                  <Text style={[s.title, !isUnread && { fontFamily: FontFamily.manropeSemiBold }]} numberOfLines={1}>{a.title}</Text>
                </View>
                <Text style={s.meta} numberOfLines={1}>{a.community} · {timeAgo(a.createdAt)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                {a.urgent ? <Pill tone="error" label="URGENT" Icon={Flame} /> : <Pill tone="neutral" label={label} />}
              </View>
            </View>
            <Text style={s.summary} numberOfLines={2}>{a.summary}</Text>
            <View style={s.actionRow}>
              <Text style={s.action}>{a.actionLabel}</Text>
              <ChevronRight size={18} color={A.primary} />
            </View>
          </Card>
        );
      })}
    </AdminScreen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: A.primary },
  title: { flex: 1, fontFamily: FontFamily.manropeBold, fontSize: 16, color: A.text },
  meta: { fontFamily: FontFamily.manropeMedium, fontSize: 13, color: A.textMuted },
  summary: { fontFamily: FontFamily.manropeMedium, fontSize: 14, color: A.textSecondary },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2, minHeight: 28 },
  action: { fontFamily: FontFamily.manropeBold, fontSize: 14, color: A.primary },
  markAll: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' },
  markAllText: { fontFamily: FontFamily.manropeBold, fontSize: 14, color: A.primary },
});
