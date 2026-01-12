import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { LeaveReviewDialog } from "./LeaveReviewDialog";
import PlayerLessonRequestsList from "./PlayerLessonRequestsList";
import PlayerAssignments from "./PlayerAssignments";

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
    table: "lesson_requests",
    event: "*",
    filter: currentUser?.id ? `player_id=eq.${currentUser.id}` : undefined,
    onChange: loadLessonRequestsCallback,
    enabled: !!currentUser?.id,
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
        const coachIds = [...new Set(requests.map((r) => r.coach_id))];

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
          request.coach = coachProfiles?.find((p) => p.id === request.coach_id);
          request.coaches = coachData?.find((c) => c.user_id === request.coach_id);
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

  return (
    <div className="space-y-6">
      <PlayerAssignments />
      
      <PlayerLessonRequestsList
        requests={lessonRequests}
        onLeaveReview={handleLeaveReview}
        onDismissDeclined={handleDismissDeclined}
      />

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

