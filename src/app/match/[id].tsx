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
import { CalendarDays, Clock3, MapPin, ShieldCheck, UserPlus, Users } from 'lucide-react-native';

import { AddPlayersSheet, type MatchInvitee } from '@/components/match/AddPlayersSheet';
import { Header } from '@/components/ui/Header';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';

interface Listing {
  id: string;
  creator_id: string;
  format: 'singles' | 'doubles';
  match_date: string;
  start_time: string;
  duration_minutes: number;
  location: string;
  court_reserved: boolean;
  note: string | null;
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
  const [players, setPlayers] = useState<MatchInvitee[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteSheet, setInviteSheet] = useState(false);
  const [userId, setUserId] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data: match, error } = await (supabase as any)
      .from('open_match_listings')
      .select('id, creator_id, format, match_date, start_time, duration_minutes, location, court_reserved, note')
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
    setOrganizer(mapped.get(match.creator_id) ?? null);
    setPlayers((participantRows ?? []).map((row: any) => mapped.get(row.user_id)).filter(Boolean) as MatchInvitee[]);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? ''));
    void load();
  }, [load]);

  const maxInvitees = listing?.format === 'doubles' ? 3 : 1;
  const slots = useMemo(() => {
    if (!listing) return [];
    return Array.from({ length: listing.format === 'doubles' ? 4 : 2 }, (_, index) => {
      if (index === 0) return organizer;
      return players[index - 1] ?? null;
    });
  }, [listing, organizer, players]);

  async function saveInvites(next: MatchInvitee[]) {
    if (!listing || userId !== listing.creator_id) return;
    const newPlayers = next.filter(player => !players.some(existing => existing.id === player.id));
    if (newPlayers.length) {
      const { error } = await (supabase as any).from('open_match_listing_participants').insert(
        newPlayers.map((player, index) => ({
          listing_id: listing.id,
          user_id: player.id,
          status: 'invited',
          added_by: userId,
          slot_index: players.length + index + 1,
        })),
      );
      if (error) {
        Alert.alert('Unable to add player', error.message);
        return;
      }
    }
    setPlayers(next);
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
        <Header variant="inner" title="Match Details" onBack={() => router.back()} />
        <View style={styles.center}><Text style={{ color: theme.textSecondary }}>Match unavailable.</Text></View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.pageBg }]}>
      <Header variant="inner" title="Match Details" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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

        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Players</Text>
        <View style={[styles.playersCard, { backgroundColor: theme.cardBg, borderColor: theme.border }, theme.shadowCard]}>
          {slots.map((player, index) => (
            <View key={player?.id ?? `slot-${index}`} style={[styles.playerRow, index < slots.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
              <View style={[styles.playerAvatar, { backgroundColor: player ? theme.selectedBg : theme.surface2 }]}>
                {player ? (
                  <Text style={[styles.avatarText, { color: theme.textPrimary }]}>{player.name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()}</Text>
                ) : (
                  <UserPlus size={20} color={theme.textMuted} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.playerName, { color: theme.textPrimary }]}>
                  {player?.name ?? (listing.format === 'doubles' ? `${index < 2 ? 'Team A' : 'Team B'} open slot` : 'Player B open slot')}
                </Text>
                <Text style={[styles.playerMeta, { color: theme.textSecondary }]}>
                  {index === 0 ? 'Organizer' : player?.utrRating == null ? (player ? 'Invited' : 'Available') : `UTR ${player.utrRating.toFixed(1)} · Invited`}
                </Text>
              </View>
              {!player && userId === listing.creator_id && (
                <TouchableOpacity style={styles.inviteButton} onPress={() => setInviteSheet(true)}>
                  <Text style={styles.inviteButtonText}>Invite</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {!!listing.note && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Match Note</Text>
            <View style={[styles.noteCard, { backgroundColor: theme.cardBg, borderColor: theme.border }, theme.shadowCard]}>
              <Text style={[styles.note, { color: theme.textSecondary }]}>{listing.note}</Text>
            </View>
          </>
        )}
      </ScrollView>

      <AddPlayersSheet
        visible={inviteSheet}
        maxPlayers={maxInvitees}
        selected={players}
        onChange={saveInvites}
        onDismiss={() => setInviteSheet(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.pagePx, paddingBottom: 60 },
  heroCard: { borderWidth: 1, borderRadius: Radius.lg, padding: 20, gap: 14 },
  format: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 28 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailText: { flex: 1, fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body },
  reservedBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(47,217,139,0.12)', borderRadius: Radius.pill, paddingHorizontal: 11, paddingVertical: 7 },
  reservedText: { color: Colors.positive, fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label },
  sectionTitle: { fontFamily: FontFamily.spaceGroteskBold, fontSize: FontSize.sectionTitle, marginTop: 28, marginBottom: 12 },
  playersCard: { borderWidth: 1, borderRadius: Radius.card, paddingHorizontal: 16 },
  playerRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12 },
  playerAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: FontFamily.manropeBold, fontSize: FontSize.label },
  playerName: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body },
  playerMeta: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, marginTop: 2 },
  inviteButton: { minHeight: 40, borderWidth: 1, borderColor: Colors.blue, borderRadius: Radius.button, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  inviteButtonText: { color: Colors.blue, fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label },
  noteCard: { borderWidth: 1, borderRadius: Radius.card, padding: 18 },
  note: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, lineHeight: 24 },
});
