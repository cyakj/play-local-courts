import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import CreateLadderDialog from '@/components/ladders/CreateLadderDialog';
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
}

const LeaguesLadders = () => {
  const { currentUser } = useAuth();
  const [ladders, setLadders] = useState<Ladder[]>([]);
  const [selectedLadder, setSelectedLadder] = useState<Ladder | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'my-ladders' | 'discover'>('my-ladders');

  const isAdmin = currentUser?.role === 'admin';

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

  const handleLadderCreated = (newLadder: Ladder) => {
    setLadders(prev => [newLadder, ...prev]);
    setShowCreateDialog(false);
    toast.success('Ladder created successfully!');
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
          {isAdmin && (
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Ladder
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

      <CreateLadderDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onLadderCreated={handleLadderCreated}
      />
    </div>
  );
};

export default LeaguesLadders;
