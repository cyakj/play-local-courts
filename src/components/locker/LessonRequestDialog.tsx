import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface LessonRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coachId: string;
  coachName: string;
  sportsOffered: string[];
}

const LessonRequestDialog: React.FC<LessonRequestDialogProps> = ({
  open,
  onOpenChange,
  coachId,
  coachName,
  sportsOffered,
}) => {
  const { currentUser } = useAuth();
  const [date, setDate] = useState<Date>();
  const [sport, setSport] = useState('');
  const [lessonType, setLessonType] = useState('');
  const [skillLevel, setSkillLevel] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) {
      toast.error('You must be logged in to request a lesson');
      return;
    }

    if (!currentUser.id) {
      console.error('Current user ID is missing:', currentUser);
      toast.error('Unable to identify user. Please try logging in again.');
      return;
    }

    if (!date || !startTime || !endTime || !sport || !lessonType || !skillLevel) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);

    try {
      console.log('Submitting lesson request with player_id:', currentUser.id);
      
      const lessonRequest = {
        player_id: currentUser.id,
        coach_id: coachId,
        preferred_date: format(date, 'yyyy-MM-dd'),
        preferred_time_start: startTime,
        preferred_time_end: endTime,
        sport,
        lesson_type: lessonType,
        skill_level: skillLevel,
        location: location || null,
        notes: notes || null,
        status: 'pending',
      };

      console.log('Lesson request data:', lessonRequest);

      const { data, error } = await supabase
        .from('lesson_requests')
        .insert(lessonRequest)
        .select();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Lesson request created successfully:', data);

      toast.success(`Lesson request sent to ${coachName}!`);
      onOpenChange(false);
      
      // Reset form
      setDate(undefined);
      setSport('');
      setLessonType('');
      setSkillLevel('');
      setStartTime('');
      setEndTime('');
      setLocation('');
      setNotes('');
    } catch (error) {
      console.error('Error submitting lesson request:', error);
      toast.error('Failed to send lesson request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request a Lesson with {coachName}</DialogTitle>
          <DialogDescription>
            Fill out the form below to request a lesson. The coach will review and respond to your request.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sport">Sport *</Label>
              <Select value={sport} onValueChange={setSport} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select sport" />
                </SelectTrigger>
                <SelectContent>
                  {sportsOffered.length > 0 ? (
                    sportsOffered.map((sportOption) => (
                      <SelectItem key={sportOption} value={sportOption}>
                        {sportOption}
                      </SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="Tennis">Tennis</SelectItem>
                      <SelectItem value="Pickleball">Pickleball</SelectItem>
                      <SelectItem value="Padel">Padel</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lessonType">Lesson Type *</Label>
              <Select value={lessonType} onValueChange={setLessonType} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private (1-on-1)</SelectItem>
                  <SelectItem value="semi-private">Semi-Private (2-3 people)</SelectItem>
                  <SelectItem value="group">Group (4+ people)</SelectItem>
                  <SelectItem value="clinic">Clinic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="skillLevel">Your Skill Level *</Label>
              <Select value={skillLevel} onValueChange={setSkillLevel} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Preferred Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !date && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, 'PPP') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time *</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endTime">End Time *</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Preferred Location</Label>
            <Input
              id="location"
              placeholder="e.g., My HOA courts, Coach's facility"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any specific goals or requests for the lesson..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="flex-1">
              {submitting ? 'Sending...' : 'Send Request'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default LessonRequestDialog;
