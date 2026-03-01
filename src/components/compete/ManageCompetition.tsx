import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, PlayCircle, StopCircle, Users, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Competition, CompetitionTeam } from './types';
import LadderLeaderboard from '@/components/ladders/LadderLeaderboard';
import LadderMatches from '@/components/ladders/LadderMatches';
import LadderTeams from '@/components/ladders/LadderTeams';
import RegistrationRequests from '@/components/ladders/RegistrationRequests';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

interface Props {
  competition: Competition;
  onBack: () => void;
  onUpdated: () => void;
}

const ManageCompetition = ({ competition, onBack, onUpdated }: Props) => {
  const { currentUser } = useAuth();
  const [teams, setTeams] = useState<CompetitionTeam[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isActive = competition.status === 'active';
  const isSetup = competition.status === 'setup';

  const loadTeams = useCallback(async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('ladder_teams').select('*').eq('ladder_id', competition.id)
      .order('total_points', { ascending: false });
    setTeams((data || []) as CompetitionTeam[]);
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
          {!competition.auto_approve_registration && (
            <TabsTrigger value="requests" className="data-[state=active]:bg-foreground data-[state=active]:text-background rounded-lg px-3 py-2 text-xs flex-1">Requests</TabsTrigger>
          )}
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
          <LadderTeams ladder={competition as any} teams={teams} onTeamsUpdated={loadTeams} isAdmin={true} />
        </TabsContent>

        {!competition.auto_approve_registration && (
          <TabsContent value="requests" className="mt-4">
            <RegistrationRequests
              ladderId={competition.id}
              ladderFormat={competition.format}
              onRequestProcessed={loadTeams}
            />
          </TabsContent>
        )}

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
