import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageSquare, X, Check, Users, Eye, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export type PartnerState = 'looking' | 'request_sent' | 'request_received' | 'confirmed' | null;

export interface PartnerProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  ntrp_rating: number | null;
  community: string;
  playing_style?: string | null;
  preferred_court_side?: string | null;
}

interface PartnerStatusBannerProps {
  state: PartnerState;
  partnerProfile: PartnerProfile | null;
  registrationRequestId: string | null;
  invitationId: string | null;
  competitionId: string;
  onStatusChange: () => void;
}

const PartnerStatusBanner = ({
  state,
  partnerProfile,
  registrationRequestId,
  invitationId,
  competitionId,
  onStatusChange,
}: PartnerStatusBannerProps) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  if (!state) return null;

  const handleLeavePool = async () => {
    if (!registrationRequestId) return;
    setIsLoading(true);
    try {
      await supabase
        .from('ladder_registration_requests')
        .delete()
        .eq('id', registrationRequestId);
      toast.success('You have left the partner pool.');
      onStatusChange();
    } catch (err) {
      toast.error('Failed to leave partner pool.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!registrationRequestId) return;
    setIsLoading(true);
    try {
      // Delete the invitation
      if (invitationId) {
        await supabase.from('ladder_invitations').delete().eq('id', invitationId);
      }
      // Delete the registration request
      await supabase
        .from('ladder_registration_requests')
        .delete()
        .eq('id', registrationRequestId);
      toast.success('Partner request cancelled.');
      onStatusChange();
    } catch (err) {
      toast.error('Failed to cancel request.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!invitationId || !registrationRequestId || !partnerProfile) return;
    setIsLoading(true);
    try {
      // Update invitation status
      await supabase
        .from('ladder_invitations')
        .update({ status: 'accepted' })
        .eq('id', invitationId);

      // Get the registration request to create the team
      const { data: regRequest } = await supabase
        .from('ladder_registration_requests')
        .select('*')
        .eq('id', registrationRequestId)
        .single();

      if (regRequest) {
        // Create the team
        await supabase.from('ladder_teams').insert({
          ladder_id: competitionId,
          team_name: regRequest.team_name,
          player1_id: regRequest.player_id,
          player2_id: currentUser?.id,
        });

        // Update registration request status
        await supabase
          .from('ladder_registration_requests')
          .update({ status: 'approved' })
          .eq('id', registrationRequestId);
      }

      toast.success('Partner request accepted! Your team is confirmed.');
      onStatusChange();
    } catch (err) {
      toast.error('Failed to accept request.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!invitationId) return;
    setIsLoading(true);
    try {
      await supabase
        .from('ladder_invitations')
        .update({ status: 'declined' })
        .eq('id', invitationId);

      // Update the registration request back to pending so the requester can try again
      if (registrationRequestId) {
        await supabase
          .from('ladder_registration_requests')
          .update({ status: 'pending', partner_id: null })
          .eq('id', registrationRequestId);
      }

      toast.success('Partner request declined.');
      onStatusChange();
    } catch (err) {
      toast.error('Failed to decline request.');
    } finally {
      setIsLoading(false);
    }
  };

  const openMessage = () => {
    if (partnerProfile?.id) {
      navigate(`/messages?user=${partnerProfile.id}`);
    }
  };

  if (state === 'looking') {
    return (
      <Card className="border-0 shadow-sm bg-muted/60">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Badge className="bg-muted-foreground/20 text-muted-foreground border-0 shrink-0">
              <Eye className="h-3 w-3 mr-1" /> Looking for Partner
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            You are visible in the partner pool for this competition.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLeavePool}
            disabled={isLoading}
            className="min-h-[44px]"
          >
            <X className="h-4 w-4 mr-1" /> Leave Partner Pool
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (state === 'request_sent') {
    return (
      <Card className="border-0 shadow-sm bg-yellow-50 dark:bg-yellow-950/20">
        <CardContent className="p-4 space-y-3">
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-0">
            <Clock className="h-3 w-3 mr-1" /> Partner Request Pending
          </Badge>
          <p className="text-sm text-muted-foreground">
            Waiting for <span className="font-medium text-foreground">{partnerProfile?.full_name || 'your partner'}</span> to respond.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelRequest}
              disabled={isLoading}
              className="min-h-[44px]"
            >
              <X className="h-4 w-4 mr-1" /> Cancel Request
            </Button>
            {partnerProfile && (
              <Button
                variant="outline"
                size="sm"
                onClick={openMessage}
                className="min-h-[44px]"
              >
                <MessageSquare className="h-4 w-4 mr-1" /> Message {partnerProfile.full_name?.split(' ')[0]}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (state === 'request_received') {
    return (
      <Card className="border-0 shadow-sm bg-blue-50 dark:bg-blue-950/20">
        <CardContent className="p-4 space-y-3">
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-0">
            <Users className="h-3 w-3 mr-1" /> Partner Request Received
          </Badge>
          {partnerProfile && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-background/80">
              <Avatar className="h-12 w-12">
                <AvatarImage src={partnerProfile.avatar_url || undefined} />
                <AvatarFallback>{(partnerProfile.full_name || 'U').charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">{partnerProfile.full_name}</p>
                {partnerProfile.community && (
                  <p className="text-xs text-muted-foreground">{partnerProfile.community}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-1">
                  {partnerProfile.ntrp_rating && (
                    <Badge variant="outline" className="text-xs">NTRP {partnerProfile.ntrp_rating}</Badge>
                  )}
                  {partnerProfile.playing_style && (
                    <Badge variant="outline" className="text-xs capitalize">{partnerProfile.playing_style}</Badge>
                  )}
                  {partnerProfile.preferred_court_side && (
                    <Badge variant="outline" className="text-xs capitalize">{partnerProfile.preferred_court_side} Court</Badge>
                  )}
                </div>
              </div>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{partnerProfile?.full_name}</span> wants to be your partner in this competition.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={handleAccept}
              disabled={isLoading}
              className="min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Check className="h-4 w-4 mr-1" /> Accept
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDecline}
              disabled={isLoading}
              className="min-h-[44px]"
            >
              <X className="h-4 w-4 mr-1" /> Decline
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (state === 'confirmed') {
    return (
      <Card className="border-0 shadow-sm bg-emerald-50 dark:bg-emerald-950/20">
        <CardContent className="p-4 space-y-3">
          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border-0">
            <Check className="h-3 w-3 mr-1" /> Team Confirmed
          </Badge>
          {partnerProfile && (
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={partnerProfile.avatar_url || undefined} />
                <AvatarFallback>{(partnerProfile.full_name || 'U').charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">{partnerProfile.full_name}</p>
                {partnerProfile.community && (
                  <p className="text-xs text-muted-foreground">{partnerProfile.community}</p>
                )}
              </div>
            </div>
          )}
          {partnerProfile && (
            <Button
              variant="outline"
              size="sm"
              onClick={openMessage}
              className="min-h-[44px]"
            >
              <MessageSquare className="h-4 w-4 mr-1" /> Message Partner
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return null;
};

export default PartnerStatusBanner;
