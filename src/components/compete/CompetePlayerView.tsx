import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Calendar, AlertCircle, Swords, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Competition } from './types';
import CompetitionCard from './CompetitionCard';
import FilterChips from './FilterChips';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { format, isPast, isFuture, parseISO } from 'date-fns';

interface CompetePlayerViewProps {
  onSelectCompetition: (c: Competition) => void;
}

const AVAILABLE_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Ladders', value: 'ladder' },
  { label: 'Round Robins', value: 'round_robin' },
  { label: 'Community Only', value: 'community' },
  { label: 'Public', value: 'public' },
  { label: 'Open Registration', value: 'open' },
];

const MY_COMP_FILTERS = [
  { label: 'Active', value: 'active' },
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'Past', value: 'past' },
];

type MyCompFilter = 'active' | 'upcoming' | 'past';

const classifyCompetition = (comp: Competition): MyCompFilter => {
  if (comp.status === 'completed') return 'past';
  if (comp.end_date && isPast(parseISO(comp.end_date))) return 'past';
  if (comp.status === 'active') return 'active';
  // status === 'setup' means registration phase
  if (comp.start_date && isFuture(parseISO(comp.start_date))) return 'upcoming';
  return 'active'; // setup with no start date or start date passed
};

const CompetePlayerView = ({ onSelectCompetition }: CompetePlayerViewProps) => {
  const { currentUser } = useAuth();
  const [myCompetitions, setMyCompetitions] = useState<Competition[]>([]);
  const [availableCompetitions, setAvailableCompetitions] = useState<Competition[]>([]);
  const [teamCounts, setTeamCounts] = useState<Record<string, number>>({});
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({});
  const [myTeamInfo, setMyTeamInfo] = useState<Record<string, { rank: number; record: string; partnerName: string | null; nextOpponent: string | null; nextDeadline: string | null }>>({});
  const [creatorProfiles, setCreatorProfiles] = useState<Record<string, { name: string; role: string }>>({});
  const [filter, setFilter] = useState('all');
  const [myCompFilter, setMyCompFilter] = useState<MyCompFilter>('active');
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedOnce = React.useRef(false);

  const loadData = useCallback(async () => {
    if (!currentUser?.id) return;
    if (!hasLoadedOnce.current) {
      setIsLoading(true);
    }

    try {
      // 1. Find competitions where user is on a team OR has registered
      const { data: myTeams } = await supabase
        .from('ladder_teams')
        .select('ladder_id, id, total_points, wins, losses, player1_id, player2_id')
        .or(`player1_id.eq.${currentUser.id},player2_id.eq.${currentUser.id}`);

      const teamLadderIds = myTeams?.map(t => t.ladder_id) || [];

      const { data: myRegistrations } = await supabase
        .from('ladder_registration_requests')
        .select('ladder_id')
        .or(`player_id.eq.${currentUser.id},partner_id.eq.${currentUser.id}`)
        .in('status', ['pending', 'pending_partner', 'approved']);

      const registrationLadderIds = myRegistrations?.map(r => r.ladder_id) || [];
      const myParticipantLadderIds = Array.from(new Set([...teamLadderIds, ...registrationLadderIds]));

      let myComps: Competition[] = [];
      if (myParticipantLadderIds.length > 0) {
        const { data } = await supabase
          .from('ladders')
          .select('*')
          .in('id', myParticipantLadderIds);
        myComps = (data || []) as Competition[];
      }
      setMyCompetitions(myComps);

      // Build rank, record, partner, and next match info
      const teamInfo: Record<string, { rank: number; record: string; partnerName: string | null; nextOpponent: string | null; nextDeadline: string | null }> = {};
      for (const comp of myComps) {
        const { data: allTeams } = await supabase
          .from('ladder_teams')
          .select('id, player1_id, player2_id, total_points, team_name, wins, losses')
          .eq('ladder_id', comp.id)
          .order('total_points', { ascending: false });

        const myTeam = allTeams?.find(t => t.player1_id === currentUser.id || t.player2_id === currentUser.id);
        const rank = myTeam ? (allTeams?.indexOf(myTeam) || 0) + 1 : 0;
        const record = myTeam ? `${myTeam.wins}W-${myTeam.losses}L` : '';

        // Get partner name for doubles
        let partnerName: string | null = null;
        if (myTeam) {
          const partnerId = myTeam.player1_id === currentUser.id ? myTeam.player2_id : myTeam.player1_id;
          if (partnerId) {
            const { data: partnerProfile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', partnerId)
              .single();
            partnerName = partnerProfile?.full_name || null;
          }
        }

        let nextOpponent: string | null = null;
        let nextDeadline: string | null = null;
        if (myTeam) {
          const { data: nextMatch } = await supabase
            .from('ladder_matches')
            .select('team1_id, team2_id, deadline_date')
            .eq('ladder_id', comp.id)
            .eq('status', 'pending')
            .or(`team1_id.eq.${myTeam.id},team2_id.eq.${myTeam.id}`)
            .order('deadline_date', { ascending: true })
            .limit(1);

          if (nextMatch && nextMatch.length > 0) {
            const opponentId = nextMatch[0].team1_id === myTeam.id ? nextMatch[0].team2_id : nextMatch[0].team1_id;
            const opponentTeam = allTeams?.find(t => t.id === opponentId);
            nextOpponent = opponentTeam?.team_name || null;
            nextDeadline = nextMatch[0].deadline_date;
          }
        }
        teamInfo[comp.id] = { rank, record, partnerName, nextOpponent, nextDeadline };
      }
      setMyTeamInfo(teamInfo);

      // 2. Load available competitions
      let query = supabase.from('ladders').select('*').in('status', ['setup', 'active']);
      if (currentUser.hoaId) {
        query = query.eq('hoa_id', currentUser.hoaId);
      }
      const { data: available } = await query.order('created_at', { ascending: false });
      const filtered = (available || []).filter(a => !myParticipantLadderIds.includes(a.id)) as Competition[];
      setAvailableCompetitions(filtered);

      // 3. Load team counts
      const allIds = Array.from(new Set([...myParticipantLadderIds, ...filtered.map(f => f.id)]));
      if (allIds.length > 0) {
        const { data: teams } = await supabase
          .from('ladder_teams')
          .select('ladder_id, player1_id, player2_id')
          .in('ladder_id', allIds);
        const tCounts: Record<string, number> = {};
        const pCounts: Record<string, number> = {};
        allIds.forEach(id => { tCounts[id] = 0; pCounts[id] = 0; });
        
        teams?.forEach(t => {
          tCounts[t.ladder_id] = (tCounts[t.ladder_id] || 0) + 1;
          pCounts[t.ladder_id] = (pCounts[t.ladder_id] || 0) + 1;
          if (t.player2_id) pCounts[t.ladder_id] = (pCounts[t.ladder_id] || 0) + 1;
        });
        
        const { data: reqs } = await supabase
          .from('ladder_registration_requests')
          .select('ladder_id, player_id')
          .in('ladder_id', allIds)
          .in('status', ['pending', 'pending_partner']);
        
        const confirmedPlayers: Record<string, Set<string>> = {};
        allIds.forEach(id => { confirmedPlayers[id] = new Set(); });
        teams?.forEach(t => {
          confirmedPlayers[t.ladder_id].add(t.player1_id);
          if (t.player2_id) confirmedPlayers[t.ladder_id].add(t.player2_id);
        });
        
        reqs?.forEach(r => {
          if (!confirmedPlayers[r.ladder_id].has(r.player_id)) {
            pCounts[r.ladder_id] = (pCounts[r.ladder_id] || 0) + 1;
            confirmedPlayers[r.ladder_id].add(r.player_id);
          }
        });
        
        setTeamCounts(tCounts);
        setPlayerCounts(pCounts);
      }

      // 4. Load creator profiles for available competitions
      const creatorIds = new Set(filtered.map(f => f.admin_id));
      if (creatorIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', Array.from(creatorIds));
        const { data: roles } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', Array.from(creatorIds));

        const creatorMap: Record<string, { name: string; role: string }> = {};
        profiles?.forEach(p => {
          const userRoles = roles?.filter(r => r.user_id === p.id).map(r => r.role) || [];
          const displayRole = userRoles.includes('admin') ? 'HOA Admin' : userRoles.includes('coach') ? 'Coach' : '';
          creatorMap[p.id] = { name: p.full_name || 'Unknown', role: displayRole };
        });
        setCreatorProfiles(creatorMap);
      }
    } catch (error) {
      console.error('Error loading compete data:', error);
      toast.error('Failed to load competitions');
    } finally {
      setIsLoading(false);
      hasLoadedOnce.current = true;
    }
  }, [currentUser?.id, currentUser?.hoaId]);

  useEffect(() => { loadData(); }, [loadData]);
  useRealtimeSubscription({ table: 'ladders', event: '*', onChange: loadData, enabled: !!currentUser?.id });

  const filteredAvailable = availableCompetitions.filter(c => {
    if (filter === 'all') return true;
    if (filter === 'community') return c.hoa_only;
    if (filter === 'public') return !c.hoa_only && !c.is_private;
    if (filter === 'open') return c.status === 'setup';
    if (filter === 'ladder') return c.scoring_mode === 'challenge';
    if (filter === 'round_robin') return c.scoring_mode !== 'challenge';
    return true;
  });

  const filteredMyComps = myCompetitions.filter(c => classifyCompetition(c) === myCompFilter);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse border-0 shadow-sm">
            <CardContent className="p-6"><div className="h-24 bg-muted rounded" /></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statusBadgeClass = (comp: Competition) => {
    const cls = classifyCompetition(comp);
    if (cls === 'active') return 'bg-emerald-100 text-emerald-700 border-0';
    if (cls === 'upcoming') return 'bg-blue-100 text-blue-700 border-0';
    return 'bg-muted text-muted-foreground border-0';
  };

  const statusLabel = (comp: Competition) => {
    const cls = classifyCompetition(comp);
    if (cls === 'active') return comp.status === 'active' ? 'Active' : 'Registration Open';
    if (cls === 'upcoming') return 'Upcoming';
    return 'Completed';
  };

  return (
    <div className="space-y-8">
      {/* My Competitions */}
      <section>
        <h2 className="text-lg font-bold text-foreground mb-4">My Competitions</h2>
        <FilterChips
          filters={MY_COMP_FILTERS}
          activeFilter={myCompFilter}
          onChange={(v) => setMyCompFilter(v as MyCompFilter)}
        />

        <div className="mt-4">
          {filteredMyComps.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-14 w-14 bg-compete-light rounded-2xl flex items-center justify-center mb-3">
                  <Trophy className="h-7 w-7 text-compete" />
                </div>
                <p className="font-medium text-foreground mb-1">
                  {myCompFilter === 'active' ? 'No active competitions' :
                   myCompFilter === 'upcoming' ? 'No upcoming competitions' :
                   'No past competitions'}
                </p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  {myCompFilter === 'active'
                    ? 'Browse below to find a competition to join.'
                    : myCompFilter === 'upcoming'
                    ? "You don't have any competitions starting soon."
                    : "You haven't completed any competitions yet."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredMyComps.map(comp => {
                const info = myTeamInfo[comp.id];
                const isLadder = comp.scoring_mode === 'challenge';
                const isDoubles = comp.format === 'doubles' || comp.format === 'mixed_doubles';
                const isPastComp = classifyCompetition(comp) === 'past';
                return (
                  <Card
                    key={comp.id}
                    className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => onSelectCompetition(comp)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="font-semibold text-sm truncate">{comp.name}</h3>
                            <Badge variant="outline" className="text-xs">
                              {isLadder ? <Swords className="h-3 w-3 mr-0.5" /> : <Trophy className="h-3 w-3 mr-0.5" />}
                              {isLadder ? 'Ladder' : 'Round Robin'}
                            </Badge>
                            <Badge className={`text-xs flex-shrink-0 ${statusBadgeClass(comp)}`}>
                              {statusLabel(comp)}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {info?.rank > 0 && (
                              <span className="font-medium text-compete">
                                {isPastComp ? `Finished #${info.rank}` : `Rank #${info.rank}`}
                              </span>
                            )}
                            {info?.record && (
                              <span>{info.record}</span>
                            )}
                            {isDoubles && info?.partnerName && (
                              <span>w/ {info.partnerName}</span>
                            )}
                            {!isPastComp && info?.nextOpponent && (
                              <span>Next: vs {info.nextOpponent}</span>
                            )}
                            {!isPastComp && info?.nextDeadline && (
                              <span className="flex items-center gap-0.5">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(info.nextDeadline), 'MMM d')}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-[44px] text-xs flex-shrink-0"
                          onClick={(e) => { e.stopPropagation(); onSelectCompetition(comp); }}
                        >
                          View
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Available to Join */}
      <section>
        <h2 className="text-lg font-bold text-foreground mb-4">Available to Join</h2>
        <FilterChips filters={AVAILABLE_FILTERS} activeFilter={filter} onChange={setFilter} />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
          {filteredAvailable.length === 0 ? (
            <Card className="border-0 shadow-sm col-span-full">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {availableCompetitions.length === 0
                    ? "You've joined all available competitions. Check back later for new ones!"
                    : "No competitions found matching your filters."}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredAvailable.map(comp => {
              const creator = creatorProfiles[comp.admin_id];
              return (
                <CompetitionCard
                  key={comp.id}
                  competition={comp}
                  onSelect={onSelectCompetition}
                  teamCount={teamCounts[comp.id] || 0}
                  playerCount={playerCounts[comp.id] || 0}
                  creatorName={creator?.name}
                  creatorRole={creator?.role}
                  showCreator
                />
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};

export default CompetePlayerView;
