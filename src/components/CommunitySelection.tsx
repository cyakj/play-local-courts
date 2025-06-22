
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { HOA } from '../types';
import { toast } from 'sonner';

interface CommunitySelectionProps {
  onJoinExisting: (hoaId: string) => void;
  onCreateNew: () => void;
}

const CommunitySelection = ({ onJoinExisting, onCreateNew }: CommunitySelectionProps) => {
  const [mode, setMode] = useState<'select' | 'join' | 'create'>('select');
  const [communities, setCommunities] = useState<HOA[]>([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (mode === 'join') {
      loadCommunities();
    }
  }, [mode]);

  const loadCommunities = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('hoas')
        .select('id, name, community_type, address')
        .order('name');

      if (error) throw error;

      setCommunities(data || []);
    } catch (error) {
      console.error('Error loading communities:', error);
      toast.error('Failed to load communities');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCommunities = communities.filter(community =>
    community.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (mode === 'select') {
    return (
      <Card className="w-full shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Community Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground mb-6">
            Are you joining an existing community or creating a new one?
          </p>
          
          <div className="space-y-3">
            <Button 
              onClick={() => setMode('join')} 
              className="w-full h-16 text-left flex flex-col items-start justify-center"
              variant="outline"
            >
              <span className="font-medium">Join an existing community</span>
              <span className="text-sm text-muted-foreground">Search for your HOA, apartment, or club</span>
            </Button>
            
            <Button 
              onClick={() => setMode('create')} 
              className="w-full h-16 text-left flex flex-col items-start justify-center"
              variant="outline"
            >
              <span className="font-medium">Create a new community</span>
              <span className="text-sm text-muted-foreground">Set up your own HOA, club, or organization</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (mode === 'join') {
    return (
      <Card className="w-full shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Find Your Community</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search for your community</Label>
              <Input
                id="search"
                type="text"
                placeholder="Type community name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {isLoading ? (
              <div className="text-center py-4">Loading communities...</div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="community">Select Your Community</Label>
                  <Select 
                    value={selectedCommunityId} 
                    onValueChange={setSelectedCommunityId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose your community" />
                    </SelectTrigger>
                    <SelectContent className="z-50 bg-white border border-gray-200 shadow-lg max-h-60">
                      {filteredCommunities.length === 0 ? (
                        <SelectItem value="no-communities" disabled>
                          No communities found
                        </SelectItem>
                      ) : (
                        filteredCommunities.map((community) => (
                          <SelectItem key={community.id} value={community.id}>
                            <div>
                              <div className="font-medium">{community.name}</div>
                              {community.address && (
                                <div className="text-sm text-muted-foreground">{community.address}</div>
                              )}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex space-x-3 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setMode('select')}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button 
                    onClick={() => selectedCommunityId && onJoinExisting(selectedCommunityId)}
                    disabled={!selectedCommunityId}
                    className="flex-1"
                  >
                    Join Community
                  </Button>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (mode === 'create') {
    return (
      <Card className="w-full shadow-lg">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <h3 className="text-lg font-medium">Ready to create your community?</h3>
            <p className="text-muted-foreground">
              You'll become the admin and can invite others to join.
            </p>
            <div className="flex space-x-3">
              <Button 
                variant="outline" 
                onClick={() => setMode('select')}
                className="flex-1"
              >
                Back
              </Button>
              <Button 
                onClick={onCreateNew}
                className="flex-1"
              >
                Continue
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
};

export default CommunitySelection;
