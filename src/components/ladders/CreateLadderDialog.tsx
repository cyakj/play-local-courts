
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Ladder } from '@/pages/LeaguesLadders';

interface CreateLadderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLadderCreated: (ladder: Ladder) => void;
}

const CreateLadderDialog = ({ open, onOpenChange, onLadderCreated }: CreateLadderDialogProps) => {
  const { currentUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    format: 'doubles' as 'singles' | 'doubles',
    is_private: false,
    start_date: '',
    weekly_deadline_day: 0, // 0 = Sunday
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id || !currentUser?.hoa_id) return;

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('ladders')
        .insert({
          name: formData.name,
          description: formData.description || null,
          format: formData.format,
          is_private: formData.is_private,
          start_date: formData.start_date || null,
          weekly_deadline_day: formData.weekly_deadline_day,
          admin_id: currentUser.id,
          hoa_id: currentUser.hoa_id,
          status: 'setup'
        })
        .select()
        .single();

      if (error) throw error;

      onLadderCreated(data);
      setFormData({
        name: '',
        description: '',
        format: 'doubles',
        is_private: false,
        start_date: '',
        weekly_deadline_day: 0,
      });
    } catch (error) {
      console.error('Error creating ladder:', error);
      toast.error('Failed to create ladder');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Ladder</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Ladder Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Spring Doubles Championship"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of the ladder..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="format">Format</Label>
            <Select 
              value={formData.format} 
              onValueChange={(value: 'singles' | 'doubles') => 
                setFormData(prev => ({ ...prev, format: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="doubles">Doubles</SelectItem>
                <SelectItem value="singles">Singles</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="start_date">Start Date (Optional)</Label>
            <Input
              id="start_date"
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deadline_day">Weekly Deadline Day</Label>
            <Select 
              value={formData.weekly_deadline_day.toString()} 
              onValueChange={(value) => 
                setFormData(prev => ({ ...prev, weekly_deadline_day: parseInt(value) }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Sunday</SelectItem>
                <SelectItem value="1">Monday</SelectItem>
                <SelectItem value="2">Tuesday</SelectItem>
                <SelectItem value="3">Wednesday</SelectItem>
                <SelectItem value="4">Thursday</SelectItem>
                <SelectItem value="5">Friday</SelectItem>
                <SelectItem value="6">Saturday</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_private"
              checked={formData.is_private}
              onCheckedChange={(checked) => 
                setFormData(prev => ({ ...prev, is_private: checked }))
              }
            />
            <Label htmlFor="is_private">Private Ladder (invite-only)</Label>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Ladder'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateLadderDialog;
