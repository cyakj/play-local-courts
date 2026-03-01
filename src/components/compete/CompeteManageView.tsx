import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trophy, Settings, ChevronRight, Users, Calendar, Swords } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Competition } from './types';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { format } from 'date-fns';

interface CompeteManageViewProps {
  onSelectCompetition: (c: Competition) => void;
  onManageCompetition: (c: Competition) => void;
  onCreateNew: () => void;
}

const CompeteManageView = ({ onSelectCompetition, onManageCompetition, onCreateNew }: CompeteManageViewProps) => {
  const { currentUser } = useAuth();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [teamCounts, setTeamCounts] = useState<Record<string, number>>({});
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!currentUser?.id) return;
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('ladders')
        .select('*')
        .eq('admin_id', currentUser.id)
        .order('created_at', { ascending: false });
      const comps = (data || []) as Competition[];
      setCompetitions(comps);

      const allIds = comps.map(c => c.id);
      if (allIds.length > 0) {
        // Count confirmed teams
        const { data: teams } = await supabase
          .from('ladder_teams')
          .select('ladder_id, player1_id, player2_id')
          .in('ladder_id', allIds);
        const tCounts: Record<string, number> = {};
        const pCounts: Record<string, number> = {};
        
        // Initialize
        allIds.forEach(id => { tCounts[id] = 0; pCounts[id] = 0; });
        
        // Count teams and players from confirmed teams
        teams?.forEach(t => {
          tCounts[t.ladder_id] = (tCounts[t.ladder_id] || 0) + 1;
          pCounts[t.ladder_id] = (pCounts[t.ladder_id] || 0) + 1;
          if (t.player2_id) pCounts[t.ladder_id] = (pCounts[t.ladder_id] || 0) + 1;
        });
        
        // Count players from pending registration requests (not yet on a team)
        const { data: reqs } = await supabase
          .from('ladder_registration_requests')
          .select('ladder_id, player_id, partner_id, status')
          .in('ladder_id', allIds)
          .in('status', ['pending', 'pending_partner']);
        
        // Collect confirmed player IDs per ladder to avoid double-counting
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
    } catch (error) {
      console.error('Error loading manage data:', error);
      toast.error('Failed to load competitions');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => { loadData(); }, [loadData]);
  useRealtimeSubscription({ table: 'ladders', event: '*', onChange: loadData, enabled: !!currentUser?.id });

  const statusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Active</Badge>;
      case 'completed': return <Badge variant="secondary" className="text-xs">Completed</Badge>;
      default: return <Badge variant="outline" className="text-xs">Open for Registration</Badge>;
    }
  };

  const visibilityBadge = (comp: Competition) => {
    if (comp.hoa_only) return <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">Community</Badge>;
    if (comp.is_private) return <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">Private</Badge>;
    return <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">Public</Badge>;
  };

  const formatBadge = (comp: Competition) => {
    const isLadder = comp.scoring_mode === 'challenge';
    return (
      <Badge variant="outline" className="text-xs">
        {isLadder ? <Swords className="h-3 w-3 mr-0.5" /> : <Trophy className="h-3 w-3 mr-0.5" />}
        {isLadder ? 'Ladder' : 'Round Robin'}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse border-0 shadow-sm">
            <CardContent className="p-6"><div className="h-16 bg-muted rounded" /></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Create button */}
      <div className="flex justify-end">
        <Button onClick={onCreateNew} className="bg-compete hover:bg-compete/90 text-compete-foreground min-h-[44px]">
          <Plus className="mr-1.5 h-4 w-4" /> Create Competition
        </Button>
      </div>

      {/* Competitions list */}
      {competitions.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-14 w-14 bg-compete-light rounded-2xl flex items-center justify-center mb-4">
              <Trophy className="h-7 w-7 text-compete" />
            </div>
            <p className="font-medium text-foreground mb-1">No competitions yet</p>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              You have not created any competitions yet. Tap Create Competition to get started.
            </p>
            <Button onClick={onCreateNew} className="bg-compete hover:bg-compete/90 text-compete-foreground min-h-[44px]">
              <Plus className="mr-1.5 h-4 w-4" /> Create Competition
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {competitions.map(comp => (
            <Card
              key={comp.id}
              className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onManageCompetition(comp)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <h3 className="font-semibold text-sm truncate">{comp.name}</h3>
                      {formatBadge(comp)}
                      {visibilityBadge(comp)}
                      {statusBadge(comp.status)}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <Users className="h-3 w-3" />
                        {playerCounts[comp.id] || 0} players registered
                        {(comp.format === 'doubles' || comp.format === 'mixed_doubles') && ` · ${teamCounts[comp.id] || 0} teams confirmed`}
                      </span>
                      {comp.registration_deadline && (
                        <span className="flex items-center gap-0.5">
                          <Calendar className="h-3 w-3" />
                          Reg. by {format(new Date(comp.registration_deadline), 'MMM d')}
                        </span>
                      )}
                      {comp.start_date && (
                        <span className="flex items-center gap-0.5">
                          <Calendar className="h-3 w-3" />
                          Starts {format(new Date(comp.start_date), 'MMM d')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-[44px] text-xs"
                      onClick={(e) => { e.stopPropagation(); onManageCompetition(comp); }}
                    >
                      <Settings className="h-3.5 w-3.5 mr-1" /> Manage
                    </Button>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default CompeteManageView;
