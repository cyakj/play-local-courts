import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, UserPlus, Trophy, Calendar, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Competition, CompetitionTeam } from './types';
import LadderLeaderboard from '@/components/ladders/LadderLeaderboard';
import LadderMatches from '@/components/ladders/LadderMatches';
import LadderRules from '@/components/ladders/LadderRules';
import LadderJoinDialog from '@/components/ladders/LadderJoinDialog';
import NtrpRequiredAlert from '@/components/ladders/NtrpRequiredAlert';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  competition: Competition;
  onBack: () => void;
}

const CompetitionDetailPlayer = ({ competition, onBack }: Props) => {
  const { currentUser } = useAuth();
  const [teams, setTeams] = useState<CompetitionTeam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnTeam, setIsOnTeam] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [userNtrp, setUserNtrp] = useState<number | null>(null);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showNtrpAlert, setShowNtrpAlert] = useState(false);
  const [eligibilityIssue, setEligibilityIssue] = useState<string | null>(null);
  const [playerProfiles, setPlayerProfiles] = useState<Record<string, string>>({});

  const isActive = competition.status === 'active';

  const loadTeams = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('ladder_teams')
        .select('*')
        .eq('ladder_id', competition.id)
        .order('total_points', { ascending: false });
      setTeams((data || []) as CompetitionTeam[]);

      // Load player names
      const playerIds = new Set<string>();
      data?.forEach(t => { playerIds.add(t.player1_id); if (t.player2_id) playerIds.add(t.player2_id); });
      if (playerIds.size > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', Array.from(playerIds));
        const map: Record<string, string> = {};
        profiles?.forEach(p => { map[p.id] = p.full_name || 'Unknown'; });
        setPlayerProfiles(map);
      }
    } catch (error) {
      console.error('Error loading teams:', error);
    } finally {
      setIsLoading(false);
    }
  }, [competition.id]);

  const checkUserStatus = useCallback(async () => {
    if (!currentUser?.id) return;

    const { data: profile } = await supabase.from('profiles').select('ntrp_rating').eq('id', currentUser.id).single();
    setUserNtrp(profile?.ntrp_rating || null);

    const { data: teamData } = await supabase
      .from('ladder_teams').select('id').eq('ladder_id', competition.id)
      .or(`player1_id.eq.${currentUser.id},player2_id.eq.${currentUser.id}`).limit(1);
    setIsOnTeam((teamData?.length || 0) > 0);

    const { data: requestData } = await supabase
      .from('ladder_registration_requests').select('id').eq('ladder_id', competition.id)
      .eq('player_id', currentUser.id).eq('status', 'pending').limit(1);
    setHasPendingRequest((requestData?.length || 0) > 0);

    // Check eligibility
    let issue: string | null = null;
    if (competition.min_ntrp && profile?.ntrp_rating && profile.ntrp_rating < competition.min_ntrp) {
      issue = `Your NTRP rating of ${profile.ntrp_rating} does not meet the minimum requirement of ${competition.min_ntrp}`;
    } else if (competition.max_ntrp && profile?.ntrp_rating && profile.ntrp_rating > competition.max_ntrp) {
      issue = `Your NTRP rating of ${profile.ntrp_rating} exceeds the maximum of ${competition.max_ntrp}`;
    } else if (competition.hoa_only && competition.hoa_id && currentUser.hoaId !== competition.hoa_id) {
      issue = `This competition is only open to members of the hosting community.`;
    }
    setEligibilityIssue(issue);
  }, [currentUser?.id, competition]);

  useEffect(() => { loadTeams(); checkUserStatus(); }, [loadTeams, checkUserStatus]);

  useRealtimeSubscription({ table: 'ladder_teams', event: '*', filter: `ladder_id=eq.${competition.id}`, onChange: loadTeams, enabled: true });

  const canSignUp = !isOnTeam && !hasPendingRequest && !eligibilityIssue && (competition.status === 'setup' || competition.status === 'active');

  const handleJoinClick = () => {
    if ((competition.min_ntrp || competition.max_ntrp) && !userNtrp) {
      setShowNtrpAlert(true);
      return;
    }
    setShowJoinDialog(true);
  };

  const statusLabel = competition.status === 'setup' ? 'Open for Registration' : competition.status === 'active' ? 'Active' : 'Completed';

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack} className="min-h-[44px]">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground">{competition.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge className={competition.status === 'active' ? 'bg-emerald-100 text-emerald-700 border-0' : 'bg-muted text-muted-foreground border-0'}>
              {statusLabel}
            </Badge>
            <span className="text-sm text-muted-foreground capitalize">{competition.format.replace('_', ' ')}</span>
            {competition.city && <span className="text-sm text-muted-foreground">· {competition.city}</span>}
          </div>
          {competition.description && <p className="text-sm text-muted-foreground mt-2">{competition.description}</p>}
        </div>

        <div className="flex gap-2 flex-shrink-0">
          {isOnTeam && <Badge variant="secondary" className="px-3 py-2 min-h-[44px] flex items-center">You're Registered</Badge>}
          {hasPendingRequest && <Badge variant="outline" className="px-3 py-2 min-h-[44px] flex items-center">Registration Pending</Badge>}
          {!isOnTeam && !hasPendingRequest && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button onClick={handleJoinClick} disabled={!canSignUp} className="bg-compete hover:bg-compete/90 text-compete-foreground min-h-[44px]">
                      <UserPlus className="mr-2 h-4 w-4" /> Sign Up
                    </Button>
                  </span>
                </TooltipTrigger>
                {eligibilityIssue && <TooltipContent><p className="max-w-xs text-sm">{eligibilityIssue}</p></TooltipContent>}
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={isActive ? 'leaderboard' : 'rules'} className="w-full">
        <TabsList className="bg-card border-0 shadow-sm p-1 h-auto w-full overflow-x-auto">
          {isActive && (
            <>
              <TabsTrigger value="leaderboard" className="data-[state=active]:bg-foreground data-[state=active]:text-background rounded-lg px-3 py-2 text-xs flex-1">
                Leaderboard
              </TabsTrigger>
              <TabsTrigger value="matches" className="data-[state=active]:bg-foreground data-[state=active]:text-background rounded-lg px-3 py-2 text-xs flex-1">
                Matches
              </TabsTrigger>
            </>
          )}
          <TabsTrigger value="players" className="data-[state=active]:bg-foreground data-[state=active]:text-background rounded-lg px-3 py-2 text-xs flex-1">
            Players
          </TabsTrigger>
          <TabsTrigger value="rules" className="data-[state=active]:bg-foreground data-[state=active]:text-background rounded-lg px-3 py-2 text-xs flex-1">
            Rules
          </TabsTrigger>
        </TabsList>

        {isActive && (
          <>
            <TabsContent value="leaderboard" className="mt-4">
              <LadderLeaderboard teams={teams} isLoading={isLoading} format={competition.format} />
            </TabsContent>
            <TabsContent value="matches" className="mt-4">
              <LadderMatches ladderId={competition.id} isAdmin={false} teams={teams} />
            </TabsContent>
          </>
        )}

        <TabsContent value="players" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-base">Registered Players ({teams.length})</CardTitle></CardHeader>
            <CardContent>
              {teams.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No players registered yet.</p>
              ) : (
                <div className="space-y-2">
                  {teams.map((team, idx) => (
                    <div key={team.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-6">#{idx + 1}</span>
                        <div>
                          <p className="text-sm font-medium">{team.team_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {playerProfiles[team.player1_id] || 'Player'}
                            {team.player2_id && ` & ${playerProfiles[team.player2_id] || 'Partner'}`}
                          </p>
                        </div>
                      </div>
                      {isActive && <Badge variant="secondary" className="text-xs">{team.total_points} pts</Badge>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="mt-4">
          <LadderRules />
        </TabsContent>
      </Tabs>

      <LadderJoinDialog
        open={showJoinDialog} onOpenChange={setShowJoinDialog}
        ladder={competition as any} userNtrp={userNtrp}
        onRegistrationComplete={() => { checkUserStatus(); loadTeams(); }}
      />
      <NtrpRequiredAlert open={showNtrpAlert} onOpenChange={setShowNtrpAlert} />
    </div>
  );
};

export default CompetitionDetailPlayer;
