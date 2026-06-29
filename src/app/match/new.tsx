import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CalendarDays,
  Check,
  ChevronRight,
  MapPin,
  Plus,
  Search,
  Users,
  X,
} from 'lucide-react-native';

import { AddPlayersSheet, type MatchInvitee } from '@/components/match/AddPlayersSheet';
import { Header } from '@/components/ui/Header';
import { WeatherTimeWheel } from '@/components/ui/WeatherTimeWheel';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';

type MatchFormat = 'singles' | 'doubles';
type LocationSource = 'hoa' | 'club' | 'directory';

interface MatchLocation {
  id: string | null;
  name: string;
  city: string;
  distance: string;
  source: LocationSource;
}

const today = new Date();
today.setHours(0, 0, 0, 0);

const DATES = Array.from({ length: 15 }, (_, index) => {
  const date = new Date(today);
  date.setDate(date.getDate() + index);
  return date;
});

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatTime(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function endTime(start: string, duration: number) {
  const [hour, minute] = start.split(':').map(Number);
  const total = hour * 60 + minute + duration;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function SheetFrame({
  visible,
  title,
  onDismiss,
  children,
}: {
  visible: boolean;
  title: string;
  onDismiss: () => void;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={[styles.backdrop, { backgroundColor: theme.backdrop }]}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onDismiss} activeOpacity={1} />
        <View style={[styles.sheet, { backgroundColor: theme.sheetBg }, theme.shadowSheet]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>{title}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onDismiss}>
              <X size={23} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

export default function NewMatchScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [userId, setUserId] = useState('');
  const [format, setFormat] = useState<MatchFormat | null>(null);
  const [players, setPlayers] = useState<MatchInvitee[]>([]);
  const [selectedDate, setSelectedDate] = useState(DATES[0]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [duration, setDuration] = useState(90);
  const [location, setLocation] = useState<MatchLocation | null>(null);
  const [courtReserved, setCourtReserved] = useState(false);
  const [note, setNote] = useState('');
  const [formatSheet, setFormatSheet] = useState(false);
  const [playersSheet, setPlayersSheet] = useState(false);
  const [dateTimeSheet, setDateTimeSheet] = useState(false);
  const [locationSheet, setLocationSheet] = useState(false);
  const [saving, setSaving] = useState(false);

  const maxInvitees = format === 'doubles' ? 3 : 1;
  const canCreate = Boolean(format && selectedDate && selectedTime && location);
  const locationCity = location?.city || location?.name;

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? ''));
  }, []);

  useEffect(() => {
    setPlayers(current => current.slice(0, maxInvitees));
  }, [maxInvitees]);

  async function createMatch() {
    if (!canCreate || !format || !selectedTime || !location) return;
    const currentUserId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!currentUserId) {
      Alert.alert('Sign-in required', 'You must be signed in to create a match.');
      return;
    }
    setSaving(true);
    const { data, error } = await (supabase as any)
      .from('open_match_listings')
      .insert({
        creator_id: currentUserId,
        format,
        match_type: 'casual',
        play_with: 'all',
        match_date: dateKey(selectedDate),
        start_time: selectedTime,
        end_time: endTime(selectedTime, duration),
        duration_minutes: duration,
        location: location.name,
        location_id: location.id,
        location_source: location.source,
        court_reserved: courtReserved,
        note: note.trim() || null,
        ntrp_min: 1,
        ntrp_max: 7,
      })
      .select('id')
      .single();

    if (!error && data?.id && players.length) {
      const { error: inviteError } = await (supabase as any)
        .from('open_match_listing_participants')
        .insert(players.map((player, index) => ({
          listing_id: data.id,
          user_id: player.id,
          status: 'invited',
          added_by: currentUserId,
          slot_index: index + 1,
        })));
      if (inviteError) {
        console.error('Invite error:', inviteError);
        Alert.alert('Match created', 'The match was created, but one or more invitations could not be added.');
      }
    }

    setSaving(false);
    if (error) {
      console.error('Create match error:', error);
      Alert.alert('Unable to create match', error.message ?? 'Something went wrong. Check the console for details.');
      return;
    }
    router.replace(`/match/${data.id}` as any);
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.pageBg }]}>
      <Header variant="inner" title="New Match" onBack={() => router.back()} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: Spacing.pagePx, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}>
        <Text style={[styles.intro, { color: theme.textSecondary }]}>
          Set the essentials. You can invite players now or publish the match with open slots.
        </Text>

        <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>MATCH</Text>
        <View style={styles.formatRow}>
          <TouchableOpacity
            style={[styles.card, styles.formatCard, { backgroundColor: theme.cardBg, borderColor: theme.border }, theme.shadowCard]}
            onPress={() => setFormatSheet(true)}>
            <View style={[styles.cardIcon, { backgroundColor: theme.surface2 }]}><Users size={22} color={Colors.blue} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>Format</Text>
              <Text style={[styles.cardValue, { color: theme.textPrimary }]}>{format ? (format === 'singles' ? 'Singles' : 'Doubles') : 'Choose format'}</Text>
            </View>
            <ChevronRight size={21} color={theme.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel="Invite players"
            style={[styles.plusButton, { backgroundColor: Colors.blue }]}
            onPress={() => setPlayersSheet(true)}>
            <Plus size={25} color={Colors.white} />
          </TouchableOpacity>
        </View>
        {!!players.length && (
          <Text style={[styles.inviteSummary, { color: theme.textSecondary }]}>
            Invited: {players.map(player => player.name).join(', ')}
          </Text>
        )}

        <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>SCHEDULE</Text>
        <TouchableOpacity
          style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }, theme.shadowCard]}
          onPress={() => setDateTimeSheet(true)}>
          <View style={[styles.cardIcon, { backgroundColor: theme.surface2 }]}><CalendarDays size={22} color={Colors.blue} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>Date & Time</Text>
            <Text style={[styles.cardValue, { color: theme.textPrimary }]}>
              {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              {selectedTime ? ` · ${formatTime(selectedTime)} · ${duration} min` : ' · Choose time'}
            </Text>
          </View>
          <ChevronRight size={21} color={theme.textMuted} />
        </TouchableOpacity>

        <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>LOCATION</Text>
        <TouchableOpacity
          style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }, theme.shadowCard]}
          onPress={() => setLocationSheet(true)}>
          <View style={[styles.cardIcon, { backgroundColor: theme.surface2 }]}><MapPin size={22} color={Colors.blue} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>Location</Text>
            <Text style={[styles.cardValue, { color: theme.textPrimary }]}>{location?.name ?? 'Choose a facility'}</Text>
          </View>
          <ChevronRight size={21} color={theme.textMuted} />
        </TouchableOpacity>

        <View style={[styles.toggleCard, { backgroundColor: theme.cardBg, borderColor: theme.border }, theme.shadowCard]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.toggleTitle, { color: theme.textPrimary }]}>Mark Court Reserved</Text>
            <Text style={[styles.toggleCopy, { color: theme.textSecondary }]}>I already have a court booked.</Text>
          </View>
          <Switch
            value={courtReserved}
            onValueChange={setCourtReserved}
            trackColor={{ false: theme.borderStrong, true: Colors.blue }}
            thumbColor={Colors.white}
          />
        </View>

        <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>MATCH NOTE</Text>
        <View style={[styles.noteCard, { backgroundColor: theme.cardBg, borderColor: theme.border }, theme.shadowCard]}>
          <TextInput
            value={note}
            onChangeText={value => setNote(value.slice(0, 200))}
            placeholder="Looking for strong baseliner."
            placeholderTextColor={theme.textDisabled}
            multiline
            style={[styles.noteInput, { color: theme.textPrimary }]}
          />
          <Text style={[styles.counter, { color: theme.textMuted }]}>{note.length}/200</Text>
        </View>
      </ScrollView>

      <View style={[styles.fixedCta, { backgroundColor: theme.pageBg, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={[styles.createButton, (!canCreate || saving) && styles.disabledButton]}
          disabled={!canCreate || saving}
          onPress={createMatch}>
          {saving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.createButtonText}>Create Match</Text>}
        </TouchableOpacity>
      </View>

      <FormatSheet visible={formatSheet} value={format} onSelect={value => { setFormat(value); setFormatSheet(false); }} onDismiss={() => setFormatSheet(false)} />
      <DateTimeSheet
        visible={dateTimeSheet}
        date={selectedDate}
        time={selectedTime}
        duration={duration}
        locationCity={locationCity}
        onSave={(date, time, nextDuration) => {
          setSelectedDate(date);
          setSelectedTime(time);
          setDuration(nextDuration);
          setDateTimeSheet(false);
        }}
        onDismiss={() => setDateTimeSheet(false)}
      />
      <LocationSheet visible={locationSheet} selected={location} onSelect={value => { setLocation(value); setLocationSheet(false); }} onDismiss={() => setLocationSheet(false)} />
      <AddPlayersSheet
        visible={playersSheet}
        maxPlayers={maxInvitees}
        selected={players}
        onChange={setPlayers}
        onDismiss={() => setPlayersSheet(false)}
      />
    </View>
  );
}

function FormatSheet({
  visible,
  value,
  onSelect,
  onDismiss,
}: {
  visible: boolean;
  value: MatchFormat | null;
  onSelect: (value: MatchFormat) => void;
  onDismiss: () => void;
}) {
  const { theme } = useTheme();
  return (
    <SheetFrame visible={visible} title="Format" onDismiss={onDismiss}>
      {(['singles', 'doubles'] as MatchFormat[]).map(option => (
        <TouchableOpacity key={option} style={[styles.optionRow, { borderBottomColor: theme.border }]} onPress={() => onSelect(option)}>
          <View>
            <Text style={[styles.optionTitle, { color: theme.textPrimary }]}>{option === 'singles' ? 'Singles' : 'Doubles'}</Text>
            <Text style={[styles.optionCopy, { color: theme.textSecondary }]}>{option === 'singles' ? 'One player per side' : 'Two players per side'}</Text>
          </View>
          {value === option && <Check size={22} color={Colors.blue} />}
        </TouchableOpacity>
      ))}
    </SheetFrame>
  );
}

function DateTimeSheet({
  visible,
  date,
  time,
  duration,
  locationCity,
  onSave,
  onDismiss,
}: {
  visible: boolean;
  date: Date;
  time: string | null;
  duration: number;
  locationCity?: string;
  onSave: (date: Date, time: string, duration: number) => void;
  onDismiss: () => void;
}) {
  const { theme } = useTheme();
  const [draftDate, setDraftDate] = useState(date);
  const [draftTime, setDraftTime] = useState<string | null>(time);
  const [draftDuration, setDraftDuration] = useState(duration);

  useEffect(() => {
    if (!visible) return;
    setDraftDate(date);
    setDraftTime(time);
    setDraftDuration(duration);
  }, [visible, date, time, duration]);

  return (
    <SheetFrame visible={visible} title="Date & Time" onDismiss={onDismiss}>
      <View style={{ flex: 1, marginHorizontal: -Spacing.pagePx }}>
        <WeatherTimeWheel
          availableDates={DATES}
          allowedDurations={[60, 90, 120]}
          mode="outdoor"
          locationCity={locationCity}
          selectedDate={draftDate}
          selectedTime={draftTime}
          selectedDuration={draftDuration}
          onDateChange={(d) => { setDraftDate(d); setDraftTime(null); }}
          onSelectSlot={(d, t, dur) => { setDraftDate(d); setDraftTime(t); setDraftDuration(dur); }}
          theme={theme}
        />
      </View>
      <TouchableOpacity
        style={[styles.sheetSave, !draftTime && styles.disabledButton]}
        disabled={!draftTime}
        onPress={() => draftTime && onSave(draftDate, draftTime, draftDuration)}>
        <Text style={styles.createButtonText}>Set Date & Time</Text>
      </TouchableOpacity>
    </SheetFrame>
  );
}

function LocationSheet({
  visible,
  selected,
  onSelect,
  onDismiss,
}: {
  visible: boolean;
  selected: MatchLocation | null;
  onSelect: (value: MatchLocation) => void;
  onDismiss: () => void;
}) {
  const { theme } = useTheme();
  const [source, setSource] = useState<LocationSource>('hoa');
  const [locations, setLocations] = useState<MatchLocation[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const [{ data: memberships }, { data: profile }, { data: hoaCourts }, { data: facilities }] = await Promise.all([
        supabase.from('hoa_memberships').select('hoa_id').eq('user_id', user.id).eq('status', 'approved'),
        supabase.from('profiles').select('home_court_id, preferred_court_locations').eq('id', user.id).maybeSingle(),
        (supabase as any).from('courts').select('id, name, hoa_id, hoas(name, address)').eq('court_type', 'tennis').limit(100),
        (supabase as any).from('tennis_facilities').select('id, name, city').eq('is_active', true).order('name'),
      ]);
      const hoaIds = new Set((memberships ?? []).map(item => item.hoa_id));

      // HOA and Club items from the HOA courts table
      const courtItems: MatchLocation[] = (hoaCourts ?? [])
        .filter((court: any) => hoaIds.has(court.hoa_id) || profile?.home_court_id === court.id)
        .map((court: any) => ({
          id: court.id,
          name: court.name,
          city: court.hoas?.address || court.hoas?.name || 'Puerto Rico',
          distance: '',
          source: hoaIds.has(court.hoa_id) ? 'hoa' : 'club',
        } as MatchLocation));
      if (profile?.preferred_court_locations && !courtItems.some(item => item.source === 'club')) {
        courtItems.push({
          id: null,
          name: profile.preferred_court_locations,
          city: 'Favorite club',
          distance: '',
          source: 'club',
        });
      }

      // External facilities for "Other Locations" tab
      const directoryItems: MatchLocation[] = (facilities ?? []).map((f: any) => ({
        id: f.id,
        name: f.name,
        city: f.city,
        distance: '',
        source: 'directory',
      }));

      setLocations([...courtItems, ...directoryItems]);
      setLoading(false);
    });
  }, [visible]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return locations
      .filter(item => item.source === source)
      .filter(item => !needle || `${item.name} ${item.city}`.toLowerCase().includes(needle));
  }, [locations, query, source]);

  return (
    <SheetFrame visible={visible} title="Location" onDismiss={onDismiss}>
      <View style={styles.segmentRow}>
        {([
          ['hoa', 'My HOA'],
          ['club', 'My Club'],
          ['directory', 'Other Locations'],
        ] as const).map(([value, label]) => (
          <TouchableOpacity
            key={value}
            style={[styles.segment, { borderColor: source === value ? Colors.blue : theme.border, backgroundColor: source === value ? theme.selectedBg : theme.cardBg }]}
            onPress={() => { setSource(value); setQuery(''); }}>
            <Text style={[styles.segmentText, { color: source === value ? Colors.blue : theme.textSecondary }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {source === 'directory' && (
        <View style={[styles.locationSearch, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
          <Search size={19} color={theme.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search facilities"
            placeholderTextColor={theme.textDisabled}
            style={[styles.locationSearchInput, { color: theme.textPrimary }]}
          />
        </View>
      )}
      {loading ? (
        <View style={styles.locationState}><ActivityIndicator color={Colors.blue} /></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {filtered.map(item => (
            <TouchableOpacity key={`${item.source}-${item.id ?? item.name}`} style={[styles.locationOption, { borderBottomColor: theme.border }]} onPress={() => onSelect(item)}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionTitle, { color: theme.textPrimary }]}>{item.name}</Text>
                <Text style={[styles.optionCopy, { color: theme.textSecondary }]}>{item.city}{item.distance ? ` · ${item.distance}` : ''}</Text>
              </View>
              {selected?.id === item.id && selected?.name === item.name && <Check size={22} color={Colors.blue} />}
            </TouchableOpacity>
          ))}
          {!filtered.length && (
            <Text style={[styles.emptyLocations, { color: theme.textSecondary }]}>
              {source === 'hoa' ? 'No HOA tennis courts are linked to your account.' : source === 'club' ? 'No favorite tennis club is set.' : 'No tennis facilities match your search.'}
            </Text>
          )}
        </ScrollView>
      )}
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  intro: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, lineHeight: 24, marginBottom: 22 },
  sectionLabel: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.eyebrow, letterSpacing: 1.2, marginTop: 20, marginBottom: 9 },
  formatRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  card: { minHeight: 84, borderRadius: Radius.card, borderWidth: 1, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 13 },
  formatCard: { flex: 1 },
  cardIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardLabel: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label },
  cardValue: { fontFamily: FontFamily.manropeBold, fontSize: FontSize.body, marginTop: 3 },
  plusButton: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  inviteSummary: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, lineHeight: 20, marginTop: 9 },
  toggleCard: { marginTop: 20, minHeight: 82, borderWidth: 1, borderRadius: Radius.card, padding: 17, flexDirection: 'row', alignItems: 'center', gap: 14 },
  toggleTitle: { fontFamily: FontFamily.manropeBold, fontSize: FontSize.body },
  toggleCopy: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, marginTop: 4 },
  noteCard: { borderWidth: 1, borderRadius: Radius.card, padding: 14 },
  noteInput: { minHeight: 100, textAlignVertical: 'top', fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, lineHeight: 24 },
  counter: { alignSelf: 'flex-end', fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.metadata },
  fixedCta: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: 1, paddingHorizontal: Spacing.pagePx, paddingTop: 14 },
  createButton: { minHeight: 54, backgroundColor: Colors.blue, borderRadius: Radius.button, alignItems: 'center', justifyContent: 'center' },
  disabledButton: { opacity: 0.42 },
  createButtonText: { color: Colors.white, fontFamily: FontFamily.manropeBold, fontSize: FontSize.body },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { height: '88%', borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.pagePx, paddingTop: 10 },
  sheetHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: Colors.borderStrong, alignSelf: 'center', marginBottom: 12 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  sheetTitle: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 24 },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  optionRow: { minHeight: 76, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionTitle: { fontFamily: FontFamily.manropeBold, fontSize: FontSize.body },
  optionCopy: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, marginTop: 3 },
  segmentRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  segment: { flex: 1, minHeight: 46, borderWidth: 1, borderRadius: Radius.chip, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  segmentText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 13, textAlign: 'center' },
  sheetSave: { minHeight: 52, backgroundColor: Colors.blue, borderRadius: Radius.button, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  locationSearch: { minHeight: 52, borderWidth: 1, borderRadius: Radius.input, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, marginBottom: 8 },
  locationSearchInput: { flex: 1, fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body },
  locationOption: { minHeight: 76, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  locationState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyLocations: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, lineHeight: 24, textAlign: 'center', padding: 28 },
});
