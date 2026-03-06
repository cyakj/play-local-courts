import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveHOA } from '@/contexts/ActiveHOAContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { UserCheck, UserX, Wrench, User } from 'lucide-react';

interface WorkerRow {
  id: string;
  user_id: string;
  worker_type: string;
  specialties: string[];
  bio: string | null;
  status: string;
  created_at: string;
  profile?: { full_name: string; phone_number: string | null };
  community_status: string;
  active_jobs: number;
  completed_jobs: number;
}

const AdminWorkers = () => {
  const { isAdmin } = useAuth();
  const { activeHOA } = useActiveHOA();
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [loading, setLoading] = useState(true);

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  useEffect(() => {
    if (activeHOA) loadWorkers();
  }, [activeHOA]);

  const loadWorkers = async () => {
    if (!activeHOA) return;
    setLoading(true);
    try {
      // Get worker-community links for this HOA
      const { data: links, error: linksError } = await supabase
        .from('maintenance_worker_communities')
        .select('worker_id, status')
        .eq('hoa_id', activeHOA.hoaId);

      if (linksError) throw linksError;
      if (!links || links.length === 0) { setWorkers([]); setLoading(false); return; }

      const workerIds = links.map(l => l.worker_id);
      const linkMap: Record<string, string> = {};
      links.forEach(l => { linkMap[l.worker_id] = l.status; });

      // Get worker details
      const { data: workersData, error: workersError } = await supabase
        .from('maintenance_workers')
        .select('id, user_id, worker_type, specialties, bio, status, created_at')
        .in('id', workerIds);

      if (workersError) throw workersError;

      // Get profiles for these workers
      const userIds = workersData?.map(w => w.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, phone_number')
        .in('id', userIds);

      const profileMap: Record<string, any> = {};
      profiles?.forEach(p => { profileMap[p.id] = p; });

      // Get job counts
      const rows: WorkerRow[] = (workersData || []).map(w => {
        return {
          ...w,
          profile: profileMap[w.user_id],
          community_status: linkMap[w.id] || 'pending',
          active_jobs: 0,
          completed_jobs: 0,
        };
      });

      // Get job counts from maintenance_reports
      for (const row of rows) {
        const { count: activeCount } = await supabase
          .from('maintenance_reports')
          .select('id', { count: 'exact' })
          .eq('worker_id', row.id)
          .in('status', ['assigned', 'accepted', 'in_progress']);

        const { count: completedCount } = await supabase
          .from('maintenance_reports')
          .select('id', { count: 'exact' })
          .eq('worker_id', row.id)
          .eq('status', 'completed');

        row.active_jobs = activeCount || 0;
        row.completed_jobs = completedCount || 0;
      }

      setWorkers(rows);
    } catch (err) {
      console.error('Error loading workers:', err);
      toast.error('Failed to load workers');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (worker: WorkerRow) => {
    try {
      // Update community link status
      await supabase
        .from('maintenance_worker_communities')
        .update({ status: 'approved' })
        .eq('worker_id', worker.id)
        .eq('hoa_id', activeHOA!.hoaId);

      // Update worker status if all communities approved or this is the first
      await supabase
        .from('maintenance_workers')
        .update({ status: 'approved' })
        .eq('id', worker.id);

      // Notify worker
      await supabase.from('competition_notifications').insert({
        competition_id: activeHOA!.hoaId,
        user_id: worker.user_id,
        type: 'worker_approved',
        title: 'Application Approved!',
        message: `Your maintenance worker application for ${activeHOA!.hoaName} has been approved. You can now receive job assignments.`,
      });

      toast.success('Worker approved');
      loadWorkers();
    } catch (err) {
      console.error('Error approving worker:', err);
      toast.error('Failed to approve worker');
    }
  };

  const handleReject = async (worker: WorkerRow) => {
    try {
      await supabase
        .from('maintenance_worker_communities')
        .update({ status: 'rejected' })
        .eq('worker_id', worker.id)
        .eq('hoa_id', activeHOA!.hoaId);

      // Notify worker
      await supabase.from('competition_notifications').insert({
        competition_id: activeHOA!.hoaId,
        user_id: worker.user_id,
        type: 'worker_rejected',
        title: 'Application Not Approved',
        message: `Your maintenance worker application for ${activeHOA!.hoaName} was not approved.`,
      });

      toast.success('Worker rejected');
      loadWorkers();
    } catch (err) {
      console.error('Error rejecting worker:', err);
      toast.error('Failed to reject worker');
    }
  };

  const approvedWorkers = workers.filter(w => w.community_status === 'approved');
  const pendingWorkers = workers.filter(w => w.community_status === 'pending');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Maintenance Workers</h1>
        <p className="text-muted-foreground">Manage maintenance workers in your community</p>
      </div>

      <Tabs defaultValue="workers">
        <TabsList>
          <TabsTrigger value="workers">Workers ({approvedWorkers.length})</TabsTrigger>
          <TabsTrigger value="pending">
            Pending {pendingWorkers.length > 0 && (
              <Badge variant="destructive" className="ml-1.5 h-5 min-w-[20px] text-xs">{pendingWorkers.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workers" className="space-y-4 mt-4">
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : approvedWorkers.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No approved workers yet</CardContent></Card>
          ) : (
            approvedWorkers.map(w => (
              <Card key={w.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{w.profile?.full_name || 'Unknown'}</span>
                        <Badge variant="outline" className="text-xs">
                          {w.worker_type === 'hoa_employee' ? 'Employee' : 'Contractor'}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {w.specialties?.map(s => (
                          <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                        ))}
                      </div>
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                        <span>{w.active_jobs} active jobs</span>
                        <span>{w.completed_jobs} completed</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-4 mt-4">
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : pendingWorkers.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No pending applications</CardContent></Card>
          ) : (
            pendingWorkers.map(w => (
              <Card key={w.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{w.profile?.full_name || 'Unknown'}</span>
                        <Badge variant="outline" className="text-xs">
                          {w.worker_type === 'hoa_employee' ? 'Employee' : 'Contractor'}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {w.specialties?.map(s => (
                          <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                        ))}
                      </div>
                      {w.bio && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{w.bio}</p>}
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" className="min-h-[44px]" onClick={() => handleApprove(w)}>
                          <UserCheck className="h-4 w-4 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="destructive" className="min-h-[44px]" onClick={() => handleReject(w)}>
                          <UserX className="h-4 w-4 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminWorkers;
