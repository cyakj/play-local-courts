import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LessonPaymentButtonProps {
  lessonRequestId: string;
  coachId: string;
  amount: number;
  status: string;
}

export const LessonPaymentButton = ({
  lessonRequestId,
  coachId,
  amount,
  status,
}: LessonPaymentButtonProps) => {
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke(
        "create-lesson-checkout",
        {
          body: { lessonRequestId, coachId },
        }
      );

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error) {
      console.error("Payment error:", error);
      toast.error("Failed to initiate payment");
    } finally {
      setLoading(false);
    }
  };

  if (status === "confirmed") {
    return (
      <Button variant="outline" size="sm" disabled>
        Paid
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      onClick={handlePayment}
      disabled={loading}
      className="gap-2"
    >
      <CreditCard className="h-4 w-4" />
      Pay ${amount}
    </Button>
  );
};
