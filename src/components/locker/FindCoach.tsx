
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Star, MapPin, Clock, DollarSign, ArrowLeft, User, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { Coach } from '../../types/coach';
import { toast } from 'sonner';
import LessonRequestDialog from './LessonRequestDialog';
import { getDistanceBetweenZips, formatDistance } from '@/lib/zipCodeUtils';

interface FindCoachProps {
  onBack: () => void;
}

interface CoachWithProfile extends Coach {
  profiles: {
    full_name: string;
    avatar_url?: string;
    zip_code?: string;
    location_visible?: boolean;
    show_exact_distance?: boolean;
  } | null;
  averageRating?: number;
  totalReviews?: number;
  distance?: number | null;
}

const FindCoach: React.FC<FindCoachProps> = ({ onBack }) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [coaches, setCoaches] = useState<CoachWithProfile[]>([]);
  const [filteredCoaches, setFilteredCoaches] = useState<CoachWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSport, setSelectedSport] = useState<string>('all');
  const [selectedSkillLevel, setSelectedSkillLevel] = useState<string>('all');
  const [travelFilter, setTravelFilter] = useState<string>('all');
  const [maxRate, setMaxRate] = useState<string>('');
  const [maxDistance, setMaxDistance] = useState<number>(25);
  const [myZipCode, setMyZipCode] = useState<string | null>(null);
  const [lessonDialogOpen, setLessonDialogOpen] = useState(false);
  const [selectedCoach, setSelectedCoach] = useState<CoachWithProfile | null>(null);

  useEffect(() => {
    loadMyProfile();
    loadCoaches();
  }, [currentUser]);

  useEffect(() => {
    filterCoaches();
  }, [coaches, selectedSport, selectedSkillLevel, travelFilter, maxRate, maxDistance, myZipCode]);

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
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadCoaches = async () => {
    try {
      // First, get all coaches
      const { data: coachData, error: coachError } = await supabase
        .from('coaches')
        .select('*');

      if (coachError) throw coachError;

      // Then get profiles for each coach
      const coachesWithProfiles = await Promise.all(
        (coachData || []).map(async (coach) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url, zip_code, location_visible, show_exact_distance')
            .eq('id', coach.user_id)
            .single();

          // Get ratings for each coach
          const { data: reviews } = await supabase
            .from('coach_reviews')
            .select('rating')
            .eq('coach_id', coach.user_id);

          const averageRating = reviews?.length 
            ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
            : undefined;

          return {
            ...coach,
            // Cast credentials to the expected type, defaulting to 'None' if invalid
            credentials: (['USPTA', 'PTR', 'None'].includes(coach.credentials)) 
              ? coach.credentials as 'USPTA' | 'PTR' | 'None'
              : 'None' as const,
            profiles: profile,
            averageRating,
            totalReviews: reviews?.length || 0
          } as CoachWithProfile;
        })
      );

      setCoaches(coachesWithProfiles);
    } catch (error) {
      console.error('Error loading coaches:', error);
      toast.error('Failed to load coaches');
    } finally {
      setLoading(false);
    }
  };

  const filterCoaches = () => {
    let filtered = coaches.map(coach => {
      // Calculate distance for each coach
      let distance: number | null = null;
      if (myZipCode && coach.profiles?.zip_code && coach.profiles?.location_visible !== false) {
        distance = getDistanceBetweenZips(myZipCode, coach.profiles.zip_code);
      }
      return { ...coach, distance };
    });

    // Filter by location visibility (opt-out)
    filtered = filtered.filter(coach => coach.profiles?.location_visible !== false);

    if (selectedSport && selectedSport !== 'all') {
      filtered = filtered.filter(coach => 
        coach.sports_offered?.includes(selectedSport)
      );
    }

    if (travelFilter === 'travel') {
      filtered = filtered.filter(coach => coach.willing_to_travel);
    }

    if (maxRate && maxRate !== 'any') {
      const maxRateNum = parseFloat(maxRate);
      filtered = filtered.filter(coach => 
        !coach.hourly_rate || coach.hourly_rate <= maxRateNum
      );
    }

    // Filter by distance if user has ZIP code
    if (myZipCode) {
      filtered = filtered.filter(coach => {
        if (coach.distance === null) return true; // Include coaches without distance data
        return coach.distance <= maxDistance;
      });
    }

    // Sort by distance first, then by rating
    filtered.sort((a, b) => {
      // Coaches with distance come first, sorted by distance
      if (a.distance !== null && b.distance !== null) {
        return a.distance - b.distance;
      }
      if (a.distance !== null) return -1;
      if (b.distance !== null) return 1;
      // Then by rating
      if (a.averageRating && b.averageRating) {
        return b.averageRating - a.averageRating;
      }
      return 0;
    });

    setFilteredCoaches(filtered);
  };

  const handleRequestLesson = (coach: CoachWithProfile) => {
    setSelectedCoach(coach);
    setLessonDialogOpen(true);
  };

  const getCoachDistanceDisplay = (coach: CoachWithProfile) => {
    if (!myZipCode || !coach.profiles?.zip_code || coach.profiles?.location_visible === false) {
      return null;
    }
    
    return formatDistance(coach.distance, coach.profiles?.show_exact_distance !== false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div>Loading coaches...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">Find a Coach</h1>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Coaches</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Distance Slider */}
            {myZipCode && (
              <div className="space-y-2">
                <Label>Max Distance: {maxDistance} mi</Label>
                <div className="px-2 pt-2">
                  <Slider
                    value={[maxDistance]}
                    onValueChange={(value) => setMaxDistance(value[0])}
                    max={50}
                    min={1}
                    step={1}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="sport">Sport</Label>
              <Select value={selectedSport} onValueChange={setSelectedSport}>
                <SelectTrigger>
                  <SelectValue placeholder="All sports" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sports</SelectItem>
                  <SelectItem value="Tennis">Tennis</SelectItem>
                  <SelectItem value="Pickleball">Pickleball</SelectItem>
                  <SelectItem value="Padel">Padel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="skillLevel">Your Skill Level</Label>
              <Select value={selectedSkillLevel} onValueChange={setSelectedSkillLevel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any level</SelectItem>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="travel">Travel Preference</Label>
              <Select value={travelFilter} onValueChange={setTravelFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Any location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any location</SelectItem>
                  <SelectItem value="travel">Can travel to my HOA</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxRate">Max Hourly Rate ($)</Label>
              <Select value={maxRate} onValueChange={setMaxRate}>
                <SelectTrigger>
                  <SelectValue placeholder="Any rate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any rate</SelectItem>
                  <SelectItem value="10">$10/hour</SelectItem>
                  <SelectItem value="20">$20/hour</SelectItem>
                  <SelectItem value="30">$30/hour</SelectItem>
                  <SelectItem value="40">$40/hour</SelectItem>
                  <SelectItem value="50">$50/hour</SelectItem>
                  <SelectItem value="60">$60/hour</SelectItem>
                  <SelectItem value="70">$70/hour</SelectItem>
                  <SelectItem value="80">$80/hour</SelectItem>
                  <SelectItem value="90">$90/hour</SelectItem>
                  <SelectItem value="100">$100/hour</SelectItem>
                  <SelectItem value="150">$150/hour</SelectItem>
                  <SelectItem value="200">$200/hour</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {!myZipCode && (
            <div className="mt-4 p-3 bg-muted rounded-lg text-sm">
              <p className="text-muted-foreground">
                Add a ZIP code to your profile to filter coaches by distance
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coaches List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCoaches.map((coach) => {
          const distanceDisplay = getCoachDistanceDisplay(coach);
          
          return (
            <Card key={coach.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                    {coach.profiles?.avatar_url ? (
                      <img 
                        src={coach.profiles.avatar_url} 
                        alt={coach.profiles.full_name || 'Coach'}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-lg font-semibold">
                        {coach.profiles?.full_name?.charAt(0) || 'C'}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{coach.profiles?.full_name || 'Coach'}</h3>
                    {coach.business_name && (
                      <p className="text-sm text-muted-foreground">{coach.business_name}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {coach.averageRating && (
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="text-sm font-medium">{coach.averageRating.toFixed(1)}</span>
                          <span className="text-sm text-muted-foreground">({coach.totalReviews})</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {distanceDisplay && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span className="font-medium">{distanceDisplay}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{coach.home_base}</span>
                    {coach.willing_to_travel && (
                      <Badge variant="secondary" className="text-xs">Will Travel</Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{coach.years_experience} years experience</span>
                  </div>

                  {coach.hourly_rate && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <DollarSign className="h-4 w-4" />
                      <span>${coach.hourly_rate}/hour</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline">{coach.credentials}</Badge>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex flex-wrap gap-1">
                    {coach.sports_offered?.map((sport) => (
                      <Badge key={sport} variant="secondary" className="text-xs">
                        {sport}
                      </Badge>
                    ))}
                  </div>
                </div>

                {coach.bio && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                    {coach.bio}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button 
                    className="flex-1" 
                    onClick={() => handleRequestLesson(coach)}
                  >
                    Request Lesson
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => navigate(`/profile/${coach.user_id}`)}
                    title="View Profile"
                  >
                    <User className="h-4 w-4 mr-1" />
                    Profile
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => navigate(`/messages?user=${coach.user_id}`)}
                    title="Message"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredCoaches.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">No coaches found matching your criteria.</p>
            <p className="text-sm text-muted-foreground mt-2">
              {myZipCode && maxDistance < 25 
                ? 'Try increasing your distance range to see more coaches.'
                : 'Try adjusting your filters to see more results.'
              }
            </p>
          </CardContent>
        </Card>
      )}

      {selectedCoach && (
        <LessonRequestDialog
          open={lessonDialogOpen}
          onOpenChange={setLessonDialogOpen}
          coachId={selectedCoach.user_id}
          coachName={selectedCoach.profiles?.full_name || 'Coach'}
          sportsOffered={selectedCoach.sports_offered || []}
        />
      )}
    </div>
  );
};

export default FindCoach;
