// src/hooks/useMyMatches.ts
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { sendMatchRequestDecisionNotification } from '@/lib/matchRequests';

export interface MyMatchListing {
  id: string;
  format: string;
  matchDate: string;
  startTime: string;
  endTime: string;
  location: string;
  status: string;
  creatorId: string;
  role: 'organizer' | 'participant';
}

export interface PendingItem extends MyMatchListing {
  direction: 'outgoing' | 'incoming';
  kind: 'invitation' | 'request';
  counterpartName: string;
  participantUserId: string;
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function useMyMatches(userId: string) {
  const [upcoming, setUpcoming] = useState<MyMatchListing[]>([]);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [past, setPast] = useState<MyMatchListing[]>([]);
  const [cancelled, setCancelled] = useState<MyMatchListing[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const today = todayKey();

    const { data: myRows } = await (supabase as any)
      .from('open_match_listing_participants')
      .select('listing_id, status, user_id, added_by')
      .eq('user_id', userId);

    const confirmedIds = (myRows ?? []).filter((r: any) => r.status === 'joined' || r.status === 'accepted').map((r: any) => r.listing_id);
    const outgoingInviteIds = (myRows ?? []).filter((r: any) => r.status === 'invited').map((r: any) => r.listing_id);
    const outgoingRequestIds = (myRows ?? []).filter((r: any) => r.status === 'requested').map((r: any) => r.listing_id);

    const { data: ownListings } = await (supabase as any)
      .from('open_match_listings')
      .select('id, creator_id, format, match_date, start_time, end_time, location, status')
      .eq('creator_id', userId);

    const relevantIds = [...new Set([...confirmedIds, ...outgoingInviteIds, ...outgoingRequestIds, ...(ownListings ?? []).map((l: any) => l.id)])];
    const { data: relevantListings } = relevantIds.length
      ? await (supabase as any).from('open_match_listings').select('id, creator_id, format, match_date, start_time, end_time, location, status').in('id', relevantIds)
      : { data: [] };
    const listingById = new Map<string, any>((relevantListings ?? []).map((l: any) => [l.id, l]));

    const { data: incomingRows } = (ownListings ?? []).length
      ? await (supabase as any)
        .from('open_match_listing_participants')
        .select('listing_id, status, user_id')
        .in('listing_id', (ownListings ?? []).map((l: any) => l.id))
        .in('status', ['invited', 'requested'])
      : { data: [] };

    const counterpartIds = new Set<string>();
    (incomingRows ?? []).forEach((r: any) => counterpartIds.add(r.user_id));
    const { data: counterpartProfiles } = counterpartIds.size
      ? await supabase.from('profiles').select('id, full_name').in('id', [...counterpartIds])
      : { data: [] };
    const nameById = new Map((counterpartProfiles ?? []).map(p => [p.id, p.full_name || 'A player']));

    const upcomingList: MyMatchListing[] = [];
    const pastList: MyMatchListing[] = [];
    const cancelledList: MyMatchListing[] = [];

    function toListing(l: any, role: 'organizer' | 'participant'): MyMatchListing {
      return { id: l.id, format: l.format, matchDate: l.match_date, startTime: l.start_time, endTime: l.end_time, location: l.location, status: l.status, creatorId: l.creator_id, role };
    }

    const seen = new Set<string>();
    for (const id of confirmedIds) {
      const l = listingById.get(id);
      if (!l || seen.has(id)) continue;
      seen.add(id);
      const role = l.creator_id === userId ? 'organizer' : 'participant';
      if (l.status === 'cancelled') cancelledList.push(toListing(l, role));
      else if (l.match_date < today) pastList.push(toListing(l, role));
      else upcomingList.push(toListing(l, role));
    }
    for (const l of ownListings ?? []) {
      if (seen.has(l.id)) continue;
      seen.add(l.id);
      if (l.status === 'cancelled') cancelledList.push(toListing(l, 'organizer'));
      else if (l.match_date < today) pastList.push(toListing(l, 'organizer'));
      else upcomingList.push(toListing(l, 'organizer'));
    }

    const pendingList: PendingItem[] = [];
    for (const id of outgoingInviteIds) {
      const l = listingById.get(id);
      if (!l) continue;
      pendingList.push({ ...toListing(l, 'participant'), direction: 'outgoing', kind: 'invitation', counterpartName: '', participantUserId: userId });
    }
    for (const id of outgoingRequestIds) {
      const l = listingById.get(id);
      if (!l) continue;
      pendingList.push({ ...toListing(l, 'participant'), direction: 'outgoing', kind: 'request', counterpartName: '', participantUserId: userId });
    }
    for (const r of incomingRows ?? []) {
      const l = listingById.get(r.listing_id);
      if (!l) continue;
      pendingList.push({
        ...toListing(l, 'organizer'),
        direction: 'incoming',
        kind: r.status === 'invited' ? 'invitation' : 'request',
        counterpartName: nameById.get(r.user_id) ?? 'A player',
        participantUserId: r.user_id,
      });
    }

    setUpcoming(upcomingList.sort((a, b) => (a.matchDate + a.startTime).localeCompare(b.matchDate + b.startTime)));
    setPending(pendingList);
    setPast(pastList.sort((a, b) => (b.matchDate + b.startTime).localeCompare(a.matchDate + a.startTime)));
    setCancelled(cancelledList);
    setLoading(false);
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const approveRequest = useCallback(async (listingId: string, participantUserId: string, organizerName: string, listing: { format: string; match_date: string; start_time: string; location: string }) => {
    const { error } = await (supabase as any).rpc('approve_match_participant', { p_listing_id: listingId, p_participant_user_id: participantUserId });
    if (error) return error.message as string;
    void sendMatchRequestDecisionNotification(
      { id: listingId, format: listing.format, match_date: listing.match_date, start_time: listing.start_time, location: listing.location },
      participantUserId, organizerName, 'approved',
    );
    void load();
    return null;
  }, [load]);

  const declineRequest = useCallback(async (listingId: string, participantUserId: string, organizerName: string, listing: { format: string; match_date: string; start_time: string; location: string }) => {
    const { error } = await (supabase as any).from('open_match_listing_participants').delete().eq('listing_id', listingId).eq('user_id', participantUserId);
    if (error) return error.message as string;
    void sendMatchRequestDecisionNotification(
      { id: listingId, format: listing.format, match_date: listing.match_date, start_time: listing.start_time, location: listing.location },
      participantUserId, organizerName, 'declined',
    );
    void load();
    return null;
  }, [load]);

  return { upcoming, pending, past, cancelled, loading, refresh: load, approveRequest, declineRequest };
}
