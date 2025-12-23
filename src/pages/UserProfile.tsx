import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  MessageCircle, 
  MapPin, 
  Star,
  Trophy,
  Calendar,
  User
} from 'lucide-react';
import { toast } from 'sonner';

interface ProfileData {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  utr_rating: number | null;
  wtn_rating: number | null;
  usta_ranking: string | null;
  home_court_id: string | null;
  date_of_birth: string | null;
  gender: string | null;
  user_type: string | null;
  created_at: string | null;
}

interface CoachData {
  business_name: string | null;
  bio: string | null;
  hourly_rate: number | null;
  years_experience: number | null;
  sports_offered: string[] | null;
  credentials: string | null;
  willing_to_travel: boolean | null;
  home_base: string | null;
}

export default function UserProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [coachData, setCoachData] = useState<CoachData | null>(null);
  const [homeCourt, setHomeCourt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasExchangedMessages, setHasExchangedMessages] = useState(false);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [totalReviews, setTotalReviews] = useState(0);

  useEffect(() => {
    if (id) {
      loadProfile();
    }
  }, [id, currentUser]);

  const loadProfile = async () => {
    if (!id) return;

    try {
      // Load user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Check if user is a coach
      const { data: coach } = await supabase
        .from('coaches')
        .select('*')
        .eq('user_id', id)
        .single();

      if (coach) {
        setCoachData(coach);
        
        // Load coach reviews
        const { data: reviews } = await supabase
          .from('coach_reviews')
          .select('rating')
          .eq('coach_id', id);

        if (reviews && reviews.length > 0) {
          const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
          setAverageRating(avg);
          setTotalReviews(reviews.length);
        }
      }

      // Load home court name
      if (profileData?.home_court_id) {
        const { data: court } = await supabase
          .from('courts')
          .select('name')
          .eq('id', profileData.home_court_id)
          .single();
        
        if (court) {
          setHomeCourt(court.name);
        }
      }

      // Check if current user has exchanged messages with this profile
      if (currentUser && currentUser.id !== id) {
        const { data: messages } = await supabase
          .from('messages')
          .select('id')
          .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${id}),and(sender_id.eq.${id},receiver_id.eq.${currentUser.id})`)
          .limit(1);

        setHasExchangedMessages((messages?.length || 0) > 0);
      }

    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleMessage = () => {
    navigate(`/messages?user=${id}`);
  };

  const getAge = (dateOfBirth: string | null) => {
    if (!dateOfBirth) return null;
    const today = new Date();
    const birth = new Date(dateOfBirth);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div>Loading profile...</div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card>
          <CardContent className="p-12 text-center">
            <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Profile not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === id;
  const isCoach = !!coachData;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      {/* Profile Header */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-start gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="text-2xl">
                {profile.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold">{profile.full_name || 'Unknown User'}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    {isCoach && (
                      <Badge className="bg-green-600">Coach</Badge>
                    )}
                    {profile.user_type && (
                      <Badge variant="outline" className="capitalize">
                        {profile.user_type.replace('_', ' ')}
                      </Badge>
                    )}
                  </div>
                  
                  {(profile.location || coachData?.home_base) && (
                    <div className="flex items-center gap-1 text-muted-foreground mt-2">
                      <MapPin className="h-4 w-4" />
                      <span>{profile.location || coachData?.home_base}</span>
                    </div>
                  )}

                  {isCoach && averageRating !== null && (
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < Math.round(averageRating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {averageRating.toFixed(1)} ({totalReviews} reviews)
                      </span>
                    </div>
                  )}
                </div>

                {!isOwnProfile && currentUser && (
                  <Button onClick={handleMessage} className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    Message
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bio Section */}
        {(profile.bio || coachData?.bio) && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">About</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{profile.bio || coachData?.bio}</p>
            </CardContent>
          </Card>
        )}

        {/* Player Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Player Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile.gender && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gender</span>
                <span className="capitalize">{profile.gender}</span>
              </div>
            )}
            
            {getAge(profile.date_of_birth) !== null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Age</span>
                <span>{getAge(profile.date_of_birth)}</span>
              </div>
            )}

            {homeCourt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Home Court</span>
                <span>{homeCourt}</span>
              </div>
            )}

            {profile.created_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Member Since</span>
                <span>{new Date(profile.created_at).toLocaleDateString()}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rankings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Star className="h-5 w-5" />
              Rankings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile.utr_rating && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">UTR Rating</span>
                <Badge variant="secondary">{profile.utr_rating}</Badge>
              </div>
            )}
            
            {profile.wtn_rating && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">WTN Rating</span>
                <Badge variant="secondary">{profile.wtn_rating}</Badge>
              </div>
            )}
            
            {profile.usta_ranking && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">USTA/NTRP</span>
                <Badge variant="secondary">{profile.usta_ranking}</Badge>
              </div>
            )}

            {!profile.utr_rating && !profile.wtn_rating && !profile.usta_ranking && (
              <p className="text-sm text-muted-foreground">No rankings available</p>
            )}
          </CardContent>
        </Card>

        {/* Coach Info (if applicable) */}
        {isCoach && coachData && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Coaching Info</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  {coachData.business_name && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Business Name</span>
                      <span>{coachData.business_name}</span>
                    </div>
                  )}
                  
                  {coachData.hourly_rate && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Hourly Rate</span>
                      <span className="font-medium">${coachData.hourly_rate}/hr</span>
                    </div>
                  )}
                  
                  {coachData.years_experience && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Experience</span>
                      <span>{coachData.years_experience} years</span>
                    </div>
                  )}
                  
                  {coachData.credentials && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Credentials</span>
                      <Badge variant="outline">{coachData.credentials}</Badge>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {coachData.willing_to_travel !== null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Will Travel</span>
                      <span>{coachData.willing_to_travel ? 'Yes' : 'No'}</span>
                    </div>
                  )}
                  
                  {coachData.sports_offered && coachData.sports_offered.length > 0 && (
                    <div>
                      <span className="text-muted-foreground">Sports Offered</span>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {coachData.sports_offered.map((sport) => (
                          <Badge key={sport} variant="secondary">{sport}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact Info - Only shown if messages have been exchanged */}
        {hasExchangedMessages && !isOwnProfile && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Contact</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                You've exchanged messages with this user. Continue your conversation in the messages tab.
              </p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={handleMessage}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Open Conversation
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
