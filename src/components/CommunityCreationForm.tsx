
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CommunityCreationFormProps {
  onCommunityCreated: (communityId: string) => void;
  onBack: () => void;
}

const CommunityCreationForm = ({ onCommunityCreated, onBack }: CommunityCreationFormProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    communityType: '',
    address: '',
    description: ''
  });

  const communityTypes = [
    { value: 'hoa', label: 'HOA (Homeowners Association)' },
    { value: 'apartment', label: 'Apartment Complex' },
    { value: 'tennis_club', label: 'Tennis Club' },
    { value: 'academy', label: 'Tennis Academy' },
    { value: 'other', label: 'Other' }
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.communityType) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.rpc('create_community', {
        community_name: formData.name,
        community_type: formData.communityType,
        community_address: formData.address || null,
        description: formData.description || null
      });

      if (error) throw error;

      toast.success(`Welcome! You've successfully created ${formData.name}. Let's set it up!`);
      onCommunityCreated(data);
    } catch (error: any) {
      console.error('Error creating community:', error);
      toast.error(error.message || 'Failed to create community');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Create Your Community</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Community Name *</Label>
            <Input
              id="name"
              type="text"
              placeholder="e.g., Sunset Hills HOA"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="communityType">Community Type *</Label>
            <Select 
              value={formData.communityType} 
              onValueChange={(value) => handleInputChange('communityType', value)}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select community type" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-white border border-gray-200 shadow-lg">
                {communityTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Community Address (Optional)</Label>
            <Input
              id="address"
              type="text"
              placeholder="e.g., 123 Main St, City, State"
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Brief description of your community..."
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onBack}
              className="flex-1"
            >
              Back
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? 'Creating...' : 'Create Community'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default CommunityCreationForm;
