
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Star, MapPin, ArrowLeft, MessageCircle, Heart, ChevronLeft, ChevronRight, RefreshCw, Navigation } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { Coach } from '../../types/coach';
import { toast } from 'sonner';
import LessonRequestDialog from './LessonRequestDialog';
import { getDistanceBetweenZips, formatDistance } from '@/lib/zipCodeUtils';
import { cn } from '@/lib/utils';

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
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const coachesPerPage = 6;

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
      const { data: coachData, error: coachError } = await supabase
        .from('coaches')
        .select('*');

      if (coachError) throw coachError;

      const coachesWithProfiles = await Promise.all(
        (coachData || []).map(async (coach) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url, zip_code, location_visible, show_exact_distance')
            .eq('id', coach.user_id)
            .single();

          const { data: reviews } = await supabase
            .from('coach_reviews')
            .select('rating')
            .eq('coach_id', coach.user_id);

          const averageRating = reviews?.length 
            ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
            : undefined;

          return {
            ...coach,
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
      let distance: number | null = null;
      if (myZipCode && coach.profiles?.zip_code && coach.profiles?.location_visible !== false) {
        distance = getDistanceBetweenZips(myZipCode, coach.profiles.zip_code);
      }
      return { ...coach, distance };
    });

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

    if (myZipCode) {
      filtered = filtered.filter(coach => {
        if (coach.distance === null) return true;
        return coach.distance <= maxDistance;
      });
    }

    filtered.sort((a, b) => {
      if (a.distance !== null && b.distance !== null) {
        return a.distance - b.distance;
      }
      if (a.distance !== null) return -1;
      if (b.distance !== null) return 1;
      if (a.averageRating && b.averageRating) {
        return b.averageRating - a.averageRating;
      }
      return 0;
    });

    setFilteredCoaches(filtered);
    setCurrentPage(1);
  };

  const handleRequestLesson = (coach: CoachWithProfile) => {
    setSelectedCoach(coach);
    setLessonDialogOpen(true);
  };

  const toggleFavorite = (coachId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(coachId)) {
        newFavorites.delete(coachId);
      } else {
        newFavorites.add(coachId);
      }
      return newFavorites;
    });
  };

  const getCoachDistanceDisplay = (coach: CoachWithProfile) => {
    if (!myZipCode || !coach.profiles?.zip_code || coach.profiles?.location_visible === false) {
      return null;
    }
    
    return formatDistance(coach.distance, coach.profiles?.show_exact_distance !== false);
  };

  const applyFilters = () => {
    filterCoaches();
  };

  const resetFilters = () => {
    setSelectedSport('all');
    setSelectedSkillLevel('all');
    setTravelFilter('all');
    setMaxRate('');
    setMaxDistance(25);
  };

  // Pagination logic
  const totalPages = Math.ceil(filteredCoaches.length / coachesPerPage);
  const startIndex = (currentPage - 1) * coachesPerPage;
  const paginatedCoaches = filteredCoaches.slice(startIndex, startIndex + coachesPerPage);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div>Loading coaches...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              onClick={onBack} 
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
              Find a Coach
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Filters Bar */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
          <div className="flex flex-wrap items-end gap-5">
            {/* Sport Filter */}
            <div className="space-y-2 min-w-[150px]">
              <Label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <span className="material-icons-round text-primary text-lg">sports_tennis</span>
                Sport
              </Label>
              <Select value={selectedSport} onValueChange={setSelectedSport}>
                <SelectTrigger className="h-10 bg-muted/30 border-border/50">
                  <SelectValue placeholder="All Sports" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">All Sports</SelectItem>
                  <SelectItem value="Tennis">Tennis</SelectItem>
                  <SelectItem value="Pickleball">Pickleball</SelectItem>
                  <SelectItem value="Padel">Padel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Skill Level Filter */}
            <div className="space-y-2 min-w-[150px]">
              <Label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <span className="material-icons-round text-primary text-lg">bar_chart</span>
                Your Level
              </Label>
              <Select value={selectedSkillLevel} onValueChange={setSelectedSkillLevel}>
                <SelectTrigger className="h-10 bg-muted/30 border-border/50">
                  <SelectValue placeholder="Any Level" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">Any Level</SelectItem>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Distance Slider */}
            {myZipCode && (
              <div className="space-y-2 min-w-[200px] flex-1 max-w-[250px]">
                <Label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <span className="material-icons-round text-primary text-lg">near_me</span>
                  Distance
                  <span className="ml-auto text-primary font-semibold">{maxDistance} mi</span>
                </Label>
                <div className="pt-1 px-1">
                  <Slider
                    value={[maxDistance]}
                    onValueChange={(value) => setMaxDistance(value[0])}
                    max={100}
                    min={1}
                    step={1}
                    className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4 [&_[role=slider]]:bg-primary"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
                    <span>1mi</span>
                    <span>50mi</span>
                    <span>100mi</span>
                  </div>
                </div>
              </div>
            )}

            {/* Travel Preference */}
            <div className="space-y-2 min-w-[160px]">
              <Label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                Travel Preference
              </Label>
              <Select value={travelFilter} onValueChange={setTravelFilter}>
                <SelectTrigger className="h-10 bg-muted/30 border-border/50">
                  <SelectValue placeholder="Any location" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">Any location</SelectItem>
                  <SelectItem value="travel">Will Travel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Max Rate Filter */}
            <div className="space-y-2 min-w-[140px]">
              <Label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <span className="material-icons-round text-primary text-lg">payments</span>
                Max Rate ($)
              </Label>
              <Select value={maxRate} onValueChange={setMaxRate}>
                <SelectTrigger className="h-10 bg-muted/30 border-border/50">
                  <SelectValue placeholder="Any Rate" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="any">Any Rate</SelectItem>
                  <SelectItem value="50">$25 - $50</SelectItem>
                  <SelectItem value="100">$50 - $100</SelectItem>
                  <SelectItem value="150">$100+</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 ml-auto">
              <Button 
                onClick={applyFilters} 
                className="bg-gradient-to-r from-primary to-blue-500 hover:from-primary/90 hover:to-blue-500/90 text-white px-6"
              >
                Apply Filters
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={resetFilters} 
                title="Reset filters"
                className="text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {!myZipCode && (
            <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground border border-border/50">
              Add a ZIP code to your profile to filter coaches by distance
            </div>
          )}
        </div>

        {/* Results Header */}
        <div className="flex items-center justify-between">
          <p className="text-base text-muted-foreground">
            Showing <span className="font-bold text-primary">{filteredCoaches.length}</span> Coaches near you
          </p>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">Sort by:</span>
            <div className="flex gap-2">
              {['Most Popular', 'Newest', 'Price: Low to High', 'Rating'].map((sort, idx) => (
                <button
                  key={sort}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm transition-colors",
                    idx === 0 
                      ? "bg-primary/10 text-primary font-medium" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  {sort}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Coaches Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedCoaches.map((coach) => {
            const distanceDisplay = getCoachDistanceDisplay(coach);
            const isFavorite = favorites.has(coach.id);
            const primarySport = coach.sports_offered?.[0] || 'Coach';
            
            return (
              <div 
                key={coach.id} 
                className="group bg-card rounded-2xl border border-border/50 overflow-hidden hover:shadow-xl hover:border-primary/20 transition-all duration-300"
              >
                {/* Coach Image Section */}
                <div className="relative h-56 bg-gradient-to-br from-muted via-muted/80 to-muted/50 overflow-hidden">
                  {coach.profile_image_url ? (
                    <img 
                      src={coach.profile_image_url} 
                      alt={coach.profiles?.full_name || 'Coach'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : coach.profiles?.avatar_url ? (
                    <img 
                      src={coach.profiles.avatar_url} 
                      alt={coach.profiles.full_name || 'Coach'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-blue-500/5">
                      <span className="text-7xl font-light text-primary/20">
                        {coach.profiles?.full_name?.charAt(0) || 'C'}
                      </span>
                    </div>
                  )}
                  
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                  
                  {/* Rating Badge */}
                  {coach.averageRating && (
                    <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-white/95 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-lg">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      <span className="text-sm font-bold text-gray-900">{coach.averageRating.toFixed(1)}</span>
                      <span className="text-xs text-gray-500">({coach.totalReviews})</span>
                    </div>
                  )}

                  {/* Favorite Button */}
                  <button
                    onClick={() => toggleFavorite(coach.id)}
                    className={cn(
                      "absolute top-4 right-4 p-2.5 rounded-full transition-all duration-200 shadow-lg",
                      isFavorite 
                        ? "bg-red-500 text-white scale-110" 
                        : "bg-white/95 backdrop-blur-sm text-gray-400 hover:text-red-500 hover:scale-110"
                    )}
                  >
                    <Heart className={cn("h-4 w-4", isFavorite && "fill-current")} />
                  </button>
                </div>

                {/* Coach Info */}
                <div className="p-5 space-y-4">
                  {/* Sport Badge & Price */}
                  <div className="flex items-start justify-between">
                    <Badge className="bg-primary/10 text-primary border-0 font-semibold uppercase tracking-wider text-[11px] px-3 py-1">
                      {primarySport === 'Tennis' ? 'Tennis Expert' : primarySport}
                    </Badge>
                    {coach.hourly_rate && (
                      <div className="text-right">
                        <div className="flex items-baseline gap-0.5">
                          <span className="text-2xl font-bold text-foreground">${coach.hourly_rate}</span>
                        </div>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">per hour</span>
                      </div>
                    )}
                  </div>

                  {/* Name */}
                  <h3 className="font-bold text-xl text-foreground tracking-tight">
                    {coach.profiles?.full_name || 'Coach'}
                  </h3>

                  {/* Bio */}
                  {coach.bio && (
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                      {coach.bio}
                    </p>
                  )}

                  {/* Tags Row */}
                  <div className="flex flex-wrap items-center gap-2">
                    {coach.willing_to_travel && (
                      <Badge variant="secondary" className="text-xs bg-muted/80 text-muted-foreground">
                        <Navigation className="h-3 w-3 mr-1" />
                        Will Travel
                      </Badge>
                    )}
                    {distanceDisplay && (
                      <Badge variant="outline" className="text-xs border-border/50">
                        <MapPin className="h-3 w-3 mr-1 text-primary" />
                        {distanceDisplay}
                      </Badge>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <Button 
                      className="flex-1 bg-gradient-to-r from-primary to-blue-500 hover:from-primary/90 hover:to-blue-500/90 text-white font-medium"
                      onClick={() => navigate(`/profile/${coach.user_id}`)}
                    >
                      View Profile
                    </Button>
                    <Button 
                      variant="outline"
                      size="icon"
                      onClick={() => navigate(`/messages?user=${coach.user_id}`)}
                      title="Message"
                      className="border-border/50 hover:bg-muted/50"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      {/* Empty State */}
      {filteredCoaches.length === 0 && (
        <div className="text-center py-12 bg-card rounded-xl border border-border/50">
          <p className="text-muted-foreground">No coaches found matching your criteria.</p>
          <p className="text-sm text-muted-foreground mt-2">
            {myZipCode && maxDistance < 25 
              ? 'Try increasing your distance range to see more coaches.'
              : 'Try adjusting your filters to see more results.'
            }
          </p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }
            
            return (
              <Button
                key={pageNum}
                variant={currentPage === pageNum ? "default" : "outline"}
                size="icon"
                onClick={() => setCurrentPage(pageNum)}
                className={cn(
                  "w-9 h-9",
                  currentPage === pageNum && "bg-primary hover:bg-primary/90"
                )}
              >
                {pageNum}
              </Button>
            );
          })}

          {totalPages > 5 && currentPage < totalPages - 2 && (
            <>
              <span className="text-muted-foreground">...</span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(totalPages)}
                className="w-9 h-9"
              >
                {totalPages}
              </Button>
            </>
          )}
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
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
    </div>
  );
};

export default FindCoach;
