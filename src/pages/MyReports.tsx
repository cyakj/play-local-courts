import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveHOA } from '@/contexts/ActiveHOAContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useData } from '@/contexts/DataContext';
import { MultiStepReportDialog } from '@/components/maintenance/MultiStepReportDialog';
import { 
  Plus, 
  Calendar, 
  ChevronRight,
  ClipboardList
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  getCategoryLabel,
  parsePriorityFromDescription,
  cleanDescription,
  priorityConfig,
  statusConfig,
  allStatusFilters,
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

const MyReports = () => {
  const { currentUser } = useAuth();
  const { activeHOA } = useActiveHOA();
  const { amenities } = useData();
  const { toast } = useToast();
  const [reports, setReports] = useState<UserReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [selectedReport, setSelectedReport] = useState<UserReport | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

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

  const filteredReports = statusFilter === 'all' 
    ? reports 
    : reports.filter(r => r.status === statusFilter);

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status];
    if (!config) return <Badge variant="outline">{status}</Badge>;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const getPriorityBadge = (description: string) => {
    const priority = parsePriorityFromDescription(description);
    const config = priorityConfig[priority];
    if (!config) return null;
    return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Navy Header */}
      <div className="navy-gradient text-white px-5 pt-[50px] pb-5">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-xl font-extrabold">My Reports</div>
            <div className="text-xs opacity-65 mt-0.5">Track and submit maintenance issues</div>
          </div>
          <button
            onClick={() => setShowReportDialog(true)}
            className="px-3.5 py-2 rounded-[10px] text-xs font-bold"
            style={{ background: '#00B4D8' }}
          >
            ＋ New
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">

      {/* Filter Chips */}
      <div className="bg-card border-b border-border px-4 py-2.5 overflow-x-auto -mt-4">
        <div className="flex gap-2">
          {allStatusFilters.map((option) => (
            <button
              key={option.value}
              onClick={() => setStatusFilter(option.value)}
              className="px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all min-h-[36px]"
              style={{
                background: statusFilter === option.value ? '#0A1628' : '#F0F4F8',
                color: statusFilter === option.value ? 'white' : '#9CA3AF',
                border: `1px solid ${statusFilter === option.value ? '#0A1628' : '#E5E7EB'}`,
              }}
            >
              {option.label}
              {option.value !== 'all' && (
                <span className="ml-1 opacity-70">
                  ({reports.filter(r => r.status === option.value).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Reports List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading reports...</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {statusFilter === 'all' ? 'No Reports Yet' : `No ${statusFilter.replace('_', ' ')} reports`}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {statusFilter === 'all' 
                  ? 'Submit a maintenance report to track issues in your community.' 
                  : 'No reports match the selected filter.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredReports.map((report) => (
            <Card 
              key={report.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => {
                setSelectedReport(report);
                setShowDetailDialog(true);
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate mb-1.5">
                      {report.report_type === 'location'
                        ? `📍 ${(report.location_text || 'Unknown location').slice(0, 30)}${(report.location_text || '').length > 30 ? '…' : ''}`
                        : report.amenity_name}
                    </h3>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {getStatusBadge(report.status)}
                      {getPriorityBadge(report.description)}
                      <Badge variant="outline" className="text-xs">{getCategoryLabel(report.category)}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {cleanDescription(report.description)}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(report.created_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                    {report.admin_notes && (
                      <div className="mt-2 p-2 bg-muted/50 rounded-lg text-xs">
                        <span className="font-medium">Admin update: </span>
                        {report.admin_notes}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                </div>
              </CardContent>
            </Card>
          ))
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
                <h3 className="font-semibold">
                  {selectedReport.report_type === 'location'
                    ? `📍 ${selectedReport.location_text || 'Unknown location'}`
                    : selectedReport.amenity_name}
                </h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {getStatusBadge(selectedReport.status)}
                  {getPriorityBadge(selectedReport.description)}
                  <Badge variant="outline">{getCategoryLabel(selectedReport.category)}</Badge>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Description</p>
                <p className="bg-muted/50 p-3 rounded-lg text-sm">{cleanDescription(selectedReport.description)}</p>
              </div>
              {selectedReport.photo_url && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Photo</p>
                  <img src={selectedReport.photo_url} alt="Report" className="rounded-lg border max-w-full" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Submitted</p>
                  <p className="font-medium">{format(new Date(selectedReport.created_at), 'MMM d, yyyy h:mm a')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Last Updated</p>
                  <p className="font-medium">{format(new Date(selectedReport.updated_at), 'MMM d, yyyy h:mm a')}</p>
                </div>
              </div>
              {selectedReport.admin_notes && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Admin Notes</p>
                  <p className="bg-primary/5 border border-primary/10 p-3 rounded-lg text-sm">{selectedReport.admin_notes}</p>
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
    </div>
  );
};

export default MyReports;
