import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, PlayCircle, StopCircle, Users, Settings, Trash2, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Competition, CompetitionTeam } from './types';
import LadderLeaderboard from '@/components/ladders/LadderLeaderboard';
import LadderMatches from '@/components/ladders/LadderMatches';
import RegistrationRequests from '@/components/ladders/RegistrationRequests';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

interface Props {
  competition: Competition;
  onBack: () => void;
  onUpdated: () => void;
}

interface PlayerProfile {
  id: string;
  full_name: string | null;
  username: string | null;
  ntrp_rating: number | null;
}

const ManageCompetition = ({ competition, onBack, onUpdated }: Props) => {
  const { currentUser } = useAuth();
  const [teams, setTeams] = useState<CompetitionTeam[]>([]);
  const [profiles, setProfiles] = useState<Record<string, PlayerProfile>>({});
  const [isLoading, setIsLoading] = useState(true);

  const isActive = competition.status === 'active';
  const isSetup = competition.status === 'setup';

  const loadTeams = useCallback(async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('ladder_teams').select('*').eq('ladder_id', competition.id)
      .order('total_points', { ascending: false });
    const teamsData = (data || []) as CompetitionTeam[];
    setTeams(teamsData);

    // Load profiles for all players
    const playerIds = new Set<string>();
    teamsData.forEach(t => {
      playerIds.add(t.player1_id);
      if (t.player2_id) playerIds.add(t.player2_id);
    });

    if (playerIds.size > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, username, ntrp_rating')
        .in('id', Array.from(playerIds));
      
      const profileMap: Record<string, PlayerProfile> = {};
      (profilesData || []).forEach((p: any) => { profileMap[p.id] = p; });
      setProfiles(profileMap);
    }

    setIsLoading(false);
  }, [competition.id]);

  useEffect(() => { loadTeams(); }, [loadTeams]);
  useRealtimeSubscription({ table: 'ladder_teams', event: '*', filter: `ladder_id=eq.${competition.id}`, onChange: loadTeams, enabled: true });

  const handleStart = async () => {
    if (teams.length < 4) { toast.error('Need at least 4 teams to start'); return; }
    try {
      await supabase.from('ladders').update({ status: 'active' }).eq('id', competition.id);
      const { data } = await supabase.rpc('generate_round_robin_matches', { ladder_id_param: competition.id });
      toast.success(`Started! Generated ${data} matches.`);
      onUpdated();
    } catch (error) {
      console.error(error);
      toast.error('Failed to start competition');
    }
  };

  const handleEnd = async () => {
    if (!confirm('End this competition? This cannot be undone.')) return;
    try {
      await supabase.from('ladders').update({ status: 'completed' }).eq('id', competition.id);
      toast.success('Competition ended');
      onUpdated();
    } catch (error) {
      toast.error('Failed to end competition');
    }
  };

  const handleRemoveTeam = async (teamId: string, teamName: string) => {
    if (!confirm(`Remove "${teamName}" from this competition?`)) return;
    try {
      const { error } = await supabase.from('ladder_teams').delete().eq('id', teamId);
      if (error) throw error;
      toast.success(`${teamName} removed`);
      loadTeams();
    } catch (error) {
      console.error(error);
      toast.error('Failed to remove player');
    }
  };

  const getPlayerName = (playerId: string) => {
    const p = profiles[playerId];
    return p?.full_name || p?.username || 'Unknown';
  };

  const getPlayerRating = (playerId: string) => {
    return profiles[playerId]?.ntrp_rating;
  };

  const statusLabel = isSetup ? 'Open for Registration' : isActive ? 'Active' : 'Completed';

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack} className="min-h-[44px]">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{competition.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={isActive ? 'bg-emerald-100 text-emerald-700 border-0' : 'bg-muted text-muted-foreground border-0'}>
              {statusLabel}
            </Badge>
            <span className="text-sm text-muted-foreground capitalize">{competition.format.replace('_', ' ')}</span>
            <span className="text-sm text-muted-foreground">· {teams.length} players</span>
          </div>
        </div>
        <div className="flex gap-2">
          {isSetup && (
            <Button onClick={handleStart} disabled={teams.length < 4} className="bg-compete hover:bg-compete/90 text-compete-foreground min-h-[44px]">
              <PlayCircle className="mr-2 h-4 w-4" /> Start Competition
            </Button>
          )}
          {isActive && (
            <Button onClick={handleEnd} variant="outline" className="min-h-[44px] border-destructive text-destructive hover:bg-destructive/10">
              <StopCircle className="mr-2 h-4 w-4" /> End Competition
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue={isActive ? 'leaderboard' : 'players'} className="w-full">
        <TabsList className="bg-card border-0 shadow-sm p-1 h-auto w-full overflow-x-auto">
          {isActive && (
            <>
              <TabsTrigger value="leaderboard" className="data-[state=active]:bg-foreground data-[state=active]:text-background rounded-lg px-3 py-2 text-xs flex-1">Leaderboard</TabsTrigger>
              <TabsTrigger value="matches" className="data-[state=active]:bg-foreground data-[state=active]:text-background rounded-lg px-3 py-2 text-xs flex-1">Matches</TabsTrigger>
            </>
          )}
          <TabsTrigger value="players" className="data-[state=active]:bg-foreground data-[state=active]:text-background rounded-lg px-3 py-2 text-xs flex-1">Players</TabsTrigger>
          <TabsTrigger value="requests" className="data-[state=active]:bg-foreground data-[state=active]:text-background rounded-lg px-3 py-2 text-xs flex-1">Requests</TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-foreground data-[state=active]:text-background rounded-lg px-3 py-2 text-xs flex-1">Settings</TabsTrigger>
        </TabsList>

        {isActive && (
          <>
            <TabsContent value="leaderboard" className="mt-4">
              <LadderLeaderboard teams={teams} isLoading={isLoading} format={competition.format} />
            </TabsContent>
            <TabsContent value="matches" className="mt-4">
              <LadderMatches ladderId={competition.id} isAdmin={true} teams={teams} />
            </TabsContent>
          </>
        )}

        <TabsContent value="players" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" /> Registered Players ({teams.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {teams.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">No players registered yet</p>
                  <p className="text-sm text-muted-foreground">Players can join from the Browse view.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {teams.map((team) => {
                    const rating = getPlayerRating(team.player1_id);
                    return (
                      <div key={team.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{team.team_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {getPlayerName(team.player1_id)}
                            {competition.format === 'doubles' && team.player2_id && (
                              <> & {getPlayerName(team.player2_id)}</>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            {rating && <span>NTRP {rating}</span>}
                            <span>{team.wins}W-{team.losses}L</span>
                            <span>{team.total_points} pts</span>
                          </div>
                        </div>
                        {(isSetup || isActive) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveTeam(team.id, team.team_name)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 min-h-[44px]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="mt-4">
          {competition.auto_approve_registration && (
            <div className="flex items-start gap-2 p-3 mb-4 rounded-lg bg-muted/50 text-sm text-muted-foreground">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Auto-approve is enabled. New registrations are automatically accepted.</span>
            </div>
          )}
          <RegistrationRequests
            ladderId={competition.id}
            ladderFormat={competition.format}
            onRequestProcessed={loadTeams}
          />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Settings className="h-4 w-4" /> Competition Settings</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 text-sm">
                <div><span className="text-muted-foreground">Format:</span> <span className="font-medium capitalize">{competition.format.replace('_', ' ')}</span></div>
                <div><span className="text-muted-foreground">Max Players:</span> <span className="font-medium">{competition.max_teams || 20}</span></div>
                <div><span className="text-muted-foreground">Scoring:</span> <span className="font-medium capitalize">{competition.scoring_format?.replace('_', ' ') || 'Best of 3'}</span></div>
                <div><span className="text-muted-foreground">3rd Set:</span> <span className="font-medium capitalize">{competition.third_set_format?.replace('_', ' ') || 'Super Tiebreak'}</span></div>
                {competition.min_ntrp && <div><span className="text-muted-foreground">NTRP Range:</span> <span className="font-medium">{competition.min_ntrp}-{competition.max_ntrp}</span></div>}
                {competition.city && <div><span className="text-muted-foreground">Location:</span> <span className="font-medium">{competition.city}</span></div>}
                <div><span className="text-muted-foreground">Auto-approve:</span> <span className="font-medium">{competition.auto_approve_registration ? 'Yes' : 'No'}</span></div>
                <div><span className="text-muted-foreground">Score Confirmation:</span> <span className="font-medium">{competition.require_score_confirmation ? 'Required' : 'Not required'}</span></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ManageCompetition;
