import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export interface UpcomingMatchInvite {
  listingId: string;
  format: string;
  matchDate: string;
  startTime: string;
  endTime: string;
  location: string;
  organizerName: string;
}

export interface UpcomingMatchItem {
  listingId: string;
  format: string;
  matchDate: string;
  startTime: string;
  endTime: string;
  location: string;
  role: 'organizer' | 'participant';
  openSlots: number;
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Single source of truth for "my matches" (open_match_listings), shared by
 * the Match tab, Home, Me, and Schedule so a newly created match — or an
 * accept/decline anywhere — shows up everywhere without duplicating the
 * fetch/aggregation logic per screen.
 */
export function useUpcomingMatches(userId: string) {
  const [invitations, setInvitations] = useState<UpcomingMatchInvite[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingMatchItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const today = todayKey();

    const { data: myParticipantRows } = await (supabase as any)
      .from('open_match_listing_participants')
      .select('listing_id, status')
      .eq('user_id', userId);

    const invitedListingIds = (myParticipantRows ?? []).filter((r: any) => r.status === 'invited').map((r: any) => r.listing_id);
    const acceptedListingIds = (myParticipantRows ?? []).filter((r: any) => r.status === 'accepted' || r.status === 'joined').map((r: any) => r.listing_id);

    const relevantIds = [...new Set([...invitedListingIds, ...acceptedListingIds])];

    const [{ data: ownListings }, { data: participantListings }] = await Promise.all([
      (supabase as any)
        .from('open_match_listings')
        .select('id, creator_id, format, match_date, start_time, end_time, location, status')
        .eq('creator_id', userId)
        .neq('status', 'cancelled')
        .gte('match_date', today),
      relevantIds.length
        ? (supabase as any)
          .from('open_match_listings')
          .select('id, creator_id, format, match_date, start_time, end_time, location, status')
          .in('id', relevantIds)
          .neq('status', 'cancelled')
          .gte('match_date', today)
        : Promise.resolve({ data: [] }),
    ]);

    const organizerIds: string[] = Array.from(new Set<string>((participantListings ?? []).map((l: any) => l.creator_id)));
    const { data: organizerProfiles } = organizerIds.length
      ? await supabase.from('profiles').select('id, full_name').in('id', organizerIds)
      : { data: [] };
    const organizerNameById = new Map((organizerProfiles ?? []).map(p => [p.id, p.full_name || 'A player']));

    const invites: UpcomingMatchInvite[] = (participantListings ?? [])
      .filter((l: any) => invitedListingIds.includes(l.id))
      .map((l: any) => ({
        listingId: l.id,
        format: l.format,
        matchDate: l.match_date,
        startTime: l.start_time,
        endTime: l.end_time,
        location: l.location,
        organizerName: organizerNameById.get(l.creator_id) ?? 'A player',
      }));

    const openSlotCounts = new Map<string, number>();
    if (ownListings?.length) {
      const { data: participantCounts } = await (supabase as any)
        .from('open_match_listing_participants')
        .select('listing_id, status')
        .in('listing_id', ownListings.map((l: any) => l.id));
      ownListings.forEach((listing: any) => {
        const maxSlots = listing.format === 'doubles' ? 3 : 1;
        const filled = (participantCounts ?? []).filter((row: any) => row.listing_id === listing.id && row.status !== 'declined').length;
        openSlotCounts.set(listing.id, Math.max(0, maxSlots - filled));
      });
    }

    const upcomingItems: UpcomingMatchItem[] = [
      ...(ownListings ?? []).map((l: any) => ({
        listingId: l.id,
        format: l.format,
        matchDate: l.match_date,
        startTime: l.start_time,
        endTime: l.end_time,
        location: l.location,
        role: 'organizer' as const,
        openSlots: openSlotCounts.get(l.id) ?? 0,
      })),
      ...(participantListings ?? [])
        .filter((l: any) => acceptedListingIds.includes(l.id) && l.creator_id !== userId)
        .map((l: any) => ({
          listingId: l.id,
          format: l.format,
          matchDate: l.match_date,
          startTime: l.start_time,
          endTime: l.end_time,
          location: l.location,
          role: 'participant' as const,
          openSlots: 0,
        })),
    ].sort((a, b) => (a.matchDate + a.startTime).localeCompare(b.matchDate + b.startTime));

    setInvitations(invites);
    setUpcoming(upcomingItems);
    setLoading(false);
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`upcoming-matches-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'open_match_listing_participants', filter: `user_id=eq.${userId}` }, () => { void load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'open_match_listings', filter: `creator_id=eq.${userId}` }, () => { void load(); })
      // Also catch other players responding on matches I organize (no reliable
      // single-column filter for "listing_id belongs to my listings").
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'open_match_listing_participants' }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, load]);

  return { invitations, upcoming, loading, refresh: load };
}
