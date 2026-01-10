import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import LadderList from '@/components/ladders/LadderList';
import LadderDetails from '@/components/ladders/LadderDetails';
import LadderDiscovery from '@/components/ladders/LadderDiscovery';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

export interface Ladder {
  id: string;
  name: string;
  format: 'singles' | 'doubles' | 'mixed_doubles';
  status: 'setup' | 'active' | 'completed';
  is_private: boolean;
  start_date: string | null;
  weekly_deadline_day: number | null;
  description: string | null;
  admin_id: string;
  hoa_id: string;
  created_at: string;
  updated_at: string;
  min_ntrp?: number | null;
  max_ntrp?: number | null;
  auto_approve_registration?: boolean;
  registration_deadline?: string | null;
  image_url?: string | null;
  max_teams?: number;
  end_date?: string | null;
  enable_playoffs?: boolean;
  playoff_teams_count?: number;
  scoring_format?: string;
  points_per_win?: number;
  points_per_set?: number;
  tiebreaker_rule?: string;
  gender_restriction?: string | null;
  third_set_format?: string;
  scoring_mode?: string;
  challenge_range?: number;
  acceptance_window_hours?: number;
  defense_period_days?: number;
  play_by_deadline_days?: number;
  participation_points?: number;
  loss_points?: number;
  secondary_tiebreaker?: string;
}

const LeaguesLadders = () => {
  const { currentUser, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [ladders, setLadders] = useState<Ladder[]>([]);
  const [selectedLadder, setSelectedLadder] = useState<Ladder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'my-ladders' | 'discover'>('my-ladders');
  const [searchQuery, setSearchQuery] = useState('');
  const [teamCounts, setTeamCounts] = useState<Record<string, number>>({});

  // Check if user is a coach
  const [isCoach, setIsCoach] = useState(false);

  useEffect(() => {
    checkIsCoach();
  }, [currentUser?.id]);

  const checkIsCoach = async () => {
    if (!currentUser?.id) return;
    const { data } = await supabase
      .from('coaches')
      .select('id')
      .eq('user_id', currentUser.id)
      .maybeSingle();
    setIsCoach(!!data);
  };

  const canManageLadders = isAdmin || isCoach;

  const loadLaddersCallback = useCallback(() => {
    loadLadders();
  }, [currentUser?.hoaId]);

  // Real-time subscription for ladder changes (when ladders are deleted/updated)
  useRealtimeSubscription({
    table: 'ladders',
    event: '*',
    onChange: loadLaddersCallback,
    enabled: !!currentUser?.hoaId
  });

  useEffect(() => {
    loadLadders();
  }, [currentUser?.hoaId]);

  const loadLadders = async () => {
    if (!currentUser?.hoaId) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('ladders')
        .select('*')
        .eq('hoa_id', currentUser.hoaId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLadders(data || []);
      
      // Load team counts for each ladder
      if (data && data.length > 0) {
        const { data: teams } = await supabase
          .from('ladder_teams')
          .select('ladder_id')
          .in('ladder_id', data.map(l => l.id));
        
        if (teams) {
          const counts: Record<string, number> = {};
          teams.forEach(team => {
            counts[team.ladder_id] = (counts[team.ladder_id] || 0) + 1;
          });
          setTeamCounts(counts);
        }
      }
    } catch (error) {
      console.error('Error loading ladders:', error);
      toast.error('Failed to load ladders');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter ladders based on search query
  const filterLadders = (ladderList: Ladder[]) => {
    if (!searchQuery.trim()) return ladderList;
    const query = searchQuery.toLowerCase();
    return ladderList.filter(ladder => 
      ladder.name.toLowerCase().includes(query) ||
      ladder.format.toLowerCase().includes(query) ||
      ladder.description?.toLowerCase().includes(query)
    );
  };

  if (selectedLadder) {
    return (
      <LadderDetails 
        ladder={selectedLadder} 
        onBack={() => setSelectedLadder(null)}
        onLadderUpdated={loadLadders}
      />
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Compete</h1>
            <p className="text-muted-foreground mt-1">
              Join ladders and compete in round-robin tournaments.<br className="hidden sm:block" />
              Rise through the ranks and showcase your skills.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Find Ladders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-full sm:w-64 bg-white border-0 shadow-sm"
              />
            </div>
            
            {canManageLadders && (
              <Button 
                onClick={() => navigate('/manage-ladders')}
                variant="outline"
                className="bg-white border-0 shadow-sm"
              >
                <Settings className="mr-2 h-4 w-4" />
                Manage
              </Button>
            )}
          </div>
        </div>

        {viewMode === 'discover' ? (
          <LadderDiscovery 
            onSelectLadder={(ladder) => {
              setSelectedLadder(ladder);
              setViewMode('my-ladders');
            }}
          />
        ) : (
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="bg-white border-0 shadow-sm p-1 h-auto">
              <TabsTrigger 
                value="active" 
                className="data-[state=active]:bg-foreground data-[state=active]:text-background rounded-lg px-6 py-2"
              >
                Active
              </TabsTrigger>
              <TabsTrigger 
                value="setup"
                className="data-[state=active]:bg-foreground data-[state=active]:text-background rounded-lg px-6 py-2"
              >
                Open for Registration
              </TabsTrigger>
              <TabsTrigger 
                value="completed"
                className="data-[state=active]:bg-foreground data-[state=active]:text-background rounded-lg px-6 py-2"
              >
                Completed
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-6">
              <LadderList 
                ladders={filterLadders(ladders.filter(l => l.status === 'active'))}
                onSelectLadder={setSelectedLadder}
                isLoading={isLoading}
                emptyMessage="No active ladders. Click 'Find Ladders' to discover and join one!"
                teamCounts={teamCounts}
              />
            </TabsContent>

            <TabsContent value="setup" className="mt-6">
              <LadderList 
                ladders={filterLadders(ladders.filter(l => l.status === 'setup'))}
                onSelectLadder={setSelectedLadder}
                isLoading={isLoading}
                emptyMessage="No ladders open for registration."
                teamCounts={teamCounts}
              />
            </TabsContent>

            <TabsContent value="completed" className="mt-6">
              <LadderList 
                ladders={filterLadders(ladders.filter(l => l.status === 'completed'))}
                onSelectLadder={setSelectedLadder}
                isLoading={isLoading}
                emptyMessage="No completed ladders."
                teamCounts={teamCounts}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default LeaguesLadders;
