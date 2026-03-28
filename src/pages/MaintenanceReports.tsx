import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, User, MapPin, Clock, Eye, Edit3, CheckCircle, AlertCircle, XCircle, Filter } from 'lucide-react';
import { AssigneeSearch } from '@/components/maintenance/AssigneeSearch';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { 
  getCategoryLabel, 
  parsePriorityFromDescription, 
  cleanDescription, 
  priorityConfig, 
  statusConfig, 
  allStatusFilters, 
  allCategories 
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

const MaintenanceReports = () => {
  const { currentUser, isAdmin } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [reports, setReports] = useState<MaintenanceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<MaintenanceReport | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || 'active',
    category: 'all',
    amenity: searchParams.get('amenity_id') || 'all'
  });

  const loadReportsCallback = useCallback(() => {
    loadReports();
  }, [currentUser, filters]);

  useRealtimeSubscription({
    table: 'maintenance_reports',
    event: '*',
    onChange: loadReportsCallback,
    enabled: isAdmin && !!currentUser?.hoaId
  });

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    loadReports();
  }, [currentUser, filters]);

  const loadReports = async () => {
    if (!currentUser?.hoaId) return;

    try {
      setLoading(true);
      let query = supabase
        .from('maintenance_reports')
        .select('*')
        .eq('hoa_id', currentUser.hoaId)
        .order('created_at', { ascending: false });

      if (filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters.category !== 'all') {
        query = query.eq('category', filters.category);
      }
      if (filters.amenity !== 'all') {
        query = query.eq('amenity_id', filters.amenity);
      }

      const { data, error } = await query;
      if (error) throw error;

      const reportsWithNames = await Promise.all((data || []).map(async (report: any) => {
        const { data: reporter } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', report.reporter_id)
          .single();
        
        const amenity = report.amenity_id
          ? (await supabase.from('courts').select('name').eq('id', report.amenity_id).single()).data
          : null;
        
        return {
          ...report,
          reporter_name: reporter?.full_name || 'Unknown',
          amenity_name: amenity?.name || 'Unknown'
        };
      }));
      
      setReports(reportsWithNames);
    } catch (error) {
      console.error('Error loading reports:', error);
      toast({
        title: "Error",
        description: "Failed to load maintenance reports",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateReportStatus = async (reportId: string, status: string, assignee?: string, adminNotes?: string) => {
    try {
      const updates: any = { status, updated_at: new Date().toISOString() };
      if (assignee !== undefined) updates.assignee = assignee;
      if (adminNotes !== undefined) updates.admin_notes = adminNotes;

      const { error } = await supabase
        .from('maintenance_reports')
        .update(updates)
        .eq('id', reportId);

      if (error) throw error;

      toast({
        title: "Report Updated",
        description: "Maintenance report status has been updated."
      });

      loadReports();
      if (selectedReport?.id === reportId) {
        setSelectedReport({ ...selectedReport, ...updates });
      }
    } catch (error) {
      console.error('Error updating report:', error);
      toast({
        title: "Error",
        description: "Failed to update report",
        variant: "destructive"
      });
    }
  };

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

  const openReportCount = reports.filter(r => r.status === 'open' || r.status === 'assigned').length;
  const inProgressCount = reports.filter(r => r.status === 'in_progress' || r.status === 'accepted').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Maintenance Reports</h1>
          <p className="text-muted-foreground">
            Track and manage amenity maintenance requests
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="destructive" className="text-lg px-3 py-1">
            {openReportCount} Open
          </Badge>
          <Badge className="text-lg px-3 py-1 bg-orange-100 text-orange-700">
            {inProgressCount} In Progress
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Status</Label>
              <Select value={filters.status} onValueChange={(value) => setFilters({...filters, status: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allStatusFilters.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Category</Label>
              <Select value={filters.category} onValueChange={(value) => setFilters({...filters, category: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {allCategories.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reports List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8">Loading reports...</div>
        ) : reports.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Reports Found</h3>
              <p className="text-muted-foreground">
                {filters.status === 'all' 
                  ? "No maintenance reports have been submitted yet."
                  : `No ${filters.status.replace('_', ' ')} reports found.`
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          reports.map((report) => (
            <Card key={report.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold">
                        {report.report_type === 'location'
                          ? `📍 ${(report.location_text || 'Unknown location').slice(0, 30)}${(report.location_text || '').length > 30 ? '…' : ''}`
                          : report.amenity_name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      {getStatusBadge(report.status)}
                      {getPriorityBadge(report.description)}
                      <Badge variant="outline">{getCategoryLabel(report.category)}</Badge>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {cleanDescription(report.description)}
                    </p>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {report.reporter_name}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(report.created_at).toLocaleDateString()}
                      </div>
                      {report.assignee && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          Assigned to: {report.assignee}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedReport(report);
                        setShowDetailDialog(true);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Report Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Maintenance Report Details</DialogTitle>
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

// Report Detail Form Component
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
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold text-lg">
            {report.report_type === 'location'
              ? `📍 ${report.location_text || 'Unknown location'}`
              : report.amenity_name}
          </h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline">{getCategoryLabel(report.category)}</Badge>
            {pConfig && <Badge variant="outline" className={pConfig.className}>{pConfig.label}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Reported by {report.reporter_name} on {new Date(report.created_at).toLocaleDateString()}
          </p>
        </div>
        
        <div>
          <Label className="text-sm font-medium">Description</Label>
          <p className="mt-1 p-3 bg-muted/50 rounded-md">{cleanDescription(report.description)}</p>
        </div>

        {report.photo_url && (
          <div>
            <Label className="text-sm font-medium">Photo</Label>
            <img 
              src={report.photo_url} 
              alt="Maintenance issue" 
              className="mt-1 max-w-full h-auto rounded-md border"
            />
          </div>
        )}
      </div>

      <div className="space-y-4 border-t pt-4">
        <h4 className="font-medium">Admin Actions</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allStatusFilters.filter(s => s.value !== 'all').map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="assignee">Assign To</Label>
            <AssigneeSearch
              value={assignee}
              onChange={setAssignee}
              placeholder="Type a name to search..."
            />
          </div>
        </div>
        
        <div>
          <Label htmlFor="notes">Admin Notes</Label>
          <Textarea
            id="notes"
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            placeholder="Add notes about progress, resolution, etc."
            rows={3}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSave}>
          Save Changes
        </Button>
      </div>
    </div>
  );
};

export default MaintenanceReports;
