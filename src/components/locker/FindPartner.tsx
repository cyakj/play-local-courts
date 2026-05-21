
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MessageCircle, User, MapPin, SlidersHorizontal, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import MatchRequestDialog from './MatchRequestDialog';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { getDistanceBetweenZips, formatDistance } from '@/lib/zipCodeUtils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface Player {
  id: string;
  full_name: string;
  avatar_url?: string;
  utr_rating?: number;
  ntrp_rating?: number;
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  // Filter states
  const [utrRange, setUtrRange] = useState([1, 15]);
  const [ntrpRange, setNtrpRange] = useState([1, 7]);
  const [location, setLocation] = useState<string>('');
  const [maxDistance, setMaxDistance] = useState<number>(25);
  const [useDistanceFilter, setUseDistanceFilter] = useState(false);

  const loadPlayersCallback = useCallback(() => {
    loadPlayers();
  }, [currentUser]);

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
        .select('id, full_name, avatar_url, utr_rating, ntrp_rating, location, bio, zip_code, location_visible, show_exact_distance')
        .neq('id', currentUser.id)
        .not('full_name', 'is', null);
      if (error) throw error;
      setPlayers(data || []);
    } catch (error) {
      console.error('Error loading players:', error);
      toast({ title: "Error", description: "Failed to load players", variant: "destructive" });
    }
  };

  const loadPreferences = async () => {
    if (!currentUser) return;
    try {
      const { data: myPrefs } = await supabase
        .from('match_preferences')
        .select('user_id, looking_to_play, match_types, preferred_times, preferred_days')
        .eq('user_id', currentUser.id)
        .single();
      setMyPreferences(myPrefs);

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

  const hasOverlap = (arr1: string[], arr2: string[]) => arr1.some(item => arr2.includes(item));

  const getOverlapSummary = (playerId: string): string | null => {
    if (!myPreferences) return null;
    const prefs = allPreferences.find(p => p.user_id === playerId);
    if (!prefs) return null;

    const parts: string[] = [];
    const matchOverlap = myPreferences.match_types.filter(t => prefs.match_types.includes(t));
    if (matchOverlap.length > 0) parts.push(matchOverlap.map(t => t.replace('_', ' ')).join(', '));
    
    const dayOverlap = myPreferences.preferred_days.filter(d => prefs.preferred_days.includes(d));
    if (dayOverlap.length > 0) {
      const dayAbbrevs: Record<string, string> = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };
      parts.push(dayOverlap.map(d => dayAbbrevs[d] || d).join('/'));
    }

    const timeOverlap = myPreferences.preferred_times.filter(t => prefs.preferred_times.includes(t));
    if (timeOverlap.length > 0) parts.push(timeOverlap.join(', '));

    return parts.length > 0 ? parts.join(' · ') : null;
  };

  const filterPlayers = () => {
    let filtered = players.map(player => {
      let distance: number | null = null;
      if (myZipCode && player.zip_code && player.location_visible !== false) {
        distance = getDistanceBetweenZips(myZipCode, player.zip_code);
      }
      return { ...player, distance };
    });

    filtered = filtered.filter(player => player.location_visible !== false);

    if (myPreferences) {
      filtered = filtered.filter(player => {
        const playerPrefs = allPreferences.find(p => p.user_id === player.id);
        if (!playerPrefs || !playerPrefs.looking_to_play) return false;
        if (!hasOverlap(myPreferences.match_types, playerPrefs.match_types)) return false;
        if (myPreferences.preferred_days.length > 0 && playerPrefs.preferred_days.length > 0) {
          if (!hasOverlap(myPreferences.preferred_days, playerPrefs.preferred_days)) return false;
        }
        if (myPreferences.preferred_times.length > 0 && playerPrefs.preferred_times.length > 0) {
          if (!hasOverlap(myPreferences.preferred_times, playerPrefs.preferred_times)) return false;
        }
        return true;
      });
    } else {
      filtered = filtered.filter(player => {
        const playerPrefs = allPreferences.find(p => p.user_id === player.id);
        return playerPrefs?.looking_to_play === true;
      });
    }

    if (useDistanceFilter && myZipCode) {
      filtered = filtered.filter(player => {
        if (player.distance === null) return true;
        return player.distance <= maxDistance;
      });
    }

    filtered = filtered.filter(player => {
      if (player.utr_rating === null || player.utr_rating === undefined) return true;
      return player.utr_rating >= utrRange[0] && player.utr_rating <= utrRange[1];
    });

    if (location) {
      filtered = filtered.filter(player => 
        player.location?.toLowerCase().includes(location.toLowerCase())
      );
    }

    filtered.sort((a, b) => {
      if (a.distance !== null && b.distance !== null) return a.distance - b.distance;
      if (a.distance !== null) return -1;
      if (b.distance !== null) return 1;
      return (a.full_name || '').localeCompare(b.full_name || '');
    });

    setFilteredPlayers(filtered);
  };

  const handleSendMatchRequest = (player: Player) => {
    setSelectedPlayer(player);
    setShowMatchRequest(true);
  };

  const getPlayerDistanceDisplay = (player: Player) => {
    if (!myZipCode || !player.zip_code || player.location_visible === false) return null;
    return formatDistance(player.distance, player.show_exact_distance !== false);
  };

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button onClick={onBack} variant="ghost" size="icon" className="h-11 w-11">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Find a Partner</h1>
        </div>
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="icon" className="h-11 w-11">
              {filtersOpen ? <X className="h-5 w-5" /> : <SlidersHorizontal className="h-5 w-5" />}
            </Button>
          </CollapsibleTrigger>
        </Collapsible>
      </div>

      {/* Collapsible Filters */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <CollapsibleContent>
          <Card className="mb-4">
            <CardContent className="p-4 space-y-5">
              {myZipCode && (
                <div className="space-y-2">
                  <Label className="text-sm">Max Distance: {maxDistance} mi</Label>
                  <Slider value={[maxDistance]} onValueChange={(v) => setMaxDistance(v[0])} max={50} min={1} step={1} />
                </div>
              )}
              {!myZipCode && (
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">Add a ZIP code to your profile to filter by distance</p>
              )}
              <div className="space-y-2">
                <Label className="text-sm">UTR Range: {utrRange[0]} – {utrRange[1]}</Label>
                <Slider value={utrRange} onValueChange={setUtrRange} max={15} min={1} step={0.5} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">NTRP Range: {ntrpRange[0]} – {ntrpRange[1]}</Label>
                <Slider value={ntrpRange} onValueChange={setNtrpRange} max={7} min={1} step={0.5} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Location</Label>
                <Input placeholder="City or area..." value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Results count */}
      <p className="text-sm text-muted-foreground mb-3">{filteredPlayers.length} player{filteredPlayers.length !== 1 ? 's' : ''} found</p>

      {/* Player Cards - Vertical List */}
      <div className="space-y-3">
        {filteredPlayers.map((player) => {
          const distanceDisplay = getPlayerDistanceDisplay(player);
          const overlapSummary = getOverlapSummary(player.id);
          const playerPrefs = allPreferences.find(p => p.user_id === player.id);
          
          return (
            <Card key={player.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                {/* Player Info */}
                <div className="flex items-start gap-3 mb-3">
                  <Avatar className="h-14 w-14 border-2 border-primary/20 shrink-0">
                    <AvatarImage src={player.avatar_url} />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {player.full_name?.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base truncate">{player.full_name}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {player.utr_rating && (
                        <Badge variant="secondary" className="text-xs">UTR {player.utr_rating}</Badge>
                      )}
                      {player.ntrp_rating && (
                        <Badge variant="outline" className="text-xs">NTRP {player.ntrp_rating}</Badge>
                      )}
                      {distanceDisplay && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {distanceDisplay}
                        </span>
                      )}
                    </div>
                    {/* Match type preferences */}
                    {playerPrefs && playerPrefs.match_types.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {playerPrefs.match_types.map(t => (
                          <Badge key={t} variant="secondary" className="text-[10px] capitalize bg-primary/10 text-primary">
                            {t.replace('_', ' ')}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {/* Availability overlap */}
                    {overlapSummary && (
                      <p className="text-xs text-green-600 mt-1.5 font-medium">
                        ✓ {overlapSummary}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  <Button 
                    className="w-full h-11"
                    onClick={() => handleSendMatchRequest(player)}
                  >
                    Send Match Request
                  </Button>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline"
                      className="flex-1 h-11"
                      onClick={() => navigate(`/profile/${player.id}`)}
                    >
                      <User className="h-4 w-4 mr-1.5" />
                      View Profile
                    </Button>
                    <Button 
                      variant="outline"
                      className="flex-1 h-11"
                      onClick={() => navigate(`/messages?user=${player.id}`)}
                    >
                      <MessageCircle className="h-4 w-4 mr-1.5" />
                      Message
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
