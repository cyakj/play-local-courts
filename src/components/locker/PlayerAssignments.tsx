import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ClipboardList, Calendar, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Assignment {
  id: string;
  coach_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  coach_name?: string;
}

export default function PlayerAssignments() {
  const { currentUser } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    if (currentUser) {
      loadAssignments();
    }
  }, [currentUser]);

  const loadAssignments = async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('client_assignments')
        .select('*')
        .eq('client_id', currentUser.id)
        .order('is_completed', { ascending: true })
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch coach names
      if (data && data.length > 0) {
        const coachIds = [...new Set(data.map(a => a.coach_id))];
        const { data: coaches } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', coachIds);

        data.forEach((assignment: any) => {
          const coach = coaches?.find(c => c.id === assignment.coach_id);
          assignment.coach_name = coach?.full_name || 'Coach';
        });
      }

      setAssignments(data || []);
    } catch (error) {
      console.error('Error loading assignments:', error);
    } finally {
      setLoading(false);
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
      toast.success(newCompleted ? 'Marked as complete!' : 'Marked as incomplete');
    } catch (error) {
      console.error('Error updating assignment:', error);
      toast.error('Failed to update assignment');
    }
  };

  const pendingCount = assignments.filter(a => !a.is_completed).length;

  if (loading) {
    return null;
  }

  if (assignments.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                My Assignments
                {pendingCount > 0 && (
                  <Badge variant="default" className="ml-2 bg-primary">
                    {pendingCount} pending
                  </Badge>
                )}
              </CardTitle>
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-2">
            {assignments.map(assignment => (
              <div
                key={assignment.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  assignment.is_completed ? 'bg-muted/50 border-muted' : 'bg-background border-border'
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
                  <div className="flex flex-wrap items-center gap-3 mt-1.5">
                    <span className="text-xs text-muted-foreground">
                      From: {assignment.coach_name}
                    </span>
                    {assignment.due_date && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Due: {format(new Date(assignment.due_date), 'MMM d, yyyy')}
                      </span>
                    )}
                    {assignment.is_completed && (
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Done
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
