// src/lib/matchRequests.ts
import { supabase } from '@/lib/supabase';

interface RequestListingSummary {
  id: string;
  format: string;
  match_date: string;
  start_time: string;
  location: string;
}

/**
 * Fires the "someone requested to join your listing" notification. Follows
 * the same logged-not-thrown pattern as sendMatchInviteNotifications in
 * matchInvites.ts: a failure here must never surface as a failure of the
 * join-request insert that already succeeded in the database.
 */
export async function sendMatchJoinRequestNotification(
  listing: RequestListingSummary,
  requesterId: string,
  requesterName: string,
  organizerId: string,
): Promise<void> {
  try {
    const { error } = await (supabase as any).from('messages').insert({
      sender_id: requesterId,
      receiver_id: organizerId,
      content: `${requesterName} requested to join your ${listing.format} match.`,
      message_type: 'match_join_request',
      related_listing_id: listing.id,
      metadata: { listing_id: listing.id, match_date: listing.match_date, start_time: listing.start_time, location: listing.location, requester_name: requesterName },
    });
    if (error) console.error('Match join request notification error:', error);
  } catch (error) {
    console.error('Match join request notification threw:', error);
  }
}

/**
 * Fires the "your request was approved/declined" notification to the requester.
 * Same non-blocking, logged-not-thrown contract as above.
 */
export async function sendMatchRequestDecisionNotification(
  listing: RequestListingSummary,
  requesterId: string,
  organizerName: string,
  decision: 'approved' | 'declined',
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const content = decision === 'approved'
      ? `${organizerName} approved your request to join their ${listing.format} match.`
      : `${organizerName} declined your request to join their ${listing.format} match.`;
    const { error } = await (supabase as any).from('messages').insert({
      sender_id: user.id,
      receiver_id: requesterId,
      content,
      message_type: 'match_request_decision',
      related_listing_id: listing.id,
      metadata: { listing_id: listing.id, decision },
    });
    if (error) console.error('Match request decision notification error:', error);
  } catch (error) {
    console.error('Match request decision notification threw:', error);
  }
}
