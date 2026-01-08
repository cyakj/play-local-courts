
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
    format: 'doubles' as 'singles' | 'doubles' | 'mixed_doubles',
    is_private: false,
    start_date: '',
    registration_deadline: '',
    weekly_deadline_day: 0, // 0 = Sunday
    min_ntrp: 'none',
    max_ntrp: 'none',
    auto_approve_registration: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id || !currentUser?.hoaId) return;

    // Validate NTRP range if provided
    if (formData.min_ntrp !== 'none' && formData.max_ntrp !== 'none') {
      const minNtrp = parseFloat(formData.min_ntrp);
      const maxNtrp = parseFloat(formData.max_ntrp);
      
      if (minNtrp > maxNtrp) {
        toast.error('Minimum NTRP must be less than or equal to maximum NTRP');
        return;
      }
      
      if (minNtrp < 1.0 || maxNtrp > 7.0) {
        toast.error('NTRP ratings must be between 1.0 and 7.0');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('ladders')
        .insert({
          name: formData.name,
          description: formData.description || null,
          format: formData.format as any, // Type assertion to handle the enum
          is_private: formData.is_private,
          start_date: formData.start_date || null,
          registration_deadline: formData.registration_deadline || null,
          weekly_deadline_day: formData.weekly_deadline_day,
          admin_id: currentUser.id,
          hoa_id: currentUser.hoaId,
          status: 'setup',
          min_ntrp: formData.min_ntrp !== 'none' ? parseFloat(formData.min_ntrp) : null,
          max_ntrp: formData.max_ntrp !== 'none' ? parseFloat(formData.max_ntrp) : null,
          auto_approve_registration: formData.auto_approve_registration,
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
        registration_deadline: '',
        weekly_deadline_day: 0,
        min_ntrp: 'none',
        max_ntrp: 'none',
        auto_approve_registration: false,
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
              onValueChange={(value: 'singles' | 'doubles' | 'mixed_doubles') => 
                setFormData(prev => ({ ...prev, format: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="doubles">Doubles</SelectItem>
                <SelectItem value="singles">Singles</SelectItem>
                <SelectItem value="mixed_doubles">Mixed Doubles</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min_ntrp">Min NTRP (Optional)</Label>
              <Select 
                value={formData.min_ntrp} 
                onValueChange={(value) => 
                  setFormData(prev => ({ ...prev, min_ntrp: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select min" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No minimum</SelectItem>
                  <SelectItem value="1.0">1.0</SelectItem>
                  <SelectItem value="1.5">1.5</SelectItem>
                  <SelectItem value="2.0">2.0</SelectItem>
                  <SelectItem value="2.5">2.5</SelectItem>
                  <SelectItem value="3.0">3.0</SelectItem>
                  <SelectItem value="3.5">3.5</SelectItem>
                  <SelectItem value="4.0">4.0</SelectItem>
                  <SelectItem value="4.5">4.5</SelectItem>
                  <SelectItem value="5.0">5.0</SelectItem>
                  <SelectItem value="5.5">5.5</SelectItem>
                  <SelectItem value="6.0">6.0</SelectItem>
                  <SelectItem value="6.5">6.5</SelectItem>
                  <SelectItem value="7.0">7.0</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_ntrp">Max NTRP (Optional)</Label>
              <Select 
                value={formData.max_ntrp} 
                onValueChange={(value) => 
                  setFormData(prev => ({ ...prev, max_ntrp: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select max" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No maximum</SelectItem>
                  <SelectItem value="1.0">1.0</SelectItem>
                  <SelectItem value="1.5">1.5</SelectItem>
                  <SelectItem value="2.0">2.0</SelectItem>
                  <SelectItem value="2.5">2.5</SelectItem>
                  <SelectItem value="3.0">3.0</SelectItem>
                  <SelectItem value="3.5">3.5</SelectItem>
                  <SelectItem value="4.0">4.0</SelectItem>
                  <SelectItem value="4.5">4.5</SelectItem>
                  <SelectItem value="5.0">5.0</SelectItem>
                  <SelectItem value="5.5">5.5</SelectItem>
                  <SelectItem value="6.0">6.0</SelectItem>
                  <SelectItem value="6.5">6.5</SelectItem>
                  <SelectItem value="7.0">7.0</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {(formData.min_ntrp !== 'none' || formData.max_ntrp !== 'none') && (
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-blue-800 font-medium">NTRP Requirement:</p>
              <p className="text-xs text-blue-700 mt-1">
                {formData.min_ntrp !== 'none' && formData.max_ntrp !== 'none' 
                  ? `Players must have NTRP rating between ${formData.min_ntrp} and ${formData.max_ntrp}`
                  : formData.min_ntrp !== 'none' 
                  ? `Players must have NTRP rating of ${formData.min_ntrp} or higher`
                  : `Players must have NTRP rating of ${formData.max_ntrp} or lower`
                }
              </p>
            </div>
          )}

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
            <Label htmlFor="registration_deadline">Registration Deadline (Optional)</Label>
            <Input
              id="registration_deadline"
              type="date"
              value={formData.registration_deadline}
              onChange={(e) => setFormData(prev => ({ ...prev, registration_deadline: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Players won't be able to register after this date
            </p>
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

          <div className="flex items-center space-x-2">
            <Switch
              id="auto_approve"
              checked={formData.auto_approve_registration}
              onCheckedChange={(checked) => 
                setFormData(prev => ({ ...prev, auto_approve_registration: checked }))
              }
            />
            <Label htmlFor="auto_approve">Auto-approve player registrations</Label>
          </div>
          <p className="text-xs text-muted-foreground -mt-2 ml-9">
            When enabled, eligible players can join without admin approval
          </p>

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
