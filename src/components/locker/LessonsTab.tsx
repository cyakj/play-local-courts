import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { LessonPaymentButton } from "./LessonPaymentButton";
import { LeaveReviewDialog } from "./LeaveReviewDialog";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { Star, X } from "lucide-react";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { formatTime12Hour } from "@/lib/textUtils";

export const LessonsTab = () => {
  const { currentUser } = useAuth();
  const [lessonRequests, setLessonRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<any>(null);

  const loadLessonRequestsCallback = useCallback(() => {
    loadLessonRequests();
  }, [currentUser]);

  // Real-time subscription for lesson request updates
  useRealtimeSubscription({
    table: 'lesson_requests',
    event: '*',
    filter: currentUser?.id ? `player_id=eq.${currentUser.id}` : undefined,
    onChange: loadLessonRequestsCallback,
    enabled: !!currentUser?.id
  });

  useEffect(() => {
    if (currentUser) {
      loadLessonRequests();
    }
  }, [currentUser]);

  useEffect(() => {
    const payment = searchParams.get("payment");
    const lessonId = searchParams.get("lesson");
    
    if (payment === "success" && lessonId) {
      verifyPayment(lessonId);
      setSearchParams({});
    }
  }, [searchParams]);

  const verifyPayment = async (lessonId: string) => {
    try {
      const { data: transaction } = await supabase
        .from("transactions")
        .select("stripe_checkout_session_id")
        .eq("lesson_request_id", lessonId)
        .single();

      if (transaction?.stripe_checkout_session_id) {
        const { data, error } = await supabase.functions.invoke(
          "verify-lesson-payment",
          {
            body: { sessionId: transaction.stripe_checkout_session_id },
          }
        );

        if (error) throw error;

        if (data?.success) {
          toast.success("Payment confirmed! Your lesson is now booked.");
          loadLessonRequests();
        }
      }
    } catch (error) {
      console.error("Error verifying payment:", error);
    }
  };

  const loadLessonRequests = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      // Fetch lesson requests without the problematic foreign key hint
      const { data: requests, error } = await supabase
        .from("lesson_requests")
        .select("*")
        .eq("player_id", currentUser.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Manually fetch coach profiles and hourly rates
      if (requests && requests.length > 0) {
        const coachIds = [...new Set(requests.map(r => r.coach_id))];
        
        const { data: coachProfiles } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", coachIds);
        
        const { data: coachData } = await supabase
          .from("coaches")
          .select("user_id, hourly_rate")
          .in("user_id", coachIds);

        // Attach coach data to requests
        requests.forEach((request: any) => {
          request.coach = coachProfiles?.find(p => p.id === request.coach_id);
          request.coaches = coachData?.find(c => c.user_id === request.coach_id);
        });

        // Check if lessons have been reviewed
        const lessonIds = requests.map((r) => r.id);
        const { data: reviews } = await supabase
          .from("coach_reviews")
          .select("lesson_request_id")
          .in("lesson_request_id", lessonIds);

        const reviewedLessonIds = new Set(
          reviews?.map((r) => r.lesson_request_id) || []
        );

        requests.forEach((request: any) => {
          request.hasReview = reviewedLessonIds.has(request.id);
        });
      }

      setLessonRequests(requests || []);
    } catch (error) {
      console.error("Error loading lesson requests:", error);
      toast.error("Failed to load lesson requests");
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveReview = (lesson: any) => {
    setSelectedLesson(lesson);
    setReviewDialogOpen(true);
  };

  const handleDismissDeclined = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from("lesson_requests")
        .delete()
        .eq("id", requestId);

      if (error) throw error;
      
      toast.success("Lesson request dismissed");
      loadLessonRequests();
    } catch (error) {
      console.error("Error dismissing request:", error);
      toast.error("Failed to dismiss request");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading lessons...</p>
      </div>
    );
  }

  // Filter upcoming accepted lessons
  const upcomingLessons = lessonRequests.filter(r => 
    r.status === 'accepted' && 
    new Date(r.preferred_date) >= new Date(new Date().toDateString())
  );

  const otherRequests = lessonRequests.filter(r => 
    r.status !== 'accepted' || new Date(r.preferred_date) < new Date(new Date().toDateString())
  );

  return (
    <div className="space-y-6">
      {/* Upcoming Lessons Section */}
      {upcomingLessons.length > 0 && (
        <Card className="border-green-200 bg-green-50/30">
          <CardHeader>
            <CardTitle className="text-green-700 flex items-center gap-2">
              <Star className="h-5 w-5" />
              Upcoming Lessons ({upcomingLessons.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingLessons.map((request) => (
                <Card 
                  key={request.id} 
                  className="border-l-4 border-l-green-500 bg-white"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h3 className="font-semibold">
                            {request.coach?.full_name || "Coach"}
                          </h3>
                          <Badge className="bg-green-600 hover:bg-green-700">
                            Confirmed
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p><strong>Sport:</strong> {request.sport}</p>
                          <p><strong>Type:</strong> {request.lesson_type}</p>
                          <p>
                            <strong>Date:</strong>{" "}
                            {new Date(request.preferred_date + 'T00:00:00').toLocaleDateString()}
                          </p>
                          <p>
                            <strong>Time:</strong> {formatTime12Hour(request.preferred_time_start)} - {formatTime12Hour(request.preferred_time_end)}
                          </p>
                          {request.location && (
                            <p><strong>Location:</strong> {request.location}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        {request.hasReview && (
                          <Badge variant="secondary">Reviewed</Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Lesson Requests */}
      <Card>
        <CardHeader>
          <CardTitle>Lesson Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {otherRequests.length === 0 && upcomingLessons.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No lesson requests yet. Find a coach to get started!
              </p>
            ) : otherRequests.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No pending or past lesson requests.
              </p>
            ) : (
              otherRequests.map((request) => (
                <Card 
                  key={request.id} 
                  className={`border-l-4 ${
                    request.status === 'accepted'
                      ? 'border-l-green-500 bg-green-50/30'
                      : request.status === 'confirmed'
                        ? 'border-l-green-500'
                        : request.status === 'declined'
                          ? 'border-l-destructive bg-destructive/5'
                          : 'border-l-primary'
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h3 className="font-semibold">
                            {request.coach?.full_name || "Coach"}
                          </h3>
                          <Badge
                            variant={
                              request.status === "confirmed"
                                ? "default"
                                : request.status === "pending"
                                ? "secondary"
                                : request.status === "accepted"
                                ? "default"
                                : "destructive"
                            }
                            className={request.status === "accepted" ? "bg-green-600 hover:bg-green-700" : ""}
                          >
                            {request.status}
                          </Badge>
                        </div>
                        {request.status === "declined" && (
                          <p className="text-xs text-destructive mb-2 bg-destructive/10 p-2 rounded">
                            This lesson request was declined by the coach.
                          </p>
                        )}
                        {request.notes?.includes('[OUTSIDE AVAILABILITY') && request.status === 'pending' && (
                          <p className="text-xs text-amber-700 mb-2 bg-amber-100 p-2 rounded">
                            This request is outside the coach's posted availability and is awaiting manual review.
                          </p>
                        )}
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>
                            <strong>Sport:</strong> {request.sport}
                          </p>
                          <p>
                            <strong>Type:</strong> {request.lesson_type}
                          </p>
                          <p>
                            <strong>Skill Level:</strong> {request.skill_level}
                          </p>
                          <p>
                            <strong>Preferred Date:</strong>{" "}
                            {new Date(request.preferred_date).toLocaleDateString()}
                          </p>
                          <p>
                            <strong>Time:</strong> {formatTime12Hour(request.preferred_time_start)} -{" "}
                            {formatTime12Hour(request.preferred_time_end)}
                          </p>
                          {request.location && (
                            <p>
                              <strong>Location:</strong> {request.location}
                            </p>
                          )}
                          {request.coaches?.hourly_rate && (
                            <p>
                              <strong>Rate:</strong> ${request.coaches.hourly_rate}/hour
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        {request.status === "accepted" &&
                          request.coaches?.hourly_rate && (
                            <LessonPaymentButton
                              lessonRequestId={request.id}
                              coachId={request.coach_id}
                              amount={request.coaches.hourly_rate}
                              status={request.status}
                            />
                          )}
                        {request.status === "accepted" && !request.hasReview && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleLeaveReview(request)}
                          >
                            <Star className="h-4 w-4 mr-2" />
                            Leave Review
                          </Button>
                        )}
                        {request.status === "declined" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDismissDeclined(request.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Dismiss
                          </Button>
                        )}
                        {request.hasReview && (
                          <Badge variant="secondary">Reviewed</Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {selectedLesson && (
        <LeaveReviewDialog
          open={reviewDialogOpen}
          onOpenChange={setReviewDialogOpen}
          lessonRequest={selectedLesson}
          onReviewSubmitted={loadLessonRequests}
        />
      )}
    </div>
  );
};
