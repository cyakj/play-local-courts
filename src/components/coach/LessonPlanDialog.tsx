import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { ClipboardList, Edit2 } from 'lucide-react';
import { toast } from 'sonner';

interface LessonPlanDialogProps {
  lessonRequestId: string;
  coachId: string;
  isCoach: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function LessonPlanDialog({
  lessonRequestId,
  coachId,
  isCoach,
  open,
  onOpenChange,
}: LessonPlanDialogProps) {
  const { currentUser } = useAuth();
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [planExists, setPlanExists] = useState(false);

  useEffect(() => {
    if (open) {
      loadLessonPlan();
    }
  }, [open, lessonRequestId]);

  const loadLessonPlan = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('lesson_plans')
        .select('content')
        .eq('lesson_request_id', lessonRequestId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setContent(data.content || '');
        setOriginalContent(data.content || '');
        setPlanExists(true);
      } else {
        setContent('');
        setOriginalContent('');
        setPlanExists(false);
      }
      setIsEditing(false);
    } catch (error) {
      console.error('Error loading lesson plan:', error);
      toast.error('Failed to load lesson plan');
    } finally {
      setLoading(false);
    }
  };

  const saveLessonPlan = async () => {
    if (!currentUser) return;

    setSaving(true);
    try {
      if (planExists) {
        const { error } = await supabase
          .from('lesson_plans')
          .update({ content, updated_at: new Date().toISOString() })
          .eq('lesson_request_id', lessonRequestId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('lesson_plans').insert({
          lesson_request_id: lessonRequestId,
          coach_id: coachId,
          content,
        });
        if (error) throw error;
        setPlanExists(true);
      }

      setOriginalContent(content);
      setIsEditing(false);
      toast.success('Lesson plan saved');
    } catch (error) {
      console.error('Error saving lesson plan:', error);
      toast.error('Failed to save lesson plan');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setContent(originalContent);
    setIsEditing(false);
  };

  const hasChanges = content !== originalContent;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Lesson Plan
          </DialogTitle>
          <DialogDescription>
            {isCoach
              ? 'Plan what you will cover in this lesson. Players can view but not edit.'
              : 'View the lesson plan your coach has prepared.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {loading ? (
            <div className="text-center text-muted-foreground py-8">Loading...</div>
          ) : isCoach && isEditing ? (
            <Textarea
              placeholder="Write your lesson plan here... (drills, focus areas, goals, etc.)"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              className="resize-none"
            />
          ) : (
            <div className="min-h-[200px] p-4 rounded-lg bg-muted/50 border">
              {content ? (
                <p className="text-sm whitespace-pre-wrap">{content}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  {isCoach ? 'No lesson plan yet. Click Edit to add one.' : 'No lesson plan has been added yet.'}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {isCoach ? (
            isEditing ? (
              <>
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button onClick={saveLessonPlan} disabled={saving || !hasChanges}>
                  {saving ? 'Saving...' : 'Save Plan'}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                <Button onClick={() => setIsEditing(true)}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit Plan
                </Button>
              </>
            )
          ) : (
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
