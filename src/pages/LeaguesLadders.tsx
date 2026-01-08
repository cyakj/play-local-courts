import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Search, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import LadderList from '@/components/ladders/LadderList';
import LadderDetails from '@/components/ladders/LadderDetails';
import LadderDiscovery from '@/components/ladders/LadderDiscovery';

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
}

const LeaguesLadders = () => {
  const { currentUser, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [ladders, setLadders] = useState<Ladder[]>([]);
  const [selectedLadder, setSelectedLadder] = useState<Ladder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'my-ladders' | 'discover'>('my-ladders');

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
      .single();
    setIsCoach(!!data);
  };

  const canManageLadders = isAdmin || isCoach;

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
    } catch (error) {
      console.error('Error loading ladders:', error);
      toast.error('Failed to load ladders');
    } finally {
      setIsLoading(false);
    }
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
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Compete</h1>
          <p className="text-muted-foreground">
            Join ladders and compete in round-robin tournaments
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={viewMode === 'discover' ? 'default' : 'outline'}
            onClick={() => setViewMode('discover')}
          >
            <Search className="mr-2 h-4 w-4" />
            Find Ladders
          </Button>
          {canManageLadders && (
            <Button onClick={() => navigate('/manage-ladders')}>
              <Settings className="mr-2 h-4 w-4" />
              Manage Ladders
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
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="setup">Open for Registration</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-6">
            <LadderList 
              ladders={ladders.filter(l => l.status === 'active')}
              onSelectLadder={setSelectedLadder}
              isLoading={isLoading}
              emptyMessage="No active ladders. Click 'Find Ladders' to discover and join one!"
            />
          </TabsContent>

          <TabsContent value="setup" className="mt-6">
            <LadderList 
              ladders={ladders.filter(l => l.status === 'setup')}
              onSelectLadder={setSelectedLadder}
              isLoading={isLoading}
              emptyMessage="No ladders open for registration."
            />
          </TabsContent>

          <TabsContent value="completed" className="mt-6">
            <LadderList 
              ladders={ladders.filter(l => l.status === 'completed')}
              onSelectLadder={setSelectedLadder}
              isLoading={isLoading}
              emptyMessage="No completed ladders."
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default LeaguesLadders;
