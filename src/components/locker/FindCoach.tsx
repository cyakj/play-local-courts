
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Star, MapPin, Clock, DollarSign, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Coach } from '../../types/coach';
import { toast } from 'sonner';

interface FindCoachProps {
  onBack: () => void;
}

interface CoachWithProfile extends Coach {
  profiles: {
    full_name: string;
    avatar_url?: string;
  } | null;
  averageRating?: number;
  totalReviews?: number;
}

const FindCoach: React.FC<FindCoachProps> = ({ onBack }) => {
  const [coaches, setCoaches] = useState<CoachWithProfile[]>([]);
  const [filteredCoaches, setFilteredCoaches] = useState<CoachWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSport, setSelectedSport] = useState<string>('all');
  const [selectedSkillLevel, setSelectedSkillLevel] = useState<string>('all');
  const [travelFilter, setTravelFilter] = useState<string>('all');
  const [maxRate, setMaxRate] = useState<string>('');

  useEffect(() => {
    loadCoaches();
  }, []);

  useEffect(() => {
    filterCoaches();
  }, [coaches, selectedSport, selectedSkillLevel, travelFilter, maxRate]);

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
            .select('full_name, avatar_url')
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
    let filtered = [...coaches];

    if (selectedSport && selectedSport !== 'all') {
      filtered = filtered.filter(coach => 
        coach.sports_offered?.includes(selectedSport)
      );
    }

    if (travelFilter === 'travel') {
      filtered = filtered.filter(coach => coach.willing_to_travel);
    }

    if (maxRate) {
      const maxRateNum = parseFloat(maxRate);
      filtered = filtered.filter(coach => 
        !coach.hourly_rate || coach.hourly_rate <= maxRateNum
      );
    }

    setFilteredCoaches(filtered);
  };

  const handleRequestLesson = (coach: CoachWithProfile) => {
    // This will open a lesson request dialog
    toast.info('Lesson request feature coming soon!');
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <Input
                id="maxRate"
                type="number"
                placeholder="Any rate"
                value={maxRate}
                onChange={(e) => setMaxRate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Coaches List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCoaches.map((coach) => (
          <Card key={coach.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
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
                    <p className="text-sm text-gray-600">{coach.business_name}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {coach.averageRating && (
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-medium">{coach.averageRating.toFixed(1)}</span>
                        <span className="text-sm text-gray-500">({coach.totalReviews})</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="h-4 w-4" />
                  <span>{coach.home_base}</span>
                  {coach.willing_to_travel && (
                    <Badge variant="secondary" className="text-xs">Will Travel</Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="h-4 w-4" />
                  <span>{coach.years_experience} years experience</span>
                </div>

                {coach.hourly_rate && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
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
                <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                  {coach.bio}
                </p>
              )}

              <Button 
                className="w-full" 
                onClick={() => handleRequestLesson(coach)}
              >
                Request Lesson
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredCoaches.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">No coaches found matching your criteria.</p>
            <p className="text-sm text-gray-400 mt-2">Try adjusting your filters to see more results.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FindCoach;
