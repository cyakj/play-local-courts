import React, { useState, useEffect, useMemo } from 'react';
import { CMHeader } from '@/components/condo-manager/CMHeader';
import { CMChips } from '@/components/condo-manager/CMChips';
import { CMStatusPill, CMPriorityBadge } from '@/components/condo-manager/CMStatusBadge';
import { useCondoManagerCommunities } from '@/hooks/useCondoManagerData';
import { supabase } from '@/integrations/supabase/client';
import { getCategoryLabel, cleanDescription } from '@/lib/maintenanceUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

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
}

const CMReports = () => {
  const [communityFilter, setCommunityFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const { communities } = useCondoManagerCommunities();

  const communityOptions = ['All', ...communities.map(c => c.name)];

  useEffect(() => {
    const fetchReports = async () => {
      if (communities.length === 0) { setLoading(false); return; }

      const hoaIds = communities.map(c => c.id);
      const hoaMap = new Map(communities.map(c => [c.id, c.name]));

      let query = supabase
        .from('maintenance_reports')
        .select('id, hoa_id, amenity_id, status, priority, category, description, reporter_id, created_at')
        .in('hoa_id', hoaIds)
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) { console.error(error); setLoading(false); return; }

      // Fetch amenity names and reporter names
      const amenityIds = [...new Set((data || []).map(r => r.amenity_id))];
      const reporterIds = [...new Set((data || []).map(r => r.reporter_id))];

      const [amenitiesRes, profilesRes] = await Promise.all([
        amenityIds.length > 0 ? supabase.from('courts').select('id, name').in('id', amenityIds) : { data: [] },
        reporterIds.length > 0 ? supabase.from('profiles').select('id, full_name').in('id', reporterIds) : { data: [] },
      ]);

      const amenityMap = new Map((amenitiesRes.data || []).map(a => [a.id, a.name]));
      const profileMap = new Map((profilesRes.data || []).map(p => [p.id, p.full_name]));

      setReports((data || []).map((r: any) => ({
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
      })));
      setLoading(false);
    };
    fetchReports();
  }, [communities]);

  const filtered = useMemo(() => reports.filter(
    (r) =>
      (communityFilter === 'All' || r.community === communityFilter) &&
      (statusFilter === 'All' || r.status.toLowerCase() === statusFilter.toLowerCase()) &&
      (categoryFilter === 'All Categories' || r.category === categoryFilter)
  ), [reports, communityFilter, statusFilter, categoryFilter]);

  const openCount = filtered.filter(r => ['Open', 'Assigned'].includes(r.status)).length;
  const inProgCount = filtered.filter(r => r.status === 'In progress').length;

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
            {['All', 'Open', 'In Progress', 'Assigned', 'Resolved'].map((o) => (
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
                <div key={r.id} className="bg-white rounded-[14px] p-3.5 mb-2.5 border border-cm-border" onClick={() => setSelectedReport(r)}>
                  <div className="flex justify-between mb-2">
                    <div>
                      <div className="text-sm font-extrabold text-cm-text">{(r as any).displayTitle}</div>
                      <div className="text-[11px] text-cm-cyan font-semibold mt-0.5">{r.community}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <CMStatusPill status={r.status} />
                      <CMPriorityBadge priority={r.priority} />
                    </div>
                  </div>
                  <div className="text-xs text-cm-text my-2">{cleanDescription(r.description)}</div>
                  <div className="flex justify-between">
                    <div className="text-[11px] text-cm-text-light">👤 {r.reporter} · {r.date}</div>
                    <div className="text-[11px] text-cm-cyan font-bold cursor-pointer" onClick={(e) => { e.stopPropagation(); setSelectedReport(r); }}>View Details →</div>
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

      {/* Detail Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={(open) => { if (!open) setSelectedReport(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Report Details</DialogTitle>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-base">{(selectedReport as any).displayTitle}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedReport.community}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <CMStatusPill status={selectedReport.status} />
                  <CMPriorityBadge priority={selectedReport.priority} />
                  <Badge variant="outline" className="text-xs">{getCategoryLabel(selectedReport.category)}</Badge>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Description</p>
                <p className="bg-muted/50 p-3 rounded-lg text-sm">{cleanDescription(selectedReport.description)}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Submitted</p>
                  <p className="font-medium">{selectedReport.date}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Reporter</p>
                  <p className="font-medium">{selectedReport.reporter}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CMReports;
