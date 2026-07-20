import { supabase } from '@/lib/supabase';

interface InviteListingSummary {
  id: string;
  format: string;
  match_date: string;
  start_time: string;
  end_time: string;
  location: string;
}

/**
 * Fires everything a match invite must trigger: the interactive card in the
 * existing DM thread (which also powers the notifications feed, since that
 * screen reads straight off `messages`), plus an email for recipients who
 * haven't disabled match_invitations in their notification preferences.
 * The participant row itself (already inserted by the caller) stays the
 * single source of truth for accept/decline state everywhere else.
 */
export async function sendMatchInviteNotifications(
  listing: InviteListingSummary,
  inviteeIds: string[],
  organizerId: string,
  organizerName: string,
) {
  if (!inviteeIds.length) return;

  const { error: msgError } = await (supabase as any).from('messages').insert(
    inviteeIds.map(inviteeId => ({
      sender_id: organizerId,
      receiver_id: inviteeId,
      content: `${organizerName} invited you to a ${listing.format} match.`,
      message_type: 'match_invite',
      related_listing_id: listing.id,
      metadata: {
        listing_id: listing.id,
        match_date: listing.match_date,
        start_time: listing.start_time,
        end_time: listing.end_time,
        location: listing.location,
        format: listing.format,
        organizer_name: organizerName,
      },
    })),
  );
  if (msgError) console.error('Match invite message error:', msgError);

  const { data: prefsRows } = await supabase
    .from('profiles')
    .select('id, notification_preferences')
    .in('id', inviteeIds);

  const emailable = (prefsRows ?? []).filter(row => {
    const prefs = row.notification_preferences as { match_invitations?: boolean } | null;
    return prefs?.match_invitations !== false;
  });

  await Promise.all(emailable.map(row => supabase.functions.invoke('send-booking-email', {
    body: {
      type: 'match_invite',
      userId: row.id,
      opponentName: organizerName,
      matchType: listing.format,
      date: listing.match_date,
      startTime: listing.start_time,
      endTime: listing.end_time,
      location: listing.location,
    },
  }).catch(err => console.error('Match invite email error:', err))));
}
