import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveHOA } from '@/contexts/ActiveHOAContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useData } from '@/contexts/DataContext';
import { MultiStepReportDialog } from '@/components/maintenance/MultiStepReportDialog';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { Plus, Calendar, ChevronRight, ClipboardList, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import {
  getCategoryLabel,
  cleanDescription,
} from '@/lib/maintenanceUtils';

interface UserReport {
  id: string;
  category: string;
  description: string;
  photo_url?: string;
  status: string;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
  amenity_id: string;
  amenity_name?: string;
  report_type?: string;
  location_text?: string;
}

const getStatusPill = (status: string): { bg: string; color: string; label: string } => {
  switch (status) {
    case 'open':
    case 'accepted':
      return { bg: '#FFF5F5', color: '#F97066', label: 'Open' };
    case 'in_progress':
      return { bg: '#FFF5F5', color: '#F97066', label: 'In Progress' };
    case 'completed':
    case 'resolved':
      return { bg: '#E0F9FF', color: '#00D4FF', label: 'Resolved' };
    case 'reopened':
      return { bg: '#FEF2F2', color: '#EF4444', label: 'Reopened' };
    default:
      return { bg: '#F9FAFB', color: '#8892A4', label: status };
  }
};

const MyReports = () => {
  const { currentUser } = useAuth();
  const { activeHOA } = useActiveHOA();
  const { amenities } = useData();
  const { toast } = useToast();
  const [reports, setReports] = useState<UserReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('active');
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [selectedReport, setSelectedReport] = useState<UserReport | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  const loadReportsCallback = useCallback(() => {
    loadReports();
  }, [currentUser, activeHOA?.hoaId]);

  useRealtimeSubscription({
    table: 'maintenance_reports',
    event: '*',
    filter: currentUser?.id ? `reporter_id=eq.${currentUser.id}` : undefined,
    onChange: loadReportsCallback,
    enabled: !!currentUser?.id && !!activeHOA?.hoaId
  });

  useEffect(() => {
    loadReports();
  }, [currentUser, activeHOA?.hoaId, showReportDialog]);

  const loadReports = async () => {
    if (!currentUser || !activeHOA?.hoaId) {
      setReports([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('maintenance_reports')
        .select('*')
        .eq('reporter_id', currentUser.id)
        .eq('hoa_id', activeHOA.hoaId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const reportsWithNames = await Promise.all((data || []).map(async (report: any) => {
        let amenityName: string | null = null;
        if (report.amenity_id) {
          const { data: amenity } = await supabase
            .from('courts')
            .select('name')
            .eq('id', report.amenity_id)
            .single();
          amenityName = amenity?.name || null;
        }

        return {
          ...report,
          amenity_name: amenityName || getCategoryLabel(report.category),
        };
      }));

      setReports(reportsWithNames);
    } catch (error) {
      console.error('Error loading reports:', error);
      toast({ title: 'Error', description: 'Failed to load reports', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const activeStatuses = ['open', 'in_progress', 'accepted', 'reopened'];
  const resolvedStatuses = ['completed', 'resolved'];

  const filteredReports = statusFilter === 'all'
    ? reports
    : statusFilter === 'active'
    ? reports.filter(r => activeStatuses.includes(r.status))
    : reports.filter(r => resolvedStatuses.includes(r.status));

  const residentFilters = [
    { value: 'active', label: 'Active' },
    { value: 'all', label: 'All' },
    { value: 'resolved', label: 'Resolved' },
  ];

  const getReportTitle = (report: UserReport) => {
    if (report.report_type === 'location') {
      const loc = report.location_text || 'Unknown location';
      return loc.length > 30 ? loc.slice(0, 30) + '…' : loc;
    }
    return report.amenity_name || getCategoryLabel(report.category);
  };

  return (
    <div className="min-h-screen pb-24" style={{ background: '#F9FAFB' }}>
      {/* Navy Header */}
      <div className="text-white px-5 pt-[50px] pb-5" style={{ backgroundColor: '#0F1F3D' }}>
        <div className="flex justify-between items-center">
          <div>
            <div className="text-xl font-extrabold">My Reports</div>
            <div className="text-xs opacity-65 mt-0.5">Track and submit maintenance issues</div>
          </div>
          <button
            onClick={() => setShowReportDialog(true)}
            className="w-10 h-10 rounded-[10px] flex items-center justify-center"
            style={{ background: '#00D4FF' }}
          >
            <Plus className="h-5 w-5 text-white" />
          </button>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="bg-white border-b px-4 py-2.5" style={{ borderColor: 'rgba(15,31,61,0.08)' }}>
        <div className="flex gap-2">
          {residentFilters.map((option) => {
            const count = option.value === 'all'
              ? reports.length
              : option.value === 'active'
              ? reports.filter(r => activeStatuses.includes(r.status)).length
              : reports.filter(r => resolvedStatuses.includes(r.status)).length;
            const active = statusFilter === option.value;
            return (
              <button
                key={option.value}
                onClick={() => setStatusFilter(option.value)}
                className="px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all min-h-[36px]"
                style={{
                  background: active ? '#0F1F3D' : '#F9FAFB',
                  color: active ? 'white' : '#8892A4',
                  border: `1px solid ${active ? '#0F1F3D' : 'rgba(15,31,61,0.08)'}`,
                }}
              >
                {option.label}
                <span className="ml-1 opacity-70">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Reports List */}
      <div className="px-4 pt-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-10">
            <div
              className="w-8 h-8 border-2 rounded-full animate-spin"
              style={{ borderColor: 'rgba(0,212,255,0.2)', borderTopColor: '#00D4FF' }}
            />
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border" style={{ borderColor: 'rgba(15,31,61,0.08)' }}>
            <ClipboardList className="h-10 w-10 mx-auto mb-3" style={{ color: '#8892A4' }} />
            <h3 className="text-[15px] font-extrabold mb-1" style={{ color: '#0F1F3D' }}>
              {statusFilter === 'all' ? 'No Reports Yet' : `No ${statusFilter} reports`}
            </h3>
            <p className="text-[13px]" style={{ color: '#8892A4' }}>
              {statusFilter === 'all'
                ? 'Submit a maintenance report to track issues in your community.'
                : 'No reports match the selected filter.'}
            </p>
          </div>
        ) : (
          filteredReports.map((report) => {
            const pill = getStatusPill(report.status);
            const isLocation = report.report_type === 'location';
            return (
              <div
                key={report.id}
                className="bg-white rounded-2xl p-4 border cursor-pointer active:scale-[0.98] transition-transform"
                style={{ borderColor: 'rgba(15,31,61,0.08)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                onClick={() => {
                  setSelectedReport(report);
                  setShowDetailDialog(true);
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      {isLocation && <MapPin className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#8892A4' }} />}
                      <h3 className="font-extrabold text-[14px] truncate" style={{ color: '#0F1F3D' }}>
                        {getReportTitle(report)}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span
                        className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: pill.bg, color: pill.color }}
                      >
                        {pill.label}
                      </span>
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: '#F9FAFB', color: '#8892A4', border: '1px solid rgba(15,31,61,0.08)' }}
                      >
                        {getCategoryLabel(report.category)}
                      </span>
                    </div>
                    <p className="text-[12px] line-clamp-2 mb-2" style={{ color: '#8892A4' }}>
                      {cleanDescription(report.description)}
                    </p>
                    <div className="flex items-center gap-1.5 text-[11px]" style={{ color: '#8892A4' }}>
                      <Calendar className="h-3 w-3" />
                      {format(new Date(report.created_at), 'MMM d, yyyy')}
                    </div>
                    {report.admin_notes && (
                      <div
                        className="mt-2 p-2.5 rounded-xl text-[12px]"
                        style={{ background: '#E0F9FF', color: '#0369A1' }}
                      >
                        <span className="font-bold">Admin update: </span>
                        {report.admin_notes}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 flex-shrink-0 mt-1" style={{ color: '#8892A4' }} />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Report Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Report Details</DialogTitle>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-1.5">
                  {selectedReport.report_type === 'location' && (
                    <MapPin className="h-4 w-4 flex-shrink-0" style={{ color: '#8892A4' }} />
                  )}
                  <h3 className="font-extrabold text-[15px]" style={{ color: '#0F1F3D' }}>
                    {getReportTitle(selectedReport)}
                  </h3>
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {(() => {
                    const pill = getStatusPill(selectedReport.status);
                    return (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: pill.bg, color: pill.color }}>
                        {pill.label}
                      </span>
                    );
                  })()}
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#F9FAFB', color: '#8892A4', border: '1px solid rgba(15,31,61,0.08)' }}>
                    {getCategoryLabel(selectedReport.category)}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#8892A4' }}>Description</p>
                <p className="rounded-xl p-3 text-[13px]" style={{ background: '#F9FAFB', color: '#0F1F3D' }}>
                  {cleanDescription(selectedReport.description)}
                </p>
              </div>
              {selectedReport.photo_url && (
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#8892A4' }}>Photo</p>
                  <img src={selectedReport.photo_url} alt="Report" className="rounded-xl border max-w-full" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-[13px]">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider mb-0.5" style={{ color: '#8892A4' }}>Submitted</p>
                  <p className="font-semibold" style={{ color: '#0F1F3D' }}>{format(new Date(selectedReport.created_at), 'MMM d, yyyy h:mm a')}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider mb-0.5" style={{ color: '#8892A4' }}>Last Updated</p>
                  <p className="font-semibold" style={{ color: '#0F1F3D' }}>{format(new Date(selectedReport.updated_at), 'MMM d, yyyy h:mm a')}</p>
                </div>
              </div>
              {selectedReport.admin_notes && (
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#8892A4' }}>Admin Notes</p>
                  <p className="rounded-xl p-3 text-[13px]" style={{ background: '#E0F9FF', color: '#0369A1' }}>
                    {selectedReport.admin_notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <MultiStepReportDialog
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        amenities={amenities.map(a => ({ id: a.id, name: a.name, amenityType: a.amenityType }))}
      />
    </div>
  );
};

export default MyReports;
