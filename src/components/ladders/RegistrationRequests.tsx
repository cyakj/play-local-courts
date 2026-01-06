import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Check, X, UserPlus, Users, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Ladder } from '@/pages/LeaguesLadders';
import { format } from 'date-fns';

interface RegistrationRequest {
  id: string;
  ladder_id: string;
  player_id: string;
  partner_id: string | null;
  team_name: string;
  status: string;
  looking_for_partner: boolean;
  message: string | null;
  admin_notes: string | null;
  created_at: string;
  player_name?: string;
  player_ntrp?: number | null;
  partner_name?: string;
  partner_ntrp?: number | null;
}

interface RegistrationRequestsProps {
  ladderId: string;
  ladderFormat: 'singles' | 'doubles' | 'mixed_doubles';
  onRequestProcessed: () => void;
}

const RegistrationRequests = ({ ladderId, ladderFormat, onRequestProcessed }: RegistrationRequestsProps) => {
  const { currentUser } = useAuth();
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<RegistrationRequest | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadRequests();
  }, [ladderId]);

  const loadRequests = async () => {
    try {
      setIsLoading(true);
      
      const { data: requestsData, error } = await supabase
        .from('ladder_registration_requests')
        .select('*')
        .eq('ladder_id', ladderId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch player details
      if (requestsData && requestsData.length > 0) {
        const playerIds = [...new Set([
          ...requestsData.map(r => r.player_id),
          ...requestsData.filter(r => r.partner_id).map(r => r.partner_id)
        ])];

        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, ntrp_rating')
          .in('id', playerIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        const enrichedRequests: RegistrationRequest[] = requestsData.map(request => ({
          ...request,
          player_name: profileMap.get(request.player_id)?.full_name || 'Unknown',
          player_ntrp: profileMap.get(request.player_id)?.ntrp_rating,
          partner_name: request.partner_id ? profileMap.get(request.partner_id)?.full_name : undefined,
          partner_ntrp: request.partner_id ? profileMap.get(request.partner_id)?.ntrp_rating : undefined,
        }));

        setRequests(enrichedRequests);
      } else {
        setRequests([]);
      }
    } catch (error) {
      console.error('Error loading requests:', error);
      toast.error('Failed to load registration requests');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (request: RegistrationRequest) => {
    setIsProcessing(true);
    try {
      // Create the team
      const { error: teamError } = await supabase
        .from('ladder_teams')
        .insert({
          ladder_id: ladderId,
          team_name: request.team_name,
          player1_id: request.player_id,
          player2_id: request.partner_id || null,
        });

      if (teamError) throw teamError;

      // Update request status
      const { error: updateError } = await supabase
        .from('ladder_registration_requests')
        .update({ status: 'approved', admin_notes: adminNotes || null })
        .eq('id', request.id);

      if (updateError) throw updateError;

      toast.success('Request approved! Team added to ladder.');
      loadRequests();
      onRequestProcessed();
    } catch (error: any) {
      console.error('Error approving request:', error);
      toast.error(error.message || 'Failed to approve request');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('ladder_registration_requests')
        .update({ 
          status: 'rejected', 
          admin_notes: adminNotes || 'Request rejected by admin' 
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      toast.success('Request rejected.');
      setShowRejectDialog(false);
      setSelectedRequest(null);
      setAdminNotes('');
      loadRequests();
    } catch (error: any) {
      console.error('Error rejecting request:', error);
      toast.error(error.message || 'Failed to reject request');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Users className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No pending registration requests</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Pending Requests ({requests.length})</h3>
      </div>

      {requests.map(request => (
        <Card key={request.id}>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium">{request.team_name}</span>
                  {request.looking_for_partner && (
                    <Badge variant="secondary" className="text-xs">
                      <UserPlus className="h-3 w-3 mr-1" />
                      Looking for partner
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {request.player_name}
                    {request.player_ntrp && ` (NTRP ${request.player_ntrp})`}
                  </span>
                  {request.partner_name && (
                    <span>
                      + {request.partner_name}
                      {request.partner_ntrp && ` (NTRP ${request.partner_ntrp})`}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {format(new Date(request.created_at), 'MMM d, h:mm a')}
                  </span>
                </div>

                {request.message && (
                  <p className="text-sm text-muted-foreground mt-2 italic">
                    "{request.message}"
                  </p>
                )}

                {/* Looking for partner indicator */}
                {request.looking_for_partner && (
                  <Badge variant="outline" className="text-xs mt-2">
                    Looking for Partner
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedRequest(request);
                    setShowRejectDialog(true);
                  }}
                  disabled={isProcessing}
                >
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleApprove(request)}
                  disabled={isProcessing || request.looking_for_partner}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Approve
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Registration Request</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this request. The player will be notified.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason (Optional)</Label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Enter reason for rejection..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isProcessing}
            >
              {isProcessing ? 'Rejecting...' : 'Reject Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RegistrationRequests;
