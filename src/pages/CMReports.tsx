import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CMHeader } from '@/components/condo-manager/CMHeader';
import { CMChips } from '@/components/condo-manager/CMChips';
import { CMStatusPill, CMPriorityBadge } from '@/components/condo-manager/CMStatusBadge';
import { CMReportDetail } from '@/components/condo-manager/CMReportDetail';
import { useCondoManagerCommunities } from '@/hooks/useCondoManagerData';
import { supabase } from '@/integrations/supabase/client';
import { getCategoryLabel, cleanDescription } from '@/lib/maintenanceUtils';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

interface Report {
  id: string;
  community: string;
  amenity: string;
  status: string;
  priority: string;
  category: string;
  description: string;
  reporter: string;
  date: string;
  report_type?: string;
  location_text?: string;
  displayTitle: string;
  is_urgent: boolean;
}

const CMReports = () => {
  const [searchParams] = useSearchParams();
  const [communityFilter, setCommunityFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('Active');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(searchParams.get('reportId'));
  const { communities } = useCondoManagerCommunities();

  const communityOptions = ['All', ...communities.map(c => c.name)];

  const fetchReports = useCallback(async () => {
    if (communities.length === 0) { setLoading(false); return; }

    const hoaIds = communities.map(c => c.id);
    const hoaMap = new Map(communities.map(c => [c.id, c.name]));

    const { data, error } = await supabase
      .from('maintenance_reports')
      .select('id, hoa_id, amenity_id, status, priority, category, description, reporter_id, created_at, report_type, location_text, is_urgent')
      .in('hoa_id', hoaIds)
      .order('created_at', { ascending: false });

    if (error) { console.error(error); setLoading(false); return; }

    const amenityIds = [...new Set((data || []).map(r => r.amenity_id).filter(Boolean))];
    const reporterIds = [...new Set((data || []).map(r => r.reporter_id))];

    const [amenitiesRes, profilesRes] = await Promise.all([
      amenityIds.length > 0 ? supabase.from('courts').select('id, name').in('id', amenityIds) : { data: [] },
      reporterIds.length > 0 ? supabase.from('profiles').select('id, full_name').in('id', reporterIds) : { data: [] },
    ]);

    const amenityMap = new Map((amenitiesRes.data || []).map(a => [a.id, a.name]));
    const profileMap = new Map((profilesRes.data || []).map(p => [p.id, p.full_name]));

    const mapped = (data || []).map((r: any) => ({
      id: r.id,
      community: hoaMap.get(r.hoa_id) || '',
      amenity: r.amenity_id ? (amenityMap.get(r.amenity_id) || null) : null,
      displayTitle: r.report_type === 'location'
        ? `📍 ${(r.location_text || 'Unknown location').slice(0, 30)}${(r.location_text || '').length > 30 ? '…' : ''}`
        : (amenityMap.get(r.amenity_id) || getCategoryLabel(r.category)),
      status: r.status.charAt(0).toUpperCase() + r.status.slice(1).replace('_', ' '),
      priority: r.priority || 'medium',
      category: r.category,
      description: r.description,
      reporter: profileMap.get(r.reporter_id) || 'Unknown',
      date: new Date(r.created_at).toLocaleDateString(),
      report_type: r.report_type,
      location_text: r.location_text,
      is_urgent: r.is_urgent ?? false,
    }));

    mapped.sort((a: Report, b: Report) => {
      if (a.is_urgent && !b.is_urgent) return -1;
      if (!a.is_urgent && b.is_urgent) return 1;
      return 0;
    });

    setReports(mapped);
    setLoading(false);
  }, [communities]);

  // Real-time: auto-refresh when reports are created or updated
  useRealtimeSubscription({
    table: 'maintenance_reports',
    event: '*',
    onChange: fetchReports,
    enabled: communities.length > 0
  });

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const filtered = useMemo(() => reports.filter(
    (r) => {
      if (communityFilter !== 'All' && r.community !== communityFilter) return false;
      if (categoryFilter !== 'All Categories' && r.category !== categoryFilter) return false;
      
      // Status filtering
      const s = r.status.toLowerCase();
      if (statusFilter === 'Active') {
        return s === 'open' || s === 'in progress' || s === 'assigned';
      }
      if (statusFilter === 'All') {
        return s !== 'closed';
      }
      return s === statusFilter.toLowerCase();
    }
  ), [reports, communityFilter, statusFilter, categoryFilter]);

  const openCount = filtered.filter(r => ['Open', 'Assigned'].includes(r.status)).length;
  const inProgCount = filtered.filter(r => r.status.toLowerCase() === 'in progress').length;

  // If a report is selected, show detail view
  if (selectedReportId) {
    return (
      <CMReportDetail
        reportId={selectedReportId}
        onBack={() => { setSelectedReportId(null); }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-cm-app-bg flex flex-col">
      <CMHeader compact>
        <div className="flex justify-between items-start">
          <div>
            <div className="text-xl font-extrabold">Maintenance Reports</div>
            <div className="text-xs opacity-65">
              {communityFilter === 'All' ? 'All communities' : communityFilter} · real time
            </div>
          </div>
          <div className="flex gap-2">
            <div
              className="rounded-full px-3 py-1.5 text-xs font-extrabold"
              style={{ background: openCount > 0 ? 'hsl(var(--cm-danger))' : 'rgba(255,255,255,0.12)' }}
            >
              {openCount} Open
            </div>
            <div
              className="rounded-full px-3 py-1.5 text-xs font-extrabold"
              style={{ background: inProgCount > 0 ? 'hsl(var(--cm-warning))' : 'rgba(255,255,255,0.12)' }}
            >
              {inProgCount} In Prog
            </div>
          </div>
        </div>
      </CMHeader>

      <div className="flex-1 overflow-y-auto pb-24">
        <div className="px-4 pt-3">
          <CMChips options={communityOptions} value={communityFilter} onChange={setCommunityFilter} light />
        </div>

        <div className="px-4 py-2.5 flex gap-2.5">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 px-2.5 py-2 rounded-[10px] border border-cm-border text-xs bg-white text-cm-text"
          >
            {['Active', 'All', 'Open', 'In Progress', 'Resolved', 'Closed'].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="flex-1 px-2.5 py-2 rounded-[10px] border border-cm-border text-xs bg-white text-cm-text"
          >
            {[
              'All Categories',
              'Grounds & Landscaping',
              'Water & Plumbing',
              'Amenities & Equipment',
              'Lighting & Electrical',
              'Buildings & Structures',
            ].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>

        <div className="px-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-3 border-cm-cyan/20 border-t-cm-cyan rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {filtered.map((r) => (
                <div
                  key={r.id}
                  className="bg-white rounded-[14px] p-3.5 mb-2.5 border border-cm-border cursor-pointer active:bg-cm-app-bg transition-colors"
                  onClick={() => setSelectedReportId(r.id)}
                >
                  <div className="flex justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {r.is_urgent && <span className="text-sm">🚨</span>}
                      <div>
                        <div className="text-sm font-extrabold text-cm-text">{r.displayTitle}</div>
                        <div className="text-[11px] text-cm-cyan font-semibold mt-0.5">{r.community}</div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <CMStatusPill status={r.status} />
                      <CMPriorityBadge priority={r.priority} />
                    </div>
                  </div>
                  <div className="text-xs text-cm-text my-2">{cleanDescription(r.description)}</div>
                  <div className="flex justify-between">
                    <div className="text-[11px] text-cm-text-light">👤 {r.reporter} · {r.date}</div>
                    <div className="text-[11px] text-cm-cyan font-bold">View Details →</div>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="text-center py-10 text-cm-text-light">No reports match your filters</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CMReports;
