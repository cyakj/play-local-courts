import { useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  Bell, CalendarDays, MessageCircle, TrendingUp, UserCheck, Wrench,
} from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Shadow, Spacing,
} from '@/constants/design';

const ALERT_CONFIG: Record<string, { Icon: typeof Bell; color: string }> = {
  approval: { Icon: UserCheck, color: Colors.accentCyan },
  issue: { Icon: Wrench, color: Colors.red },
  booking: { Icon: CalendarDays, color: Colors.textMuted },
  health: { Icon: TrendingUp, color: Colors.coral },
};

const FILTER_OPTIONS = ['All', 'Urgent', 'Approvals', 'Issues', 'Bookings'] as const;
type FilterOption = typeof FILTER_OPTIONS[number];

interface Alert {
  id: string;
  type: 'approval' | 'issue' | 'booking' | 'health';
  community: string;
  communityId: string;
  text: string;
  time: string;
  urgent: boolean;
  reportId?: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins <= 1 ? 'Just now' : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function CMAlertsScreen() {
  const insets = useSafeAreaInsets();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterOption>('All');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  async function load() {
    const { data: hoas } = await supabase.from('hoas').select('id, name');
    if (!hoas || hoas.length === 0) { setLoading(false); return; }

    const hoaIds = hoas.map((h) => h.id);
    const hoaMap = new Map(hoas.map((h) => [h.id, h.name]));

    const [approvalsRes, issuesRes] = await Promise.all([
      supabase
        .from('community_join_requests')
        .select('id, hoa_id, created_at, profiles(full_name)')
        .in('hoa_id', hoaIds)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
      supabase
        .from('maintenance_reports')
        .select('id, hoa_id, description, category, status, is_urgent, created_at')
        .in('hoa_id', hoaIds)
        .in('status', ['open', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const allAlerts: Alert[] = [];

    for (const req of approvalsRes.data ?? []) {
      const name = (req.profiles as any)?.full_name ?? 'Someone';
      allAlerts.push({
        id: `approval-${req.id}`,
        type: 'approval',
        community: hoaMap.get(req.hoa_id) ?? '',
        communityId: req.hoa_id,
        text: `${name} is requesting to join`,
        time: timeAgo(req.created_at),
        urgent: true,
      });
    }

    for (const report of issuesRes.data ?? []) {
      const summary = (report.description ?? '').trim();
      allAlerts.push({
        id: `issue-${report.id}`,
        type: 'issue',
        community: hoaMap.get(report.hoa_id) ?? '',
        communityId: report.hoa_id,
        text: summary ? (summary.length > 80 ? `${summary.slice(0, 80)}…` : summary) : 'Maintenance issue reported',
        time: timeAgo(report.created_at),
        urgent: report.is_urgent || report.status === 'open',
        reportId: report.id,
      });
    }

    allAlerts.sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0));
    setAlerts(allAlerts);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function takeAction(a: Alert) {
    if (a.type === 'approval') {
      router.push('/pending-requests' as any);
    } else if (a.type === 'issue') {
      router.push({ pathname: '/(cm)/maintenance', params: { reportId: a.reportId ?? '' } } as any);
    }
  }

  const visible = alerts.filter((a) => !dismissed.has(a.id));
  const urgentCount = visible.filter((a) => a.urgent).length;

  const filtered = visible.filter((a) => {
    if (filter === 'All') return true;
    if (filter === 'Urgent') return a.urgent;
    if (filter === 'Approvals') return a.type === 'approval';
    if (filter === 'Issues') return a.type === 'issue';
    if (filter === 'Bookings') return a.type === 'booking';
    return true;
  });

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <View style={styles.headerInner}>
          <View>
            <Text style={styles.headerTitle}>Alerts</Text>
            <Text style={styles.headerSub}>Pending actions</Text>
          </View>
          <View style={styles.headerActions}>
            <View style={[styles.urgentBadge, urgentCount > 0 && styles.urgentBadgeActive]}>
              <Text style={styles.urgentBadgeText}>{urgentCount} Urgent</Text>
            </View>
            <TouchableOpacity
              testID="messages-icon"
              style={styles.messagesBtn}
              onPress={() => router.push('/(cm)/messages' as any)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <MessageCircle color={Colors.white} size={20} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Filter chips row */}
      <View style={styles.chipBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipContent}>
          {FILTER_OPTIONS.map((opt) => {
            const active = filter === opt;
            return (
              <TouchableOpacity
                key={opt}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setFilter(opt)}
                activeOpacity={0.7}>
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accentCyan} />}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>
          {loading ? (
            <View style={styles.loadingRow}>
              <View style={styles.spinner} />
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>No alerts — everything looks good!</Text>
            </View>
          ) : (
            filtered.map((a) => {
              const cfg = ALERT_CONFIG[a.type] || { Icon: Bell, color: Colors.textMuted };
              const { Icon } = cfg;
              return (
                <View
                  key={a.id}
                  style={[
                    styles.alertCard,
                    a.urgent && { borderColor: cfg.color + '44' },
                  ]}>
                  <View style={styles.alertRow}>
                    <View style={[styles.alertIconBox, { backgroundColor: cfg.color + '18' }]}>
                      <Icon color={cfg.color} size={16} strokeWidth={1.5} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.alertMeta}>
                        <Text style={styles.alertCommunity}>{a.community.toUpperCase()}</Text>
                        <Text style={styles.alertTime}>{a.time}</Text>
                      </View>
                      <Text style={styles.alertText}>{a.text}</Text>
                      {(a.urgent || a.type === 'issue') && (
                        <View style={styles.alertActions}>
                          <TouchableOpacity
                            style={styles.actionBtnPrimary}
                            onPress={() => takeAction(a)}
                            activeOpacity={0.8}>
                            <Text style={styles.actionBtnPrimaryLabel}>Take Action</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.actionBtnSecondary}
                            onPress={() => setDismissed((prev) => new Set(prev).add(a.id))}
                            activeOpacity={0.7}>
                            <Text style={styles.actionBtnSecondaryLabel}>Dismiss</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },

  header: {
    backgroundColor: Colors.navy,
    paddingHorizontal: Spacing.pagePx,
    paddingBottom: 16,
  },
  headerInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: 20,
    color: Colors.white,
  },
  headerSub: {
    fontFamily: FontFamily.interRegular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  urgentBadge: {
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  urgentBadgeActive: { backgroundColor: 'rgba(239,68,68,0.25)' },
  messagesBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  urgentBadgeText: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: 13,
    color: Colors.white,
  },

  chipBar: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 10,
    paddingHorizontal: Spacing.pagePx,
  },
  chipContent: { gap: 8 },
  chip: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: Colors.pageBg,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.uiLabel,
    color: Colors.textMuted,
  },
  chipLabelActive: { color: Colors.white },

  content: { padding: Spacing.pagePx, paddingBottom: 100, gap: 12 },

  loadingRow: { alignItems: 'center', paddingVertical: 40 },
  spinner: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(0,212,255,0.2)',
    borderTopColor: Colors.accentCyan,
  },
  emptyRow: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontFamily: FontFamily.interRegular, fontSize: FontSize.body, color: Colors.textMuted },

  alertCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow,
  },
  alertRow: { flexDirection: 'row', gap: 12 },
  alertIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  alertMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  alertCommunity: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 11,
    color: Colors.accentCyan,
    letterSpacing: 0.8,
  },
  alertTime: {
    fontFamily: FontFamily.interRegular,
    fontSize: 10,
    color: Colors.textMuted,
  },
  alertText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 13,
    color: Colors.navy,
  },
  alertActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtnPrimary: {
    flex: 1,
    backgroundColor: Colors.navy,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  actionBtnPrimaryLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 12,
    color: Colors.white,
  },
  actionBtnSecondary: {
    flex: 1,
    backgroundColor: Colors.pageBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 10,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  actionBtnSecondaryLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 12,
    color: Colors.textMuted,
  },
});
