import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Clock, 
  Users, 
  MessageSquare, 
  Star,
  CheckCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import AvailabilityManager from '../components/coach/AvailabilityManager';
import { PaymentsTab } from '../components/coach/PaymentsTab';
import LessonRequestsTable from '../components/coach/LessonRequestsTable';

const CoachDashboard = () => {
  const navigate = useNavigate();
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
        .order('created_at', { ascending: false });

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
      const today = new Date().toISOString().split('T')[0];
      const completedLessons = requestsData?.filter(r => 
        r.status === 'completed' || 
        (r.status === 'accepted' && r.preferred_date < today)
      ).length || 0;
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4">
          <LessonRequestsTable
            requests={lessonRequests}
            onAccept={(id) => handleRequestAction(id, 'accept')}
            onDecline={(id) => handleRequestAction(id, 'decline')}
          />
        </TabsContent>

        <TabsContent value="availability" className="space-y-4">
          <AvailabilityManager />
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <PaymentsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CoachDashboard;
