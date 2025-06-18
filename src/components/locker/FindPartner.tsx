import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MessageCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    matchType: 'any',
    minRating: '',
    maxRating: '',
    timeOfDay: 'any',
    dayOfWeek: 'any'
  });

  console.log('FindPartner component rendering, currentUser:', currentUser?.id);

  useEffect(() => {
    console.log('FindPartner useEffect triggered');
    
    // Always render the basic UI first
    setInitialLoading(false);
    
    // Then attempt to load data if user is available
    if (currentUser) {
      console.log('Current user found, searching for players');
      searchPlayers();
    } else {
      console.log('No current user found');
      setError('Please log in to find tennis partners');
    }
  }, [currentUser]);

  const searchPlayers = async () => {
    console.log('Starting searchPlayers function');
    setLoading(true);
    setError(null);

    try {
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // Test basic connectivity first
      console.log('Testing Supabase connection...');
      const { data: testConnection, error: connectionError } = await supabase
        .from('match_preferences')
        .select('count')
        .limit(1);

      if (connectionError) {
        console.error('Connection test failed:', connectionError);
        throw new Error(`Database connection failed: ${connectionError.message}`);
      }
      console.log('Connection test successful');

      // Try to fetch match preferences with profile data
      console.log('Fetching match preferences...');
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
            usta_ranking
          )
        `)
        .eq('looking_to_play', true)
        .neq('user_id', currentUser.id);

      console.log('Query result:', { data, error });

      if (error) {
        console.error('Query error:', error);
        throw new Error(`Failed to fetch players: ${error.message}`);
      }

      const formattedPlayers = data?.map((item: any) => ({
        id: item.profiles.id,
        full_name: item.profiles.full_name || 'Unknown Player',
        avatar_url: item.profiles.avatar_url || '',
        bio: item.profiles.bio || '',
        utr_rating: item.profiles.utr_rating || 0,
        wtn_rating: item.profiles.wtn_rating || 0,
        usta_ranking: item.profiles.usta_ranking || '',
        hoa_name: 'Community Member',
        match_types: item.match_types || [],
        preferred_times: item.preferred_times || [],
        preferred_days: item.preferred_days || [],
        notes: item.notes || ''
      })) || [];

      console.log('Formatted players:', formattedPlayers);
      setPlayers(formattedPlayers);
      
      if (formattedPlayers.length === 0) {
        console.log('No players found');
      }

    } catch (error: any) {
      console.error('Error in searchPlayers:', error);
      setError(error.message || 'Failed to search for players');
      toast({
        title: "Error",
        description: error.message || 'Failed to search for players',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredPlayers = players.filter(player => {
    if (filters.matchType !== 'any' && !player.match_types.includes(filters.matchType)) return false;
    if (filters.timeOfDay !== 'any' && !player.preferred_times.includes(filters.timeOfDay)) return false;
    if (filters.dayOfWeek !== 'any' && !player.preferred_days.includes(filters.dayOfWeek)) return false;
    
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
        case 'hitting_session': return 'Hitting Session';
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

  // Show loading spinner only for initial load
  if (initialLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading Find Partner...</span>
          </div>
        </div>
      </div>
    );
  }

  console.log('Rendering FindPartner UI, players count:', players.length, 'filtered:', filteredPlayers.length, 'error:', error);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <Button variant="ghost" onClick={onBack} className="mr-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to My Locker
        </Button>
        <h1 className="text-3xl font-bold">Find a Partner</h1>
      </div>

      {/* Show error message if there's an error */}
      {error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Error: {error}</span>
            </div>
            <Button 
              onClick={searchPlayers} 
              className="mt-4"
              variant="outline"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Retrying...
                </>
              ) : (
                'Try Again'
              )}
            </Button>
          </CardContent>
        </Card>
      )}

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
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="singles">Singles</SelectItem>
                  <SelectItem value="doubles">Doubles</SelectItem>
                  <SelectItem value="mixed_doubles">Mixed Doubles</SelectItem>
                  <SelectItem value="hitting_session">Hitting Session</SelectItem>
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
                  <SelectItem value="any">Any</SelectItem>
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
                  <SelectItem value="any">Any</SelectItem>
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
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                'Search Players'
              )}
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

        {filteredPlayers.length === 0 && !loading && !error && (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                {players.length === 0 
                  ? "No players are currently looking to play. Be the first to set your preferences in the Match Finder tab!"
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
