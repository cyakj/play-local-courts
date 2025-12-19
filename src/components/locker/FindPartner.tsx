
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import MatchRequestDialog from './MatchRequestDialog';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

interface Player {
  id: string;
  full_name: string;
  avatar_url?: string;
  utr_rating?: number;
  location?: string;
  bio?: string;
}

interface FindPartnerProps {
  onBack: () => void;
}

const FindPartner = ({ onBack }: FindPartnerProps) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showMatchRequest, setShowMatchRequest] = useState(false);
  
  // Filter states
  const [utrRange, setUtrRange] = useState([1, 15]);
  const [ntrpRange, setNtrpRange] = useState([1, 7]);
  const [location, setLocation] = useState<string>('');

  const loadPlayersCallback = useCallback(() => {
    loadPlayers();
  }, [currentUser]);

  // Real-time subscription for profile updates (new players, profile changes)
  useRealtimeSubscription({
    table: 'profiles',
    event: '*',
    onChange: loadPlayersCallback,
    enabled: !!currentUser
  });

  useEffect(() => {
    loadPlayers();
  }, [currentUser]);

  useEffect(() => {
    filterPlayers();
  }, [players, utrRange, ntrpRange, location]);

  const loadPlayers = async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, utr_rating, location, bio')
        .neq('id', currentUser.id)
        .not('full_name', 'is', null);

      if (error) throw error;
      setPlayers(data || []);
    } catch (error) {
      console.error('Error loading players:', error);
      toast({
        title: "Error",
        description: "Failed to load players",
        variant: "destructive"
      });
    }
  };

  const filterPlayers = () => {
    let filtered = players;

    // Filter by UTR range
    filtered = filtered.filter(player => {
      const utr = player.utr_rating || 0;
      return utr >= utrRange[0] && utr <= utrRange[1];
    });

    // Filter by location
    if (location) {
      filtered = filtered.filter(player => 
        player.location?.toLowerCase().includes(location.toLowerCase())
      );
    }

    setFilteredPlayers(filtered);
  };

  const handleSendMatchRequest = (player: Player) => {
    setSelectedPlayer(player);
    setShowMatchRequest(true);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-6">
        <Button onClick={onBack} variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Locker
        </Button>
        <h1 className="text-3xl font-bold">Find a Partner</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters Sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* UTR Range */}
              <div className="space-y-2">
                <Label>UTR Range: {utrRange[0]} - {utrRange[1]}</Label>
                <div className="px-2">
                  <Slider
                    value={utrRange}
                    onValueChange={setUtrRange}
                    max={15}
                    min={1}
                    step={0.5}
                    className="w-full [&_.slider-range]:bg-green-500 [&_.slider-thumb]:bg-white [&_.slider-thumb]:border-green-500 [&_.slider-track]:bg-gray-200"
                  />
                </div>
              </div>

              {/* NTRP Range */}
              <div className="space-y-2">
                <Label>NTRP Range: {ntrpRange[0]} - {ntrpRange[1]}</Label>
                <div className="px-2">
                  <Slider
                    value={ntrpRange}
                    onValueChange={setNtrpRange}
                    max={7}
                    min={1}
                    step={0.5}
                    className="w-full [&_.slider-range]:bg-green-500 [&_.slider-thumb]:bg-white [&_.slider-thumb]:border-green-500 [&_.slider-track]:bg-gray-200"
                  />
                </div>
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  placeholder="Enter location..."
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Players Grid */}
        <div className="lg:col-span-3">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredPlayers.map((player) => (
              <Card key={player.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3 mb-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={player.avatar_url} />
                      <AvatarFallback>
                        {player.full_name?.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold">{player.full_name}</h3>
                      <div className="flex gap-2 text-sm text-muted-foreground">
                        <span>UTR: {player.utr_rating || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                  
                  {player.location && (
                    <p className="text-sm text-muted-foreground mb-2">
                      Location: {player.location}
                    </p>
                  )}
                  
                  {player.bio && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {player.bio}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleSendMatchRequest(player)}
                    >
                      Send Match Request
                    </Button>
                    <Button size="sm" variant="outline">
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredPlayers.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No players match your current filters.</p>
            </div>
          )}
        </div>
      </div>

      {selectedPlayer && showMatchRequest && (
        <MatchRequestDialog
          targetPlayer={{
            id: selectedPlayer.id,
            full_name: selectedPlayer.full_name,
            match_types: ['singles', 'doubles', 'hitting_session']
          }}
          open={showMatchRequest}
          onOpenChange={setShowMatchRequest}
        />
      )}
    </div>
  );
};

export default FindPartner;
