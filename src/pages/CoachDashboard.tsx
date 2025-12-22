
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  Clock, 
  DollarSign, 
  Users, 
  MessageSquare, 
  Star,
  MapPin,
  CheckCircle,
  XCircle,
  TrendingUp,
  UserCog
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { LessonRequest, CoachReview } from '../types/coach';
import { toast } from 'sonner';
import AvailabilityManager from '../components/coach/AvailabilityManager';
import { PaymentsTab } from '../components/coach/PaymentsTab';
import CoachProfileSettings from '../components/coach/CoachProfileSettings';

const CoachDashboard = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(tabParam || "requests");
  const { currentUser } = useAuth();
  const [lessonRequests, setLessonRequests] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pendingRequests: 0,
    completedLessons: 0,
    averageRating: 0,
    totalEarnings: 0
  });

  useEffect(() => {
    if (currentUser) {
      loadDashboardData();
    }
  }, [currentUser]);

  const loadDashboardData = async () => {
    if (!currentUser) return;

    try {
      // Load lesson requests
      const { data: requestsData, error: requestsError } = await supabase
        .from('lesson_requests')
        .select('*')
        .eq('coach_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(10);

      // Manually fetch player profiles
      if (requestsData && requestsData.length > 0) {
        const playerIds = [...new Set(requestsData.map(r => r.player_id))];
        const { data: playersData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', playerIds);

        // Attach player data to requests
        requestsData.forEach((request: any) => {
          request.player = playersData?.find(p => p.id === request.player_id);
        });
      }

      if (requestsError) throw requestsError;

      // Load reviews
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('coach_reviews')
        .select('*')
        .eq('coach_id', currentUser.id)
        .order('created_at', { ascending: false });

      // Manually fetch player profiles for reviews
      if (reviewsData && reviewsData.length > 0) {
        const playerIds = [...new Set(reviewsData.map(r => r.player_id))];
        const { data: playersData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', playerIds);

        // Attach player data to reviews
        reviewsData.forEach((review: any) => {
          review.player = playersData?.find(p => p.id === review.player_id);
        });
      }

      if (reviewsError) throw reviewsError;

      setLessonRequests(requestsData || []);
      setReviews(reviewsData || []);

      // Calculate stats
      const pendingRequests = requestsData?.filter(r => r.status === 'pending').length || 0;
      const completedLessons = requestsData?.filter(r => r.status === 'completed').length || 0;
      const averageRating = reviewsData?.length 
        ? reviewsData.reduce((sum, review) => sum + review.rating, 0) / reviewsData.length
        : 0;

      setStats({
        pendingRequests,
        completedLessons,
        averageRating,
        totalEarnings: 0 // This would be calculated based on actual payment data
      });

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAction = async (requestId: string, action: 'accept' | 'decline') => {
    try {
      const { error } = await supabase
        .from('lesson_requests')
        .update({ 
          status: action === 'accept' ? 'accepted' : 'declined',
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;

      toast.success(`Lesson request ${action}ed successfully`);
      loadDashboardData(); // Refresh data
    } catch (error) {
      console.error(`Error ${action}ing request:`, error);
      toast.error(`Failed to ${action} request`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div>Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
          <Users className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Coach Dashboard
          </h1>
          <p className="text-gray-600">Manage your coaching business</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Requests</p>
                <p className="text-2xl font-bold">{stats.pendingRequests}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completed Lessons</p>
                <p className="text-2xl font-bold">{stats.completedLessons}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Average Rating</p>
                <p className="text-2xl font-bold">
                  {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : 'N/A'}
                </p>
              </div>
              <Star className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Reviews</p>
                <p className="text-2xl font-bold">{reviews.length}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Lesson Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {lessonRequests.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No lesson requests yet</p>
              ) : (
                <div className="space-y-4">
                  {lessonRequests.map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium">{request.player?.full_name || 'Student'}</h3>
                          <Badge variant={
                            request.status === 'pending' ? 'default' :
                            request.status === 'accepted' ? 'secondary' :
                            request.status === 'declined' ? 'destructive' : 'outline'
                          }>
                            {request.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p><strong>Sport:</strong> {request.sport}</p>
                          <p><strong>Type:</strong> {request.lesson_type}</p>
                          <p><strong>Skill Level:</strong> {request.skill_level}</p>
                          <p><strong>Preferred Date:</strong> {request.preferred_date}</p>
                          <p><strong>Time:</strong> {request.preferred_time_start} - {request.preferred_time_end}</p>
                          {request.location && <p><strong>Location:</strong> {request.location}</p>}
                          {request.notes && <p><strong>Notes:</strong> {request.notes}</p>}
                        </div>
                      </div>
                      {request.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleRequestAction(request.id, 'accept')}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRequestAction(request.id, 'decline')}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Decline
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Student Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              {reviews.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No reviews yet</p>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div key={review.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium">{review.player?.full_name || 'Student'}</h3>
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      {review.review_text && (
                        <p className="text-gray-600 mb-2">{review.review_text}</p>
                      )}
                      {review.coach_response && (
                        <div className="mt-2 p-2 bg-gray-50 rounded">
                          <p className="text-sm font-medium">Your response:</p>
                          <p className="text-sm text-gray-600">{review.coach_response}</p>
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(review.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="availability" className="space-y-4">
          <AvailabilityManager />
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <PaymentsTab />
        </TabsContent>

        <TabsContent value="profile" className="space-y-4">
          <CoachProfileSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CoachDashboard;
