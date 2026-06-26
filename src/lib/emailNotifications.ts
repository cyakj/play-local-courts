import { supabase } from '@/lib/supabase';

interface NotificationEmailPayload {
  type:
    | 'booking_confirmation'
    | 'booking_cancellation'
    | 'booking_reminder'
    | 'lesson_confirmation'
    | 'lesson_reminder'
    | 'lesson_request_received'
    | 'lesson_declined'
    | 'match_confirmation'
    | 'match_reminder'
    | 'hoa_approved'
    | 'hoa_rejected';
  userId: string;
  playerId?: string;
  bookingId?: string;
  lessonId?: string;
  courtName?: string;
  coachName?: string;
  playerName?: string;
  opponentName?: string;
  matchType?: string;
  lessonType?: string;
  sport?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  playType?: string;
  location?: string;
  hoursLabel?: string;
  cancellationReason?: string;
  isAdminCancellation?: boolean;
  communityName?: string;
}

export function sendNotificationEmail(payload: NotificationEmailPayload): void {
  supabase.functions.invoke('send-booking-email', { body: payload }).catch(() => {});
}
