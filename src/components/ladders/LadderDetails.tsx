
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Settings, Users, PlayCircle, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Ladder } from '@/pages/LeaguesLadders';
import LadderTeams from './LadderTeams';
import LadderMatches from './LadderMatches';
import LadderLeaderboard from './LadderLeaderboard';
import LadderRules from './LadderRules';
import RegistrationRequests from './RegistrationRequests';
import LadderJoinDialog from './LadderJoinDialog';
import NtrpRequiredAlert from './NtrpRequiredAlert';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

interface LadderDetailsProps {
  ladder: Ladder;
  onBack: () => void;
  onLadderUpdated: () => void;
}

export interface LadderTeam {
  id: string;
  ladder_id: string;
  team_name: string;
  player1_id: string;
  player2_id: string | null;
  total_points: number;
  wins: number;
  losses: number;
  games_played: number;
  created_at: string;
}

const LadderDetails = ({ ladder, onBack, onLadderUpdated }: LadderDetailsProps) => {
  const { currentUser } = useAuth();
  const [teams, setTeams] = useState<LadderTeam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showNtrpAlert, setShowNtrpAlert] = useState(false);
  const [userNtrp, setUserNtrp] = useState<number | null>(null);
  const [isOnTeam, setIsOnTeam] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);

  const isAdmin = ladder.admin_id === currentUser?.id;

  const loadTeamsCallback = useCallback(() => {
    loadTeams();
  }, [ladder.id]);

  // Real-time subscription for team updates (new teams joining, points updates)
  useRealtimeSubscription({
    table: 'ladder_teams',
    event: '*',
    filter: `ladder_id=eq.${ladder.id}`,
    onChange: loadTeamsCallback,
    enabled: true
  });

  // Real-time subscription for match updates (score submissions)
  useRealtimeSubscription({
    table: 'ladder_matches',
    event: '*',
    filter: `ladder_id=eq.${ladder.id}`,
    onChange: loadTeamsCallback, // Reload teams when matches are updated (for points)
    enabled: true
  });

  useEffect(() => {
    loadTeams();
    checkUserStatus();
  }, [ladder.id, currentUser?.id]);

  const checkUserStatus = async () => {
    if (!currentUser?.id) return;

    // Get user's NTRP rating
    const { data: profile } = await supabase
      .from('profiles')
      .select('ntrp_rating')
      .eq('id', currentUser.id)
      .single();
    
    setUserNtrp(profile?.ntrp_rating || null);

    // Check if user is already on a team
    const { data: teamData } = await supabase
      .from('ladder_teams')
      .select('id')
      .eq('ladder_id', ladder.id)
      .or(`player1_id.eq.${currentUser.id},player2_id.eq.${currentUser.id}`)
      .limit(1);
    
    setIsOnTeam((teamData?.length || 0) > 0);

    // Check if user has a pending registration request
    const { data: requestData } = await supabase
      .from('ladder_registration_requests')
      .select('id')
      .eq('ladder_id', ladder.id)
      .eq('player_id', currentUser.id)
      .eq('status', 'pending')
      .limit(1);
    
    setHasPendingRequest((requestData?.length || 0) > 0);
  };

  const loadTeams = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('ladder_teams')
        .select('*')
        .eq('ladder_id', ladder.id)
        .order('total_points', { ascending: false });

      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error('Error loading teams:', error);
      toast.error('Failed to load teams');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartLadder = async () => {
    if (teams.length < 4) {
      toast.error('Need at least 4 teams to start the ladder');
      return;
    }

    try {
      // Update ladder status to active
      const { error: updateError } = await supabase
        .from('ladders')
        .update({ status: 'active' })
        .eq('id', ladder.id);

      if (updateError) throw updateError;

      // Generate round-robin matches
      const { data, error: matchError } = await supabase.rpc(
        'generate_round_robin_matches',
        { ladder_id_param: ladder.id }
      );

      if (matchError) throw matchError;

      toast.success(`Ladder started! Generated ${data} matches.`);
      onLadderUpdated();
    } catch (error) {
      console.error('Error starting ladder:', error);
      toast.error('Failed to start ladder');
    }
  };

  const handleJoinClick = () => {
    // Check if ladder has NTRP requirements
    const hasNtrpRequirement = ladder.min_ntrp || ladder.max_ntrp;
    
    if (hasNtrpRequirement && !userNtrp) {
      setShowNtrpAlert(true);
      return;
    }
    
    setShowJoinDialog(true);
  };

  const canJoin = !isOnTeam && !hasPendingRequest && (ladder.status === 'setup' || ladder.status === 'active');

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Ladders
        </Button>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">{ladder.name}</h1>
          <div className="flex items-center gap-4">
            <Badge variant={
              ladder.status === 'active' ? 'default' :
              ladder.status === 'completed' ? 'secondary' : 'outline'
            }>
              {ladder.status}
            </Badge>
            <span className="text-sm text-muted-foreground capitalize">
              {ladder.format} Format
            </span>
            {ladder.is_private && (
              <span className="text-sm text-muted-foreground">Private</span>
            )}
          </div>
          {ladder.description && (
            <p className="text-muted-foreground mt-2">{ladder.description}</p>
          )}
        </div>

        <div className="flex gap-2">
          {!isAdmin && canJoin && (
            <Button onClick={handleJoinClick} variant="default">
              <UserPlus className="mr-2 h-4 w-4" />
              Join Ladder
            </Button>
          )}
          {!isAdmin && hasPendingRequest && (
            <Badge variant="outline" className="px-3 py-2">
              Registration Pending
            </Badge>
          )}
          {!isAdmin && isOnTeam && (
            <Badge variant="secondary" className="px-3 py-2">
              You're Registered
            </Badge>
          )}
          {isAdmin && ladder.status === 'setup' && (
            <Button onClick={handleStartLadder} disabled={teams.length < 4}>
              <PlayCircle className="mr-2 h-4 w-4" />
              Start Ladder
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="leaderboard" className="w-full">
        <TabsList>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="matches">Matches</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          {isAdmin && <TabsTrigger value="requests">Requests</TabsTrigger>}
        </TabsList>

        <TabsContent value="leaderboard" className="mt-6">
          <LadderLeaderboard 
            teams={teams} 
            isLoading={isLoading}
            format={ladder.format}
          />
        </TabsContent>

        <TabsContent value="matches" className="mt-6">
          <LadderMatches 
            ladderId={ladder.id}
            isAdmin={isAdmin}
            teams={teams}
          />
        </TabsContent>

        <TabsContent value="teams" className="mt-6">
          <LadderTeams 
            ladder={ladder}
            teams={teams}
            onTeamsUpdated={loadTeams}
            isAdmin={isAdmin}
          />
        </TabsContent>

        <TabsContent value="rules" className="mt-6">
          <LadderRules />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="requests" className="mt-6">
            <RegistrationRequests 
              ladderId={ladder.id}
              ladderFormat={ladder.format}
              onRequestProcessed={() => {
                loadTeams();
                checkUserStatus();
              }}
            />
          </TabsContent>
        )}
      </Tabs>

      <LadderJoinDialog
        open={showJoinDialog}
        onOpenChange={setShowJoinDialog}
        ladder={ladder}
        userNtrp={userNtrp}
        onRegistrationComplete={() => {
          checkUserStatus();
          loadTeams();
        }}
      />

      <NtrpRequiredAlert
        open={showNtrpAlert}
        onOpenChange={setShowNtrpAlert}
      />
    </div>
  );
};

export default LadderDetails;
