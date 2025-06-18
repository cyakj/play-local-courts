
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowLeft, MessageCircle, AlertCircle, Loader2, HelpCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import MatchRequestDialog from './MatchRequestDialog';

interface PlayerResult {
  id: string;
  full_name: string;
  avatar_url: string;
  bio: string;
  utr_rating: number;
  wtn_rating: number;
  ntrp_rating: number;
  date_of_birth: string;
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
    minUtrRating: '',
    maxUtrRating: '',
    minNtrpRating: '',
    maxNtrpRating: '',
    timeOfDay: 'any',
    dayOfWeek: 'any'
  });

  console.log('FindPartner component rendering, currentUser:', currentUser?.id);

  useEffect(() => {
    console.log('FindPartner useEffect triggered');
    
    setInitialLoading(false);
    
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

      console.log('Fetching match preferences...');
      const { data: matchPrefsData, error: matchPrefsError } = await supabase
        .from('match_preferences')
        .select('*')
        .eq('looking_to_play', true)
        .neq('user_id', currentUser.id);

      if (matchPrefsError) {
        console.error('Match preferences query error:', matchPrefsError);
        throw new Error(`Failed to fetch match preferences: ${matchPrefsError.message}`);
      }

      console.log('Match preferences data:', matchPrefsData);

      if (!matchPrefsData || matchPrefsData.length === 0) {
        console.log('No match preferences found');
        setPlayers([]);
        return;
      }

      const userIds = matchPrefsData.map(pref => pref.user_id);
      
      console.log('Fetching profiles for user IDs:', userIds);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      if (profilesError) {
        console.error('Profiles query error:', profilesError);
        throw new Error(`Failed to fetch player profiles: ${profilesError.message}`);
      }

      console.log('Profiles data:', profilesData);

      const formattedPlayers = matchPrefsData.map((matchPref: any) => {
        const profile = profilesData?.find(p => p.id === matchPref.user_id);
        
        return {
          id: matchPref.user_id,
          full_name: profile?.full_name || 'Unknown Player',
          avatar_url: profile?.avatar_url || '',
          bio: profile?.bio || '',
          utr_rating: profile?.utr_rating || 0,
          wtn_rating: profile?.wtn_rating || 0,
          ntrp_rating: (profile as any)?.ntrp_rating || 0,
          date_of_birth: profile?.date_of_birth || '',
          hoa_name: 'Community Member',
          match_types: matchPref.match_types || [],
          preferred_times: matchPref.preferred_times || [],
          preferred_days: matchPref.preferred_days || [],
          notes: matchPref.notes || ''
        };
      }).filter(player => player.full_name !== 'Unknown Player');

      console.log('Formatted players:', formattedPlayers);
      setPlayers(formattedPlayers);

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

  const getPlayerAge = (dateOfBirth: string): number | null => {
    if (!dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const getPrimaryRating = (player: PlayerResult): { rating: number; type: string } | null => {
    const age = getPlayerAge(player.date_of_birth);
    
    if (age !== null && age < 30) {
      if (player.utr_rating) return { rating: player.utr_rating, type: 'UTR' };
      if (player.ntrp_rating) return { rating: player.ntrp_rating, type: 'NTRP' };
    } else if (age !== null && age >= 30) {
      if (player.ntrp_rating) return { rating: player.ntrp_rating, type: 'NTRP' };
      if (player.utr_rating) return { rating: player.utr_rating, type: 'UTR' };
    }
    
    if (player.utr_rating) return { rating: player.utr_rating, type: 'UTR' };
    if (player.ntrp_rating) return { rating: player.ntrp_rating, type: 'NTRP' };
    if (player.wtn_rating) return { rating: player.wtn_rating, type: 'WTN' };
    
    return null;
  };

  const filteredPlayers = players.filter(player => {
    if (filters.matchType !== 'any' && !player.match_types.includes(filters.matchType)) return false;
    if (filters.timeOfDay !== 'any' && !player.preferred_times.includes(filters.timeOfDay)) return false;
    if (filters.dayOfWeek !== 'any' && !player.preferred_days.includes(filters.dayOfWeek)) return false;
    
    if (filters.minUtrRating || filters.maxUtrRating) {
      if (!player.utr_rating) return false;
      if (filters.minUtrRating && player.utr_rating < parseFloat(filters.minUtrRating)) return false;
      if (filters.maxUtrRating && player.utr_rating > parseFloat(filters.maxUtrRating)) return false;
    }
    
    if (filters.minNtrpRating || filters.maxNtrpRating) {
      if (!player.ntrp_rating) return false;
      if (filters.minNtrpRating && player.ntrp_rating < parseFloat(filters.minNtrpRating)) return false;
      if (filters.maxNtrpRating && player.ntrp_rating > parseFloat(filters.maxNtrpRating)) return false;
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

  const handleMessage = (playerId: string, playerName: string) => {
    toast({
      title: "Feature Coming Soon",
      description: `Messaging with ${playerName} will be available soon!`
    });
  };

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
    <TooltipProvider>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-6">
          <Button variant="ghost" onClick={onBack} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to My Locker
          </Button>
          <h1 className="text-3xl font-bold">Find a Partner</h1>
        </div>

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
            <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
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
                <div className="flex items-center gap-1">
                  <Label htmlFor="minUtrRating">Min UTR</Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Used in high school, college, and global tennis events</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="minUtrRating"
                  type="number"
                  step="0.1"
                  value={filters.minUtrRating}
                  onChange={(e) => setFilters(prev => ({ ...prev, minUtrRating: e.target.value }))}
                  placeholder="Any"
                />
              </div>

              <div>
                <div className="flex items-center gap-1">
                  <Label htmlFor="maxUtrRating">Max UTR</Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Used in high school, college, and global tennis events</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="maxUtrRating"
                  type="number"
                  step="0.1"
                  value={filters.maxUtrRating}
                  onChange={(e) => setFilters(prev => ({ ...prev, maxUtrRating: e.target.value }))}
                  placeholder="Any"
                />
              </div>

              <div>
                <div className="flex items-center gap-1">
                  <Label htmlFor="minNtrpRating">Min NTRP</Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Used by USTA for adult league and recreational play</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="minNtrpRating"
                  type="number"
                  step="0.5"
                  value={filters.minNtrpRating}
                  onChange={(e) => setFilters(prev => ({ ...prev, minNtrpRating: e.target.value }))}
                  placeholder="Any"
                />
              </div>

              <div>
                <div className="flex items-center gap-1">
                  <Label htmlFor="maxNtrpRating">Max NTRP</Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Used by USTA for adult league and recreational play</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="maxNtrpRating"
                  type="number"
                  step="0.5"
                  value={filters.maxNtrpRating}
                  onChange={(e) => setFilters(prev => ({ ...prev, maxNtrpRating: e.target.value }))}
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

          {filteredPlayers.map((player) => {
            const primaryRating = getPrimaryRating(player);
            
            return (
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
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleMessage(player.id, player.full_name)}
                          >
                            <MessageCircle className="h-4 w-4 mr-2" />
                            Message
                          </Button>
                          <MatchRequestDialog 
                            targetPlayer={{
                              id: player.id,
                              full_name: player.full_name,
                              match_types: player.match_types
                            }}
                          />
                        </div>
                      </div>

                      {player.bio && (
                        <p className="text-sm">{player.bio}</p>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {player.utr_rating && (
                          <Badge variant={primaryRating?.type === 'UTR' ? 'default' : 'secondary'}>
                            UTR: {player.utr_rating}
                          </Badge>
                        )}
                        {player.ntrp_rating && (
                          <Badge variant={primaryRating?.type === 'NTRP' ? 'default' : 'secondary'}>
                            NTRP: {player.ntrp_rating}
                          </Badge>
                        )}
                        {player.wtn_rating && (
                          <Badge variant="secondary">WTN: {player.wtn_rating}</Badge>
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
            );
          })}

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
    </TooltipProvider>
  );
};

export default FindPartner;
