import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ImagePlus, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveHOA } from '@/contexts/ActiveHOAContext';
import { toast } from 'sonner';
import { Ladder } from '@/pages/LeaguesLadders';

interface CreateLadderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLadderCreated: (ladder: Ladder) => void;
}

const CreateLadderDialog = ({ open, onOpenChange, onLadderCreated }: CreateLadderDialogProps) => {
  const { currentUser } = useAuth();
  const { activeHOA } = useActiveHOA();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadImage = async (ladderId: string): Promise<string | null> => {
    if (!imageFile) return null;
    
    const fileExt = imageFile.name.split('.').pop();
    const filePath = `ladder-images/${ladderId}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, imageFile, { upsert: true });
    
    if (uploadError) {
      console.error('Error uploading image:', uploadError);
      return null;
    }
    
    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id) {
      toast.error('You must be logged in to create a ladder');
      return;
    }

    // Coaches can create ladders without an HOA, but we need at least one identifier
    const hoaId = activeHOA?.hoaId || null;

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
          hoa_id: hoaId,
          status: 'setup',
          min_ntrp: formData.min_ntrp !== 'none' ? parseFloat(formData.min_ntrp) : null,
          max_ntrp: formData.max_ntrp !== 'none' ? parseFloat(formData.max_ntrp) : null,
          auto_approve_registration: formData.auto_approve_registration,
        })
        .select()
        .single();

      if (error) throw error;

      // Upload image if selected
      if (imageFile && data) {
        const imageUrl = await uploadImage(data.id);
        if (imageUrl) {
          await supabase
            .from('ladders')
            .update({ image_url: imageUrl })
            .eq('id', data.id);
          data.image_url = imageUrl;
        }
      }

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
      setImageFile(null);
      setImagePreview(null);
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
          <DialogDescription>Set up a new competitive ladder for your community</DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Ladder Image */}
          <div className="space-y-2">
            <Label>Ladder Image (Optional)</Label>
            <div className="flex items-center gap-4">
              {imagePreview ? (
                <div className="relative">
                  <Avatar className="h-20 w-20 rounded-lg">
                    <AvatarImage src={imagePreview} className="object-cover" />
                    <AvatarFallback className="rounded-lg">🎾</AvatarFallback>
                  </Avatar>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={removeImage}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-20 w-20 rounded-lg border-dashed flex flex-col gap-1"
                >
                  <ImagePlus className="h-6 w-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Add</span>
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              <p className="text-xs text-muted-foreground">
                Add a photo to represent your ladder
              </p>
            </div>
          </div>

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
