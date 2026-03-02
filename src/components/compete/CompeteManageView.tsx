import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trophy, Settings, ChevronRight, Users, Calendar, Swords, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Competition, WizardFormData } from './types';
import FilterChips from './FilterChips';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { format, isPast, isFuture, parseISO } from 'date-fns';

interface CompeteManageViewProps {
  onSelectCompetition: (c: Competition) => void;
  onManageCompetition: (c: Competition) => void;
  onCreateNew: (initialData?: Partial<WizardFormData>) => void;
}

const MANAGE_FILTERS = [
  { label: 'Active', value: 'active' },
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'Draft', value: 'draft' },
  { label: 'Past', value: 'past' },
];

type ManageFilter = 'active' | 'upcoming' | 'draft' | 'past';

const classifyAdminComp = (comp: Competition): ManageFilter => {
  if (comp.status === 'completed') return 'past';
  if (comp.end_date && isPast(parseISO(comp.end_date))) return 'past';
  if (comp.status === 'active') return 'active';
  // status === 'setup'
  if (comp.start_date && isFuture(parseISO(comp.start_date))) return 'upcoming';
  // setup with no start date = draft
  if (!comp.start_date) return 'draft';
  return 'active';
};

const competitionToWizardData = (comp: Competition): Partial<WizardFormData> => ({
  competitionType: comp.scoring_mode === 'challenge' ? 'ladder' : 'round_robin',
  name: `${comp.name} (Copy)`,
  description: comp.description || '',
  city: comp.city || '',
  visibility: comp.hoa_only ? 'community' : comp.is_private ? 'private' : 'public',
  format: comp.format,
  gender_restriction: comp.gender_restriction || 'none',
  min_ntrp: comp.min_ntrp?.toString() || '',
  max_ntrp: comp.max_ntrp?.toString() || '',
  min_age: comp.min_age?.toString() || '',
  max_age: comp.max_age?.toString() || '',
  hoa_only: comp.hoa_only || false,
  max_teams: (comp.max_teams || 20).toString(),
  auto_approve_registration: comp.auto_approve_registration || false,
  weekly_deadline_day: comp.weekly_deadline_day || 0,
  challenge_range: (comp.challenge_range || 3).toString(),
  enable_playoffs: comp.enable_playoffs || false,
  playoff_teams_count: (comp.playoff_teams_count || 4).toString(),
  scoring_mode: comp.scoring_mode || 'cumulative',
  scoring_format: comp.scoring_format || 'best_of_3',
  third_set_format: comp.third_set_format || 'super_tiebreak',
  points_per_win: (comp.points_per_win || 3).toString(),
  points_per_set: (comp.points_per_set || 1).toString(),
  loss_points: (comp.loss_points || 0).toString(),
  tiebreaker_rule: comp.tiebreaker_rule || 'head_to_head',
  secondary_tiebreaker: comp.secondary_tiebreaker || 'games_won',
  acceptance_window_hours: (comp.acceptance_window_hours || 48).toString(),
  play_by_deadline_days: (comp.play_by_deadline_days || 10).toString(),
  require_score_confirmation: comp.require_score_confirmation ?? true,
  dispute_window_hours: (comp.dispute_window_hours || 48).toString(),
});

const CompeteManageView = ({ onSelectCompetition, onManageCompetition, onCreateNew }: CompeteManageViewProps) => {
  const { currentUser } = useAuth();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [teamCounts, setTeamCounts] = useState<Record<string, number>>({});
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<ManageFilter>('active');
  const hasLoadedOnce = React.useRef(false);

  const loadData = useCallback(async () => {
    if (!currentUser?.id) return;
    if (!hasLoadedOnce.current) setIsLoading(true);
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
          .select('ladder_id, player_id, partner_id, status')
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
    } catch (error) {
      console.error('Error loading manage data:', error);
      toast.error('Failed to load competitions');
    } finally {
      setIsLoading(false);
      hasLoadedOnce.current = true;
    }
  }, [currentUser?.id]);

  useEffect(() => { loadData(); }, [loadData]);
  useRealtimeSubscription({ table: 'ladders', event: '*', onChange: loadData, enabled: !!currentUser?.id });

  const filteredComps = competitions.filter(c => classifyAdminComp(c) === activeFilter);

  const statusBadge = (comp: Competition) => {
    const cls = classifyAdminComp(comp);
    switch (cls) {
      case 'active': return <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Active</Badge>;
      case 'upcoming': return <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">Upcoming</Badge>;
      case 'draft': return <Badge variant="outline" className="text-xs">Draft</Badge>;
      case 'past': return <Badge variant="secondary" className="text-xs">Completed</Badge>;
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
        <Button onClick={() => onCreateNew()} className="bg-compete hover:bg-compete/90 text-compete-foreground min-h-[44px]">
          <Plus className="mr-1.5 h-4 w-4" /> Create Competition
        </Button>
      </div>

      {/* Filter chips */}
      <FilterChips
        filters={MANAGE_FILTERS}
        activeFilter={activeFilter}
        onChange={(v) => setActiveFilter(v as ManageFilter)}
      />

      {/* Competitions list */}
      {filteredComps.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-14 w-14 bg-compete-light rounded-2xl flex items-center justify-center mb-4">
              <Trophy className="h-7 w-7 text-compete" />
            </div>
            <p className="font-medium text-foreground mb-1">
              {activeFilter === 'active' ? 'No active competitions' :
               activeFilter === 'upcoming' ? 'No upcoming competitions' :
               activeFilter === 'draft' ? 'No drafts' :
               'No past competitions'}
            </p>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              {activeFilter === 'draft' || activeFilter === 'active'
                ? 'Tap Create Competition to get started.'
                : activeFilter === 'upcoming'
                ? 'Create a competition with a future start date.'
                : 'Completed competitions will appear here.'}
            </p>
            {(activeFilter === 'active' || activeFilter === 'draft') && (
              <Button onClick={() => onCreateNew()} className="bg-compete hover:bg-compete/90 text-compete-foreground min-h-[44px]">
                <Plus className="mr-1.5 h-4 w-4" /> Create Competition
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredComps.map(comp => {
            const isPastComp = classifyAdminComp(comp) === 'past';
            return (
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
                        {statusBadge(comp)}
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
                            {isPastComp ? 'Ran' : 'Starts'} {format(new Date(comp.start_date), 'MMM d')}
                            {comp.end_date && ` – ${format(new Date(comp.end_date), 'MMM d')}`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isPastComp ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-[44px] text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCreateNew(competitionToWizardData(comp));
                          }}
                        >
                          <Copy className="h-3.5 w-3.5 mr-1" /> Duplicate
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-[44px] text-xs"
                          onClick={(e) => { e.stopPropagation(); onManageCompetition(comp); }}
                        >
                          <Settings className="h-3.5 w-3.5 mr-1" /> Manage
                        </Button>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CompeteManageView;
