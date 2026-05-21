import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  const [takeaways, setTakeaways] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [originalTakeaways, setOriginalTakeaways] = useState('');
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
        .select('content, takeaways')
        .eq('lesson_request_id', lessonRequestId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setContent(data.content || '');
        setTakeaways(data.takeaways || '');
        setOriginalContent(data.content || '');
        setOriginalTakeaways(data.takeaways || '');
        setPlanExists(true);
      } else {
        setContent('');
        setTakeaways('');
        setOriginalContent('');
        setOriginalTakeaways('');
        setPlanExists(false);
      }
      setIsEditing(false);
    } catch (error) {
      console.error('Error loading lesson overview:', error);
      toast.error('Failed to load lesson overview');
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
          .update({ content, takeaways, updated_at: new Date().toISOString() })
          .eq('lesson_request_id', lessonRequestId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('lesson_plans').insert({
          lesson_request_id: lessonRequestId,
          coach_id: coachId,
          content,
          takeaways,
        });
        if (error) throw error;
        setPlanExists(true);
      }

      setOriginalContent(content);
      setOriginalTakeaways(takeaways);
      setIsEditing(false);
      toast.success('Lesson overview saved');
    } catch (error) {
      console.error('Error saving lesson overview:', error);
      toast.error('Failed to save lesson overview');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setContent(originalContent);
    setTakeaways(originalTakeaways);
    setIsEditing(false);
  };

  const hasChanges = content !== originalContent || takeaways !== originalTakeaways;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Lesson Overview
          </DialogTitle>
          <DialogDescription>
            {isCoach
              ? 'Plan what you will cover and record takeaways after the lesson.'
              : 'View the lesson plan and takeaways from your coach.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {loading ? (
            <div className="text-center text-muted-foreground py-8">Loading...</div>
          ) : isCoach && isEditing ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="lesson-plan">Lesson Plan (Before)</Label>
                <Textarea
                  id="lesson-plan"
                  placeholder="What you plan to cover... (drills, focus areas, goals, etc.)"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                  className="resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="takeaways">Lesson Takeaways (After)</Label>
                <Textarea
                  id="takeaways"
                  placeholder="Key takeaways, progress notes, areas to work on..."
                  value={takeaways}
                  onChange={(e) => setTakeaways(e.target.value)}
                  rows={6}
                  className="resize-none"
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Lesson Plan (Before)</Label>
                <div className="min-h-[100px] p-4 rounded-lg bg-muted/50 border">
                  {content ? (
                    <p className="text-sm whitespace-pre-wrap">{content}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      {isCoach ? 'No lesson plan yet. Click Edit to add one.' : 'No lesson plan has been added yet.'}
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Lesson Takeaways (After)</Label>
                <div className="min-h-[100px] p-4 rounded-lg bg-muted/50 border">
                  {takeaways ? (
                    <p className="text-sm whitespace-pre-wrap">{takeaways}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      {isCoach ? 'No takeaways yet. Click Edit to add them after the lesson.' : 'No takeaways have been added yet.'}
                    </p>
                  )}
                </div>
              </div>
            </>
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
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                <Button onClick={() => setIsEditing(true)}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
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
