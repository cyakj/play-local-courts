
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Ladder } from '@/pages/LeaguesLadders';
import { LadderTeam } from './LadderDetails';

interface LadderTeamsProps {
  ladder: Ladder;
  teams: LadderTeam[];
  onTeamsUpdated: () => void;
  isAdmin: boolean;
}

interface Profile {
  id: string;
  full_name: string | null;
  username: string | null;
}

const LadderTeams = ({ ladder, teams, onTeamsUpdated, isAdmin }: LadderTeamsProps) => {
  const { currentUser } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    team_name: '',
    player1_id: '',
    player2_id: ''
  });

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    if (!currentUser?.hoa_id) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .eq('hoa_id', currentUser.hoa_id)
        .eq('hoa_status', 'approved');

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error loading profiles:', error);
    }
  };

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('ladder_teams')
        .insert({
          ladder_id: ladder.id,
          team_name: formData.team_name,
          player1_id: formData.player1_id,
          player2_id: ladder.format === 'doubles' ? formData.player2_id : null
        });

      if (error) throw error;

      toast.success('Team added successfully!');
      setShowAddDialog(false);
      setFormData({ team_name: '', player1_id: '', player2_id: '' });
      onTeamsUpdated();
    } catch (error) {
      console.error('Error adding team:', error);
      toast.error('Failed to add team');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!isAdmin) return;

    try {
      const { error } = await supabase
        .from('ladder_teams')
        .delete()
        .eq('id', teamId);

      if (error) throw error;

      toast.success('Team removed successfully!');
      onTeamsUpdated();
    } catch (error) {
      console.error('Error deleting team:', error);
      toast.error('Failed to remove team');
    }
  };

  const getPlayerName = (playerId: string) => {
    const player = profiles.find(p => p.id === playerId);
    return player?.full_name || player?.username || 'Unknown Player';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Teams ({teams.length})</h3>
          <p className="text-sm text-muted-foreground">
            {ladder.format === 'doubles' ? 'Minimum 4 teams required' : 'Minimum 4 players required'}
          </p>
        </div>
        
        {isAdmin && ladder.status === 'setup' && (
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Team
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Team</DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleAddTeam} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="team_name">Team Name</Label>
                  <Input
                    id="team_name"
                    value={formData.team_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, team_name: e.target.value }))}
                    placeholder="Enter team name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="player1">Player 1</Label>
                  <Select 
                    value={formData.player1_id} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, player1_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select player 1" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map(profile => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.full_name || profile.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {ladder.format === 'doubles' && (
                  <div className="space-y-2">
                    <Label htmlFor="player2">Player 2</Label>
                    <Select 
                      value={formData.player2_id} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, player2_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select player 2" />
                      </SelectTrigger>
                      <SelectContent>
                        {profiles.filter(p => p.id !== formData.player1_id).map(profile => (
                          <SelectItem key={profile.id} value={profile.id}>
                            {profile.full_name || profile.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Adding...' : 'Add Team'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {teams.map((team) => (
          <Card key={team.id}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{team.team_name}</CardTitle>
                {isAdmin && ladder.status === 'setup' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteTeam(team.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div className="text-sm">
                    <div>{getPlayerName(team.player1_id)}</div>
                    {ladder.format === 'doubles' && team.player2_id && (
                      <div>{getPlayerName(team.player2_id)}</div>
                    )}
                  </div>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Points:</span>
                  <span className="font-medium">{team.total_points}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Record:</span>
                  <span>{team.wins}-{team.losses}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {teams.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">No teams added yet</p>
            <p className="text-sm text-muted-foreground">
              {isAdmin ? 'Click "Add Team" to get started' : 'Teams will appear here once added by the admin'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LadderTeams;
