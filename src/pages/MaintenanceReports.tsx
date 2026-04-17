import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Calendar, User, MapPin, Eye, CheckCircle, AlertCircle, ArrowLeft, Filter, X,
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { AssigneeSearch } from '@/components/maintenance/AssigneeSearch';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import {
  getCategoryLabel,
  parsePriorityFromDescription,
  cleanDescription,
  priorityConfig,
  statusConfig,
  allStatusFilters,
  allCategories,
} from '@/lib/maintenanceUtils';

interface MaintenanceReport {
  id: string;
  category: string;
  description: string;
  photo_url?: string;
  status: string;
  assignee?: string;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
  reporter_id: string;
  amenity_id: string;
  reporter_name?: string;
  amenity_name?: string;
  report_type?: string;
  location_text?: string;
}

const statusPill = (status: string) => {
  const map: Record<string, { bg: string; text: string; border: string }> = {
    open:       { bg: '#FEF2F2', text: '#991B1B', border: '#EF4444' },
    assigned:   { bg: '#FFF5F5', text: '#C0392B', border: '#F97066' },
    in_progress:{ bg: '#FFF5F5', text: '#C0392B', border: '#F97066' },
    accepted:   { bg: '#FFF5F5', text: '#C0392B', border: '#F97066' },
    resolved:   { bg: '#E0F9FF', text: '#0369A1', border: '#00D4FF' },
    closed:     { bg: '#E0F9FF', text: '#0369A1', border: '#00D4FF' },
  };
  return map[status] || { bg: '#F3F4F6', text: '#6B7280', border: '#E5E7EB' };
};

const MaintenanceReports = () => {
  const { currentUser, isAdmin } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [reports, setReports] = useState<MaintenanceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<MaintenanceReport | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || 'active',
    category: 'all',
    amenity: searchParams.get('amenity_id') || 'all',
  });

  const loadReportsCallback = useCallback(() => { loadReports(); }, [currentUser, filters]);

  useRealtimeSubscription({
    table: 'maintenance_reports',
    event: '*',
    onChange: loadReportsCallback,
    enabled: isAdmin && !!currentUser?.hoaId,
  });

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  useEffect(() => { loadReports(); }, [currentUser, filters]);

  const loadReports = async () => {
    if (!currentUser?.hoaId) return;
    try {
      setLoading(true);
      let query = supabase
        .from('maintenance_reports')
        .select('*')
        .eq('hoa_id', currentUser.hoaId)
        .order('created_at', { ascending: false });

      if (filters.status === 'active') {
        query = query.in('status', ['open', 'assigned', 'in_progress', 'accepted']);
      } else if (filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters.category !== 'all') query = query.eq('category', filters.category);
      if (filters.amenity !== 'all') query = query.eq('amenity_id', filters.amenity);

      const { data, error } = await query;
      if (error) throw error;

      const reportsWithNames = await Promise.all((data || []).map(async (report: any) => {
        const { data: reporter } = await supabase.from('profiles').select('full_name').eq('id', report.reporter_id).single();
        const amenity = report.amenity_id
          ? (await supabase.from('courts').select('name').eq('id', report.amenity_id).single()).data
          : null;
        return { ...report, reporter_name: reporter?.full_name || 'Unknown', amenity_name: amenity?.name || 'Unknown' };
      }));

      setReports(reportsWithNames);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load maintenance reports', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const updateReportStatus = async (reportId: string, status: string, assignee?: string, adminNotes?: string) => {
    try {
      const updates: any = { status, updated_at: new Date().toISOString() };
      if (assignee !== undefined) updates.assignee = assignee;
      if (adminNotes !== undefined) updates.admin_notes = adminNotes;
      const { error } = await supabase.from('maintenance_reports').update(updates).eq('id', reportId);
      if (error) throw error;
      toast({ title: 'Report Updated', description: 'Status updated successfully.' });
      loadReports();
      if (selectedReport?.id === reportId) setSelectedReport({ ...selectedReport, ...updates });
    } catch {
      toast({ title: 'Error', description: 'Failed to update report', variant: 'destructive' });
    }
  };

  const openReportCount = reports.filter((r) => r.status === 'open' || r.status === 'assigned').length;
  const inProgressCount = reports.filter((r) => r.status === 'in_progress' || r.status === 'accepted').length;

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-28">
      {/* Header */}
      <div style={{ backgroundColor: '#0F1F3D' }} className="px-5 pt-12 pb-8 relative overflow-visible">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/admin')} className="text-white active:scale-95 transition-transform">
            <ArrowLeft className="h-6 w-6" />
          </button>
        </div>
        <div className="text-[13px] uppercase font-semibold mb-1" style={{ color: '#00D4FF', letterSpacing: '0.15em' }}>
          Admin
        </div>
        <h1 className="text-[32px] font-black text-white leading-[1.1] tracking-tight">
          Maintenance Reports
        </h1>

        {/* Stats row */}
        <div className="flex gap-3 mt-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: 'rgba(239,68,68,0.2)' }}>
            <AlertCircle className="h-3.5 w-3.5 text-white" />
            <span className="text-[12px] font-bold text-white">{openReportCount} Open</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: 'rgba(249,112,102,0.2)' }}>
            <span className="text-[12px] font-bold text-white">{inProgressCount} In Progress</span>
          </div>
        </div>

        <div className="absolute -bottom-6 left-0 right-0 h-8 pointer-events-none z-0"
          style={{ background: 'linear-gradient(to bottom, #0F1F3D, transparent)' }} />
      </div>

      <div className="px-5 pt-8 space-y-3">
        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-100 min-h-[44px]"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        >
          <Filter className="h-4 w-4" style={{ color: '#00D4FF' }} />
          <span className="text-[13px] font-bold" style={{ color: '#0F1F3D' }}>Filters</span>
          {(filters.status !== 'active' || filters.category !== 'all') && (
            <span className="w-2 h-2 rounded-full ml-1" style={{ backgroundColor: '#00D4FF' }} />
          )}
        </button>

        {showFilters && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100 space-y-4" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div>
              <div className="text-[11px] uppercase font-semibold mb-2" style={{ color: '#8892A4', letterSpacing: '0.08em' }}>Status</div>
              <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
                <SelectTrigger className="rounded-xl border-gray-200 focus:border-[#00D4FF]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allStatusFilters.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-[11px] uppercase font-semibold mb-2" style={{ color: '#8892A4', letterSpacing: '0.08em' }}>Category</div>
              <Select value={filters.category} onValueChange={(v) => setFilters({ ...filters, category: v })}>
                <SelectTrigger className="rounded-xl border-gray-200 focus:border-[#00D4FF]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {allCategories.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Reports list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(0,212,255,0.2)', borderTopColor: '#00D4FF' }} />
          </div>
        ) : reports.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-gray-100" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <CheckCircle className="h-12 w-12 mx-auto mb-3" style={{ color: '#00D4FF' }} />
            <div className="text-[15px] font-bold mb-1" style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}>No Reports Found</div>
            <div className="text-[13px]" style={{ color: '#8892A4' }}>
              {filters.status === 'all' ? 'No reports submitted yet.' : `No ${filters.status.replace('_', ' ')} reports found.`}
            </div>
          </div>
        ) : (
          reports.map((report) => {
            const pill = statusPill(report.status);
            return (
              <div
                key={report.id}
                className="bg-white rounded-2xl p-5 border border-gray-100"
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="text-[15px] font-extrabold leading-tight" style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}>
                      {report.report_type === 'location'
                        ? (report.location_text || 'Unknown location').slice(0, 40)
                        : report.amenity_name}
                    </div>
                  </div>
                  <span
                    className="text-[11px] font-bold px-2.5 py-0.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: pill.bg, color: pill.text, border: `1px solid ${pill.border}` }}
                  >
                    {statusConfig[report.status]?.label || report.status}
                  </span>
                </div>

                <div className="text-[13px] mb-3 line-clamp-2" style={{ color: '#8892A4' }}>
                  {cleanDescription(report.description)}
                </div>

                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" style={{ color: '#8892A4' }} />
                    <span className="text-[12px]" style={{ color: '#8892A4' }}>{report.reporter_name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" style={{ color: '#8892A4' }} />
                    <span className="text-[12px]" style={{ color: '#8892A4' }}>
                      {new Date(report.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {report.assignee && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" style={{ color: '#8892A4' }} />
                      <span className="text-[12px]" style={{ color: '#8892A4' }}>{report.assignee}</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => { setSelectedReport(report); setShowDetailDialog(true); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold min-h-[44px]"
                  style={{ backgroundColor: '#F3F4F6', color: '#0F1F3D' }}
                >
                  <Eye className="h-4 w-4" />
                  View Details
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}>Report Details</DialogTitle>
          </DialogHeader>
          {selectedReport && (
            <ReportDetailForm
              report={selectedReport}
              onUpdate={updateReportStatus}
              onClose={() => setShowDetailDialog(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const ReportDetailForm: React.FC<{
  report: MaintenanceReport;
  onUpdate: (id: string, status: string, assignee?: string, notes?: string) => void;
  onClose: () => void;
}> = ({ report, onUpdate, onClose }) => {
  const [status, setStatus] = useState(report.status);
  const [assignee, setAssignee] = useState(report.assignee || '');
  const [adminNotes, setAdminNotes] = useState(report.admin_notes || '');

  const priority = parsePriorityFromDescription(report.description);
  const pConfig = priorityConfig[priority];

  const handleSave = () => {
    onUpdate(report.id, status, assignee, adminNotes);
    onClose();
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[16px] font-extrabold" style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}>
          {report.report_type === 'location' ? report.location_text || 'Unknown location' : report.amenity_name}
        </div>
        <div className="text-[12px] mt-1" style={{ color: '#8892A4' }}>
          Reported by {report.reporter_name} · {new Date(report.created_at).toLocaleDateString()}
        </div>
        <div className="text-[12px] mt-0.5 uppercase font-semibold" style={{ color: '#8892A4', letterSpacing: '0.08em' }}>
          {getCategoryLabel(report.category)}{pConfig ? ` · ${pConfig.label}` : ''}
        </div>
      </div>

      <div>
        <div className="text-[11px] uppercase font-semibold mb-1.5" style={{ color: '#8892A4', letterSpacing: '0.08em' }}>Description</div>
        <div className="p-3 rounded-xl text-[13px]" style={{ backgroundColor: '#F9FAFB', color: '#0F1F3D' }}>
          {cleanDescription(report.description)}
        </div>
      </div>

      {report.photo_url && (
        <div>
          <div className="text-[11px] uppercase font-semibold mb-1.5" style={{ color: '#8892A4', letterSpacing: '0.08em' }}>Photo</div>
          <img src={report.photo_url} alt="Maintenance issue" className="rounded-xl w-full h-auto border border-gray-100" />
        </div>
      )}

      <div className="pt-4 border-t border-gray-100 space-y-4">
        <div className="text-[13px] font-bold" style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}>Admin Actions</div>

        <div>
          <div className="text-[11px] uppercase font-semibold mb-1.5" style={{ color: '#8892A4', letterSpacing: '0.08em' }}>Status</div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="rounded-xl border-gray-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allStatusFilters.filter((s) => s.value !== 'all').map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <div className="text-[11px] uppercase font-semibold mb-1.5" style={{ color: '#8892A4', letterSpacing: '0.08em' }}>Assign To</div>
          <AssigneeSearch value={assignee} onChange={setAssignee} placeholder="Type a name to search..." />
        </div>

        <div>
          <div className="text-[11px] uppercase font-semibold mb-1.5" style={{ color: '#8892A4', letterSpacing: '0.08em' }}>Admin Notes</div>
          <Textarea
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            placeholder="Add notes about progress, resolution, etc."
            rows={3}
            className="rounded-xl border-gray-200 focus:border-[#00D4FF] text-[13px]"
            style={{ color: '#0F1F3D' }}
          />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={onClose}
          className="flex-1 py-3 rounded-xl text-[13px] font-bold min-h-[44px]"
          style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="flex-1 py-3 rounded-xl text-[13px] font-bold text-white min-h-[44px]"
          style={{ backgroundColor: '#0F1F3D' }}
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default MaintenanceReports;
