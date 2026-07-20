import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { CalendarDays, MapPin } from 'lucide-react-native';

import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useUpcomingMatches, type UpcomingMatchInvite } from '@/hooks/useUpcomingMatches';

function formatTime(value: string) {
  const [hour, minute] = value.slice(0, 5).split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function MyMatchesPanel({ userId }: { userId: string }) {
  const { theme } = useTheme();
  const { invitations, upcoming, loading, refresh } = useUpcomingMatches(userId);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function respond(invite: UpcomingMatchInvite, status: 'accepted' | 'declined') {
    setBusyId(invite.listingId);
    const { error } = await (supabase as any)
      .from('open_match_listing_participants')
      .update({ status })
      .eq('listing_id', invite.listingId)
      .eq('user_id', userId);
    setBusyId(null);
    if (!error) void refresh();
  }

  if (!userId || (!loading && !invitations.length && !upcoming.length)) return null;

  return (
    <View style={styles.wrap}>
      {loading ? (
        <ActivityIndicator color={Colors.blue} style={{ marginVertical: 20 }} />
      ) : (
        <>
          {!!invitations.length && (
            <>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Your Invitations</Text>
              {invitations.map(invite => (
                <View key={invite.listingId} style={[styles.inviteCard, { backgroundColor: theme.cardBg, borderColor: Colors.blue }]}>
                  <TouchableOpacity onPress={() => router.push(`/match/${invite.listingId}` as any)}>
                    <Text style={[styles.inviteTitle, { color: theme.textPrimary }]}>
                      {invite.organizerName} invited you · {invite.format === 'doubles' ? 'Doubles' : 'Singles'}
                    </Text>
                    <View style={styles.metaRow}>
                      <CalendarDays size={13} color={theme.textSecondary} />
                      <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                        {formatDate(invite.matchDate)} · {formatTime(invite.startTime)}
                      </Text>
                    </View>
                    <View style={styles.metaRow}>
                      <MapPin size={13} color={theme.textSecondary} />
                      <Text style={[styles.metaText, { color: theme.textSecondary }]} numberOfLines={1}>{invite.location}</Text>
                    </View>
                  </TouchableOpacity>
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.declineBtn]}
                      disabled={busyId === invite.listingId}
                      onPress={() => respond(invite, 'declined')}>
                      <Text style={styles.declineBtnText}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.acceptBtn]}
                      disabled={busyId === invite.listingId}
                      onPress={() => respond(invite, 'accepted')}>
                      <Text style={styles.acceptBtnText}>Accept</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          )}

          {!!upcoming.length && (
            <>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginTop: invitations.length ? 20 : 0 }]}>My Upcoming Matches</Text>
              {upcoming.map(item => (
                <TouchableOpacity
                  key={item.listingId}
                  style={[styles.upcomingRow, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
                  onPress={() => router.push(`/match/${item.listingId}` as any)}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.upcomingTitle, { color: theme.textPrimary }]}>
                      {item.format === 'doubles' ? 'Doubles' : 'Singles'} · {formatDate(item.matchDate)}
                    </Text>
                    <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                      {formatTime(item.startTime)} · {item.location}
                      {item.role === 'organizer' && item.openSlots > 0 ? ` · ${item.openSlots} open slot${item.openSlots > 1 ? 's' : ''}` : ''}
                    </Text>
                  </View>
                  <Text style={[styles.roleTag, { color: item.role === 'organizer' ? Colors.blue : Colors.positive }]}>
                    {item.role === 'organizer' ? 'ORGANIZER' : 'GOING'}
                  </Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: Spacing.pagePx, marginBottom: 24 },
  sectionTitle: { fontFamily: FontFamily.spaceGroteskBold, fontSize: FontSize.sectionTitle, marginBottom: 12 },
  inviteCard: { borderWidth: 1.5, borderRadius: Radius.card, padding: 14, marginBottom: 10, gap: 8 },
  inviteTitle: { fontFamily: FontFamily.manropeBold, fontSize: FontSize.body },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  metaText: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, flexShrink: 1 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  actionBtn: { flex: 1, minHeight: 40, borderRadius: Radius.button, alignItems: 'center', justifyContent: 'center' },
  acceptBtn: { backgroundColor: Colors.positive },
  acceptBtnText: { color: Colors.white, fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label },
  declineBtn: { borderWidth: 1, borderColor: Colors.negative },
  declineBtnText: { color: Colors.negative, fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label },
  upcomingRow: { flexDirection: 'row', alignItems: 'center', minHeight: 68, borderWidth: 1, borderRadius: Radius.card, paddingHorizontal: 14, marginBottom: 8, gap: 10 },
  upcomingTitle: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body },
  roleTag: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 10, letterSpacing: 0.6 },
});
