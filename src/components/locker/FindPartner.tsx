
import React, { useState, useEffect } from 'react';
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

interface Player {
  id: string;
  full_name: string;
  avatar_url?: string;
  ntrp_rating?: number;
  utr_rating?: number;
  play_style?: string;
  availability?: string;
  location_preference?: string;
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
  const [ntrpRange, setNtrpRange] = useState([1.0, 7.0]);
  const [playStyle, setPlayStyle] = useState<string>('');
  const [availability, setAvailability] = useState<string>('');
  const [location, setLocation] = useState<string>('');

  useEffect(() => {
    loadPlayers();
  }, [currentUser]);

  useEffect(() => {
    filterPlayers();
  }, [players, utrRange, ntrpRange, playStyle, availability, location]);

  const loadPlayers = async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, ntrp_rating, utr_rating, play_style, availability, location_preference')
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

    // Filter by NTRP range
    filtered = filtered.filter(player => {
      const ntrp = player.ntrp_rating || 0;
      return ntrp >= ntrpRange[0] && ntrp <= ntrpRange[1];
    });

    // Filter by play style
    if (playStyle) {
      filtered = filtered.filter(player => player.play_style === playStyle);
    }

    // Filter by availability
    if (availability) {
      filtered = filtered.filter(player => player.availability === availability);
    }

    // Filter by location
    if (location) {
      filtered = filtered.filter(player => 
        player.location_preference?.toLowerCase().includes(location.toLowerCase())
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
                    className="w-full [&>.relative]:h-2 [&>.relative]:bg-gray-200 [&>.relative]:rounded-full [&_[role=slider]]:h-4 [&_[role=slider]]:w-4 [&_[role=slider]]:border-2 [&_[role=slider]]:border-green-500 [&_[role=slider]]:bg-white [&_[role=slider]]:shadow-md [&>.relative>.bg-primary]:bg-green-500"
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
                    max={7.0}
                    min={1.0}
                    step={0.5}
                    className="w-full [&>.relative]:h-2 [&>.relative]:bg-gray-200 [&>.relative]:rounded-full [&_[role=slider]]:h-4 [&_[role=slider]]:w-4 [&_[role=slider]]:border-2 [&_[role=slider]]:border-green-500 [&_[role=slider]]:bg-white [&_[role=slider]]:shadow-md [&>.relative>.bg-primary]:bg-green-500"
                  />
                </div>
              </div>

              {/* Play Style */}
              <div className="space-y-2">
                <Label>Play Style</Label>
                <Select value={playStyle} onValueChange={setPlayStyle}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any style</SelectItem>
                    <SelectItem value="aggressive">Aggressive</SelectItem>
                    <SelectItem value="defensive">Defensive</SelectItem>
                    <SelectItem value="all_court">All Court</SelectItem>
                    <SelectItem value="baseline">Baseline</SelectItem>
                    <SelectItem value="serve_volley">Serve & Volley</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Availability */}
              <div className="space-y-2">
                <Label>Availability</Label>
                <Select value={availability} onValueChange={setAvailability}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any time</SelectItem>
                    <SelectItem value="weekday_mornings">Weekday Mornings</SelectItem>
                    <SelectItem value="weekday_afternoons">Weekday Afternoons</SelectItem>
                    <SelectItem value="weekday_evenings">Weekday Evenings</SelectItem>
                    <SelectItem value="weekend_mornings">Weekend Mornings</SelectItem>
                    <SelectItem value="weekend_afternoons">Weekend Afternoons</SelectItem>
                    <SelectItem value="weekend_evenings">Weekend Evenings</SelectItem>
                  </SelectContent>
                </Select>
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
                        <span>NTRP: {player.ntrp_rating || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                  
                  {player.play_style && (
                    <p className="text-sm text-muted-foreground mb-2">
                      Style: {player.play_style.replace('_', ' ')}
                    </p>
                  )}
                  
                  {player.availability && (
                    <p className="text-sm text-muted-foreground mb-3">
                      Available: {player.availability.replace(/_/g, ' ')}
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

      {selectedPlayer && (
        <MatchRequestDialog
          open={showMatchRequest}
          onOpenChange={setShowMatchRequest}
          player={selectedPlayer}
        />
      )}
    </div>
  );
};

export default FindPartner;
