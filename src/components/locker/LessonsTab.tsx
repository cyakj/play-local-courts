import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { LessonPaymentButton } from "./LessonPaymentButton";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";

export const LessonsTab = () => {
  const { currentUser } = useAuth();
  const [lessonRequests, setLessonRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

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
      const { data: requests, error } = await supabase
        .from("lesson_requests")
        .select(`
          *,
          coach:profiles!lesson_requests_coach_id_fkey(full_name, avatar_url),
          coaches!lesson_requests_coach_id_fkey(hourly_rate)
        `)
        .eq("player_id", currentUser.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setLessonRequests(requests || []);
    } catch (error) {
      console.error("Error loading lesson requests:", error);
      toast.error("Failed to load lesson requests");
    } finally {
      setLoading(false);
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
      <Card>
        <CardHeader>
          <CardTitle>My Lesson Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {lessonRequests.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No lesson requests yet. Find a coach to get started!
              </p>
            ) : (
              lessonRequests.map((request) => (
                <Card key={request.id} className="border-l-4 border-l-primary">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
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
                          >
                            {request.status}
                          </Badge>
                        </div>
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
                            <strong>Time:</strong> {request.preferred_time_start} -{" "}
                            {request.preferred_time_end}
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
                      {request.status === "accepted" &&
                        request.coaches?.hourly_rate && (
                          <LessonPaymentButton
                            lessonRequestId={request.id}
                            coachId={request.coach_id}
                            amount={request.coaches.hourly_rate}
                            status={request.status}
                          />
                        )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
