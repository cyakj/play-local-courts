import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface WorkerInfo {
  status: string;
  worker_type: string;
  specialties: string[];
  communities: { name: string; status: string }[];
}

const WorkerPendingScreen = () => {
  const { currentUser, logout } = useAuth();
  const [workerInfo, setWorkerInfo] = useState<WorkerInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser?.id) loadWorkerInfo();
  }, [currentUser?.id]);

  const loadWorkerInfo = async () => {
    if (!currentUser) return;
    try {
      const { data: worker } = await supabase
        .from('maintenance_workers')
        .select('status, worker_type, specialties')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (!worker) { setLoading(false); return; }

      const { data: communities } = await supabase
        .from('maintenance_worker_communities')
        .select('hoa_id, status')
        .eq('worker_id', (await supabase.from('maintenance_workers').select('id').eq('user_id', currentUser.id).single()).data?.id || '');

      const hoaIds = communities?.map(c => c.hoa_id) || [];
      let hoaNames: Record<string, string> = {};
      if (hoaIds.length > 0) {
        const { data: hoas } = await supabase.from('hoas').select('id, name').in('id', hoaIds);
        hoas?.forEach(h => { hoaNames[h.id] = h.name; });
      }

      setWorkerInfo({
        status: worker.status,
        worker_type: worker.worker_type,
        specialties: worker.specialties || [],
        communities: communities?.map(c => ({
          name: hoaNames[c.hoa_id] || 'Unknown Community',
          status: c.status,
        })) || [],
      });
    } catch (err) {
      console.error('Error loading worker info:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const statusIcon = {
    pending: <Clock className="h-12 w-12 text-amber-500" />,
    approved: <CheckCircle className="h-12 w-12 text-green-500" />,
    rejected: <XCircle className="h-12 w-12 text-red-500" />,
    inactive: <AlertTriangle className="h-12 w-12 text-muted-foreground" />,
  };

  const statusMessage = {
    pending: 'Your application is pending approval from the community admin. You will be notified once your application is reviewed.',
    approved: 'Your application has been approved! You can now access your worker dashboard.',
    rejected: 'Your application was not approved. You can contact support or apply to a different community.',
    inactive: 'Your worker account has been deactivated. Please contact your community admin.',
  };

  const status = workerInfo?.status || 'pending';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          {statusIcon[status as keyof typeof statusIcon] || statusIcon.pending}

          <h2 className="text-xl font-bold">{currentUser?.fullName || 'Worker'}</h2>

          <Badge variant={status === 'approved' ? 'default' : status === 'rejected' ? 'destructive' : 'secondary'} className="text-sm">
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>

          {workerInfo?.communities && workerInfo.communities.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium">Applied to:</p>
              {workerInfo.communities.map((c, i) => (
                <p key={i} className="text-sm text-muted-foreground">{c.name}</p>
              ))}
            </div>
          )}

          <p className="text-muted-foreground text-sm leading-relaxed">
            {statusMessage[status as keyof typeof statusMessage] || statusMessage.pending}
          </p>

          <div className="pt-4 space-y-2">
            <Button variant="outline" onClick={() => loadWorkerInfo()} className="w-full min-h-[44px]">
              Refresh Status
            </Button>
            <Button variant="ghost" onClick={logout} className="w-full min-h-[44px]">
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkerPendingScreen;
