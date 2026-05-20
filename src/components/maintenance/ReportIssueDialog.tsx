import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { Camera, Loader2 } from 'lucide-react';
import { smartSentenceCase } from '@/lib/textUtils';

interface ReportIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amenityId?: string;
  amenityName?: string;
  amenities: Array<{ id: string; name: string; amenityType: string }>;
}

export const ReportIssueDialog: React.FC<ReportIssueDialogProps> = ({
  open,
  onOpenChange,
  amenityId,
  amenityName,
  amenities
}) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedAmenity, setSelectedAmenity] = useState(amenityId || '');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);

  const categories = [
    { value: 'lighting', label: 'Lighting' },
    { value: 'surface_net', label: 'Surface/Net' },
    { value: 'gate_access', label: 'Gate/Access' },
    { value: 'plumbing', label: 'Plumbing' },
    { value: 'cleaning', label: 'Cleaning' },
    { value: 'other', label: 'Other' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedAmenity || !category || !description) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      let photoUrl = null;

      // Upload photo if provided
      if (photo) {
        const fileExt = photo.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(`maintenance/${fileName}`, photo);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(`maintenance/${fileName}`);
        
        photoUrl = publicUrl;
      }

      // Create maintenance report
      const { error } = await supabase
        .from('maintenance_reports')
        .insert({
          hoa_id: currentUser.hoaId!,
          amenity_id: selectedAmenity,
          reporter_id: currentUser.id,
          category,
          description,
          photo_url: photoUrl,
          status: 'open'
        });

      if (error) throw error;

      toast({
        title: "Issue Reported",
        description: "Your maintenance request has been submitted successfully."
      });

      // Reset form
      setSelectedAmenity(amenityId || '');
      setCategory('');
      setDescription('');
      setPhoto(null);
      onOpenChange(false);
    } catch (error) {
      console.error('Error submitting report:', error);
      toast({
        title: "Error",
        description: "Failed to submit maintenance report",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Report an Issue</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amenity">Amenity *</Label>
            <Select value={selectedAmenity} onValueChange={setSelectedAmenity} disabled={!!amenityId}>
              <SelectTrigger>
                <SelectValue placeholder={amenityName || "Select amenity"} />
              </SelectTrigger>
              <SelectContent>
                {amenities.map((amenity) => (
                  <SelectItem key={amenity.id} value={amenity.id}>
                    {amenity.name} ({amenity.amenityType})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Issue Category *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Describe the issue in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="photo">Photo (Optional)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="photo"
                type="file"
                accept="image/*"
                onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                className="flex-1"
              />
              <Camera className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} style={{ color: '#0F1F3D', fontSize: '15px', fontWeight: 500, textDecoration: 'underline' }}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Report'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};