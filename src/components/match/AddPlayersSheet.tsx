import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Check, Search, UserPlus, X } from 'lucide-react-native';

import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';

export interface MatchInvitee {
  id: string;
  name: string;
  avatarUrl: string | null;
  utrRating: number | null;
}

interface AddPlayersSheetProps {
  visible: boolean;
  maxPlayers: number;
  selected: MatchInvitee[];
  onChange: (players: MatchInvitee[]) => void;
  onDismiss: () => void;
}

export function AddPlayersSheet({
  visible,
  maxPlayers,
  selected,
  onChange,
  onDismiss,
}: AddPlayersSheetProps) {
  const { theme } = useTheme();
  const [permission, setPermission] = useState<'idle' | 'granted' | 'denied' | 'unavailable'>('idle');
  const [players, setPlayers] = useState<MatchInvitee[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const loadContacts = useCallback(async () => {
    if (Platform.OS === 'web') {
      setPermission('unavailable');
      return;
    }

    setLoading(true);
    setMessage('');
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
        setPlayers([]);
        setMessage('No contacts were found on this device.');
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
      setPlayers(matched);
      if (!matched.length) setMessage('None of your contacts are on TenisX yet.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Contacts could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    void loadContacts();
  }, [visible, loadContacts]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return players;
    return players.filter(player => player.name.toLowerCase().includes(needle));
  }, [players, query]);

  function toggle(player: MatchInvitee) {
    const exists = selected.some(item => item.id === player.id);
    if (exists) {
      onChange(selected.filter(item => item.id !== player.id));
      return;
    }
    if (selected.length >= maxPlayers) {
      setMessage(`This match can include ${maxPlayers} invited ${maxPlayers === 1 ? 'player' : 'players'}.`);
      return;
    }
    setMessage('');
    onChange([...selected, player]);
  }

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

          {permission === 'denied' ? (
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
                  value={query}
                  onChangeText={setQuery}
                  style={[styles.searchInput, { color: theme.textPrimary }]}
                  placeholder="Search name, email, or phone"
                  placeholderTextColor={theme.textDisabled}
                />
              </View>

              {loading ? (
                <View style={styles.centerState}><ActivityIndicator color={Colors.blue} /></View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {filtered.map(player => {
                    const active = selected.some(item => item.id === player.id);
                    return (
                      <View key={player.id} style={[styles.playerRow, { borderBottomColor: theme.border }]}>
                        {player.avatarUrl ? (
                          <Image source={{ uri: player.avatarUrl }} style={styles.avatar} />
                        ) : (
                          <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.surface2 }]}>
                            <Text style={[styles.avatarText, { color: theme.textPrimary }]}>
                              {player.name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.playerName, { color: theme.textPrimary }]}>{player.name}</Text>
                          <Text style={[styles.playerRating, { color: theme.textSecondary }]}>
                            {player.utrRating == null ? 'UTR not set' : `UTR ${player.utrRating.toFixed(1)}`}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={[styles.addButton, active && styles.addButtonActive]}
                          onPress={() => toggle(player)}>
                          {active ? <Check size={18} color={Colors.white} /> : <Text style={styles.addButtonText}>Add</Text>}
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                  {!!message && <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>}
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  title: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 24 },
  subtitle: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, marginTop: 3 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
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
