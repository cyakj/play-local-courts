import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Building2, MapPin, Search, Loader2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveHOA } from '@/contexts/ActiveHOAContext';
import { useNavigate } from 'react-router-dom';

interface JoinExistingHOAProps {
  onSuccess: () => void;
}

interface HOAOption {
  id: string;
  name: string;
  address?: string;
}

export const JoinExistingHOA = ({ onSuccess }: JoinExistingHOAProps) => {
  const { requestJoinHOA, memberships, pendingMemberships } = useActiveHOA();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [communities, setCommunities] = useState<HOAOption[]>([]);
  const [selectedHOA, setSelectedHOA] = useState<HOAOption | null>(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Memoize the existing HOA IDs to prevent useEffect from re-running on every render
  const existingHOAIds = useMemo(() => new Set([
    ...memberships.map(m => m.hoaId),
    ...pendingMemberships.map(m => m.hoaId),
  ]), [memberships, pendingMemberships]);

  useEffect(() => {
    const searchCommunities = async () => {
      if (searchTerm.length < 2) {
        setCommunities([]);
        return;
      }

      setIsSearching(true);
      try {
        const { data, error } = await supabase
          .from('hoas')
          .select('id, name, address')
          .ilike('name', `%${searchTerm}%`)
          .limit(10);

        if (error) throw error;

        // Filter out communities user is already a member of
        const filtered = (data || []).filter(hoa => !existingHOAIds.has(hoa.id));
        setCommunities(filtered);
      } catch (error) {
        console.error('Error searching communities:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchCommunities, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm, existingHOAIds]);

  const handleRegisterCommunity = () => {
    navigate('/hoa-application');
  };

  const handleSubmit = async () => {
    if (!selectedHOA) return;

    setIsLoading(true);
    try {
      await requestJoinHOA(selectedHOA.id, message || undefined);
      onSuccess();
    } catch (error) {
      console.error('Error joining HOA:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {!selectedHOA ? (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by community name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {isSearching && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isSearching && communities.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {communities.map((hoa) => (
                <button
                  key={hoa.id}
                  className="w-full flex items-center gap-3 p-3 bg-white rounded-lg border hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
                  onClick={() => setSelectedHOA(hoa)}
                >
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{hoa.name}</p>
                    {hoa.address && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {hoa.address}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {!isSearching && searchTerm.length >= 2 && communities.length === 0 && (
            <div className="text-center py-4 space-y-3">
              <div className="text-muted-foreground">
                <p className="text-sm">No communities found matching "{searchTerm}"</p>
              </div>
              <Button
                variant="outline"
                className="w-full justify-center gap-2 h-auto py-3 bg-green-50 border-green-200 hover:bg-green-100 hover:border-green-300"
                onClick={handleRegisterCommunity}
              >
                <Plus className="h-4 w-4 text-green-600" />
                <span className="text-green-700 font-medium">Register Your Community</span>
              </Button>
            </div>
          )}

          {searchTerm.length < 2 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Type at least 2 characters to search
            </p>
          )}
        </>
      ) : (
        <>
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{selectedHOA.name}</p>
                {selectedHOA.address && (
                  <p className="text-xs text-muted-foreground">{selectedHOA.address}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedHOA(null)}
              >
                Change
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message to Admin (optional)</Label>
            <Textarea
              id="message"
              placeholder="Introduce yourself or provide your unit/address..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Request to Join'
            )}
          </Button>
        </>
      )}
    </div>
  );
};
