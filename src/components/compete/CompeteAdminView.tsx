import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trophy, Settings, ChevronRight, Users, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Competition } from './types';
import CompetitionCard from './CompetitionCard';
import FilterChips from './FilterChips';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { format } from 'date-fns';

interface CompeteAdminViewProps {
  onSelectCompetition: (c: Competition) => void;
  onManageCompetition: (c: Competition) => void;
  onCreateNew: () => void;
}

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Ladders', value: 'ladder' },
  { label: 'Round Robins', value: 'round_robin' },
  { label: 'Community', value: 'community' },
  { label: 'Public', value: 'public' },
  { label: 'Open', value: 'open' },
];

const CompeteAdminView = ({ onSelectCompetition, onManageCompetition, onCreateNew }: CompeteAdminViewProps) => {
  const { currentUser } = useAuth();
  const [myCreated, setMyCreated] = useState<Competition[]>([]);
  const [browseCompetitions, setBrowseCompetitions] = useState<Competition[]>([]);
  const [teamCounts, setTeamCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const loadData = useCallback(async () => {
    if (!currentUser?.id) return;
    setIsLoading(true);
    try {
      // My created competitions
      const { data: created } = await supabase
        .from('ladders')
        .select('*')
        .eq('admin_id', currentUser.id)
        .order('created_at', { ascending: false });
      setMyCreated((created || []) as Competition[]);

      // Browse: all competitions in user's HOA
      let query = supabase.from('ladders').select('*').in('status', ['setup', 'active']);
      if (currentUser.hoaId) {
        query = query.eq('hoa_id', currentUser.hoaId);
      }
      const { data: browse } = await query.order('created_at', { ascending: false });
      const browseFiltered = (browse || []).filter(b => b.admin_id !== currentUser.id) as Competition[];
      setBrowseCompetitions(browseFiltered);

      // Team counts
      const allIds = [...(created || []).map(c => c.id), ...browseFiltered.map(b => b.id)];
      if (allIds.length > 0) {
        const { data: teams } = await supabase.from('ladder_teams').select('ladder_id').in('ladder_id', allIds);
        const counts: Record<string, number> = {};
        teams?.forEach(t => { counts[t.ladder_id] = (counts[t.ladder_id] || 0) + 1; });
        setTeamCounts(counts);
      }
    } catch (error) {
      console.error('Error loading admin compete data:', error);
      toast.error('Failed to load competitions');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id, currentUser?.hoaId]);

  useEffect(() => { loadData(); }, [loadData]);

  useRealtimeSubscription({ table: 'ladders', event: '*', onChange: loadData, enabled: !!currentUser?.id });

  const statusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Active</Badge>;
      case 'completed': return <Badge variant="secondary" className="text-xs">Completed</Badge>;
      default: return <Badge variant="outline" className="text-xs">Setup</Badge>;
    }
  };

  const filteredBrowse = browseCompetitions.filter(c => {
    if (filter === 'all') return true;
    if (filter === 'community') return c.hoa_only;
    if (filter === 'public') return !c.hoa_only && !c.is_private;
    if (filter === 'open') return c.status === 'setup';
    if (filter === 'ladder') return c.scoring_mode === 'challenge';
    if (filter === 'round_robin') return c.scoring_mode !== 'challenge';
    return true;
  });

  return (
    <div className="space-y-6">
      <Tabs defaultValue="my-competitions" className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList className="bg-card border-0 shadow-sm p-1 h-auto">
            <TabsTrigger value="my-competitions" className="data-[state=active]:bg-foreground data-[state=active]:text-background rounded-lg px-4 py-2 text-sm">
              My Competitions
            </TabsTrigger>
            <TabsTrigger value="browse" className="data-[state=active]:bg-foreground data-[state=active]:text-background rounded-lg px-4 py-2 text-sm">
              Browse
            </TabsTrigger>
          </TabsList>
          
          <Button onClick={onCreateNew} className="bg-compete hover:bg-compete/90 text-compete-foreground min-h-[44px]">
            <Plus className="mr-1.5 h-4 w-4" /> Create
          </Button>
        </div>

        <TabsContent value="my-competitions" className="mt-0">
          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Card key={i} className="animate-pulse border-0 shadow-sm"><CardContent className="p-6"><div className="h-16 bg-muted rounded" /></CardContent></Card>)}</div>
          ) : myCreated.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-14 w-14 bg-compete-light rounded-2xl flex items-center justify-center mb-3">
                  <Trophy className="h-7 w-7 text-compete" />
                </div>
                <p className="text-sm text-muted-foreground mb-4">You haven't created any competitions yet.</p>
                <Button onClick={onCreateNew} className="bg-compete hover:bg-compete/90 text-compete-foreground min-h-[44px]">
                  <Plus className="mr-1.5 h-4 w-4" /> Create Competition
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {myCreated.map(comp => (
                <Card key={comp.id} className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => onManageCompetition(comp)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-sm truncate">{comp.name}</h3>
                          {statusBadge(comp.status)}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="capitalize">{comp.format.replace('_', ' ')}</span>
                          <span className="flex items-center gap-0.5"><Users className="h-3 w-3" /> {teamCounts[comp.id] || 0} players</span>
                          {comp.start_date && <span className="flex items-center gap-0.5"><Calendar className="h-3 w-3" /> {format(new Date(comp.start_date), 'MMM d')}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button size="sm" variant="outline" className="min-h-[36px] text-xs" onClick={(e) => { e.stopPropagation(); onManageCompetition(comp); }}>
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
        </TabsContent>

        <TabsContent value="browse" className="mt-0">
          <FilterChips filters={FILTERS} activeFilter={filter} onChange={setFilter} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
            {filteredBrowse.length === 0 ? (
              <Card className="border-0 shadow-sm col-span-full">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <p className="text-sm text-muted-foreground">No other competitions found.</p>
                </CardContent>
              </Card>
            ) : (
              filteredBrowse.map(comp => (
                <CompetitionCard key={comp.id} competition={comp} onSelect={onSelectCompetition} teamCount={teamCounts[comp.id] || 0} showCreator />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CompeteAdminView;
