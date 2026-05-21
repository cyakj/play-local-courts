
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Users } from 'lucide-react';
import { LadderTeam } from '@/components/ladders/LadderDetails';

interface LadderLeaderboardProps {
  teams: LadderTeam[];
  isLoading: boolean;
  format: 'singles' | 'doubles' | 'mixed_doubles';
}

const LadderLeaderboard = ({ teams, isLoading, format }: LadderLeaderboardProps) => {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading leaderboard...</div>
        </CardContent>
      </Card>
    );
  }

  if (teams.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            No teams have joined this ladder yet.
          </div>
        </CardContent>
      </Card>
    );
  }

  const getFormatDisplay = () => {
    switch (format) {
      case 'singles':
        return 'Singles';
      case 'doubles':
        return 'Doubles';
      case 'mixed_doubles':
        return 'Mixed Doubles';
      default:
        return 'Unknown';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Leaderboard - {getFormatDisplay()}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {teams.map((team, index) => (
            <div
              key={team.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
                  <span className="font-bold text-sm">
                    {index + 1}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold">{team.team_name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {team.wins}W - {team.losses}L
                  </p>
                </div>
              </div>
              <div className="text-right">
                <Badge variant="secondary" className="mb-1">
                  {team.total_points} pts
                </Badge>
                <p className="text-xs text-muted-foreground">
                  {team.games_played} games
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default LadderLeaderboard;
