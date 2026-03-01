import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, UserPlus, Trophy, Calendar, MessageSquare, Swords } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Competition, CompetitionTeam } from './types';
import LadderLeaderboard from '@/components/ladders/LadderLeaderboard';
import LadderMatches from '@/components/ladders/LadderMatches';
import LadderRules from '@/components/ladders/LadderRules';
import LadderJoinDialog from '@/components/ladders/LadderJoinDialog';
import NtrpRequiredAlert from '@/components/ladders/NtrpRequiredAlert';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import PartnerStatusBanner, { PartnerState, PartnerProfile } from './PartnerStatusBanner';

interface Props {
  competition: Competition;
  onBack: () => void;
}

const CompetitionDetailPlayer = ({ competition, onBack }: Props) => {
  const { currentUser } = useAuth();
  const [teams, setTeams] = useState<CompetitionTeam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnTeam, setIsOnTeam] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [userNtrp, setUserNtrp] = useState<number | null>(null);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showNtrpAlert, setShowNtrpAlert] = useState(false);
  const [eligibilityIssue, setEligibilityIssue] = useState<string | null>(null);
  const [playerProfiles, setPlayerProfiles] = useState<Record<string, { name: string; community: string; rating: number | null }>>({});
  const [creatorName, setCreatorName] = useState<string>('');
  const [creatorRole, setCreatorRole] = useState<string>('');
  const [partnerState, setPartnerState] = useState<PartnerState>(null);
  const [partnerProfile, setPartnerProfile] = useState<PartnerProfile | null>(null);
  const [partnerRegRequestId, setPartnerRegRequestId] = useState<string | null>(null);
  const [partnerInvitationId, setPartnerInvitationId] = useState<string | null>(null);
  const [totalPlayerCount, setTotalPlayerCount] = useState(0);
  const isActive = competition.status === 'active';
  const isSetup = competition.status === 'setup';
  const isLadder = competition.scoring_mode === 'challenge';

  const loadTeams = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('ladder_teams')
        .select('*')
        .eq('ladder_id', competition.id)
        .order('total_points', { ascending: false });
      setTeams((data || []) as CompetitionTeam[]);

      const playerIds = new Set<string>();
      data?.forEach(t => { playerIds.add(t.player1_id); if (t.player2_id) playerIds.add(t.player2_id); });
      if (playerIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, ntrp_rating, hoa_id')
          .in('id', Array.from(playerIds));
        
        // Get HOA names
        const hoaIds = new Set(profiles?.map(p => p.hoa_id).filter(Boolean) as string[]);
        let hoaMap: Record<string, string> = {};
        if (hoaIds.size > 0) {
          const { data: hoas } = await supabase.from('hoas').select('id, name').in('id', Array.from(hoaIds));
          hoas?.forEach(h => { hoaMap[h.id] = h.name; });
        }

        const map: Record<string, { name: string; community: string; rating: number | null }> = {};
        profiles?.forEach(p => {
          map[p.id] = {
            name: p.full_name || 'Unknown',
            community: p.hoa_id ? (hoaMap[p.hoa_id] || '') : '',
            rating: p.ntrp_rating,
          };
        });
        setPlayerProfiles(map);
      }

      // Count total players including pending registrations
      let totalPlayers = playerIds.size;
      const { data: pendingReqs } = await supabase
        .from('ladder_registration_requests')
        .select('player_id')
        .eq('ladder_id', competition.id)
        .in('status', ['pending', 'pending_partner']);
      pendingReqs?.forEach(r => {
        if (!playerIds.has(r.player_id)) {
          totalPlayers++;
          playerIds.add(r.player_id);
        }
      });
      setTotalPlayerCount(totalPlayers);
    } catch (error) {
      console.error('Error loading teams:', error);
    } finally {
      setIsLoading(false);
    }
  }, [competition.id]);

  const loadCreator = useCallback(async () => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', competition.admin_id)
      .single();
    setCreatorName(profile?.full_name || 'Unknown');

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', competition.admin_id);
    const userRoles = roles?.map(r => r.role) || [];
    setCreatorRole(userRoles.includes('admin') ? 'HOA Admin' : userRoles.includes('coach') ? 'Coach' : '');
  }, [competition.admin_id]);

  const checkUserStatus = useCallback(async () => {
    if (!currentUser?.id) return;

    const { data: profile } = await supabase.from('profiles').select('ntrp_rating').eq('id', currentUser.id).single();
    setUserNtrp(profile?.ntrp_rating || null);

    const { data: teamData } = await supabase
      .from('ladder_teams').select('id, player1_id, player2_id').eq('ladder_id', competition.id)
      .or(`player1_id.eq.${currentUser.id},player2_id.eq.${currentUser.id}`).limit(1);
    const onTeam = (teamData?.length || 0) > 0;
    setIsOnTeam(onTeam);

    const { data: requestData } = await supabase
      .from('ladder_registration_requests').select('id, looking_for_partner, partner_id, status').eq('ladder_id', competition.id)
      .eq('player_id', currentUser.id).in('status', ['pending', 'pending_partner']).limit(1);
    setHasPendingRequest((requestData?.length || 0) > 0);

    // Check partner status for doubles competitions
    const isDoubles = competition.format === 'doubles' || competition.format === 'mixed_doubles';
    if (isDoubles && !onTeam) {
      await loadPartnerStatus(currentUser.id, requestData);
    } else if (onTeam && isDoubles) {
      // Team confirmed - find partner
      const team = teamData?.[0];
      if (team) {
        const partnerId = team.player1_id === currentUser.id ? team.player2_id : team.player1_id;
        if (partnerId) {
          const pProfile = await loadPartnerProfile(partnerId);
          setPartnerProfile(pProfile);
          setPartnerState('confirmed');
        }
      }
    } else {
      setPartnerState(null);
      setPartnerProfile(null);
    }

    let issue: string | null = null;
    if (competition.min_ntrp && profile?.ntrp_rating && profile.ntrp_rating < competition.min_ntrp) {
      issue = `Your NTRP rating of ${profile.ntrp_rating} does not meet the minimum requirement of ${competition.min_ntrp}`;
    } else if (competition.max_ntrp && profile?.ntrp_rating && profile.ntrp_rating > competition.max_ntrp) {
      issue = `Your NTRP rating of ${profile.ntrp_rating} exceeds the maximum of ${competition.max_ntrp}`;
    } else if (competition.hoa_only && competition.hoa_id && currentUser.hoaId !== competition.hoa_id) {
      issue = `This competition is only open to members of the hosting community.`;
    }
    setEligibilityIssue(issue);
  }, [currentUser?.id, competition]);

  const loadPartnerProfile = async (userId: string): Promise<PartnerProfile | null> => {
    const { data: p } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, ntrp_rating, hoa_id')
      .eq('id', userId)
      .single();
    if (!p) return null;
    let community = '';
    if (p.hoa_id) {
      const { data: hoa } = await supabase.from('hoas').select('name').eq('id', p.hoa_id).single();
      community = hoa?.name || '';
    }
    return { id: p.id, full_name: p.full_name, avatar_url: p.avatar_url, ntrp_rating: p.ntrp_rating, community };
  };

  const loadPartnerStatus = async (userId: string, myRequests: any[] | null) => {
    // State 1: Looking for partner
    if (myRequests && myRequests.length > 0) {
      const req = myRequests[0];
      setPartnerRegRequestId(req.id);

      if (req.looking_for_partner && !req.partner_id) {
        setPartnerState('looking');
        setPartnerProfile(null);
        setPartnerInvitationId(null);
        return;
      }

      // State 2: Request sent (I invited someone)
      if (req.partner_id && req.status === 'pending_partner') {
        const { data: inv } = await supabase
          .from('ladder_invitations')
          .select('id')
          .eq('ladder_id', competition.id)
          .eq('invited_by', userId)
          .eq('invited_user_id', req.partner_id)
          .eq('status', 'pending')
          .limit(1);
        const pProfile = await loadPartnerProfile(req.partner_id);
        setPartnerProfile(pProfile);
        setPartnerState('request_sent');
        setPartnerInvitationId(inv?.[0]?.id || null);
        return;
      }
    }

    // State 3: Request received (someone invited me)
    const { data: incomingInvites } = await supabase
      .from('ladder_invitations')
      .select('id, invited_by, ladder_id')
      .eq('ladder_id', competition.id)
      .eq('invited_user_id', userId)
      .eq('status', 'pending')
      .limit(1);

    if (incomingInvites && incomingInvites.length > 0) {
      const inv = incomingInvites[0];
      // Find the registration request from the inviter
      const { data: inviterReq } = await supabase
        .from('ladder_registration_requests')
        .select('id')
        .eq('ladder_id', competition.id)
        .eq('player_id', inv.invited_by)
        .eq('partner_id', userId)
        .limit(1);

      const pProfile = await loadPartnerProfile(inv.invited_by);
      setPartnerProfile(pProfile);
      setPartnerState('request_received');
      setPartnerInvitationId(inv.id);
      setPartnerRegRequestId(inviterReq?.[0]?.id || null);
      return;
    }

    // No partner activity
    setPartnerState(null);
    setPartnerProfile(null);
    setPartnerRegRequestId(null);
    setPartnerInvitationId(null);
  };

  useEffect(() => { loadTeams(); checkUserStatus(); loadCreator(); }, [loadTeams, checkUserStatus, loadCreator]);
  useRealtimeSubscription({ table: 'ladder_teams', event: '*', filter: `ladder_id=eq.${competition.id}`, onChange: loadTeams, enabled: true });
  useRealtimeSubscription({ table: 'ladder_invitations', event: '*', filter: `ladder_id=eq.${competition.id}`, onChange: checkUserStatus, enabled: true });
  useRealtimeSubscription({ table: 'ladder_registration_requests', event: '*', filter: `ladder_id=eq.${competition.id}`, onChange: loadTeams, enabled: true });

  const canSignUp = !isOnTeam && !hasPendingRequest && !eligibilityIssue && !partnerState && (isSetup || isActive);

  const handleJoinClick = () => {
    if ((competition.min_ntrp || competition.max_ntrp) && !userNtrp) {
      setShowNtrpAlert(true);
      return;
    }
    setShowJoinDialog(true);
  };

  const statusLabel = isSetup ? 'Open for Registration' : isActive ? 'Active' : 'Completed';

  // Determine default tab based on status and enrollment
  const defaultTab = isActive && isOnTeam ? 'leaderboard' : isActive ? 'leaderboard' : 'rules';

  return (
    <div className="space-y-4 pb-24">
      <Button variant="ghost" onClick={onBack} className="min-h-[44px]">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">{competition.name}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={isActive ? 'bg-emerald-100 text-emerald-700 border-0' : isSetup ? 'bg-blue-100 text-blue-700 border-0' : 'bg-muted text-muted-foreground border-0'}>
            {statusLabel}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {isLadder ? <Swords className="h-3 w-3 mr-0.5" /> : <Trophy className="h-3 w-3 mr-0.5" />}
            {isLadder ? 'Ladder' : 'Round Robin'}
          </Badge>
          <span className="text-sm text-muted-foreground capitalize">{competition.format.replace('_', ' ')}</span>
          {competition.city && <span className="text-sm text-muted-foreground">· {competition.city}</span>}
        </div>
        {creatorName && (
          <p className="text-sm text-muted-foreground">
            Created by <span className="font-medium text-foreground">{creatorName}</span>
            {creatorRole && <span className="text-compete ml-1">({creatorRole})</span>}
          </p>
        )}
        {competition.description && <p className="text-sm text-muted-foreground">{competition.description}</p>}
      </div>

      {/* Partner Status Banner - shown directly on competition page */}
      {partnerState && (
        <PartnerStatusBanner
          state={partnerState}
          partnerProfile={partnerProfile}
          registrationRequestId={partnerRegRequestId}
          invitationId={partnerInvitationId}
          competitionId={competition.id}
          onStatusChange={checkUserStatus}
        />
      )}

      {/* Registration status badges */}
      <div className="flex gap-2">
        {isOnTeam && !partnerState && <Badge variant="secondary" className="px-3 py-2 min-h-[44px] flex items-center">You're Registered</Badge>}
        {hasPendingRequest && !partnerState && <Badge variant="outline" className="px-3 py-2 min-h-[44px] flex items-center">Registration Pending</Badge>}
      </div>

      {/* Tabs */}
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="bg-card border-0 shadow-sm p-1 h-auto w-full overflow-x-auto">
          {isActive && (
            <>
              <TabsTrigger value="leaderboard" className="data-[state=active]:bg-foreground data-[state=active]:text-background rounded-lg px-3 py-2 text-xs flex-1">
                Leaderboard
              </TabsTrigger>
              <TabsTrigger value="matches" className="data-[state=active]:bg-foreground data-[state=active]:text-background rounded-lg px-3 py-2 text-xs flex-1">
                Matches
              </TabsTrigger>
            </>
          )}
          <TabsTrigger value="players" className="data-[state=active]:bg-foreground data-[state=active]:text-background rounded-lg px-3 py-2 text-xs flex-1">
            Players
          </TabsTrigger>
          <TabsTrigger value="rules" className="data-[state=active]:bg-foreground data-[state=active]:text-background rounded-lg px-3 py-2 text-xs flex-1">
            Rules
          </TabsTrigger>
        </TabsList>

        {isActive && (
          <>
            <TabsContent value="leaderboard" className="mt-4">
              <LadderLeaderboard teams={teams} isLoading={isLoading} format={competition.format} />
            </TabsContent>
            <TabsContent value="matches" className="mt-4">
              <LadderMatches ladderId={competition.id} isAdmin={false} teams={teams} />
            </TabsContent>
          </>
        )}

        <TabsContent value="players" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-base">Registered Players ({totalPlayerCount})</CardTitle></CardHeader>
            <CardContent>
              {teams.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No players registered yet.</p>
              ) : (
                <div className="space-y-2">
                  {teams.map((team, idx) => {
                    const p1 = playerProfiles[team.player1_id];
                    const p2 = team.player2_id ? playerProfiles[team.player2_id] : null;
                    return (
                      <div key={team.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-bold text-muted-foreground w-6 flex-shrink-0">#{idx + 1}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{team.team_name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {p1?.name || 'Player'}
                              {p2 && ` & ${p2.name}`}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {p1?.community && <span>{p1.community}</span>}
                              {p1?.rating && <span>NTRP {p1.rating}</span>}
                            </div>
                          </div>
                        </div>
                        {isActive && <Badge variant="secondary" className="text-xs flex-shrink-0">{team.total_points} pts</Badge>}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-base">Competition Rules</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <div><span className="text-muted-foreground">Format:</span> <span className="font-medium capitalize">{competition.format.replace('_', ' ')}</span></div>
                <div><span className="text-muted-foreground">Type:</span> <span className="font-medium">{isLadder ? 'Ladder' : 'Round Robin'}</span></div>
                <div><span className="text-muted-foreground">Scoring:</span> <span className="font-medium capitalize">{competition.scoring_format?.replace('_', ' ') || 'Best of 3'}</span></div>
                <div><span className="text-muted-foreground">3rd Set:</span> <span className="font-medium capitalize">{competition.third_set_format?.replace('_', ' ') || 'Super Tiebreak'}</span></div>
                <div><span className="text-muted-foreground">Points/Win:</span> <span className="font-medium">{competition.points_per_win || 3}</span></div>
                {competition.loss_points ? <div><span className="text-muted-foreground">Loss Points:</span> <span className="font-medium">{competition.loss_points}</span></div> : null}
                {competition.min_ntrp && <div><span className="text-muted-foreground">NTRP Range:</span> <span className="font-medium">{competition.min_ntrp}-{competition.max_ntrp}</span></div>}
                {competition.gender_restriction && <div><span className="text-muted-foreground">Gender:</span> <span className="font-medium capitalize">{competition.gender_restriction.replace('_', ' ')}</span></div>}
                <div><span className="text-muted-foreground">Max Players:</span> <span className="font-medium">{competition.max_teams || 20}</span></div>
                {competition.play_by_deadline_days && <div><span className="text-muted-foreground">Play-by Deadline:</span> <span className="font-medium">{competition.play_by_deadline_days} days</span></div>}
                {competition.acceptance_window_hours && <div><span className="text-muted-foreground">Acceptance Window:</span> <span className="font-medium">{competition.acceptance_window_hours}h</span></div>}
                <div><span className="text-muted-foreground">Score Confirmation:</span> <span className="font-medium">{competition.require_score_confirmation ? 'Required' : 'Not required'}</span></div>
                {competition.city && <div><span className="text-muted-foreground">Location:</span> <span className="font-medium">{competition.city}</span></div>}
                {competition.start_date && <div><span className="text-muted-foreground">Start Date:</span> <span className="font-medium">{competition.start_date}</span></div>}
                {competition.end_date && <div><span className="text-muted-foreground">End Date:</span> <span className="font-medium">{competition.end_date}</span></div>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Fixed Sign Up Button at bottom */}
      {!isOnTeam && !hasPendingRequest && (isSetup || isActive) && (
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-t border-border z-20">
          <div className="container mx-auto max-w-lg">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="w-full block">
                    <Button
                      onClick={handleJoinClick}
                      disabled={!canSignUp}
                      className={`w-full min-h-[48px] text-base font-medium ${
                        canSignUp
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-muted text-muted-foreground cursor-not-allowed'
                      }`}
                    >
                      <UserPlus className="mr-2 h-5 w-5" /> Sign Up
                    </Button>
                  </span>
                </TooltipTrigger>
                {eligibilityIssue && (
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-sm">{eligibilityIssue}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      )}

      <LadderJoinDialog
        open={showJoinDialog} onOpenChange={setShowJoinDialog}
        ladder={competition as any} userNtrp={userNtrp}
        onRegistrationComplete={() => { checkUserStatus(); loadTeams(); }}
      />
      <NtrpRequiredAlert open={showNtrpAlert} onOpenChange={setShowNtrpAlert} />
    </div>
  );
};

export default CompetitionDetailPlayer;
