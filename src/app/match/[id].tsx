import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  CalendarDays, Check, Clock3, MapPin, MessageCircle,
  ShieldCheck, UserPlus, UserX, X,
} from 'lucide-react-native';

import { AddPlayersSheet, type MatchInvitee } from '@/components/match/AddPlayersSheet';
import { Header } from '@/components/ui/Header';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { sendMatchInviteNotifications } from '@/lib/matchInvites';

type ParticipantStatus = 'invited' | 'accepted' | 'declined' | 'joined';

interface Participant extends MatchInvitee {
  status: ParticipantStatus;
  slotIndex: number | null;
}

interface Listing {
  id: string;
  creator_id: string;
  format: 'singles' | 'doubles';
  match_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  location: string;
  court_reserved: boolean;
  note: string | null;
  status: string;
}

function formatTime(value: string) {
  const [hour, minute] = value.slice(0, 5).split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}

export default function MatchDetailsScreen() {
  const { theme } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [listing, setListing] = useState<Listing | null>(null);
  const [organizer, setOrganizer] = useState<MatchInvitee | null>(null);
  const [organizerName, setOrganizerName] = useState('The organizer');
  const [players, setPlayers] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteSheet, setInviteSheet] = useState(false);
  const [replacingSlot, setReplacingSlot] = useState<number | null>(null);
  const [userId, setUserId] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data: match, error } = await (supabase as any)
      .from('open_match_listings')
      .select('id, creator_id, format, match_date, start_time, end_time, duration_minutes, location, court_reserved, note, status')
      .eq('id', id)
      .single();
    if (error || !match) {
      Alert.alert('Match unavailable', error?.message ?? 'This match could not be found.');
      setLoading(false);
      return;
    }

    const { data: participantRows } = await (supabase as any)
      .from('open_match_listing_participants')
      .select('user_id, status, slot_index')
      .eq('listing_id', id)
      .order('slot_index');
    const profileIds = [match.creator_id, ...(participantRows ?? []).map((row: any) => row.user_id)];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, utr_rating')
      .in('id', profileIds);
    const mapped = new Map((profiles ?? []).map(profile => [profile.id, {
      id: profile.id,
      name: profile.full_name || 'TenisX player',
      avatarUrl: profile.avatar_url,
      utrRating: profile.utr_rating,
    }]));

    setListing(match);
    const organizerProfile = mapped.get(match.creator_id) ?? null;
    setOrganizer(organizerProfile);
    setOrganizerName(organizerProfile?.name ?? 'The organizer');
    setPlayers((participantRows ?? [])
      .map((row: any) => {
        const base = mapped.get(row.user_id);
        if (!base) return null;
        return { ...base, status: row.status as ParticipantStatus, slotIndex: row.slot_index ?? null };
      })
      .filter(Boolean) as Participant[]);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? ''));
    void load();
  }, [load]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`match-detail-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'open_match_listing_participants', filter: `listing_id=eq.${id}` }, () => { void load(); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'open_match_listings', filter: `id=eq.${id}` }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [id, load]);

  const isOrganizer = !!listing && userId === listing.creator_id;
  const maxInvitees = listing?.format === 'doubles' ? 3 : 1;
  const slots = useMemo(() => {
    if (!listing) return [];
    return Array.from({ length: listing.format === 'doubles' ? 4 : 2 }, (_, index) => {
      if (index === 0) return organizer ? { ...organizer, status: 'accepted' as ParticipantStatus, slotIndex: 0 } : null;
      return players.find(p => p.slotIndex === index) ?? null;
    });
  }, [listing, organizer, players]);

  async function saveInvites(next: MatchInvitee[]) {
    if (!listing || !isOrganizer) return;
    const newPlayers = next.filter(player => !players.some(existing => existing.id === player.id));
    if (newPlayers.length) {
      const startIndex = replacingSlot ?? (players.length + 1);
      const { error } = await (supabase as any).from('open_match_listing_participants').insert(
        newPlayers.map((player, index) => ({
          listing_id: listing.id,
          user_id: player.id,
          status: 'invited',
          added_by: userId,
          slot_index: replacingSlot ?? startIndex + index,
        })),
      );
      if (error) {
        if ((error as any).code === '23505') {
          Alert.alert('Already invited', 'That player already has a slot on this match.');
        } else {
          Alert.alert('Unable to add player', error.message);
        }
        return;
      }
      await sendMatchInviteNotifications(listing, newPlayers.map(p => p.id), userId, organizerName);
    }
    setReplacingSlot(null);
    void load();
  }

  async function respond(participant: Participant, status: 'accepted' | 'declined') {
    if (!listing) return;
    setBusyId(participant.id);
    const { error } = await (supabase as any)
      .from('open_match_listing_participants')
      .update({ status })
      .eq('listing_id', listing.id)
      .eq('user_id', participant.id);
    setBusyId(null);
    if (error) {
      Alert.alert('Unable to respond', error.message);
      return;
    }
    void load();
  }

  async function removeParticipant(participant: Participant) {
    if (!listing || !isOrganizer) return;
    setBusyId(participant.id);
    const { error } = await (supabase as any)
      .from('open_match_listing_participants')
      .delete()
      .eq('listing_id', listing.id)
      .eq('user_id', participant.id);
    setBusyId(null);
    if (error) {
      Alert.alert('Unable to remove player', error.message);
      return;
    }
    void load();
  }

  function replaceParticipant(participant: Participant) {
    setReplacingSlot(participant.slotIndex);
    void removeParticipant(participant).then(() => setInviteSheet(true));
  }

  async function cancelMatch() {
    if (!listing || !isOrganizer) return;
    Alert.alert('Cancel this match?', 'All invited and accepted players will be notified the match is off.', [
      { text: 'Keep Match', style: 'cancel' },
      {
        text: 'Cancel Match', style: 'destructive', onPress: async () => {
          const { error } = await (supabase as any)
            .from('open_match_listings')
            .update({ status: 'cancelled' })
            .eq('id', listing.id);
          if (error) {
            Alert.alert('Unable to cancel', error.message);
            return;
          }
          void load();
        },
      },
    ]);
  }

  function messagePlayer(participantId: string) {
    router.push({ pathname: '/messages', params: { partner: participantId } } as any);
  }

  // See match/new.tsx handleBack — reached directly (deep link, or after
  // match/new.tsx's router.replace(`/match/${id}`) on creation) can leave no
  // history to pop, so router.back() silently no-ops instead of navigating.
  function handleBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/(resident)/match');
  }

  if (loading) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: theme.pageBg }]}>
        <ActivityIndicator color={Colors.blue} />
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={[styles.root, { backgroundColor: theme.pageBg }]}>
        <Header variant="inner" title="Match Details" onBack={handleBack} />
        <View style={styles.center}><Text style={{ color: theme.textSecondary }}>Match unavailable.</Text></View>
      </View>
    );
  }

  const myParticipant = players.find(p => p.id === userId) ?? null;
  const isCancelled = listing.status === 'cancelled';

  return (
    <View style={[styles.root, { backgroundColor: theme.pageBg }]}>
      <Header variant="inner" title="Match Details" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isCancelled && (
          <View style={styles.cancelledBanner}>
            <Text style={styles.cancelledBannerText}>This match was cancelled by the organizer.</Text>
          </View>
        )}

        <View style={[styles.heroCard, { backgroundColor: theme.cardBg, borderColor: theme.border }, theme.shadowCard]}>
          <Text style={[styles.format, { color: theme.textPrimary }]}>{listing.format === 'singles' ? 'Singles' : 'Doubles'}</Text>
          <View style={styles.detailRow}>
            <CalendarDays size={19} color={Colors.blue} />
            <Text style={[styles.detailText, { color: theme.textSecondary }]}>
              {new Date(`${listing.match_date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Clock3 size={19} color={Colors.blue} />
            <Text style={[styles.detailText, { color: theme.textSecondary }]}>{formatTime(listing.start_time)} · {listing.duration_minutes} min</Text>
          </View>
          <View style={styles.detailRow}>
            <MapPin size={19} color={Colors.blue} />
            <Text style={[styles.detailText, { color: theme.textSecondary }]}>{listing.location}</Text>
          </View>
          {listing.court_reserved && (
            <View style={styles.reservedBadge}>
              <ShieldCheck size={16} color={Colors.positive} />
              <Text style={styles.reservedText}>Court Reserved</Text>
            </View>
          )}
        </View>

        {myParticipant?.status === 'invited' && !isCancelled && (
          <View style={[styles.respondCard, { backgroundColor: theme.cardBg, borderColor: Colors.blue }]}>
            <Text style={[styles.respondTitle, { color: theme.textPrimary }]}>You're invited to this match</Text>
            <View style={styles.respondRow}>
              <TouchableOpacity
                style={[styles.respondButton, styles.declineButton]}
                disabled={busyId === userId}
                onPress={() => respond(myParticipant, 'declined')}>
                <Text style={styles.declineButtonText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.respondButton, styles.acceptButton]}
                disabled={busyId === userId}
                onPress={() => respond(myParticipant, 'accepted')}>
                <Text style={styles.acceptButtonText}>Accept</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Players</Text>
        <View style={[styles.playersCard, { backgroundColor: theme.cardBg, borderColor: theme.border }, theme.shadowCard]}>
          {slots.map((player, index) => {
            const isMe = player?.id === userId;
            const isOpenSlot = !player;
            const statusLabel = index === 0 ? 'Organizer'
              : player?.status === 'accepted' ? 'Accepted'
              : player?.status === 'declined' ? 'Declined'
              : player?.status === 'invited' ? 'Invited'
              : player ? 'Joined' : 'Open Slot';

            return (
              <View key={player?.id ?? `slot-${index}`} style={[styles.playerRow, index < slots.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                <View style={[styles.playerAvatar, { backgroundColor: player ? theme.selectedBg : theme.surface2 }]}>
                  {player ? (
                    <Text style={[styles.avatarText, { color: theme.textPrimary }]}>{player.name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()}</Text>
                  ) : (
                    <UserPlus size={20} color={theme.textMuted} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.playerName, { color: theme.textPrimary }, player?.status === 'declined' && { color: theme.textMuted }]}>
                    {player?.name ?? (listing.format === 'doubles' ? `${index < 2 ? 'Team A' : 'Team B'} open slot` : 'Player B open slot')}
                  </Text>
                  <View style={styles.metaRow}>
                    {player?.status === 'accepted' && <Check size={13} color={Colors.positive} strokeWidth={2.5} />}
                    {player?.status === 'declined' && <UserX size={13} color={Colors.negative} strokeWidth={2.5} />}
                    <Text style={[
                      styles.playerMeta,
                      { color: player?.status === 'accepted' ? Colors.positive : player?.status === 'declined' ? Colors.negative : theme.textSecondary },
                    ]}>
                      {player?.utrRating != null ? `UTR ${player.utrRating.toFixed(1)} · ${statusLabel}` : statusLabel}
                    </Text>
                  </View>
                </View>

                {isOpenSlot && isOrganizer && !isCancelled && (
                  <TouchableOpacity style={styles.inviteButton} onPress={() => setInviteSheet(true)}>
                    <Text style={styles.inviteButtonText}>Invite</Text>
                  </TouchableOpacity>
                )}

                {player && index > 0 && !isMe && !isCancelled && (
                  <View style={styles.actionsRow}>
                    <TouchableOpacity style={styles.iconAction} onPress={() => messagePlayer(player.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <MessageCircle size={17} color={theme.textSecondary} />
                    </TouchableOpacity>
                    {isOrganizer && (
                      <TouchableOpacity
                        style={styles.iconAction}
                        disabled={busyId === player.id}
                        onPress={() => Alert.alert('Manage player', `${player.name}`, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Replace', onPress: () => replaceParticipant(player) },
                          { text: 'Remove', style: 'destructive', onPress: () => removeParticipant(player) },
                        ])}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <X size={17} color={theme.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {!!listing.note && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Match Note</Text>
            <View style={[styles.noteCard, { backgroundColor: theme.cardBg, borderColor: theme.border }, theme.shadowCard]}>
              <Text style={[styles.note, { color: theme.textSecondary }]}>{listing.note}</Text>
            </View>
          </>
        )}

        {isOrganizer && !isCancelled && (
          <TouchableOpacity style={styles.cancelMatchButton} onPress={cancelMatch}>
            <Text style={styles.cancelMatchButtonText}>Cancel Match</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <AddPlayersSheet
        visible={inviteSheet}
        maxPlayers={maxInvitees}
        selected={players}
        onChange={saveInvites}
        onDismiss={() => { setInviteSheet(false); setReplacingSlot(null); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.pagePx, paddingBottom: 60 },
  cancelledBanner: { backgroundColor: 'rgba(255,92,107,0.12)', borderRadius: Radius.card, padding: 14, marginBottom: 16 },
  cancelledBannerText: { color: Colors.negative, fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label, textAlign: 'center' },
  heroCard: { borderWidth: 1, borderRadius: Radius.lg, padding: 20, gap: 14 },
  format: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 28 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailText: { flex: 1, fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body },
  reservedBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(47,217,139,0.12)', borderRadius: Radius.pill, paddingHorizontal: 11, paddingVertical: 7 },
  reservedText: { color: Colors.positive, fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label },
  respondCard: { marginTop: 18, borderWidth: 1.5, borderRadius: Radius.card, padding: 16, gap: 12 },
  respondTitle: { fontFamily: FontFamily.manropeBold, fontSize: FontSize.body },
  respondRow: { flexDirection: 'row', gap: 10 },
  respondButton: { flex: 1, minHeight: 46, borderRadius: Radius.button, alignItems: 'center', justifyContent: 'center' },
  acceptButton: { backgroundColor: Colors.positive },
  acceptButtonText: { color: Colors.white, fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body },
  declineButton: { borderWidth: 1, borderColor: Colors.negative },
  declineButtonText: { color: Colors.negative, fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body },
  sectionTitle: { fontFamily: FontFamily.spaceGroteskBold, fontSize: FontSize.sectionTitle, marginTop: 28, marginBottom: 12 },
  playersCard: { borderWidth: 1, borderRadius: Radius.card, paddingHorizontal: 16 },
  playerRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12 },
  playerAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: FontFamily.manropeBold, fontSize: FontSize.label },
  playerName: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  playerMeta: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label },
  inviteButton: { minHeight: 40, borderWidth: 1, borderColor: Colors.blue, borderRadius: Radius.button, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  inviteButtonText: { color: Colors.blue, fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label },
  actionsRow: { flexDirection: 'row', gap: 6 },
  iconAction: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  noteCard: { borderWidth: 1, borderRadius: Radius.card, padding: 18 },
  note: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, lineHeight: 24 },
  cancelMatchButton: { marginTop: 28, minHeight: 50, borderRadius: Radius.button, borderWidth: 1, borderColor: Colors.negative, alignItems: 'center', justifyContent: 'center' },
  cancelMatchButtonText: { color: Colors.negative, fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body },
});
