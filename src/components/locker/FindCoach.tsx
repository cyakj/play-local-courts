
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Star, MapPin, ArrowLeft, MessageCircle, Heart, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
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
  const [maxRate, setMaxRate] = useState<string>('any');
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
  }, [coaches, selectedSport, selectedSkillLevel, maxRate, maxDistance, myZipCode]);

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

  const resetFilters = () => {
    setSelectedSport('all');
    setSelectedSkillLevel('all');
    setMaxRate('any');
    setMaxDistance(25);
  };

  // Pagination logic
  const totalPages = Math.ceil(filteredCoaches.length / coachesPerPage);
  const startIndex = (currentPage - 1) * coachesPerPage;
  const paginatedCoaches = filteredCoaches.slice(startIndex, startIndex + coachesPerPage);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-6">
            <button 
              onClick={onBack} 
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Back</span>
            </button>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-green-600 via-emerald-500 to-teal-500 bg-clip-text text-transparent">
              Find a Coach
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Filter Bar */}
        <div className="bg-card rounded-2xl shadow-sm p-6">
          <div className="flex flex-wrap items-end gap-6">
            {/* Sport Filter */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>🎾</span> Sport
              </label>
              <Select value={selectedSport} onValueChange={setSelectedSport}>
                <SelectTrigger className="w-36 h-9 bg-muted/50 border-0">
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
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>📊</span> Your Level
              </label>
              <Select value={selectedSkillLevel} onValueChange={setSelectedSkillLevel}>
                <SelectTrigger className="w-32 h-9 bg-muted/50 border-0">
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
            <div className="space-y-1.5 flex-1 min-w-[180px] max-w-[240px]">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" /> Distance
                </label>
                <span className="text-sm font-semibold text-primary">{maxDistance} mi</span>
              </div>
              <div className="pt-1">
                <Slider
                  value={[maxDistance]}
                  onValueChange={(value) => setMaxDistance(value[0])}
                  max={100}
                  min={1}
                  step={1}
                  className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4 [&_[role=slider]]:bg-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>1mi</span>
                  <span>50mi</span>
                  <span>100mi</span>
                </div>
              </div>
            </div>

            {/* Max Rate Filter */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>💰</span> Max Rate ($)
              </label>
              <Select value={maxRate} onValueChange={setMaxRate}>
                <SelectTrigger className="w-32 h-9 bg-muted/50 border-0">
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
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 h-9"
              >
                Apply Filters
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={resetFilters} 
                title="Reset filters"
                className="h-9 w-9 text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Results Header */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-bold text-foreground">{filteredCoaches.length}</span> Coaches near you
          </p>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Sort by:</span>
            <Select 
              defaultValue="popular"
              onValueChange={(value) => {
                let sorted = [...filteredCoaches];
                switch (value) {
                  case 'popular':
                    // Most Popular = highest rating + most reviews
                    sorted.sort((a, b) => {
                      const scoreA = (a.averageRating || 0) * 10 + (a.totalReviews || 0);
                      const scoreB = (b.averageRating || 0) * 10 + (b.totalReviews || 0);
                      return scoreB - scoreA;
                    });
                    break;
                  case 'rating':
                    sorted.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
                    break;
                  case 'price-low':
                    sorted.sort((a, b) => (a.hourly_rate || 999) - (b.hourly_rate || 999));
                    break;
                  case 'newest':
                    sorted.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
                    break;
                }
                setFilteredCoaches(sorted);
              }}
            >
              <SelectTrigger className="w-36 h-8 border-0 bg-transparent text-foreground font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="popular">Most Popular</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="rating">Rating</SelectItem>
              </SelectContent>
            </Select>
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
                className="group bg-card rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300"
              >
                {/* Coach Image Section */}
                <div className="relative h-52 bg-gradient-to-br from-muted to-muted/50 overflow-hidden">
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
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10">
                      <span className="text-6xl font-light text-primary/30">
                        {coach.profiles?.full_name?.charAt(0) || 'C'}
                      </span>
                    </div>
                  )}
                  
                  {/* Rating Badge */}
                  {coach.averageRating && (
                    <div className="absolute top-3 left-3 flex items-center gap-1 bg-white/95 backdrop-blur-sm rounded-full px-2.5 py-1 shadow-md">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span className="text-sm font-bold text-gray-900">{coach.averageRating.toFixed(1)}</span>
                      <span className="text-xs text-gray-500">({coach.totalReviews})</span>
                    </div>
                  )}

                  {/* Favorite Button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(coach.id); }}
                    className={cn(
                      "absolute top-3 right-3 p-2 rounded-full transition-all duration-200 shadow-md",
                      isFavorite 
                        ? "bg-red-500 text-white" 
                        : "bg-white/95 backdrop-blur-sm text-gray-400 hover:text-red-500"
                    )}
                  >
                    <Heart className={cn("h-4 w-4", isFavorite && "fill-current")} />
                  </button>
                </div>

                {/* Coach Info */}
                <div className="p-4 space-y-3">
                  {/* Sport Badge & Price */}
                  <div className="flex items-start justify-between">
                    <Badge className="bg-primary/10 text-primary border-0 font-semibold uppercase tracking-wider text-[10px] px-2.5 py-0.5">
                      {primarySport === 'Tennis' ? 'Tennis Expert' : primarySport}
                    </Badge>
                    {coach.hourly_rate && (
                      <div className="text-right">
                        <span className="text-xl font-bold text-foreground">${coach.hourly_rate}</span>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">per hour</span>
                      </div>
                    )}
                  </div>

                  {/* Name */}
                  <h3 className="font-bold text-lg text-foreground">
                    {coach.profiles?.full_name || 'Coach'}
                  </h3>

                  {/* Bio */}
                  {coach.bio && (
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                      {coach.bio}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button 
                      className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-medium h-10"
                      onClick={() => navigate(`/profile/${coach.user_id}`)}
                    >
                      View Profile
                    </Button>
                    <Button 
                      variant="outline"
                      size="icon"
                      onClick={() => navigate(`/messages?user=${coach.user_id}`)}
                      title="Message"
                      className="h-10 w-10 border-border/50"
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
          <div className="text-center py-16 bg-card rounded-2xl shadow-sm">
            <p className="text-muted-foreground">No coaches found matching your criteria.</p>
            <p className="text-sm text-muted-foreground mt-2">
              Try adjusting your filters to see more results.
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
              className="h-9 w-9"
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
              </>
            )}
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-9 w-9"
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
