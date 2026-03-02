import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Edit, Trash2, Users, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import CreateLadderDialog from '@/components/ladders/CreateLadderDialog';
import LadderDetails from '@/components/ladders/LadderDetails';
import { Ladder } from '@/pages/LeaguesLadders';
import { format } from 'date-fns';

const ManageLadders = () => {
  const { currentUser, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [ladders, setLadders] = useState<Ladder[]>([]);
  const [selectedLadder, setSelectedLadder] = useState<Ladder | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingLadder, setEditingLadder] = useState<Ladder | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is a coach
  const [isCoach, setIsCoach] = useState(false);

  useEffect(() => {
    checkIsCoach();
    loadManagedLadders();
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

  const loadManagedLadders = async () => {
    if (!currentUser?.id) return;

    try {
      setIsLoading(true);
      // Load ladders where user is the admin
      const { data, error } = await supabase
        .from('ladders')
        .select('*')
        .eq('admin_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLadders(data || []);
    } catch (error) {
      console.error('Error loading ladders:', error);
      toast.error('Failed to load your ladders');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLadderCreated = (newLadder: Ladder) => {
    if (editingLadder) {
      // Update existing ladder in the list
      setLadders(prev => prev.map(l => l.id === newLadder.id ? newLadder : l));
    } else {
      // Add new ladder to the list
      setLadders(prev => [newLadder, ...prev]);
    }
    setShowCreateDialog(false);
    setEditingLadder(null);
  };

  const handleEditLadder = (ladder: Ladder, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingLadder(ladder);
    setShowCreateDialog(true);
  };

  const handleDeleteLadder = async (ladderId: string) => {
    if (!confirm('Are you sure you want to delete this ladder? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('ladders')
        .delete()
        .eq('id', ladderId)
        .eq('admin_id', currentUser?.id);

      if (error) throw error;
      
      setLadders(prev => prev.filter(l => l.id !== ladderId));
      toast.success('Ladder deleted');
    } catch (error) {
      console.error('Error deleting ladder:', error);
      toast.error('Failed to delete ladder');
    }
  };

  const canCreateLadder = isAdmin || isCoach;

  if (!canCreateLadder) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
          <p className="text-muted-foreground">
            Only HOA Admins and Coaches can create and manage ladders.
          </p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => navigate('/leagues-ladders')}
          >
            Browse Ladders
          </Button>
        </div>
      </div>
    );
  }

  if (selectedLadder) {
    return (
      <LadderDetails 
        ladder={selectedLadder} 
        onBack={() => setSelectedLadder(null)}
        onLadderUpdated={loadManagedLadders}
      />
    );
  }


  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate('/leagues-ladders')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Compete
        </Button>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Manage Ladders</h1>
          <p className="text-muted-foreground">
            Create and manage your competitive ladders
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Ladder
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-4 bg-muted rounded w-2/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : ladders.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <div className="text-muted-foreground mb-4">
              You haven't created any ladders yet.
            </div>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Ladder
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ladders.map(ladder => (
            <Card 
              key={ladder.id} 
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => setSelectedLadder(ladder)}
            >
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{ladder.name}</CardTitle>
                  <Badge variant={
                    ladder.status === 'active' ? 'default' :
                    ladder.status === 'completed' ? 'secondary' : 'outline'
                  }>
                    {ladder.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span className="capitalize">{ladder.format.replace('_', ' ')}</span>
                  </div>
                  {ladder.start_date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>Starts: {format(new Date(ladder.start_date), 'MMM d, yyyy')}</span>
                    </div>
                  )}
                  {(ladder as any).registration_deadline && (
                    <div className="flex items-center gap-2 text-orange-600">
                      <Calendar className="h-4 w-4" />
                      <span>Registration closes: {format(new Date((ladder as any).registration_deadline), 'MMM d, yyyy')}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 mt-4" onClick={e => e.stopPropagation()}>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={(e) => handleEditLadder(ladder, e)}
                  >
                    <Edit className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                  {ladder.status === 'setup' && (
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => handleDeleteLadder(ladder.id)}
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      Delete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateLadderDialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) setEditingLadder(null);
        }}
        onLadderCreated={handleLadderCreated}
        editingLadder={editingLadder}
      />
    </div>
  );
};

export default ManageLadders;