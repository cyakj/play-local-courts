
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award } from 'lucide-react';
import { LadderTeam } from './LadderDetails';

interface LadderLeaderboardProps {
  teams: LadderTeam[];
  isLoading: boolean;
  format: 'singles' | 'doubles';
}

const LadderLeaderboard = ({ teams, isLoading, format }: LadderLeaderboardProps) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-32"></div>
                </div>
                <div className="h-4 bg-gray-200 rounded w-16"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const sortedTeams = [...teams].sort((a, b) => {
    if (b.total_points !== a.total_points) {
      return b.total_points - a.total_points;
    }
    // Tiebreaker: better win percentage
    const aWinPct = a.games_played > 0 ? a.wins / a.games_played : 0;
    const bWinPct = b.games_played > 0 ? b.wins / b.games_played : 0;
    return bWinPct - aWinPct;
  });

  const getRankIcon = (position: number) => {
    switch (position) {
      case 1:
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Award className="h-5 w-5 text-amber-600" />;
      default:
        return null;
    }
  };

  const getRankBadge = (position: number) => {
    if (position <= 4) {
      return (
        <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
          Top 4
        </Badge>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Leaderboard
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Ranked by points earned. Top 4 teams advance to playoffs.
        </p>
      </CardHeader>
      
      <CardContent>
        {sortedTeams.length === 0 ? (
          <div className="text-center py-8">
            <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium text-muted-foreground">No teams yet</p>
            <p className="text-sm text-muted-foreground">Teams will appear here once matches are played</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedTeams.map((team, index) => {
              const position = index + 1;
              const winPct = team.games_played > 0 ? (team.wins / team.games_played * 100).toFixed(1) : '0.0';
              
              return (
                <div
                  key={team.id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    position <= 4 ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 w-12">
                      <span className="font-bold text-lg">{position}</span>
                      {getRankIcon(position)}
                    </div>
                    
                    <div>
                      <div className="font-semibold">{team.team_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {team.wins}-{team.losses} ({winPct}%)
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-bold text-lg">{team.total_points}</div>
                      <div className="text-sm text-muted-foreground">points</div>
                    </div>
                    {getRankBadge(position)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LadderLeaderboard;
