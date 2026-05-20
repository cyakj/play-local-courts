import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, CheckCircle, ChevronDown } from 'lucide-react';
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

// Status pill config (Lumina Slate)
const getStatusPill = (status: string) => {
  const map: Record<string, { bg: string; text: string; border: string; label: string }> = {
    open:        { bg: '#FFF5F5', text: '#C0392B', border: '#F97066', label: 'Open' },
    assigned:    { bg: '#FFF5F5', text: '#C0392B', border: '#F97066', label: 'Assigned' },
    in_progress: { bg: '#EFF6FF', text: '#1D4ED8', border: '#3B82F6', label: 'In Progress' },
    accepted:    { bg: '#EFF6FF', text: '#1D4ED8', border: '#3B82F6', label: 'Accepted' },
    resolved:    { bg: '#E0F9FF', text: '#0369A1', border: '#00D4FF', label: 'Resolved' },
    closed:      { bg: '#E0F9FF', text: '#0369A1', border: '#00D4FF', label: 'Closed' },
  };
  return map[status] || { bg: '#F3F4F6', text: '#6B7280', border: '#E5E7EB', label: status };
};

// Severity pill config (Lumina Slate)
const getSeverityPill = (priority: string) => {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    urgent: { bg: '#FEF2F2', text: '#991B1B', label: 'Urgent' },
    high:   { bg: '#FEF2F2', text: '#991B1B', label: 'High' },
    medium: { bg: '#FFF5F5', text: '#C0392B', label: 'Medium' },
    low:    { bg: '#F0FDF4', text: '#065F46', label: 'Low' },
  };
  return map[priority] || { bg: '#F3F4F6', text: '#6B7280', label: priority };
};

// Styled custom select component
const StyledSelect: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}> = ({ value, onChange, options }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-4 py-2.5 bg-white"
        style={{
          border: `1px solid ${open ? '#00D4FF' : 'rgba(15,31,61,0.15)'}`,
          borderRadius: 8,
          fontSize: 14,
          color: '#0F1F3D',
          fontFamily: 'Inter, sans-serif',
          cursor: 'pointer',
          boxShadow: open ? '0 0 0 3px rgba(0,212,255,0.12)' : 'none',
          minHeight: 44,
        }}
      >
        <span>{selected?.label || 'Select...'}</span>
        <ChevronDown
          className="h-4 w-4 transition-transform"
          style={{ color: '#8892A4', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>
      {open && (
        <div
          className="absolute left-0 right-0 mt-1 bg-white rounded-xl overflow-hidden z-30"
          style={{ boxShadow: '0px 8px 24px rgba(15,31,61,0.12)', border: '1px solid rgba(15,31,61,0.08)' }}
        >
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full text-left px-4 py-3 text-[14px] transition-colors hover:bg-[#F9FAFB]"
              style={{
                fontFamily: 'Inter, sans-serif',
                color: opt.value === value ? '#00D4FF' : '#0F1F3D',
                background: opt.value === value ? 'rgba(0,212,255,0.05)' : 'white',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
  const [amenityFilter, setAmenityFilter] = useState('All');
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || 'active',
    category: 'all',
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

      const { data, error } = await query;
      if (error) throw error;

      const reportsWithNames = await Promise.all((data || []).map(async (report: any) => {
        const { data: reporter } = await supabase.from('profiles').select('full_name').eq('id', report.reporter_id).single();
        const amenity = report.amenity_id
          ? (await supabase.from('courts').select('name').eq('id', report.amenity_id).single()).data
          : null;
        return { ...report, reporter_name: reporter?.full_name || 'Unknown', amenity_name: amenity?.name || 'General' };
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

  // Unique amenity names for filter tabs
  const amenityTabs = useMemo(() => {
    const names = [...new Set(reports.map(r => r.amenity_name || 'General'))];
    return ['All', ...names];
  }, [reports]);

  const visibleReports = useMemo(() => {
    if (amenityFilter === 'All') return reports;
    return reports.filter(r => (r.amenity_name || 'General') === amenityFilter);
  }, [reports, amenityFilter]);

  const statusOptions = [
    { value: 'active', label: 'Active (all open)' },
    { value: 'all', label: 'All Statuses' },
    ...allStatusFilters.filter(s => !['all', 'active'].includes(s.value)).map(s => ({ value: s.value, label: s.label })),
  ];

  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    ...allCategories,
  ];

  return (
    <div className="min-h-screen pb-28" style={{ background: '#F9FAFB' }}>

      {/* Header */}
      <div style={{ backgroundColor: '#0F1F3D' }} className="px-5 pt-1 pb-2 relative overflow-visible">
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-2 mb-1 active:scale-95 transition-transform"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <ArrowLeft className="h-5 w-5 text-white" />
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1
              className="text-[28px] font-black text-white leading-[1.1] tracking-tight"
              style={{ fontFamily: 'Manrope, sans-serif' }}
            >
              Maintenance Reports
            </h1>
            <p className="mt-0.5" style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontFamily: 'Inter, sans-serif' }}>
              All communities · real time
            </p>
          </div>
          {/* Stat badges */}
          <div className="flex flex-col gap-1.5 items-end ml-4 flex-shrink-0">
            <span
              className="text-[12px] font-semibold px-3 py-1 rounded-full text-white"
              style={{ background: '#F97066', letterSpacing: '0.01em' }}
            >
              {openReportCount} Open
            </span>
            <span
              className="text-[12px] font-semibold px-3 py-1 rounded-full text-white"
              style={{ background: '#00D4FF' }}
            >
              {inProgressCount} In Progress
            </span>
          </div>
        </div>

      </div>

      <div className="pt-1">
        {/* Amenity filter tabs */}
        <div
          className="px-5 mb-3"
          style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
        >
          <div className="flex gap-2 pb-1" style={{ whiteSpace: 'nowrap' }}>
            {amenityTabs.map(tab => {
              const active = amenityFilter === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setAmenityFilter(tab)}
                  className="flex-shrink-0 active:scale-95 transition-transform"
                  style={{
                    padding: '8px 16px',
                    borderRadius: 99,
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: 'Inter, sans-serif',
                    border: active ? 'none' : '1px solid #E5E7EB',
                    background: active ? '#0F1F3D' : 'white',
                    color: active ? 'white' : '#4B5563',
                    cursor: 'pointer',
                    minHeight: 36,
                  }}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </div>

        {/* Status and Category filters */}
        <div className="px-5 grid grid-cols-2 gap-3 mb-4">
          <StyledSelect
            value={filters.status}
            onChange={v => setFilters(f => ({ ...f, status: v }))}
            options={statusOptions}
          />
          <StyledSelect
            value={filters.category}
            onChange={v => setFilters(f => ({ ...f, category: v }))}
            options={categoryOptions}
          />
        </div>

        {/* Reports list */}
        <div className="px-5 space-y-[10px]">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(0,212,255,0.2)', borderTopColor: '#00D4FF' }} />
            </div>
          ) : visibleReports.length === 0 ? (
            <div
              className="bg-white rounded-2xl p-8 text-center"
              style={{ boxShadow: '0px 12px 32px rgba(15,31,61,0.04)', border: '1px solid rgba(15,31,61,0.06)' }}
            >
              <CheckCircle className="h-12 w-12 mx-auto mb-3" style={{ color: '#00D4FF' }} />
              <div className="text-[15px] font-bold mb-1" style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}>
                No Reports Found
              </div>
              <div className="text-[14px]" style={{ color: '#4B5563' }}>
                {filters.status === 'all' ? 'No reports submitted yet.' : 'No matching reports found.'}
              </div>
            </div>
          ) : (
            visibleReports.map((report) => {
              const pill = getStatusPill(report.status);
              const priority = parsePriorityFromDescription(report.description);
              const sevPill = getSeverityPill(priority);
              const isUrgent = priority === 'urgent';
              const title = report.report_type === 'location'
                ? (report.location_text || 'Unknown location')
                : (report.amenity_name || 'General');

              return (
                <div
                  key={report.id}
                  className="bg-white rounded-2xl p-5"
                  style={{
                    boxShadow: '0px 12px 32px rgba(15,31,61,0.04)',
                    border: '1px solid rgba(15,31,61,0.06)',
                  }}
                >
                  {/* Top row: title + status badge */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {isUrgent && (
                          <span
                            className="text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{
                              background: '#FEF2F2',
                              color: '#991B1B',
                              border: '1px solid #EF4444',
                            }}
                          >
                            URGENT
                          </span>
                        )}
                        <span
                          className="text-[17px] font-bold leading-tight truncate"
                          style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}
                        >
                          {title}
                        </span>
                      </div>
                      <div className="text-[13px] font-medium" style={{ color: '#00D4FF', fontFamily: 'Inter, sans-serif' }}>
                        {report.amenity_name || 'General'}
                      </div>
                    </div>

                    {/* Badges column */}
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                        style={{
                          background: pill.bg,
                          color: pill.text,
                          border: `1px solid ${pill.border}`,
                        }}
                      >
                        {pill.label}
                      </span>
                      {priority !== 'medium' && (
                        <span
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: sevPill.bg, color: sevPill.text }}
                        >
                          {sevPill.label}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <p
                    className="mb-3 line-clamp-2"
                    style={{
                      fontSize: 14,
                      color: '#374151',
                      fontFamily: 'Inter, sans-serif',
                      lineHeight: 1.5,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {cleanDescription(report.description)}
                  </p>

                  {/* Reporter · date */}
                  <div className="flex items-center gap-2 mb-3" style={{ fontSize: 13, color: '#4B5563', fontFamily: 'Inter, sans-serif' }}>
                    <span className="font-medium" style={{ color: '#0F1F3D' }}>{report.reporter_name}</span>
                    <span style={{ color: '#D1D5DB' }}>·</span>
                    <span>{new Date(report.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>

                  {/* View details */}
                  <div className="flex justify-end pt-3" style={{ borderTop: '1px solid rgba(15,31,61,0.06)' }}>
                    <button
                      onClick={() => { setSelectedReport(report); setShowDetailDialog(true); }}
                      className="text-[13px] font-semibold active:scale-95 transition-transform"
                      style={{ color: '#00D4FF', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                    >
                      View Details →
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
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

  const statusOptions = allStatusFilters
    .filter(s => !['all', 'active'].includes(s.value))
    .map(s => ({ value: s.value, label: s.label }));

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
        <div className="text-[15px] font-semibold mt-1" style={{ color: '#0F1F3D' }}>
          Reported by {report.reporter_name} · {new Date(report.created_at).toLocaleDateString()}
        </div>
        <div className="text-[13px] mt-0.5 uppercase font-semibold" style={{ color: '#4B5563', letterSpacing: '0.08em' }}>
          {getCategoryLabel(report.category)}{pConfig ? ` · ${pConfig.label}` : ''}
        </div>
      </div>

      <div>
        <div className="text-[13px] uppercase font-semibold mb-1.5" style={{ color: '#374151', letterSpacing: '0.08em' }}>Description</div>
        <div className="p-4 rounded-xl text-[14px] leading-relaxed" style={{ backgroundColor: '#F9FAFB', color: '#0F1F3D' }}>
          {cleanDescription(report.description)}
        </div>
      </div>

      {report.photo_url && (
        <div>
          <div className="text-[13px] uppercase font-semibold mb-1.5" style={{ color: '#374151', letterSpacing: '0.08em' }}>Photo</div>
          <img src={report.photo_url} alt="Maintenance issue" className="rounded-xl w-full h-auto border border-gray-100" />
        </div>
      )}

      <div className="pt-4 border-t border-gray-100 space-y-4">
        <div className="text-[15px] font-bold" style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}>Admin Actions</div>

        <div>
          <div className="text-[13px] uppercase font-semibold mb-1.5" style={{ color: '#374151', letterSpacing: '0.08em' }}>Status</div>
          <StyledSelect value={status} onChange={setStatus} options={statusOptions} />
        </div>

        <div>
          <div className="text-[13px] uppercase font-semibold mb-1.5" style={{ color: '#374151', letterSpacing: '0.08em' }}>Assign To</div>
          <AssigneeSearch value={assignee} onChange={setAssignee} placeholder="Type a name to search..." />
        </div>

        <div>
          <div className="text-[13px] uppercase font-semibold mb-1.5" style={{ color: '#374151', letterSpacing: '0.08em' }}>Admin Notes</div>
          <Textarea
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            placeholder="Add notes about progress, resolution, etc."
            rows={3}
            className="rounded-xl border-gray-200 focus:border-[#00D4FF] text-[14px]"
            style={{ color: '#0F1F3D' }}
          />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={onClose}
          className="flex-1 py-3 rounded-xl min-h-[44px]"
          style={{ backgroundColor: '#F3F4F6', color: '#0F1F3D', fontSize: '15px', fontWeight: 500, border: 'none', cursor: 'pointer' }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="flex-1 py-3 rounded-xl text-[15px] font-bold text-white min-h-[44px]"
          style={{ backgroundColor: '#0F1F3D', border: 'none', cursor: 'pointer' }}
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default MaintenanceReports;
