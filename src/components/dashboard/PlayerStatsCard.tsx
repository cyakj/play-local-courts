import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Trophy, 
  Target,
  TrendingUp,
  Medal
} from 'lucide-react';
import { subDays, format } from 'date-fns';

interface PlayerStats {
  matchesPlayed: number;
  wins: number;
  losses: number;
  ladderPositions: { ladderName: string; position: number }[];
}

export const PlayerStatsCard = () => {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState<PlayerStats>({
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    ladderPositions: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      loadPlayerStats();
    }
  }, [currentUser]);

  const loadPlayerStats = async () => {
    if (!currentUser) return;
    
    try {
      const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');

      // Get matches played in last 30 days
      const { data: matches } = await supabase
        .from('matches')
        .select('id, winner_id, player1_id, player2_id')
        .or(`player1_id.eq.${currentUser.id},player2_id.eq.${currentUser.id}`)
        .gte('date', thirtyDaysAgo);

      const matchesPlayed = matches?.length || 0;
      const wins = matches?.filter(m => m.winner_id === currentUser.id).length || 0;
      const losses = matchesPlayed - wins;

      // Get ladder positions
      const { data: teams } = await supabase
        .from('ladder_teams')
        .select(`
          id,
          team_name,
          total_points,
          ladder_id,
          ladders (
            id,
            name,
            status
          )
        `)
        .or(`player1_id.eq.${currentUser.id},player2_id.eq.${currentUser.id}`);

      const ladderPositions: { ladderName: string; position: number }[] = [];

      if (teams) {
        for (const team of teams) {
          if (team.ladders && (team.ladders as any).status === 'active') {
            // Get position by counting teams with more points
            const { count } = await supabase
              .from('ladder_teams')
              .select('id', { count: 'exact' })
              .eq('ladder_id', team.ladder_id)
              .gt('total_points', team.total_points);

            ladderPositions.push({
              ladderName: (team.ladders as any).name,
              position: (count || 0) + 1
            });
          }
        }
      }

      setStats({
        matchesPlayed,
        wins,
        losses,
        ladderPositions
      });
    } catch (error) {
      console.error('Error loading player stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const winRate = stats.matchesPlayed > 0 
    ? Math.round((stats.wins / stats.matchesPlayed) * 100) 
    : 0;

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader className="pb-3">
          <div className="h-5 bg-muted rounded w-1/3"></div>
        </CardHeader>
        <CardContent>
          <div className="h-20 bg-muted rounded"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-compete/5 to-compete/10">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-compete" />
          Your Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-foreground">{stats.matchesPlayed}</div>
            <div className="text-xs text-muted-foreground">Matches (30d)</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{stats.wins}</div>
            <div className="text-xs text-muted-foreground">Wins</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-muted-foreground">{stats.losses}</div>
            <div className="text-xs text-muted-foreground">Losses</div>
          </div>
        </div>

        {stats.matchesPlayed > 0 && (
          <div className="flex items-center gap-2 p-3 bg-compete/5 rounded-lg mb-4">
            <Target className="h-4 w-4 text-compete" />
            <span className="text-sm">Win Rate: <span className="font-bold text-compete">{winRate}%</span></span>
          </div>
        )}

        {stats.ladderPositions.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium flex items-center gap-2">
              <Medal className="h-4 w-4 text-amber-500" />
              Ladder Standings
            </div>
            {stats.ladderPositions.map((pos, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                <span className="truncate">{pos.ladderName}</span>
                <span className="font-bold text-compete">#{pos.position}</span>
              </div>
            ))}
          </div>
        )}

        {stats.matchesPlayed === 0 && stats.ladderPositions.length === 0 && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            <Trophy className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Play matches to track your stats!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
