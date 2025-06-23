
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { LadderTeam } from './LadderDetails';
import SubmitScoreDialog from './SubmitScoreDialog';
import { format } from 'date-fns';

interface LadderMatchesProps {
  ladderId: string;
  isAdmin: boolean;
  teams: LadderTeam[];
}

export interface LadderMatch {
  id: string;
  ladder_id: string;
  team1_id: string;
  team2_id: string;
  round_number: number | null;
  playoff_stage: string | null;
  scheduled_date: string | null;
  deadline_date: string | null;
  status: 'pending' | 'submitted' | 'confirmed' | 'disputed';
  team1_score_games: number | null;
  team2_score_games: number | null;
  team1_score_sets: number | null;
  team2_score_sets: number | null;
  super_tiebreak: boolean | null;
  winner_team_id: string | null;
  points_awarded: number | null;
  submitted_by: string | null;
  submitted_at: string | null;
  dispute_reason: string | null;
  created_at: string;
  updated_at: string;
}

const LadderMatches = ({ ladderId, isAdmin, teams }: LadderMatchesProps) => {
  const { currentUser } = useAuth();
  const [matches, setMatches] = useState<LadderMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<LadderMatch | null>(null);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);

  useEffect(() => {
    loadMatches();
  }, [ladderId]);

  const loadMatches = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('ladder_matches')
        .select('*')
        .eq('ladder_id', ladderId)
        .order('scheduled_date', { ascending: true });

      if (error) throw error;
      // Map the data to ensure status field has correct type
      const mappedData = (data || []).map(match => ({
        ...match,
        status: match.status as 'pending' | 'submitted' | 'confirmed' | 'disputed'
      }));
      setMatches(mappedData);
    } catch (error) {
      console.error('Error loading matches:', error);
      toast.error('Failed to load matches');
    } finally {
      setIsLoading(false);
    }
  };

  const getTeamName = (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    return team?.team_name || 'Unknown Team';
  };

  const canSubmitScore = (match: LadderMatch) => {
    if (!currentUser) return false;
    if (match.status !== 'pending') return false;
    
    const team1 = teams.find(t => t.id === match.team1_id);
    const team2 = teams.find(t => t.id === match.team2_id);
    
    const isInTeam1 = team1?.player1_id === currentUser.id || team1?.player2_id === currentUser.id;
    const isInTeam2 = team2?.player1_id === currentUser.id || team2?.player2_id === currentUser.id;
    
    return isInTeam1 || isInTeam2;
  };

  const handleSubmitScore = (match: LadderMatch) => {
    setSelectedMatch(match);
    setShowSubmitDialog(true);
  };

  const handleScoreSubmitted = () => {
    setShowSubmitDialog(false);
    setSelectedMatch(null);
    loadMatches();
  };

  const renderMatch = (match: LadderMatch) => {
    const team1Name = getTeamName(match.team1_id);
    const team2Name = getTeamName(match.team2_id);
    const isOverdue = match.deadline_date && new Date(match.deadline_date) < new Date() && match.status === 'pending';

    return (
      <Card key={match.id} className={`${isOverdue ? 'border-red-200 bg-red-50' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg">
                {team1Name} vs {team2Name}
              </CardTitle>
              {match.round_number && (
                <p className="text-sm text-muted-foreground">Round {match.round_number}</p>
              )}
              {match.playoff_stage && (
                <Badge variant="secondary" className="mt-1">
                  {match.playoff_stage}
                </Badge>
              )}
            </div>
            
            <Badge variant={
              match.status === 'confirmed' ? 'default' :
              match.status === 'submitted' ? 'secondary' :
              match.status === 'disputed' ? 'destructive' : 'outline'
            }>
              {match.status}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-3">
            {match.scheduled_date && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                <span>Scheduled: {format(new Date(match.scheduled_date), 'MMM d, yyyy')}</span>
              </div>
            )}
            
            {match.deadline_date && (
              <div className={`flex items-center gap-2 text-sm ${isOverdue ? 'text-red-600' : 'text-muted-foreground'}`}>
                {isOverdue ? <AlertCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                <span>Deadline: {format(new Date(match.deadline_date), 'MMM d, yyyy')}</span>
                {isOverdue && <span className="font-medium">(Overdue)</span>}
              </div>
            )}
            
            {match.status === 'confirmed' && match.team1_score_games !== null && match.team2_score_games !== null && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="flex justify-between items-center">
                  <span>{team1Name}</span>
                  <span className="font-bold">{match.team1_score_games}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>{team2Name}</span>
                  <span className="font-bold">{match.team2_score_games}</span>
                </div>
                {match.super_tiebreak && (
                  <div className="text-sm text-muted-foreground mt-1">Super Tiebreak</div>
                )}
                {match.points_awarded && (
                  <div className="text-sm text-muted-foreground mt-1">
                    Points awarded: {match.points_awarded}
                  </div>
                )}
              </div>
            )}
            
            {canSubmitScore(match) && (
              <Button 
                onClick={() => handleSubmitScore(match)}
                className="w-full"
              >
                Submit Score
              </Button>
            )}
            
            {match.status === 'submitted' && match.submitted_by !== currentUser?.id && (
              <div className="text-sm text-muted-foreground">
                Score submitted - waiting for opponent confirmation
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const upcomingMatches = matches.filter(m => m.status === 'pending');
  const completedMatches = matches.filter(m => m.status === 'confirmed');
  const pendingMatches = matches.filter(m => m.status === 'submitted' || m.status === 'disputed');

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming ({upcomingMatches.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({pendingMatches.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedMatches.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {upcomingMatches.map(renderMatch)}
          </div>
          {upcomingMatches.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-muted-foreground">No upcoming matches</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pending" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pendingMatches.map(renderMatch)}
          </div>
          {pendingMatches.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-muted-foreground">No pending matches</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {completedMatches.map(renderMatch)}
          </div>
          {completedMatches.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-muted-foreground">No completed matches</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {selectedMatch && (
        <SubmitScoreDialog
          match={selectedMatch}
          teams={teams}
          open={showSubmitDialog}
          onOpenChange={setShowSubmitDialog}
          onScoreSubmitted={handleScoreSubmitted}
        />
      )}
    </div>
  );
};

export default LadderMatches;
