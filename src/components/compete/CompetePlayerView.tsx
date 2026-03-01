import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Calendar, ChevronRight, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Competition } from './types';
import CompetitionCard from './CompetitionCard';
import FilterChips from './FilterChips';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { format } from 'date-fns';

interface CompetePlayerViewProps {
  onSelectCompetition: (c: Competition) => void;
}

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Ladders', value: 'ladder' },
  { label: 'Round Robins', value: 'round_robin' },
  { label: 'Community', value: 'community' },
  { label: 'Public', value: 'public' },
  { label: 'Open', value: 'open' },
];

const CompetePlayerView = ({ onSelectCompetition }: CompetePlayerViewProps) => {
  const { currentUser } = useAuth();
  const [myCompetitions, setMyCompetitions] = useState<Competition[]>([]);
  const [availableCompetitions, setAvailableCompetitions] = useState<Competition[]>([]);
  const [teamCounts, setTeamCounts] = useState<Record<string, number>>({});
  const [myTeamInfo, setMyTeamInfo] = useState<Record<string, { rank: number; nextOpponent: string | null; nextDeadline: string | null }>>({});
  const [filter, setFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!currentUser?.id) return;
    setIsLoading(true);

    try {
      // 1. Find competitions where user is on a team
      const { data: myTeams } = await supabase
        .from('ladder_teams')
        .select('ladder_id, id, total_points')
        .or(`player1_id.eq.${currentUser.id},player2_id.eq.${currentUser.id}`);

      const myLadderIds = myTeams?.map(t => t.ladder_id) || [];
      
      let myComps: Competition[] = [];
      if (myLadderIds.length > 0) {
        const { data } = await supabase
          .from('ladders')
          .select('*')
          .in('id', myLadderIds)
          .in('status', ['active', 'setup']);
        myComps = (data || []) as Competition[];
      }
      setMyCompetitions(myComps);

      // Build rank info for my competitions
      const teamInfo: Record<string, { rank: number; nextOpponent: string | null; nextDeadline: string | null }> = {};
      for (const comp of myComps) {
        const { data: allTeams } = await supabase
          .from('ladder_teams')
          .select('id, player1_id, player2_id, total_points, team_name')
          .eq('ladder_id', comp.id)
          .order('total_points', { ascending: false });

        const myTeam = allTeams?.find(t => t.player1_id === currentUser.id || t.player2_id === currentUser.id);
        const rank = myTeam ? (allTeams?.indexOf(myTeam) || 0) + 1 : 0;

        // Find next upcoming match
        let nextOpponent: string | null = null;
        let nextDeadline: string | null = null;
        if (myTeam) {
          const { data: nextMatch } = await supabase
            .from('ladder_matches')
            .select('team1_id, team2_id, deadline_date')
            .eq('ladder_id', comp.id)
            .eq('status', 'pending')
            .or(`team1_id.eq.${myTeam.id},team2_id.eq.${myTeam.id}`)
            .order('deadline_date', { ascending: true })
            .limit(1);

          if (nextMatch && nextMatch.length > 0) {
            const opponentId = nextMatch[0].team1_id === myTeam.id ? nextMatch[0].team2_id : nextMatch[0].team1_id;
            const opponentTeam = allTeams?.find(t => t.id === opponentId);
            nextOpponent = opponentTeam?.team_name || null;
            nextDeadline = nextMatch[0].deadline_date;
          }
        }
        teamInfo[comp.id] = { rank, nextOpponent, nextDeadline };
      }
      setMyTeamInfo(teamInfo);

      // 2. Load available competitions (from user's HOA + public ones)
      let query = supabase.from('ladders').select('*').in('status', ['setup', 'active']);
      
      if (currentUser.hoaId) {
        // User can see their HOA's ladders
        query = query.eq('hoa_id', currentUser.hoaId);
      }

      const { data: available } = await query.order('created_at', { ascending: false });
      // Filter out ones user is already in
      const filtered = (available || []).filter(a => !myLadderIds.includes(a.id)) as Competition[];
      setAvailableCompetitions(filtered);

      // 3. Load team counts
      const allIds = [...myLadderIds, ...filtered.map(f => f.id)];
      if (allIds.length > 0) {
        const { data: teams } = await supabase
          .from('ladder_teams')
          .select('ladder_id')
          .in('ladder_id', allIds);
        const counts: Record<string, number> = {};
        teams?.forEach(t => { counts[t.ladder_id] = (counts[t.ladder_id] || 0) + 1; });
        setTeamCounts(counts);
      }
    } catch (error) {
      console.error('Error loading compete data:', error);
      toast.error('Failed to load competitions');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id, currentUser?.hoaId]);

  useEffect(() => { loadData(); }, [loadData]);

  useRealtimeSubscription({
    table: 'ladders',
    event: '*',
    onChange: loadData,
    enabled: !!currentUser?.id
  });

  const filteredAvailable = availableCompetitions.filter(c => {
    if (filter === 'all') return true;
    if (filter === 'community') return c.hoa_only;
    if (filter === 'public') return !c.hoa_only && !c.is_private;
    if (filter === 'open') return c.status === 'setup';
    // ladder vs round_robin - for now all are round_robin by scoring_mode
    if (filter === 'ladder') return c.scoring_mode === 'challenge';
    if (filter === 'round_robin') return c.scoring_mode !== 'challenge';
    return true;
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse border-0 shadow-sm">
            <CardContent className="p-6"><div className="h-24 bg-muted rounded" /></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* My Active Competitions */}
      <section>
        <h2 className="text-lg font-bold text-foreground mb-4">My Active Competitions</h2>
        {myCompetitions.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-14 w-14 bg-compete-light rounded-2xl flex items-center justify-center mb-3">
                <Trophy className="h-7 w-7 text-compete" />
              </div>
              <p className="text-sm text-muted-foreground max-w-xs">
                You are not in any active competitions yet. Browse below to join one.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {myCompetitions.map(comp => {
              const info = myTeamInfo[comp.id];
              return (
                <Card key={comp.id} className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => onSelectCompetition(comp)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-sm truncate">{comp.name}</h3>
                          <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs flex-shrink-0">
                            {comp.status === 'active' ? 'Active' : 'Registration'}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {info?.rank > 0 && <span className="font-medium text-compete">Rank #{info.rank}</span>}
                          {info?.nextOpponent && (
                            <span>Next: vs {info.nextOpponent}</span>
                          )}
                          {info?.nextDeadline && (
                            <span className="flex items-center gap-0.5">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(info.nextDeadline), 'MMM d')}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Available to Join */}
      <section>
        <h2 className="text-lg font-bold text-foreground mb-4">Available to Join</h2>
        <FilterChips filters={FILTERS} activeFilter={filter} onChange={setFilter} />
        
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
          {filteredAvailable.length === 0 ? (
            <Card className="border-0 shadow-sm col-span-full">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No competitions found matching your filters.</p>
              </CardContent>
            </Card>
          ) : (
            filteredAvailable.map(comp => (
              <CompetitionCard
                key={comp.id}
                competition={comp}
                onSelect={onSelectCompetition}
                teamCount={teamCounts[comp.id] || 0}
                showCreator
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
};

export default CompetePlayerView;
