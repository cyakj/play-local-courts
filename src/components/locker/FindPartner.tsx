
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface PlayerResult {
  id: string;
  full_name: string;
  avatar_url: string;
  bio: string;
  utr_rating: number;
  wtn_rating: number;
  usta_ranking: string;
  hoa_name: string;
  match_types: string[];
  preferred_times: string[];
  preferred_days: string[];
  notes: string;
}

interface FindPartnerProps {
  onBack: () => void;
}

const FindPartner: React.FC<FindPartnerProps> = ({ onBack }) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [players, setPlayers] = useState<PlayerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    matchType: '',
    minRating: '',
    maxRating: '',
    timeOfDay: '',
    dayOfWeek: ''
  });

  useEffect(() => {
    console.log('FindPartner component mounted, currentUser:', currentUser?.id);
    if (currentUser) {
      searchPlayers();
    }
  }, [currentUser]);

  const searchPlayers = async () => {
    if (!currentUser) {
      console.log('No current user, skipping search');
      return;
    }

    console.log('Starting player search...');
    setLoading(true);
    try {
      // First, let's test basic query to match_preferences
      const { data: testData, error: testError } = await supabase
        .from('match_preferences')
        .select('*')
        .eq('looking_to_play', true)
        .limit(5);

      console.log('Test query result:', { testData, testError });

      // Now try the full query with profile join
      const { data, error } = await supabase
        .from('match_preferences')
        .select(`
          user_id,
          match_types,
          preferred_times,
          preferred_days,
          notes,
          profiles!inner (
            id,
            full_name,
            avatar_url,
            bio,
            utr_rating,
            wtn_rating,
            usta_ranking,
            hoas (name)
          )
        `)
        .eq('looking_to_play', true)
        .neq('user_id', currentUser.id);

      console.log('Full query result:', { data, error });

      if (error) {
        console.error('Query error:', error);
        throw error;
      }

      const formattedPlayers = data?.map((item: any) => ({
        id: item.profiles.id,
        full_name: item.profiles.full_name || 'Unknown Player',
        avatar_url: item.profiles.avatar_url || '',
        bio: item.profiles.bio || '',
        utr_rating: item.profiles.utr_rating || 0,
        wtn_rating: item.profiles.wtn_rating || 0,
        usta_ranking: item.profiles.usta_ranking || '',
        hoa_name: item.profiles.hoas?.name || 'Unknown HOA',
        match_types: item.match_types || [],
        preferred_times: item.preferred_times || [],
        preferred_days: item.preferred_days || [],
        notes: item.notes || ''
      })) || [];

      console.log('Formatted players:', formattedPlayers);
      setPlayers(formattedPlayers);
    } catch (error) {
      console.error('Error searching players:', error);
      toast({
        title: "Error",
        description: "Failed to search for players. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredPlayers = players.filter(player => {
    if (filters.matchType && !player.match_types.includes(filters.matchType)) return false;
    if (filters.timeOfDay && !player.preferred_times.includes(filters.timeOfDay)) return false;
    if (filters.dayOfWeek && !player.preferred_days.includes(filters.dayOfWeek)) return false;
    
    if (filters.minRating || filters.maxRating) {
      const rating = player.utr_rating || player.wtn_rating;
      if (!rating) return false;
      if (filters.minRating && rating < parseFloat(filters.minRating)) return false;
      if (filters.maxRating && rating > parseFloat(filters.maxRating)) return false;
    }
    
    return true;
  });

  const formatMatchTypes = (types: string[]) => {
    return types.map(type => {
      switch (type) {
        case 'singles': return 'Singles';
        case 'doubles': return 'Doubles';
        case 'mixed_doubles': return 'Mixed Doubles';
        default: return type;
      }
    }).join(', ');
  };

  const formatTimes = (times: string[]) => {
    return times.map(time => {
      switch (time) {
        case 'morning': return 'Morning';
        case 'afternoon': return 'Afternoon';
        case 'evening': return 'Evening';
        default: return time;
      }
    }).join(', ');
  };

  const formatDays = (days: string[]) => {
    return days.map(day => day.charAt(0).toUpperCase() + day.slice(1)).join(', ');
  };

  console.log('Rendering FindPartner, players count:', players.length, 'filtered:', filteredPlayers.length);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <Button variant="ghost" onClick={onBack} className="mr-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to My Locker
        </Button>
        <h1 className="text-3xl font-bold">Find a Partner</h1>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Search Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="matchType">Match Type</Label>
              <Select value={filters.matchType} onValueChange={(value) => setFilters(prev => ({ ...prev, matchType: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any</SelectItem>
                  <SelectItem value="singles">Singles</SelectItem>
                  <SelectItem value="doubles">Doubles</SelectItem>
                  <SelectItem value="mixed_doubles">Mixed Doubles</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="minRating">Min Rating</Label>
              <Input
                id="minRating"
                type="number"
                step="0.1"
                value={filters.minRating}
                onChange={(e) => setFilters(prev => ({ ...prev, minRating: e.target.value }))}
                placeholder="Any"
              />
            </div>

            <div>
              <Label htmlFor="maxRating">Max Rating</Label>
              <Input
                id="maxRating"
                type="number"
                step="0.1"
                value={filters.maxRating}
                onChange={(e) => setFilters(prev => ({ ...prev, maxRating: e.target.value }))}
                placeholder="Any"
              />
            </div>

            <div>
              <Label htmlFor="timeOfDay">Time of Day</Label>
              <Select value={filters.timeOfDay} onValueChange={(value) => setFilters(prev => ({ ...prev, timeOfDay: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any</SelectItem>
                  <SelectItem value="morning">Morning</SelectItem>
                  <SelectItem value="afternoon">Afternoon</SelectItem>
                  <SelectItem value="evening">Evening</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="dayOfWeek">Day of Week</Label>
              <Select value={filters.dayOfWeek} onValueChange={(value) => setFilters(prev => ({ ...prev, dayOfWeek: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any</SelectItem>
                  <SelectItem value="monday">Monday</SelectItem>
                  <SelectItem value="tuesday">Tuesday</SelectItem>
                  <SelectItem value="wednesday">Wednesday</SelectItem>
                  <SelectItem value="thursday">Thursday</SelectItem>
                  <SelectItem value="friday">Friday</SelectItem>
                  <SelectItem value="saturday">Saturday</SelectItem>
                  <SelectItem value="sunday">Sunday</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="mt-4">
            <Button onClick={searchPlayers} disabled={loading}>
              {loading ? 'Searching...' : 'Search Players'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">
          {loading ? 'Searching...' : `${filteredPlayers.length} player${filteredPlayers.length !== 1 ? 's' : ''} found`}
        </h2>

        {filteredPlayers.map((player) => (
          <Card key={player.id}>
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={player.avatar_url} alt={player.full_name} />
                  <AvatarFallback>
                    {player.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold">{player.full_name}</h3>
                      <p className="text-sm text-muted-foreground">{player.hoa_name}</p>
                    </div>
                    <Button variant="outline" size="sm">
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Message
                    </Button>
                  </div>

                  {player.bio && (
                    <p className="text-sm">{player.bio}</p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {player.utr_rating && (
                      <Badge variant="secondary">UTR: {player.utr_rating}</Badge>
                    )}
                    {player.wtn_rating && (
                      <Badge variant="secondary">WTN: {player.wtn_rating}</Badge>
                    )}
                    {player.usta_ranking && (
                      <Badge variant="secondary">USTA: {player.usta_ranking}</Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="font-medium">Match Types: </span>
                      <span className="text-muted-foreground">{formatMatchTypes(player.match_types)}</span>
                    </div>
                    <div>
                      <span className="font-medium">Times: </span>
                      <span className="text-muted-foreground">{formatTimes(player.preferred_times)}</span>
                    </div>
                    <div>
                      <span className="font-medium">Days: </span>
                      <span className="text-muted-foreground">{formatDays(player.preferred_days)}</span>
                    </div>
                  </div>

                  {player.notes && (
                    <div className="text-sm">
                      <span className="font-medium">Notes: </span>
                      <span className="text-muted-foreground">{player.notes}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredPlayers.length === 0 && !loading && (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                {players.length === 0 
                  ? "No players are currently looking to play. Be the first to set your preferences!"
                  : "No players found matching your criteria. Try adjusting your filters."
                }
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default FindPartner;
