
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { LadderMatch } from './LadderMatches';
import { LadderTeam } from './LadderDetails';
import { Camera, ImagePlus } from 'lucide-react';

interface SubmitScoreDialogProps {
  match: LadderMatch;
  teams: LadderTeam[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScoreSubmitted: () => void;
  currentUserTeamId?: string;
}

const SubmitScoreDialog = ({ match, teams, open, onOpenChange, onScoreSubmitted, currentUserTeamId }: SubmitScoreDialogProps) => {
  const { currentUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    team1_score: '',
    team2_score: '',
    super_tiebreak: false,
    is_retirement: false,
    retired_by: '' as 'me' | 'opponent' | '',
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const team1 = teams.find(t => t.id === match.team1_id);
  const team2 = teams.find(t => t.id === match.team2_id);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onload = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photoFile || !currentUser) return null;
    const ext = photoFile.name.split('.').pop();
    const path = `${currentUser.id}/${match.id}.${ext}`;
    const { error } = await supabase.storage.from('score-photos').upload(path, photoFile, { upsert: true });
    if (error) {
      console.error('Photo upload error:', error);
      return null;
    }
    const { data: urlData } = supabase.storage.from('score-photos').getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    // Determine which team the current user is on
    const isTeam1 = currentUserTeamId === match.team1_id;
    const photoUrlField = isTeam1 ? 'score_photo_url_team1' : 'score_photo_url_team2';

    if (formData.is_retirement) {
      if (!formData.retired_by) {
        toast.error('Please select who retired');
        return;
      }

      setIsSubmitting(true);
      try {
        const photoUrl = await uploadPhoto();
        
        // Determine retiring team
        let retiredTeamId: string;
        let winnerId: string;
        if (formData.retired_by === 'me') {
          retiredTeamId = currentUserTeamId || match.team1_id;
          winnerId = retiredTeamId === match.team1_id ? match.team2_id : match.team1_id;
        } else {
          const opponentTeamId = currentUserTeamId === match.team1_id ? match.team2_id : match.team1_id;
          retiredTeamId = opponentTeamId;
          winnerId = currentUserTeamId || match.team1_id;
        }

        const updateData: Record<string, any> = {
          is_retirement: true,
          retired_by_team_id: retiredTeamId,
          winner_team_id: winnerId,
          status: 'pending' as any,
          submitted_by: currentUser.id,
          submitted_at: new Date().toISOString(),
        };
        if (photoUrl) updateData[photoUrlField] = photoUrl;

        const { error } = await supabase
          .from('ladder_matches')
          .update(updateData)
          .eq('id', match.id);

        if (error) throw error;

        toast.success('Retirement recorded. Waiting for opponent confirmation.');
        onScoreSubmitted();
      } catch (error) {
        console.error('Error submitting retirement:', error);
        toast.error('Failed to submit retirement');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Regular score submission
    const team1Score = parseInt(formData.team1_score);
    const team2Score = parseInt(formData.team2_score);

    if (isNaN(team1Score) || isNaN(team2Score)) {
      toast.error('Please enter valid scores');
      return;
    }

    if (team1Score < 0 || team2Score < 0) {
      toast.error('Scores cannot be negative');
      return;
    }

    const winnerId = team1Score > team2Score ? match.team1_id : match.team2_id;
    const loserScore = Math.min(team1Score, team2Score);
    
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
      const photoUrl = await uploadPhoto();

      const updateData: Record<string, any> = {
        team1_score_games: team1Score,
        team2_score_games: team2Score,
        super_tiebreak: formData.super_tiebreak,
        winner_team_id: winnerId,
        points_awarded: pointsAwarded,
        status: 'pending' as any,
        submitted_by: currentUser.id,
        submitted_at: new Date().toISOString()
      };
      if (photoUrl) updateData[photoUrlField] = photoUrl;

      const { error } = await supabase
        .from('ladder_matches')
        .update(updateData)
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
          {/* Match Retired toggle */}
          <div className="flex items-center space-x-2">
            <Switch
              id="is_retirement"
              checked={formData.is_retirement}
              onCheckedChange={(checked) => 
                setFormData(prev => ({ ...prev, is_retirement: checked, retired_by: '' }))
              }
            />
            <Label htmlFor="is_retirement">Match Retired</Label>
          </div>

          {formData.is_retirement ? (
            <div className="space-y-3">
              <Label>Who retired?</Label>
              <RadioGroup
                value={formData.retired_by}
                onValueChange={(v) => setFormData(prev => ({ ...prev, retired_by: v as 'me' | 'opponent' }))}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="me" id="retired-me" />
                  <Label htmlFor="retired-me">I Retired</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="opponent" id="retired-opponent" />
                  <Label htmlFor="retired-opponent">My Opponent Retired</Label>
                </div>
              </RadioGroup>
              <p className="text-xs text-muted-foreground">
                The retiring player is recorded as the loser. No forfeit or walkover strike is issued for a retirement.
              </p>
            </div>
          ) : (
            <>
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

              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-sm font-medium">Scoring System:</p>
                <div className="text-xs text-muted-foreground mt-1 space-y-1">
                  <div>6-0 = 600 pts, 6-1 = 550 pts, 6-2 = 500 pts</div>
                  <div>6-3 = 450 pts, 6-4 = 400 pts, 7-5 = 350 pts</div>
                  <div>7-6 = 300 pts, Super Tiebreak = 250 pts</div>
                </div>
              </div>
            </>
          )}

          {/* Scorecard Photo Upload */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Camera className="h-4 w-4" /> Scorecard Photo (optional)
            </Label>
            {photoPreview ? (
              <div className="relative">
                <img src={photoPreview} className="h-24 w-full rounded-lg object-cover" alt="Scorecard" />
                <Button type="button" variant="destructive" size="sm" className="absolute top-1 right-1 h-6 text-xs"
                  onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}>
                  Remove
                </Button>
              </div>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer border border-dashed rounded-lg p-3 hover:bg-muted/50 transition-colors">
                <ImagePlus className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Upload scorecard photo</span>
                <input type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
              </label>
            )}
            <p className="text-xs text-muted-foreground">
              Adding a photo helps resolve any disputes quickly.
            </p>
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
