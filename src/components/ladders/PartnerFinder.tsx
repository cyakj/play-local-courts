import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserPlus, Users, Trophy, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Ladder } from '@/pages/LeaguesLadders';

interface LookingForPartner {
  id: string;
  player_id: string;
  team_name: string;
  created_at: string;
  player_name?: string;
  player_ntrp?: number | null;
  player_avatar?: string | null;
}

interface PartnerFinderProps {
  ladder: Ladder;
  onTeamFormed: () => void;
}

const PartnerFinder = ({ ladder, onTeamFormed }: PartnerFinderProps) => {
  const { currentUser } = useAuth();
  const [seekers, setSeekers] = useState<LookingForPartner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMatching, setIsMatching] = useState(false);

  useEffect(() => {
    loadSeekers();
  }, [ladder.id]);

  const loadSeekers = async () => {
    try {
      setIsLoading(true);
      
      const { data: requestsData, error } = await supabase
        .from('ladder_registration_requests')
        .select('id, player_id, team_name, created_at')
        .eq('ladder_id', ladder.id)
        .eq('looking_for_partner', true)
        .eq('status', 'pending')
        .neq('player_id', currentUser?.id || '')
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (requestsData && requestsData.length > 0) {
        const playerIds = requestsData.map(r => r.player_id);

        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, ntrp_rating, avatar_url')
          .in('id', playerIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        const enrichedSeekers: LookingForPartner[] = requestsData.map(request => ({
          ...request,
          player_name: profileMap.get(request.player_id)?.full_name || 'Unknown',
          player_ntrp: profileMap.get(request.player_id)?.ntrp_rating,
          player_avatar: profileMap.get(request.player_id)?.avatar_url,
        }));

        setSeekers(enrichedSeekers);
      } else {
        setSeekers([]);
      }
    } catch (error) {
      console.error('Error loading partner seekers:', error);
      toast.error('Failed to load partner seekers');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePairUp = async (seeker: LookingForPartner) => {
    if (!currentUser?.id) return;

    setIsMatching(true);
    try {
      // Update the original request to add this user as partner
      const { error: updateError } = await supabase
        .from('ladder_registration_requests')
        .update({
          partner_id: currentUser.id,
          looking_for_partner: false,
          team_name: `${seeker.player_name} & ${currentUser.fullName}`,
        })
        .eq('id', seeker.id);

      if (updateError) throw updateError;

      // If ladder auto-approves, create the team directly
      if (ladder.auto_approve_registration) {
        const { error: teamError } = await supabase
          .from('ladder_teams')
          .insert({
            ladder_id: ladder.id,
            team_name: `${seeker.player_name} & ${currentUser.fullName}`,
            player1_id: seeker.player_id,
            player2_id: currentUser.id,
          });

        if (teamError) throw teamError;

        // Update request to approved
        await supabase
          .from('ladder_registration_requests')
          .update({ status: 'approved' })
          .eq('id', seeker.id);

        toast.success('Team formed and added to ladder!');
      } else {
        toast.success('Paired with partner! Waiting for admin approval.');
      }

      loadSeekers();
      onTeamFormed();
    } catch (error: any) {
      console.error('Error pairing up:', error);
      toast.error(error.message || 'Failed to pair up with partner');
    } finally {
      setIsMatching(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => (
          <Card key={i}>
            <CardContent className="p-4 flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-4 w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (seekers.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <UserPlus className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-center">
            No players are currently looking for partners in this ladder.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Register as "Looking for Partner" and we'll match you when someone joins!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Players Looking for Partners
        </h3>
        <Badge variant="secondary">{seekers.length} available</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {seekers.map(seeker => (
          <Card key={seeker.id}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={seeker.player_avatar || undefined} />
                  <AvatarFallback>
                    {seeker.player_name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1">
                  <div className="font-medium">{seeker.player_name}</div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {seeker.player_ntrp && (
                      <span className="flex items-center gap-1">
                        <Trophy className="h-3.5 w-3.5" />
                        NTRP {seeker.player_ntrp}
                      </span>
                    )}
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={() => handlePairUp(seeker)}
                  disabled={isMatching}
                >
                  <Users className="h-4 w-4 mr-1" />
                  Pair Up
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PartnerFinder;
