
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import CreateLadderDialog from '@/components/ladders/CreateLadderDialog';
import LadderList from '@/components/ladders/LadderList';
import LadderDetails from '@/components/ladders/LadderDetails';

export interface Ladder {
  id: string;
  name: string;
  format: 'singles' | 'doubles';
  status: 'setup' | 'active' | 'completed';
  is_private: boolean;
  start_date: string | null;
  weekly_deadline_day: number | null;
  description: string | null;
  admin_id: string;
  hoa_id: string;
  created_at: string;
  updated_at: string;
}

const LeaguesLadders = () => {
  const { currentUser } = useAuth();
  const [ladders, setLadders] = useState<Ladder[]>([]);
  const [selectedLadder, setSelectedLadder] = useState<Ladder | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
          <h1 className="text-3xl font-bold">Leagues & Ladders</h1>
          <p className="text-muted-foreground">
            Compete in round-robin tournaments with your community
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Ladder
          </Button>
        )}
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList>
          <TabsTrigger value="active">Active Ladders</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="setup">Setup</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6">
          <LadderList 
            ladders={ladders.filter(l => l.status === 'active')}
            onSelectLadder={setSelectedLadder}
            isLoading={isLoading}
            emptyMessage="No active ladders found."
          />
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          <LadderList 
            ladders={ladders.filter(l => l.status === 'completed')}
            onSelectLadder={setSelectedLadder}
            isLoading={isLoading}
            emptyMessage="No completed ladders found."
          />
        </TabsContent>

        <TabsContent value="setup" className="mt-6">
          <LadderList 
            ladders={ladders.filter(l => l.status === 'setup')}
            onSelectLadder={setSelectedLadder}
            isLoading={isLoading}
            emptyMessage="No ladders in setup found."
          />
        </TabsContent>
      </Tabs>

      <CreateLadderDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onLadderCreated={handleLadderCreated}
      />
    </div>
  );
};

export default LeaguesLadders;
