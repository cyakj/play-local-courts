import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CMCommunityData {
  id: string;
  name: string;
  address: string | null;
  totalUnits: number;
  health: number;
  status: 'excellent' | 'good' | 'warning' | 'critical';
  openIssues: number;
  pendingApprovals: number;
  todayBookings: number;
  activeMembers: number;
  avgResolutionDays: number;
  utilization: number;
  amenities: { id: string; name: string; type: string }[];
}

export interface CMNotification {
  id: string;
  hoa_id: string | null;
  type: string;
  title: string;
  body: string;
  metadata: any;
  read: boolean;
  created_at: string;
  community_name?: string;
}

function calcHealthScore(
  avgResolutionDays: number,
  openIssues: number,
  totalUnits: number,
  utilization: number,
  activeMembers: number
): { score: number; status: 'excellent' | 'good' | 'warning' | 'critical' } {
  // Maintenance (25 pts)
  let maint = 0;
  if (avgResolutionDays < 3) maint = 25;
  else if (avgResolutionDays <= 5) maint = 18;
  else if (avgResolutionDays <= 7) maint = 10;

  // Issue volume (25 pts)
  const issueRatio = totalUnits > 0 ? (openIssues / totalUnits) * 100 : 0;
  let vol = 0;
  if (issueRatio < 2) vol = 25;
  else if (issueRatio < 5) vol = 15;
  else if (issueRatio < 10) vol = 8;

  // Utilization (25 pts)
  let util = 10;
  if (utilization >= 50 && utilization <= 85) util = 25;
  else if (utilization >= 30 && utilization < 50) util = 18;
  else if (utilization > 85 && utilization <= 90) util = 18;
  else if (utilization > 90) util = 15;

  // Engagement (25 pts)
  const engRatio = totalUnits > 0 ? (activeMembers / totalUnits) * 100 : 0;
  let eng = 0;
  if (engRatio >= 90) eng = 25;
  else if (engRatio >= 75) eng = 18;
  else if (engRatio >= 50) eng = 10;

  const score = maint + vol + util + eng;
  let status: 'excellent' | 'good' | 'warning' | 'critical' = 'critical';
  if (score >= 90) status = 'excellent';
  else if (score >= 75) status = 'good';
  else if (score >= 50) status = 'warning';

  return { score, status };
}

export function useCondoManagerCommunities() {
  const { currentUser } = useAuth();
  const [communities, setCommunities] = useState<CMCommunityData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!currentUser?.id) return;

    try {
      // Get all communities where user is admin
      const { data: memberships } = await supabase
        .from('hoa_memberships')
        .select('hoa_id')
        .eq('user_id', currentUser.id)
        .eq('role', 'admin')
        .eq('status', 'approved');

      if (!memberships?.length) {
        setCommunities([]);
        setLoading(false);
        return;
      }

      const hoaIds = memberships.map(m => m.hoa_id);

      // Fetch HOA details
      const { data: hoas } = await supabase
        .from('hoas')
        .select('id, name, address')
        .in('id', hoaIds);

      // Fetch amenities (courts) per HOA
      const { data: courts } = await supabase
        .from('courts')
        .select('id, name, court_type, hoa_id')
        .in('hoa_id', hoaIds);

      // Open issues
      const { data: openReports } = await supabase
        .from('maintenance_reports')
        .select('id, hoa_id, status, created_at, completed_at')
        .in('hoa_id', hoaIds);

      // Pending approvals
      const { data: pendingMembers } = await supabase
        .from('hoa_memberships')
        .select('id, hoa_id')
        .in('hoa_id', hoaIds)
        .eq('status', 'pending');

      // Today's bookings
      const today = new Date().toISOString().split('T')[0];
      const courtIds = (courts || []).map(c => c.id);
      let todayBookings: any[] = [];
      if (courtIds.length > 0) {
        const { data } = await supabase
          .from('bookings')
          .select('id, court_id, date')
          .in('court_id', courtIds)
          .eq('date', today);
        todayBookings = data || [];
      }

      // All members per HOA
      const { data: allMembers } = await supabase
        .from('hoa_memberships')
        .select('id, hoa_id, user_id')
        .in('hoa_id', hoaIds)
        .eq('status', 'approved');

      // Build community data
      const result: CMCommunityData[] = (hoas || []).map(hoa => {
        const hoaCourts = (courts || []).filter(c => c.hoa_id === hoa.id);
        const hoaReports = (openReports || []).filter(r => r.hoa_id === hoa.id);
        const openCount = hoaReports.filter(r => ['open', 'assigned'].includes(r.status)).length;
        const pending = (pendingMembers || []).filter(m => m.hoa_id === hoa.id).length;
        const hoaCourtIds = hoaCourts.map(c => c.id);
        const bookingsToday = todayBookings.filter(b => hoaCourtIds.includes(b.court_id)).length;
        const members = (allMembers || []).filter(m => m.hoa_id === hoa.id);
        const activeCount = members.length; // Simplified - count approved members
        const totalUnits = Math.max(activeCount, 20); // Estimate

        // Avg resolution
        const resolved = hoaReports.filter(r => r.status === 'resolved' && r.completed_at);
        let avgRes = 0;
        if (resolved.length > 0) {
          const totalDays = resolved.reduce((sum, r) => {
            const created = new Date(r.created_at).getTime();
            const completed = new Date(r.completed_at!).getTime();
            return sum + (completed - created) / 86400000;
          }, 0);
          avgRes = Math.round((totalDays / resolved.length) * 10) / 10;
        }

        // Utilization: simplified - bookings today / (courts * 14 slots) * 100 * 7 for weekly
        const weeklySlots = hoaCourts.length * 14 * 7; // 14 slots per day * 7 days
        const utilization = weeklySlots > 0 ? Math.round((bookingsToday * 7 / weeklySlots) * 100) : 0;

        const { score, status } = calcHealthScore(avgRes, openCount, totalUnits, utilization, activeCount);

        return {
          id: hoa.id,
          name: hoa.name,
          address: hoa.address,
          totalUnits,
          health: score,
          status,
          openIssues: openCount,
          pendingApprovals: pending,
          todayBookings: bookingsToday,
          activeMembers: activeCount,
          avgResolutionDays: avgRes,
          utilization,
          amenities: hoaCourts.map(c => ({ id: c.id, name: c.name, type: c.court_type })),
        };
      });

      setCommunities(result);
    } catch (error) {
      console.error('Error fetching CM data:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { communities, loading, refetch: fetchData };
}

export function useCondoManagerNotifications() {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<CMNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!currentUser?.id) return;

    const { data, error } = await supabase
      .from('hoa_notifications')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      // Get community names
      const hoaIds = [...new Set(data.filter(n => n.hoa_id).map(n => n.hoa_id!))];
      let hoaMap = new Map<string, string>();
      if (hoaIds.length > 0) {
        const { data: hoas } = await supabase
          .from('hoas')
          .select('id, name')
          .in('id', hoaIds);
        hoaMap = new Map((hoas || []).map(h => [h.id, h.name]));
      }

      setNotifications(data.map(n => ({
        ...n,
        community_name: n.hoa_id ? hoaMap.get(n.hoa_id) || '' : '',
      })));
    }
    setLoading(false);
  }, [currentUser?.id]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription
  useEffect(() => {
    if (!currentUser?.id) return;

    const channel = supabase
      .channel('cm-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'hoa_notifications',
        filter: `user_id=eq.${currentUser.id}`,
      }, (payload) => {
        const newNotif = payload.new as any;
        setNotifications(prev => [{
          ...newNotif,
          community_name: '',
        }, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser?.id]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const markAllRead = async () => {
    if (!currentUser?.id) return;
    await supabase
      .from('hoa_notifications')
      .update({ read: true })
      .eq('user_id', currentUser.id)
      .eq('read', false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markRead = async (id: string) => {
    await supabase
      .from('hoa_notifications')
      .update({ read: true })
      .eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  return { notifications, unreadCount, loading, markAllRead, markRead, refetch: fetchNotifications };
}

const formatTimeAgo = (date: Date) => {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export function useCondoManagerAlerts(communities: CMCommunityData[]) {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Stabilize dependency to avoid stale/partial results from reference changes
  const communitiesKey = communities.map(c => `${c.id}:${c.pendingApprovals}:${c.openIssues}:${c.status}:${c.health}`).join('|');

  useEffect(() => {
    if (communities.length === 0) {
      setAlerts([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const buildAlerts = async () => {
      const result: any[] = [];

      for (const c of communities) {
        // Pending approvals
        if (c.pendingApprovals > 0) {
          result.push({
            type: 'approval',
            community: c.name,
            communityId: c.id,
            text: `${c.pendingApprovals} pending member approval${c.pendingApprovals > 1 ? 's' : ''}`,
            time: 'now',
            urgent: true,
          });
        }

        // Open issues > 3
        if (c.openIssues > 3) {
          result.push({
            type: 'issue',
            community: c.name,
            communityId: c.id,
            text: `${c.openIssues} open issues need attention`,
            time: 'now',
            urgent: true,
          });
        }

        // Health warnings
        if (c.status === 'warning' || c.status === 'critical') {
          result.push({
            type: 'health',
            community: c.name,
            communityId: c.id,
            text: `Health score at ${c.health} — ${c.status}`,
            time: '1d ago',
            urgent: c.status === 'critical',
          });
        }
      }

      // Also check for old unresolved issues
      const hoaIds = communities.map(c => c.id);
      if (hoaIds.length > 0) {
        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        
        const [oldIssuesRes, recentReportsRes] = await Promise.all([
          supabase
            .from('maintenance_reports')
            .select('id, hoa_id, category, created_at')
            .in('hoa_id', hoaIds)
            .in('status', ['open', 'assigned'])
            .lt('created_at', fiveDaysAgo.toISOString()),
          supabase
            .from('maintenance_reports')
            .select('id, hoa_id, category, created_at, report_type, location_text, is_urgent')
            .in('hoa_id', hoaIds)
            .eq('status', 'open')
            .gte('created_at', twoDaysAgo.toISOString())
            .order('created_at', { ascending: false }),
        ]);

        if (cancelled) return;

        const hoaMap = new Map(communities.map(c => [c.id, c.name]));

        if (oldIssuesRes.data) {
          for (const issue of oldIssuesRes.data) {
            result.push({
              type: 'issue',
              community: hoaMap.get(issue.hoa_id) || '',
              communityId: issue.hoa_id,
              text: `Issue unresolved 5+ days: ${issue.category}`,
              time: new Date(issue.created_at).toLocaleDateString(),
              urgent: true,
            });
          }
        }

        // Recent new maintenance reports as alerts
        if (recentReportsRes.data) {
          for (const report of recentReportsRes.data) {
            const categoryLabel = report.category.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
            const label = report.report_type === 'location'
              ? `📍 ${report.location_text || 'Location issue'}`
              : categoryLabel;
            result.push({
              type: 'issue',
              community: hoaMap.get(report.hoa_id) || '',
              communityId: report.hoa_id,
              reportId: report.id,
              text: `New report: ${label}`,
              time: formatTimeAgo(new Date(report.created_at)),
              urgent: report.is_urgent ?? false,
            });
          }
        }
      }

      if (!cancelled) {
        setAlerts(result);
        setLoading(false);
      }
    };

    buildAlerts();
    return () => { cancelled = true; };
  }, [communitiesKey]);

  return { alerts, loading };
}
