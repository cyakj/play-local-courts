import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Users, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import LadderJoinDialog from '@/components/ladders/LadderJoinDialog';
import { Competition } from '@/components/compete/types';

interface LadderInvitationData {
  type: 'ladder_partner_invitation';
  ladder_id: string;
  ladder_name: string;
  registration_request_id: string;
  inviter_name: string;
  team_name: string;
}

interface LadderInvitationMessageProps {
  invitationData: LadderInvitationData;
  messageId: string;
  senderId: string;
  onStatusChange?: () => void;
}

const LadderInvitationMessage = ({ 
  invitationData, 
  messageId, 
  senderId,
  onStatusChange 
}: LadderInvitationMessageProps) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<'pending' | 'accepted' | 'declined'>('pending');
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [ladderData, setLadderData] = useState<Competition | null>(null);
  const [userNtrp, setUserNtrp] = useState<number | null>(null);

  const handleSignUp = async () => {
    try {
      // Fetch the full ladder data for the join dialog
      const { data: ladder, error } = await supabase
        .from('ladders')
        .select('*')
        .eq('id', invitationData.ladder_id)
        .single();

      if (error) throw error;

      // Fetch user NTRP
      const { data: profile } = await supabase
        .from('profiles')
        .select('ntrp_rating')
        .eq('id', currentUser?.id)
        .single();

      setLadderData(ladder as unknown as Competition);
      setUserNtrp(profile?.ntrp_rating || null);
      setShowJoinDialog(true);
    } catch (error: any) {
      console.error('Error fetching ladder:', error);
      toast.error('Could not load ladder details');
    }
  };

  const handleAccept = async () => {
    if (!currentUser) return;
    
    setIsProcessing(true);
    try {
      const { data: request, error: fetchError } = await supabase
        .from('ladder_registration_requests')
        .select('*')
        .eq('id', invitationData.registration_request_id)
        .single();

      if (fetchError) throw fetchError;

      const { data: ladder, error: ladderError } = await supabase
        .from('ladders')
        .select('auto_approve_registration')
        .eq('id', invitationData.ladder_id)
        .single();

      if (ladderError) throw ladderError;

      if (ladder.auto_approve_registration) {
        const { error: teamError } = await supabase
          .from('ladder_teams')
          .insert({
            ladder_id: invitationData.ladder_id,
            team_name: invitationData.team_name,
            player1_id: senderId,
            player2_id: currentUser.id,
          });

        if (teamError) throw teamError;

        await supabase
          .from('ladder_registration_requests')
          .delete()
          .eq('id', invitationData.registration_request_id);
      } else {
        const { error: updateError } = await supabase
          .from('ladder_registration_requests')
          .update({ 
            status: 'pending',
            partner_id: currentUser.id 
          })
          .eq('id', invitationData.registration_request_id);

        if (updateError) throw updateError;
      }

      await supabase
        .from('ladder_invitations')
        .update({ status: 'accepted' })
        .eq('ladder_id', invitationData.ladder_id)
        .eq('invited_user_id', currentUser.id)
        .eq('invited_by', senderId);

      await supabase
        .from('messages')
        .insert({
          sender_id: currentUser.id,
          receiver_id: senderId,
          content: `I've accepted your invitation to join "${invitationData.ladder_name}"! ${ladder.auto_approve_registration ? 'We\'re now registered.' : 'Waiting for admin approval.'}`,
        });

      setStatus('accepted');
      toast.success(`You've joined ${invitationData.team_name}!`);
      onStatusChange?.();
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      toast.error(error.message || 'Failed to accept invitation');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!currentUser) return;
    
    setIsProcessing(true);
    try {
      await supabase
        .from('ladder_invitations')
        .update({ status: 'declined' })
        .eq('ladder_id', invitationData.ladder_id)
        .eq('invited_user_id', currentUser.id)
        .eq('invited_by', senderId);

      await supabase
        .from('ladder_registration_requests')
        .update({ 
          status: 'partner_declined',
          partner_id: null 
        })
        .eq('id', invitationData.registration_request_id);

      await supabase
        .from('messages')
        .insert({
          sender_id: currentUser.id,
          receiver_id: senderId,
          content: `I'm unable to join "${invitationData.ladder_name}" at this time. You may want to find another partner.`,
        });

      setStatus('declined');
      toast.info('Invitation declined');
      onStatusChange?.();
    } catch (error: any) {
      console.error('Error declining invitation:', error);
      toast.error(error.message || 'Failed to decline invitation');
    } finally {
      setIsProcessing(false);
    }
  };

  const viewLadder = () => {
    navigate(`/leagues-ladders`);
  };

  if (status === 'accepted') {
    return (
      <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <Check className="h-5 w-5" />
            <span className="font-medium">Partnership accepted!</span>
          </div>
          <p className="text-sm text-green-600 dark:text-green-500 mt-1">
            You've joined {invitationData.team_name} for {invitationData.ladder_name}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (status === 'declined') {
    return (
      <Card className="bg-muted border-muted-foreground/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <X className="h-5 w-5" />
            <span className="font-medium">Invitation declined</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-primary/10">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Ladder Partnership Invitation</CardTitle>
              <CardDescription>From {invitationData.inviter_name}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-background">
                <Users className="h-3 w-3 mr-1" />
                Doubles
              </Badge>
              <span className="font-medium">{invitationData.ladder_name}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {invitationData.inviter_name} wants you to join their team 
              <span className="font-medium"> "{invitationData.team_name}"</span>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              onClick={handleAccept} 
              disabled={isProcessing}
              className="flex-1"
            >
              <Check className="h-4 w-4 mr-2" />
              {isProcessing ? 'Processing...' : 'Accept & Join'}
            </Button>
            <Button 
              variant="outline" 
              onClick={handleDecline}
              disabled={isProcessing}
              className="flex-1"
            >
              <X className="h-4 w-4 mr-2" />
              Decline
            </Button>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={viewLadder}
              className="flex-1"
            >
              View Ladder Details
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleSignUp}
              className="flex-1"
            >
              Sign Up Independently
            </Button>
          </div>
        </CardContent>
      </Card>

      {showJoinDialog && ladderData && (
        <LadderJoinDialog
          open={showJoinDialog}
          onOpenChange={setShowJoinDialog}
          ladder={ladderData}
          userNtrp={userNtrp}
          onRegistrationComplete={() => {
            setShowJoinDialog(false);
            onStatusChange?.();
          }}
        />
      )}
    </>
  );
};

export default LadderInvitationMessage;

export const isLadderInvitation = (content: string): LadderInvitationData | null => {
  try {
    const parsed = JSON.parse(content);
    if (parsed.type === 'ladder_partner_invitation') {
      return parsed as LadderInvitationData;
    }
  } catch {
    // Not JSON, regular message
  }
  return null;
};
