import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Trash2, Calendar, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
}

interface ClientAssignmentsProps {
  clientId: string;
  clientName: string;
  isCoach: boolean;
}

export default function ClientAssignments({ clientId, clientName, isCoach }: ClientAssignmentsProps) {
  const { currentUser } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDueDate, setNewDueDate] = useState('');

  useEffect(() => {
    loadAssignments();
  }, [clientId, currentUser]);

  const loadAssignments = async () => {
    if (!currentUser) return;

    try {
      const query = supabase
        .from('client_assignments')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      
      // If coach, filter by their ID; if player, they're the client
      if (isCoach) {
        query.eq('coach_id', currentUser.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error('Error loading assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  const createAssignment = async () => {
    if (!currentUser || !newTitle.trim()) return;

    setSaving(true);
    try {
      const { error } = await supabase.from('client_assignments').insert({
        coach_id: currentUser.id,
        client_id: clientId,
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        due_date: newDueDate || null,
      });

      if (error) throw error;

      toast.success('Assignment created');
      setDialogOpen(false);
      setNewTitle('');
      setNewDescription('');
      setNewDueDate('');
      loadAssignments();
    } catch (error) {
      console.error('Error creating assignment:', error);
      toast.error('Failed to create assignment');
    } finally {
      setSaving(false);
    }
  };

  const toggleCompletion = async (assignment: Assignment) => {
    try {
      const newCompleted = !assignment.is_completed;
      const { error } = await supabase
        .from('client_assignments')
        .update({
          is_completed: newCompleted,
          completed_at: newCompleted ? new Date().toISOString() : null,
        })
        .eq('id', assignment.id);

      if (error) throw error;

      setAssignments(prev =>
        prev.map(a =>
          a.id === assignment.id
            ? { ...a, is_completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null }
            : a
        )
      );
      toast.success(newCompleted ? 'Marked as complete' : 'Marked as incomplete');
    } catch (error) {
      console.error('Error updating assignment:', error);
      toast.error('Failed to update assignment');
    }
  };

  const deleteAssignment = async (id: string) => {
    try {
      const { error } = await supabase
        .from('client_assignments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setAssignments(prev => prev.filter(a => a.id !== id));
      toast.success('Assignment deleted');
    } catch (error) {
      console.error('Error deleting assignment:', error);
      toast.error('Failed to delete assignment');
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading assignments...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Assignments</h4>
        {isCoach && (
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        )}
      </div>

      {assignments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          {isCoach ? 'No assignments yet. Add one to get started.' : 'No assignments from your coach yet.'}
        </p>
      ) : (
        <div className="space-y-2">
          {assignments.map(assignment => (
            <div
              key={assignment.id}
              className={`flex items-start gap-3 p-3 rounded-lg border ${
                assignment.is_completed ? 'bg-muted/50' : 'bg-background'
              }`}
            >
              <Checkbox
                checked={assignment.is_completed}
                onCheckedChange={() => toggleCompletion(assignment)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${assignment.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                  {assignment.title}
                </p>
                {assignment.description && (
                  <p className="text-sm text-muted-foreground mt-0.5">{assignment.description}</p>
                )}
                <div className="flex items-center gap-3 mt-1.5">
                  {assignment.due_date && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Due: {format(new Date(assignment.due_date), 'MMM d, yyyy')}
                    </span>
                  )}
                  {assignment.is_completed && assignment.completed_at && (
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Completed
                    </Badge>
                  )}
                </div>
              </div>
              {isCoach && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteAssignment(assignment.id)}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Assignment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Assignment for {clientName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Title *</label>
              <Input
                placeholder="e.g., Practice forehand drills"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="Add details or instructions..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
                className="mt-1.5"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Due Date</label>
              <Input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createAssignment} disabled={saving || !newTitle.trim()}>
              {saving ? 'Creating...' : 'Create Assignment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
