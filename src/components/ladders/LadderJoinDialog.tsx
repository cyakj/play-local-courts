import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Users, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Ladder } from '@/pages/LeaguesLadders';

interface LadderJoinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ladder: Ladder;
  userNtrp: number | null;
  onRegistrationComplete: () => void;
}

interface Profile {
  id: string;
  full_name: string | null;
  username: string | null;
  ntrp_rating: number | null;
}

const LadderJoinDialog = ({ open, onOpenChange, ladder, userNtrp, onRegistrationComplete }: LadderJoinDialogProps) => {
  const { currentUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [lookingForPartner, setLookingForPartner] = useState(false);
  const [formData, setFormData] = useState({
    team_name: '',
    partner_id: '',
    message: '',
  });

  const isDoubles = ladder.format === 'doubles' || ladder.format === 'mixed_doubles';
  const requiresApproval = !ladder.auto_approve_registration;

  useEffect(() => {
    if (open && isDoubles) {
      loadProfiles();
    }
    // Reset form when dialog opens
    if (open) {
      setFormData({
        team_name: currentUser?.fullName || '',
        partner_id: '',
        message: '',
      });
      setLookingForPartner(false);
    }
  }, [open, isDoubles]);

  const loadProfiles = async () => {
    if (!currentUser?.hoaId) return;

    try {
      let query = supabase
        .from('profiles')
        .select('id, full_name, username, ntrp_rating')
        .neq('id', currentUser.id);
      
      // Only filter by HOA if joining a community ladder
      if (ladder.hoa_id === currentUser.hoaId) {
        query = query.eq('hoa_id', currentUser.hoaId).eq('hoa_status', 'approved');
      }

      // Filter by NTRP if ladder has requirements
      if (ladder.min_ntrp) {
        query = query.gte('ntrp_rating', ladder.min_ntrp);
      }
      if (ladder.max_ntrp) {
        query = query.lte('ntrp_rating', ladder.max_ntrp);
      }

      const { data, error } = await query;
      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error loading profiles:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id) return;

    if (isDoubles && !lookingForPartner && !formData.partner_id) {
      toast.error('Please select a partner or enable "Looking for Partner"');
      return;
    }

    setIsSubmitting(true);
    try {
      // If auto-approve and we have all info, add directly to ladder
      if (ladder.auto_approve_registration && (!isDoubles || formData.partner_id)) {
        const { error } = await supabase
          .from('ladder_teams')
          .insert({
            ladder_id: ladder.id,
            team_name: formData.team_name || currentUser.fullName || 'Team',
            player1_id: currentUser.id,
            player2_id: isDoubles ? formData.partner_id : null,
          });

        if (error) throw error;
        toast.success('Successfully joined the ladder!');
      } else {
        // Create a registration request
        const { error } = await supabase
          .from('ladder_registration_requests')
          .insert({
            ladder_id: ladder.id,
            player_id: currentUser.id,
            partner_id: formData.partner_id || null,
            team_name: formData.team_name || currentUser.fullName || 'Team',
            looking_for_partner: lookingForPartner,
            message: formData.message || null,
            status: 'pending',
          });

        if (error) throw error;
        
        if (lookingForPartner) {
          toast.success('Registration submitted! We\'ll notify you when a partner is found.');
        } else {
          toast.success('Registration request submitted! Waiting for admin approval.');
        }
      }

      onRegistrationComplete();
    } catch (error: any) {
      console.error('Error joining ladder:', error);
      toast.error(error.message || 'Failed to join ladder');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPartnerName = (id: string) => {
    const profile = profiles.find(p => p.id === id);
    return profile?.full_name || profile?.username || 'Unknown';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Join {ladder.name}
          </DialogTitle>
          <DialogDescription>
            {requiresApproval 
              ? 'Submit a request to join this ladder. An admin will review your application.'
              : 'Complete the form below to join this ladder.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* NTRP Requirements Info */}
          {(ladder.min_ntrp || ladder.max_ntrp) && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium">NTRP Requirements</div>
                <p className="text-sm">
                  This ladder requires NTRP between {ladder.min_ntrp || '1.0'} and {ladder.max_ntrp || '7.0'}
                </p>
                {userNtrp && (
                  <p className="text-sm mt-1 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                    Your NTRP: {userNtrp}
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Team Name */}
          <div className="space-y-2">
            <Label htmlFor="team_name">
              {isDoubles ? 'Team Name' : 'Display Name'}
            </Label>
            <Input
              id="team_name"
              value={formData.team_name}
              onChange={(e) => setFormData(prev => ({ ...prev, team_name: e.target.value }))}
              placeholder={isDoubles ? 'Enter team name' : 'Your display name'}
              required
            />
          </div>

          {/* Partner Selection for Doubles */}
          {isDoubles && (
            <>
              <div className="flex items-center space-x-2">
                <Switch
                  id="looking-for-partner"
                  checked={lookingForPartner}
                  onCheckedChange={setLookingForPartner}
                />
                <Label htmlFor="looking-for-partner" className="cursor-pointer">
                  <span className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Looking for a partner
                  </span>
                </Label>
              </div>

              {!lookingForPartner ? (
                <div className="space-y-2">
                  <Label htmlFor="partner">Select Partner</Label>
                  <Select
                    value={formData.partner_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, partner_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose your partner" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map(profile => (
                        <SelectItem key={profile.id} value={profile.id}>
                          <div className="flex items-center gap-2">
                            <span>{profile.full_name || profile.username}</span>
                            {profile.ntrp_rating && (
                              <Badge variant="outline" className="text-xs">
                                NTRP {profile.ntrp_rating}
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {profiles.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No eligible partners found. Try "Looking for a partner" instead.
                    </p>
                  )}
                </div>
              ) : (
                <Alert>
                  <UserPlus className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    You'll be matched with another player looking for a partner based on NTRP compatibility.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}

          {/* Message (for approval-required ladders) */}
          {requiresApproval && (
            <div className="space-y-2">
              <Label htmlFor="message">Message to Admin (Optional)</Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Add a note to your registration request..."
                rows={2}
              />
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting 
                ? 'Submitting...' 
                : requiresApproval 
                  ? 'Submit Request' 
                  : 'Join Ladder'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default LadderJoinDialog;
