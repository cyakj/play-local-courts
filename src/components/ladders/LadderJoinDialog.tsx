import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, UserPlus, AlertCircle, CheckCircle2, Search, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Ladder } from '@/pages/LeaguesLadders';
import { cn } from '@/lib/utils';

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
  avatar_url: string | null;
}

const LadderJoinDialog = ({ open, onOpenChange, ladder, userNtrp, onRegistrationComplete }: LadderJoinDialogProps) => {
  const { currentUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lookingForPartner, setLookingForPartner] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<Profile | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    team_name: '',
    message: '',
  });

  const isDoubles = ladder.format === 'doubles' || ladder.format === 'mixed_doubles';
  const requiresApproval = !ladder.auto_approve_registration;

  useEffect(() => {
    // Reset form when dialog opens
    if (open) {
      setFormData({
        team_name: currentUser?.fullName || '',
        message: '',
      });
      setLookingForPartner(false);
      setSearchQuery('');
      setSelectedPartner(null);
      setSearchResults([]);
    }
  }, [open, currentUser]);

  // Click outside to close search results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search for partners as user types
  useEffect(() => {
    const searchPartners = async () => {
      if (!searchQuery.trim() || searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        // Use a more flexible search that doesn't require NTRP if ladder has no requirements
        let query = supabase
          .from('profiles')
          .select('id, full_name, username, ntrp_rating, avatar_url')
          .neq('id', currentUser?.id || '');

        // Search by name (case insensitive)
        const searchTerm = `%${searchQuery}%`;
        query = query.or(`full_name.ilike.${searchTerm},username.ilike.${searchTerm}`);

        // Only filter by NTRP if ladder has requirements AND the player has a rating
        if (ladder.min_ntrp) {
          query = query.or(`ntrp_rating.gte.${ladder.min_ntrp},ntrp_rating.is.null`);
        }
        if (ladder.max_ntrp) {
          query = query.or(`ntrp_rating.lte.${ladder.max_ntrp},ntrp_rating.is.null`);
        }

        query = query.limit(20);

        const { data, error } = await query;
        if (error) throw error;
        
        // Filter results to only those with a name
        const filteredData = (data || []).filter(p => p.full_name || p.username);
        setSearchResults(filteredData);
        setShowResults(true);
      } catch (error) {
        console.error('Error searching partners:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchPartners, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, currentUser?.id, ladder.min_ntrp, ladder.max_ntrp]);

  const selectPartner = (profile: Profile) => {
    setSelectedPartner(profile);
    setSearchQuery('');
    setShowResults(false);
  };

  const clearPartner = () => {
    setSelectedPartner(null);
    setSearchQuery('');
  };

  const sendPartnerInvitation = async (partnerId: string, registrationRequestId: string) => {
    if (!currentUser) return;

    const invitationContent = JSON.stringify({
      type: 'ladder_partner_invitation',
      ladder_id: ladder.id,
      ladder_name: ladder.name,
      registration_request_id: registrationRequestId,
      inviter_name: currentUser.fullName,
      team_name: formData.team_name,
    });

    // Send invitation message
    await supabase
      .from('messages')
      .insert({
        sender_id: currentUser.id,
        receiver_id: partnerId,
        content: invitationContent,
      });

    // Create ladder invitation record
    await supabase
      .from('ladder_invitations')
      .insert({
        ladder_id: ladder.id,
        invited_user_id: partnerId,
        invited_by: currentUser.id,
        status: 'pending',
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id) return;

    if (isDoubles && !lookingForPartner && !selectedPartner) {
      toast.error('Please search and select a partner or enable "Looking for Partner"');
      return;
    }

    setIsSubmitting(true);
    try {
      // For doubles with a partner selected, we need to send an invitation
      if (isDoubles && selectedPartner && !lookingForPartner) {
        // Check for existing pending invitation from this user for this ladder
        const { data: existingInvite } = await supabase
          .from('ladder_invitations')
          .select('id')
          .eq('ladder_id', ladder.id)
          .eq('invited_by', currentUser.id)
          .eq('status', 'pending')
          .maybeSingle();

        if (existingInvite) {
          toast.error('You already have a pending partner invitation for this competition. Cancel it first before inviting someone else.');
          setIsSubmitting(false);
          return;
        }

        // Check if this person already has a pending invitation for this ladder
        const { data: targetInvite } = await supabase
          .from('ladder_invitations')
          .select('id')
          .eq('ladder_id', ladder.id)
          .eq('invited_user_id', selectedPartner.id)
          .eq('status', 'pending')
          .maybeSingle();

        if (targetInvite) {
          toast.error(`${selectedPartner.full_name || 'This player'} already has a pending invitation for this competition.`);
          setIsSubmitting(false);
          return;
        }
        // Create registration request with pending partner
        const { data: requestData, error } = await supabase
          .from('ladder_registration_requests')
          .insert({
            ladder_id: ladder.id,
            player_id: currentUser.id,
            partner_id: selectedPartner.id,
            team_name: formData.team_name || currentUser.fullName || 'Team',
            looking_for_partner: false,
            message: formData.message || null,
            status: 'pending_partner', // New status for awaiting partner confirmation
          })
          .select()
          .single();

        if (error) throw error;

        // Send invitation to partner
        await sendPartnerInvitation(selectedPartner.id, requestData.id);

        toast.success(`Invitation sent to ${selectedPartner.full_name || selectedPartner.username}! They'll need to accept to complete your registration.`);
      } else if (ladder.auto_approve_registration && !isDoubles) {
        // Singles with auto-approve: add directly to ladder
        const { error } = await supabase
          .from('ladder_teams')
          .insert({
            ladder_id: ladder.id,
            team_name: formData.team_name || currentUser.fullName || 'Team',
            player1_id: currentUser.id,
            player2_id: null,
          });

        if (error) throw error;
        toast.success('Successfully joined the ladder!');
      } else {
        // Create a registration request (looking for partner or needs approval)
        const { error } = await supabase
          .from('ladder_registration_requests')
          .insert({
            ladder_id: ladder.id,
            player_id: currentUser.id,
            partner_id: null,
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

      onOpenChange(false);
      onRegistrationComplete();
    } catch (error: any) {
      console.error('Error joining ladder:', error);
      toast.error(error.message || 'Failed to join ladder');
    } finally {
      setIsSubmitting(false);
    }
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
                  onCheckedChange={(checked) => {
                    setLookingForPartner(checked);
                    if (checked) {
                      clearPartner();
                    }
                  }}
                />
                <Label htmlFor="looking-for-partner" className="cursor-pointer">
                  <span className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Looking for a partner
                  </span>
                </Label>
              </div>

              {!lookingForPartner && (
                <div className="space-y-2">
                  <Label>Search for Partner</Label>
                  
                  {selectedPartner ? (
                    <div className="flex items-center gap-3 p-3 bg-accent rounded-lg">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={selectedPartner.avatar_url || undefined} />
                        <AvatarFallback>
                          {(selectedPartner.full_name || selectedPartner.username || 'U').charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">
                          {selectedPartner.full_name || selectedPartner.username}
                        </p>
                        {selectedPartner.ntrp_rating && (
                          <Badge variant="outline" className="text-xs mt-1">
                            NTRP {selectedPartner.ntrp_rating}
                          </Badge>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={clearPartner}
                        className="h-8 w-8"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div ref={searchRef} className="relative">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onFocus={() => searchResults.length > 0 && setShowResults(true)}
                          placeholder="Type a name to search..."
                          className="pl-10"
                        />
                      </div>
                      
                      {showResults && searchResults.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {searchResults.map((profile) => (
                            <div
                              key={profile.id}
                              onClick={() => selectPartner(profile)}
                              className={cn(
                                "flex items-center gap-3 p-3 cursor-pointer hover:bg-accent transition-colors",
                                "border-b last:border-b-0"
                              )}
                            >
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={profile.avatar_url || undefined} />
                                <AvatarFallback>
                                  {(profile.full_name || profile.username || 'U').charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <p className="font-medium text-sm">
                                  {profile.full_name || profile.username}
                                </p>
                                {profile.username && profile.full_name && (
                                  <p className="text-xs text-muted-foreground">@{profile.username}</p>
                                )}
                              </div>
                              {profile.ntrp_rating && (
                                <Badge variant="outline" className="text-xs">
                                  NTRP {profile.ntrp_rating}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {showResults && searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
                        <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg p-4 text-center text-muted-foreground">
                          No players found matching "{searchQuery}"
                        </div>
                      )}
                      
                      {isSearching && (
                        <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg p-4 text-center text-muted-foreground">
                          Searching...
                        </div>
                      )}
                    </div>
                  )}
                  
                  {!selectedPartner && (
                    <p className="text-xs text-muted-foreground">
                      Your partner will receive an invitation to join the ladder with you.
                    </p>
                  )}
                </div>
              )}
              
              {lookingForPartner && (
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
          {(requiresApproval || (isDoubles && selectedPartner)) && (
            <div className="space-y-2">
              <Label htmlFor="message">
                {isDoubles && selectedPartner 
                  ? 'Message to Partner (Optional)'
                  : 'Message to Admin (Optional)'}
              </Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                placeholder={isDoubles && selectedPartner 
                  ? 'Add a note to your partner invitation...'
                  : 'Add a note to your registration request...'}
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
                : isDoubles && selectedPartner
                  ? 'Send Invitation'
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
