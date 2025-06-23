
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Users, Calendar, CheckCircle } from 'lucide-react';

const LadderRules = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Scoring System
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">
              Points are awarded to the winner based on the loser's games:
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                  <span className="text-sm font-medium">6-0 Win</span>
                  <Badge variant="default">600 pts</Badge>
                </div>
                <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                  <span className="text-sm font-medium">6-1 Win</span>
                  <Badge variant="default">550 pts</Badge>
                </div>
                <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                  <span className="text-sm font-medium">6-2 Win</span>
                  <Badge variant="default">500 pts</Badge>
                </div>
                <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                  <span className="text-sm font-medium">6-3 Win</span>
                  <Badge variant="default">450 pts</Badge>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                  <span className="text-sm font-medium">6-4 Win</span>
                  <Badge variant="secondary">400 pts</Badge>
                </div>
                <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                  <span className="text-sm font-medium">7-5 Win</span>
                  <Badge variant="secondary">350 pts</Badge>
                </div>
                <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                  <span className="text-sm font-medium">7-6 Win</span>
                  <Badge variant="secondary">300 pts</Badge>
                </div>
                <div className="flex justify-between items-center p-2 bg-purple-50 rounded">
                  <span className="text-sm font-medium">Super Tiebreak</span>
                  <Badge variant="outline">250 pts</Badge>
                </div>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-red-50 rounded-lg">
              <p className="text-sm text-red-800 font-medium">Important:</p>
              <ul className="text-sm text-red-700 mt-1 space-y-1">
                <li>• Loser receives 0 points</li>
                <li>• Match must be completed to receive points</li>
                <li>• No partial wins or points for incomplete matches</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Format & Structure
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Round-Robin Phase</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Each team plays every other team once</li>
                <li>• Minimum 4 teams, maximum 12 teams</li>
                <li>• Teams ranked by total points earned</li>
                <li>• Tiebreaker: win percentage</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Playoff Phase</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Top 4 teams advance to playoffs</li>
                <li>• Semifinals: 1st vs 4th, 2nd vs 3rd</li>
                <li>• Winners advance to Final</li>
                <li>• Optional 3rd place match</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Scheduling & Deadlines
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• Matches have weekly deadlines set by admin</li>
              <li>• Players are responsible for arranging match times</li>
              <li>• Late matches may result in penalties</li>
              <li>• Reschedules must be approved by admin</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Score Submission & Confirmation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <h4 className="font-medium mb-2">Process:</h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Either team can submit the match score</li>
                <li>Opponent must confirm or dispute the result</li>
                <li>If confirmed: points awarded, leaderboard updates</li>
                <li>If disputed: admin resolves manually</li>
              </ol>
            </div>
            
            <div className="p-3 bg-amber-50 rounded-lg">
              <p className="text-sm text-amber-800 font-medium">Fair Play:</p>
              <p className="text-sm text-amber-700 mt-1">
                All players are expected to submit accurate scores and resolve disputes respectfully. 
                Persistent disputes may result in match forfeit.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LadderRules;
