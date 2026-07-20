import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Contacts from 'expo-contacts/legacy';
import { Check, Search, UserPlus, Users, X } from 'lucide-react-native';

import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import type { ThemeTokens } from '@/constants/theme-tokens';

export interface MatchInvitee {
  id: string;
  name: string;
  avatarUrl: string | null;
  utrRating: number | null;
  sameCommunity?: boolean;
}

interface AddPlayersSheetProps {
  visible: boolean;
  maxPlayers: number;
  selected: MatchInvitee[];
  onChange: (players: MatchInvitee[]) => void;
  onDismiss: () => void;
}

type SourceTab = 'search' | 'contacts';

function initials(name: string) {
  return name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
}

function PlayerRow({
  player,
  active,
  onToggle,
  theme,
}: {
  player: MatchInvitee;
  active: boolean;
  onToggle: () => void;
  theme: ThemeTokens;
}) {
  return (
    <View style={[styles.playerRow, { borderBottomColor: theme.border }]}>
      {player.avatarUrl ? (
        <Image source={{ uri: player.avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.surface2 }]}>
          <Text style={[styles.avatarText, { color: theme.textPrimary }]}>{initials(player.name)}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[styles.playerName, { color: theme.textPrimary }]}>{player.name}</Text>
        <Text style={[styles.playerRating, { color: theme.textSecondary }]}>
          {player.utrRating == null ? 'UTR not set' : `UTR ${player.utrRating.toFixed(1)}`}
          {player.sameCommunity ? ' · Same community' : ''}
        </Text>
      </View>
      <TouchableOpacity style={[styles.addButton, active && styles.addButtonActive]} onPress={onToggle}>
        {active ? <Check size={18} color={Colors.white} /> : <Text style={styles.addButtonText}>Add</Text>}
      </TouchableOpacity>
    </View>
  );
}

export function AddPlayersSheet({
  visible,
  maxPlayers,
  selected,
  onChange,
  onDismiss,
}: AddPlayersSheetProps) {
  const { theme } = useTheme();
  const [tab, setTab] = useState<SourceTab>('search');

  // ── Player search (primary flow) ──────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MatchInvitee[]>([]);
  const [suggested, setSuggested] = useState<MatchInvitee[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (text: string) => {
    setSearchLoading(true);
    const { data, error } = await (supabase as any).rpc('search_players', { search_query: text });
    if (!error) {
      setSearchResults((data ?? []).map((row: any) => ({
        id: row.user_id,
        name: row.full_name || 'TenisX player',
        avatarUrl: row.avatar_url ?? null,
        utrRating: row.utr_rating == null ? null : Number(row.utr_rating),
        sameCommunity: !!row.same_community,
      })));
    }
    setSearchLoading(false);
  }, []);

  const loadSuggested = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: myListings }, { data: sent }, { data: received }] = await Promise.all([
      (supabase as any).from('open_match_listing_participants').select('listing_id').eq('user_id', user.id),
      supabase.from('messages').select('receiver_id').eq('sender_id', user.id),
      supabase.from('messages').select('sender_id').eq('receiver_id', user.id),
    ]);

    const listingIds = [...new Set((myListings ?? []).map((row: any) => row.listing_id))];
    const { data: coParticipants } = listingIds.length
      ? await (supabase as any)
        .from('open_match_listing_participants')
        .select('user_id')
        .in('listing_id', listingIds)
        .neq('user_id', user.id)
      : { data: [] };

    const ids = new Set<string>();
    (coParticipants ?? []).forEach((row: any) => ids.add(row.user_id));
    (sent ?? []).forEach((row: any) => ids.add(row.receiver_id));
    (received ?? []).forEach((row: any) => ids.add(row.sender_id));
    ids.delete(user.id);
    if (!ids.size) { setSuggested([]); return; }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, utr_rating, hoa_id')
      .in('id', [...ids].slice(0, 20));

    setSuggested((profiles ?? []).map(profile => ({
      id: profile.id,
      name: profile.full_name || 'TenisX player',
      avatarUrl: profile.avatar_url ?? null,
      utrRating: profile.utr_rating == null ? null : Number(profile.utr_rating),
    })));
  }, []);

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setTab('search');
    void runSearch('');
    void loadSuggested();
  }, [visible, runSearch, loadSuggested]);

  useEffect(() => {
    if (!visible) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void runSearch(query); }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, visible]);

  // ── Contacts (secondary/optional flow) ────────────────────────────────────
  const [permission, setPermission] = useState<'idle' | 'granted' | 'denied' | 'unavailable'>('idle');
  const [contacts, setContacts] = useState<MatchInvitee[]>([]);
  const [contactsQuery, setContactsQuery] = useState('');
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsMessage, setContactsMessage] = useState('');
  const contactsLoaded = useRef(false);

  const loadContacts = useCallback(async () => {
    if (Platform.OS === 'web') {
      setPermission('unavailable');
      return;
    }

    setContactsLoading(true);
    setContactsMessage('');
    try {
      const response = await Contacts.requestPermissionsAsync();
      if (response.status !== 'granted') {
        setPermission('denied');
        return;
      }
      setPermission('granted');

      const result = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.Emails, Contacts.Fields.PhoneNumbers],
        pageSize: 1000,
      });
      if (!result.data.length) {
        setContacts([]);
        setContactsMessage('No contacts were found on this device.');
        return;
      }

      const emails = new Set<string>();
      const phones = new Set<string>();
      result.data.forEach(contact => {
        contact.emails?.forEach(item => {
          if (item.email) emails.add(item.email.trim().toLowerCase());
        });
        contact.phoneNumbers?.forEach(item => {
          if (item.number) phones.add(item.number);
        });
      });

      const { data, error } = await (supabase as any).rpc('match_tenisx_contacts', {
        contact_emails: [...emails],
        contact_phones: [...phones],
      });
      if (error) throw error;

      const matched = (data ?? []).map((row: any) => ({
        id: row.user_id,
        name: row.full_name || 'TenisX player',
        avatarUrl: row.avatar_url ?? null,
        utrRating: row.utr_rating == null ? null : Number(row.utr_rating),
      }));
      setContacts(matched);
      if (!matched.length) setContactsMessage('None of your contacts are on TenisX yet.');
    } catch (error) {
      setContactsMessage(error instanceof Error ? error.message : 'Contacts could not be loaded.');
    } finally {
      setContactsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible || tab !== 'contacts' || contactsLoaded.current) return;
    contactsLoaded.current = true;
    void loadContacts();
  }, [visible, tab, loadContacts]);

  useEffect(() => {
    if (!visible) contactsLoaded.current = false;
  }, [visible]);

  const filteredContacts = useMemo(() => {
    const needle = contactsQuery.trim().toLowerCase();
    if (!needle) return contacts;
    return contacts.filter(player => player.name.toLowerCase().includes(needle));
  }, [contacts, contactsQuery]);

  const [limitMessage, setLimitMessage] = useState('');

  function toggle(player: MatchInvitee) {
    const exists = selected.some(item => item.id === player.id);
    if (exists) {
      onChange(selected.filter(item => item.id !== player.id));
      return;
    }
    if (selected.length >= maxPlayers) {
      setLimitMessage(`This match can include ${maxPlayers} invited ${maxPlayers === 1 ? 'player' : 'players'}.`);
      return;
    }
    setLimitMessage('');
    onChange([...selected, player]);
  }

  const showSuggested = tab === 'search' && !query.trim() && suggested.length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={[styles.backdrop, { backgroundColor: theme.backdrop }]}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onDismiss} activeOpacity={1} />
        <View style={[styles.sheet, { backgroundColor: theme.sheetBg }, theme.shadowSheet]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: theme.textPrimary }]}>Add Players</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                {selected.length} of {maxPlayers} invited
              </Text>
            </View>
            <TouchableOpacity style={styles.iconButton} onPress={onDismiss}>
              <X size={23} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tab, { borderColor: tab === 'search' ? Colors.blue : theme.border, backgroundColor: tab === 'search' ? theme.selectedBg : theme.cardBg }]}
              onPress={() => setTab('search')}>
              <Search size={15} color={tab === 'search' ? Colors.blue : theme.textSecondary} />
              <Text style={[styles.tabText, { color: tab === 'search' ? Colors.blue : theme.textSecondary }]}>Players</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, { borderColor: tab === 'contacts' ? Colors.blue : theme.border, backgroundColor: tab === 'contacts' ? theme.selectedBg : theme.cardBg }]}
              onPress={() => setTab('contacts')}>
              <Users size={15} color={tab === 'contacts' ? Colors.blue : theme.textSecondary} />
              <Text style={[styles.tabText, { color: tab === 'contacts' ? Colors.blue : theme.textSecondary }]}>Contacts</Text>
            </TouchableOpacity>
          </View>

          {tab === 'search' ? (
            <>
              <View style={[styles.search, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                <Search size={19} color={theme.textMuted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  style={[styles.searchInput, { color: theme.textPrimary }]}
                  placeholder="Search players by name"
                  placeholderTextColor={theme.textDisabled}
                  autoCorrect={false}
                />
              </View>

              {searchLoading ? (
                <View style={styles.centerState}><ActivityIndicator color={Colors.blue} /></View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {showSuggested && (
                    <>
                      <Text style={[styles.groupLabel, { color: theme.textMuted }]}>SUGGESTED</Text>
                      {suggested.map(player => (
                        <PlayerRow
                          key={`suggested-${player.id}`}
                          player={player}
                          active={selected.some(item => item.id === player.id)}
                          onToggle={() => toggle(player)}
                          theme={theme}
                        />
                      ))}
                      <Text style={[styles.groupLabel, { color: theme.textMuted, marginTop: 14 }]}>ALL PLAYERS</Text>
                    </>
                  )}
                  {searchResults
                    .filter(player => !showSuggested || !suggested.some(s => s.id === player.id))
                    .map(player => (
                      <PlayerRow
                        key={player.id}
                        player={player}
                        active={selected.some(item => item.id === player.id)}
                        onToggle={() => toggle(player)}
                        theme={theme}
                      />
                    ))}
                  {!searchResults.length && !showSuggested && (
                    <Text style={[styles.message, { color: theme.textSecondary }]}>
                      {query.trim() ? 'No players match that search.' : 'No discoverable players found yet.'}
                    </Text>
                  )}
                  {!!limitMessage && <Text style={[styles.message, { color: theme.textSecondary }]}>{limitMessage}</Text>}
                </ScrollView>
              )}
            </>
          ) : permission === 'denied' ? (
            <View style={styles.centerState}>
              <UserPlus size={42} color={Colors.blue} />
              <Text style={[styles.stateTitle, { color: theme.textPrimary }]}>Enable Contacts Access</Text>
              <Text style={[styles.stateCopy, { color: theme.textSecondary }]}>
                TenisX only uses email and phone numbers to find contacts who already have an account.
              </Text>
              <TouchableOpacity style={styles.primaryButton} onPress={() => Linking.openSettings()}>
                <Text style={styles.primaryButtonText}>Open Settings</Text>
              </TouchableOpacity>
            </View>
          ) : permission === 'unavailable' ? (
            <View style={styles.centerState}>
              <Text style={[styles.stateTitle, { color: theme.textPrimary }]}>Contacts are available in the mobile app</Text>
              <Text style={[styles.stateCopy, { color: theme.textSecondary }]}>
                Open TenisX on iOS or Android to invite people from your contacts.
              </Text>
            </View>
          ) : (
            <>
              <View style={[styles.search, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                <Search size={19} color={theme.textMuted} />
                <TextInput
                  value={contactsQuery}
                  onChangeText={setContactsQuery}
                  style={[styles.searchInput, { color: theme.textPrimary }]}
                  placeholder="Search name, email, or phone"
                  placeholderTextColor={theme.textDisabled}
                />
              </View>

              {contactsLoading ? (
                <View style={styles.centerState}><ActivityIndicator color={Colors.blue} /></View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {filteredContacts.map(player => (
                    <PlayerRow
                      key={player.id}
                      player={player}
                      active={selected.some(item => item.id === player.id)}
                      onToggle={() => toggle(player)}
                      theme={theme}
                    />
                  ))}
                  {!!contactsMessage && <Text style={[styles.message, { color: theme.textSecondary }]}>{contactsMessage}</Text>}
                  {!!limitMessage && <Text style={[styles.message, { color: theme.textSecondary }]}>{limitMessage}</Text>}
                </ScrollView>
              )}
            </>
          )}

          <TouchableOpacity style={styles.doneButton} onPress={onDismiss}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { height: '86%', borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.pagePx, paddingTop: 10 },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: Colors.borderStrong, alignSelf: 'center', marginBottom: 15 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 24 },
  subtitle: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, marginTop: 3 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: Radius.chip, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  tabText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label },
  groupLabel: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.eyebrow, letterSpacing: 1.2, marginTop: 4, marginBottom: 4 },
  search: { minHeight: 52, borderWidth: 1, borderRadius: Radius.input, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, marginBottom: 10 },
  searchInput: { flex: 1, fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 26, gap: 14 },
  stateTitle: { fontFamily: FontFamily.spaceGroteskBold, fontSize: FontSize.cardTitle, textAlign: 'center' },
  stateCopy: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, lineHeight: 24, textAlign: 'center' },
  primaryButton: { minHeight: 50, paddingHorizontal: 24, borderRadius: Radius.button, backgroundColor: Colors.blue, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: Colors.white, fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label },
  playerRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1 },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: FontFamily.manropeBold, fontSize: FontSize.label },
  playerName: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body },
  playerRating: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, marginTop: 2 },
  addButton: { minWidth: 58, height: 40, borderRadius: Radius.button, borderWidth: 1, borderColor: Colors.blue, alignItems: 'center', justifyContent: 'center' },
  addButtonActive: { backgroundColor: Colors.blue },
  addButtonText: { color: Colors.blue, fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label },
  message: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, textAlign: 'center', padding: 28 },
  doneButton: { minHeight: 52, marginTop: 12, backgroundColor: Colors.blue, borderRadius: Radius.button, alignItems: 'center', justifyContent: 'center' },
  doneButtonText: { color: Colors.white, fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body },
});
