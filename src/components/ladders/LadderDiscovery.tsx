import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Search, Filter, MapPin, Users, Trophy, Calendar, ArrowRight, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Ladder } from '@/pages/LeaguesLadders';
import LadderJoinDialog from './LadderJoinDialog';
import NtrpRequiredAlert from './NtrpRequiredAlert';
import { format } from 'date-fns';

interface DiscoverableLadder extends Ladder {
  hoa_name?: string;
  team_count?: number;
  user_registered?: boolean;
  user_pending_request?: boolean;
}

interface LadderDiscoveryProps {
  onSelectLadder: (ladder: Ladder) => void;
}

const LadderDiscovery = ({ onSelectLadder }: LadderDiscoveryProps) => {
  const { currentUser } = useAuth();
  const [ladders, setLadders] = useState<DiscoverableLadder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLadder, setSelectedLadder] = useState<DiscoverableLadder | null>(null);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showNtrpAlert, setShowNtrpAlert] = useState(false);
  const [userNtrp, setUserNtrp] = useState<number | null>(null);

  // Filter state
  const [filters, setFilters] = useState({
    search: '',
    format: 'all',
    status: 'all',
    communityOnly: true,
    minNtrp: 1.0,
    maxNtrp: 7.0,
    maxDistance: 50,
  });

  useEffect(() => {
    loadUserNtrp();
    loadLadders();
  }, [currentUser, filters.communityOnly]);

  const loadUserNtrp = async () => {
    if (!currentUser?.id) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('ntrp_rating')
        .eq('id', currentUser.id)
        .single();

      if (error) throw error;
      setUserNtrp(data?.ntrp_rating || null);
    } catch (error) {
      console.error('Error loading user NTRP:', error);
    }
  };

  const loadLadders = async () => {
    if (!currentUser) return;

    try {
      setIsLoading(true);
      
      let query = supabase
        .from('ladders')
        .select(`
          *,
          hoas!inner(name)
        `)
        .in('status', ['setup', 'active'])
        .eq('is_private', false);

      // Filter by community if option selected
      if (filters.communityOnly && currentUser.hoaId) {
        query = query.eq('hoa_id', currentUser.hoaId);
      }

      const { data: laddersData, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      // Get team counts and user registration status
      const ladderIds = laddersData?.map(l => l.id) || [];
      
      const [teamsResult, requestsResult, userTeamsResult] = await Promise.all([
        supabase
          .from('ladder_teams')
          .select('ladder_id')
          .in('ladder_id', ladderIds),
        supabase
          .from('ladder_registration_requests')
          .select('ladder_id, status')
          .eq('player_id', currentUser.id)
          .in('ladder_id', ladderIds),
        supabase
          .from('ladder_teams')
          .select('ladder_id')
          .in('ladder_id', ladderIds)
          .or(`player1_id.eq.${currentUser.id},player2_id.eq.${currentUser.id}`)
      ]);

      // Count teams per ladder
      const teamCounts: Record<string, number> = {};
      teamsResult.data?.forEach(t => {
        teamCounts[t.ladder_id] = (teamCounts[t.ladder_id] || 0) + 1;
      });

      // Check user registration status
      const pendingRequests = new Set(
        requestsResult.data?.filter(r => r.status === 'pending').map(r => r.ladder_id) || []
      );
      const userRegisteredLadders = new Set(
        userTeamsResult.data?.map(t => t.ladder_id) || []
      );

      const enrichedLadders: DiscoverableLadder[] = (laddersData || []).map(ladder => ({
        ...ladder,
        hoa_name: (ladder.hoas as any)?.name,
        team_count: teamCounts[ladder.id] || 0,
        user_registered: userRegisteredLadders.has(ladder.id),
        user_pending_request: pendingRequests.has(ladder.id),
      }));

      setLadders(enrichedLadders);
    } catch (error) {
      console.error('Error loading ladders:', error);
      toast.error('Failed to load ladders');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinClick = (ladder: DiscoverableLadder) => {
    // Check if ladder has NTRP requirements and user doesn't have NTRP set
    if ((ladder.min_ntrp || ladder.max_ntrp) && userNtrp === null) {
      setSelectedLadder(ladder);
      setShowNtrpAlert(true);
      return;
    }

    // Check if user meets NTRP requirements
    if (userNtrp !== null) {
      if (ladder.min_ntrp && userNtrp < ladder.min_ntrp) {
        toast.error(`Your NTRP (${userNtrp}) is below the minimum required (${ladder.min_ntrp})`);
        return;
      }
      if (ladder.max_ntrp && userNtrp > ladder.max_ntrp) {
        toast.error(`Your NTRP (${userNtrp}) is above the maximum allowed (${ladder.max_ntrp})`);
        return;
      }
    }

    setSelectedLadder(ladder);
    setShowJoinDialog(true);
  };

  const getFormatLabel = (format: string) => {
    switch (format) {
      case 'singles': return 'Singles';
      case 'doubles': return 'Doubles';
      case 'mixed_doubles': return 'Mixed Doubles';
      default: return format;
    }
  };

  const filteredLadders = ladders.filter(ladder => {
    if (filters.search && !ladder.name.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    if (filters.format !== 'all' && ladder.format !== filters.format) {
      return false;
    }
    if (filters.status !== 'all' && ladder.status !== filters.status) {
      return false;
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-32 mb-4" />
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search ladders..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Format</Label>
                  <Select
                    value={filters.format}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, format: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Formats</SelectItem>
                      <SelectItem value="singles">Singles</SelectItem>
                      <SelectItem value="doubles">Doubles</SelectItem>
                      <SelectItem value="mixed_doubles">Mixed Doubles</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={filters.status}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="setup">Accepting Teams</SelectItem>
                      <SelectItem value="active">In Progress</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-3 pt-6">
                  <Switch
                    id="community-only"
                    checked={filters.communityOnly}
                    onCheckedChange={(checked) => setFilters(prev => ({ ...prev, communityOnly: checked }))}
                  />
                  <Label htmlFor="community-only" className="cursor-pointer">
                    My Community Only
                  </Label>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User NTRP Display */}
      {userNtrp && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Trophy className="h-4 w-4" />
          <span>Your NTRP Rating: <strong>{userNtrp}</strong></span>
        </div>
      )}

      {/* Ladder List */}
      {filteredLadders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">No ladders found</p>
            <p className="text-sm text-muted-foreground">
              {filters.communityOnly 
                ? 'Try enabling public ladders or adjust your filters'
                : 'Try adjusting your filters'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredLadders.map(ladder => (
            <Card key={ladder.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{ladder.name}</h3>
                      <Badge variant={ladder.status === 'active' ? 'default' : 'outline'}>
                        {ladder.status === 'setup' ? 'Accepting Teams' : 'In Progress'}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-3">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {ladder.hoa_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {ladder.team_count} {ladder.format === 'singles' ? 'players' : 'teams'}
                      </span>
                      <span className="capitalize">{getFormatLabel(ladder.format)}</span>
                      {ladder.start_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          Starts {format(new Date(ladder.start_date), 'MMM d, yyyy')}
                        </span>
                      )}
                    </div>

                    {(ladder.min_ntrp || ladder.max_ntrp) && (
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="secondary" className="font-normal">
                          NTRP: {ladder.min_ntrp || '1.0'} - {ladder.max_ntrp || '7.0'}
                        </Badge>
                        {userNtrp !== null && (
                          <>
                            {userNtrp >= (ladder.min_ntrp || 0) && userNtrp <= (ladder.max_ntrp || 7) ? (
                              <span className="text-green-600 text-xs">You qualify</span>
                            ) : (
                              <span className="text-red-600 text-xs flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                You don't meet requirements
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {ladder.description && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {ladder.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectLadder(ladder)}
                    >
                      View Details
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                    
                    {ladder.user_registered ? (
                      <Badge variant="default">Joined</Badge>
                    ) : ladder.user_pending_request ? (
                      <Badge variant="secondary">Request Pending</Badge>
                    ) : ladder.status === 'setup' ? (
                      <Button
                        size="sm"
                        onClick={() => handleJoinClick(ladder)}
                      >
                        Join Ladder
                      </Button>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Join Dialog */}
      {selectedLadder && (
        <LadderJoinDialog
          open={showJoinDialog}
          onOpenChange={setShowJoinDialog}
          ladder={selectedLadder}
          userNtrp={userNtrp}
          onRegistrationComplete={() => {
            loadLadders();
            setShowJoinDialog(false);
          }}
        />
      )}

      {/* NTRP Required Alert */}
      <NtrpRequiredAlert
        open={showNtrpAlert}
        onOpenChange={setShowNtrpAlert}
      />
    </div>
  );
};

export default LadderDiscovery;
