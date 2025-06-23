
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { LadderMatch } from './LadderMatches';
import { LadderTeam } from './LadderDetails';

interface SubmitScoreDialogProps {
  match: LadderMatch;
  teams: LadderTeam[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScoreSubmitted: () => void;
}

const SubmitScoreDialog = ({ match, teams, open, onOpenChange, onScoreSubmitted }: SubmitScoreDialogProps) => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    team1_score: '',
    team2_score: '',
    super_tiebreak: false
  });

  const team1 = teams.find(t => t.id === match.team1_id);
  const team2 = teams.find(t => t.id === match.team2_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const team1Score = parseInt(formData.team1_score);
    const team2Score = parseInt(formData.team2_score);

    // Basic validation
    if (isNaN(team1Score) || isNaN(team2Score)) {
      toast.error('Please enter valid scores');
      return;
    }

    if (team1Score < 0 || team2Score < 0) {
      toast.error('Scores cannot be negative');
      return;
    }

    // Determine winner
    const winnerId = team1Score > team2Score ? match.team1_id : match.team2_id;
    const loserScore = Math.min(team1Score, team2Score);
    
    // Calculate points using the database function
    let pointsAwarded = 0;
    try {
      const { data: points, error: pointsError } = await supabase.rpc(
        'calculate_ladder_points',
        { 
          winner_games: Math.max(team1Score, team2Score), 
          loser_games: loserScore,
          super_tiebreak: formData.super_tiebreak 
        }
      );

      if (pointsError) throw pointsError;
      pointsAwarded = points;
    } catch (error) {
      console.error('Error calculating points:', error);
      toast.error('Failed to calculate points');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('ladder_matches')
        .update({
          team1_score_games: team1Score,
          team2_score_games: team2Score,
          super_tiebreak: formData.super_tiebreak,
          winner_team_id: winnerId,
          points_awarded: pointsAwarded,
          status: 'submitted',
          submitted_by: user.id,
          submitted_at: new Date().toISOString()
        })
        .eq('id', match.id);

      if (error) throw error;

      toast.success('Score submitted! Waiting for opponent confirmation.');
      onScoreSubmitted();
    } catch (error) {
      console.error('Error submitting score:', error);
      toast.error('Failed to submit score');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Submit Match Score</DialogTitle>
        </DialogHeader>
        
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            {team1?.team_name} vs {team2?.team_name}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="team1_score">{team1?.team_name}</Label>
              <Input
                id="team1_score"
                type="number"
                min="0"
                value={formData.team1_score}
                onChange={(e) => setFormData(prev => ({ ...prev, team1_score: e.target.value }))}
                placeholder="0"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="team2_score">{team2?.team_name}</Label>
              <Input
                id="team2_score"
                type="number"
                min="0"
                value={formData.team2_score}
                onChange={(e) => setFormData(prev => ({ ...prev, team2_score: e.target.value }))}
                placeholder="0"
                required
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="super_tiebreak"
              checked={formData.super_tiebreak}
              onCheckedChange={(checked) => 
                setFormData(prev => ({ ...prev, super_tiebreak: checked }))
              }
            />
            <Label htmlFor="super_tiebreak">Super Tiebreak (10-point tiebreak)</Label>
          </div>

          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-blue-800 font-medium">Scoring System:</p>
            <div className="text-xs text-blue-700 mt-1 space-y-1">
              <div>6-0 = 600 pts, 6-1 = 550 pts, 6-2 = 500 pts</div>
              <div>6-3 = 450 pts, 6-4 = 400 pts, 7-5 = 350 pts</div>
              <div>7-6 = 300 pts, Super Tiebreak = 250 pts</div>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Score'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SubmitScoreDialog;
