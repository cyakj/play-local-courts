
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, MessageCircle, User, MapPin } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import MatchRequestDialog from './MatchRequestDialog';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { getDistanceBetweenZips, formatDistance } from '@/lib/zipCodeUtils';

interface Player {
  id: string;
  full_name: string;
  avatar_url?: string;
  utr_rating?: number;
  location?: string;
  bio?: string;
  zip_code?: string;
  location_visible?: boolean;
  show_exact_distance?: boolean;
  distance?: number | null;
}

interface MatchPrefs {
  user_id: string;
  looking_to_play: boolean;
  match_types: string[];
  preferred_times: string[];
  preferred_days: string[];
}

interface FindPartnerProps {
  onBack: () => void;
}

const FindPartner = ({ onBack }: FindPartnerProps) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showMatchRequest, setShowMatchRequest] = useState(false);
  const [myPreferences, setMyPreferences] = useState<MatchPrefs | null>(null);
  const [allPreferences, setAllPreferences] = useState<MatchPrefs[]>([]);
  const [myZipCode, setMyZipCode] = useState<string | null>(null);
  
  // Filter states
  const [utrRange, setUtrRange] = useState([1, 15]);
  const [ntrpRange, setNtrpRange] = useState([1, 7]);
  const [location, setLocation] = useState<string>('');
  const [maxDistance, setMaxDistance] = useState<number>(25);
  const [useDistanceFilter, setUseDistanceFilter] = useState(false);

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
    loadMyProfile();
    loadPlayers();
    loadPreferences();
  }, [currentUser]);

  useEffect(() => {
    filterPlayers();
  }, [players, utrRange, ntrpRange, location, myPreferences, allPreferences, maxDistance, useDistanceFilter, myZipCode]);

  const loadMyProfile = async () => {
    if (!currentUser) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('zip_code')
        .eq('id', currentUser.id)
        .single();
      
      if (error) throw error;
      
      if (data?.zip_code) {
        setMyZipCode(data.zip_code);
        setUseDistanceFilter(true);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadPlayers = async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, utr_rating, location, bio, zip_code, location_visible, show_exact_distance')
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

  const loadPreferences = async () => {
    if (!currentUser) return;

    try {
      // Load my preferences
      const { data: myPrefs } = await supabase
        .from('match_preferences')
        .select('user_id, looking_to_play, match_types, preferred_times, preferred_days')
        .eq('user_id', currentUser.id)
        .single();

      setMyPreferences(myPrefs);

      // Load all other users' preferences who are looking to play
      const { data: allPrefs } = await supabase
        .from('match_preferences')
        .select('user_id, looking_to_play, match_types, preferred_times, preferred_days')
        .eq('looking_to_play', true)
        .neq('user_id', currentUser.id);

      setAllPreferences(allPrefs || []);
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  };

  // Helper to check if two arrays have at least one common element
  const hasOverlap = (arr1: string[], arr2: string[]) => {
    return arr1.some(item => arr2.includes(item));
  };

  const filterPlayers = () => {
    let filtered = players.map(player => {
      // Calculate distance for each player
      let distance: number | null = null;
      if (myZipCode && player.zip_code && player.location_visible !== false) {
        distance = getDistanceBetweenZips(myZipCode, player.zip_code);
      }
      return { ...player, distance };
    });

    // Filter by location visibility (opt-out)
    filtered = filtered.filter(player => player.location_visible !== false);

    // Filter by match preferences - strict overlap on all categories
    if (myPreferences) {
      filtered = filtered.filter(player => {
        const playerPrefs = allPreferences.find(p => p.user_id === player.id);
        
        // Player must be actively looking to play
        if (!playerPrefs || !playerPrefs.looking_to_play) {
          return false;
        }

        // Must have at least one match_type overlap
        if (!hasOverlap(myPreferences.match_types, playerPrefs.match_types)) {
          return false;
        }

        // Must have at least one preferred_day overlap
        if (myPreferences.preferred_days.length > 0 && playerPrefs.preferred_days.length > 0) {
          if (!hasOverlap(myPreferences.preferred_days, playerPrefs.preferred_days)) {
            return false;
          }
        }

        // Must have at least one preferred_time overlap
        if (myPreferences.preferred_times.length > 0 && playerPrefs.preferred_times.length > 0) {
          if (!hasOverlap(myPreferences.preferred_times, playerPrefs.preferred_times)) {
            return false;
          }
        }

        return true;
      });
    } else {
      // If no preferences set, show players who are looking to play
      filtered = filtered.filter(player => {
        const playerPrefs = allPreferences.find(p => p.user_id === player.id);
        return playerPrefs?.looking_to_play === true;
      });
    }

    // Filter by distance if enabled and user has ZIP code
    if (useDistanceFilter && myZipCode) {
      filtered = filtered.filter(player => {
        if (player.distance === null) return true; // Include players without distance data
        return player.distance <= maxDistance;
      });
    }

    // Filter by UTR range - include players with no UTR rating (null)
    filtered = filtered.filter(player => {
      if (player.utr_rating === null || player.utr_rating === undefined) {
        return true;
      }
      return player.utr_rating >= utrRange[0] && player.utr_rating <= utrRange[1];
    });

    // Filter by location text
    if (location) {
      filtered = filtered.filter(player => 
        player.location?.toLowerCase().includes(location.toLowerCase())
      );
    }

    // Sort by distance first, then by name
    filtered.sort((a, b) => {
      // Players with distance come first, sorted by distance
      if (a.distance !== null && b.distance !== null) {
        return a.distance - b.distance;
      }
      if (a.distance !== null) return -1;
      if (b.distance !== null) return 1;
      // Then alphabetically
      return (a.full_name || '').localeCompare(b.full_name || '');
    });

    setFilteredPlayers(filtered);
  };

  const handleSendMatchRequest = (player: Player) => {
    setSelectedPlayer(player);
    setShowMatchRequest(true);
  };

  const getPlayerDistanceDisplay = (player: Player) => {
    if (!myZipCode || !player.zip_code || player.location_visible === false) {
      return null;
    }
    
    return formatDistance(player.distance, player.show_exact_distance !== false);
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
              {/* Distance Filter */}
              {myZipCode && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Max Distance: {maxDistance} miles</Label>
                  </div>
                  <div className="px-2">
                    <Slider
                      value={[maxDistance]}
                      onValueChange={(value) => setMaxDistance(value[0])}
                      max={50}
                      min={1}
                      step={1}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Showing players within {maxDistance} miles
                  </p>
                </div>
              )}

              {!myZipCode && (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p className="text-muted-foreground">
                    Add a ZIP code to your profile to filter by distance
                  </p>
                </div>
              )}

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
                  />
                </div>
              </div>

              {/* Location Text */}
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
            {filteredPlayers.map((player) => {
              const distanceDisplay = getPlayerDistanceDisplay(player);
              
              return (
                <Card key={player.id} className="hover:shadow-lg transition-shadow border-border/50">
                  <CardContent className="p-5">
                    {/* Player Info Row */}
                    <div className="flex items-center gap-4 mb-4">
                      <Avatar className="h-14 w-14 border-2 border-primary/20">
                        <AvatarImage src={player.avatar_url} />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {player.full_name?.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base truncate">{player.full_name}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-sm font-medium text-primary">
                            UTR: {player.utr_rating || 'N/A'}
                          </span>
                          {distanceDisplay && (
                            <span className="flex items-center gap-1 text-sm text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5" />
                              {distanceDisplay}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons - Stacked Layout */}
                    <div className="flex flex-col gap-2">
                      <Button 
                        className="w-full"
                        onClick={() => handleSendMatchRequest(player)}
                      >
                        Send Match Request
                      </Button>
                      <div className="flex gap-2 min-w-0">
                        <Button 
                          variant="outline"
                          className="flex-1 min-w-0"
                          onClick={() => navigate(`/profile/${player.id}`)}
                        >
                          <User className="h-4 w-4 shrink-0 mr-1.5" />
                          <span className="truncate">View Profile</span>
                        </Button>
                        <Button 
                          variant="outline"
                          className="flex-1 min-w-0"
                          onClick={() => navigate(`/messages?user=${player.id}`)}
                        >
                          <MessageCircle className="h-4 w-4 shrink-0 mr-1.5" />
                          <span className="truncate">Message</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {filteredPlayers.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No players match your current filters.</p>
              {myZipCode && maxDistance < 25 && (
                <p className="text-sm text-muted-foreground mt-2">
                  Try increasing your distance range to see more players.
                </p>
              )}
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
