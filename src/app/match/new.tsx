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
  Clock3,
  MapPin,
  Plus,
  Search,
  Users,
  X,
} from 'lucide-react-native';

import { AddPlayersSheet, type MatchInvitee } from '@/components/match/AddPlayersSheet';
import { Header } from '@/components/ui/Header';
import { TimeSlotWheel } from '@/components/ui/TimeSlotWheel';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import { useHourlyWeather } from '@/hooks/useHourlyWeather';
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

const TIME_SLOTS = Array.from({ length: 33 }, (_, index) => {
  const total = 6 * 60 + index * 30;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
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
  const { wheelWeather } = useHourlyWeather(location?.city || location?.name);

  const maxInvitees = format === 'doubles' ? 3 : 1;
  const canCreate = Boolean(format && selectedDate && selectedTime && location && userId);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? ''));
  }, []);

  useEffect(() => {
    setPlayers(current => current.slice(0, maxInvitees));
  }, [maxInvitees]);

  async function createMatch() {
    if (!canCreate || !format || !selectedTime || !location) return;
    setSaving(true);
    const { data, error } = await (supabase as any)
      .from('open_match_listings')
      .insert({
        creator_id: userId,
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
          added_by: userId,
          slot_index: index + 1,
        })));
      if (inviteError) {
        Alert.alert('Match created', 'The match was created, but one or more invitations could not be added.');
      }
    }

    setSaving(false);
    if (error) {
      Alert.alert('Unable to create match', error.message);
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
        weather={wheelWeather}
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
  weather,
  onSave,
  onDismiss,
}: {
  visible: boolean;
  date: Date;
  time: string | null;
  duration: number;
  weather: ReturnType<typeof useHourlyWeather>['wheelWeather'];
  onSave: (date: Date, time: string, duration: number) => void;
  onDismiss: () => void;
}) {
  const { theme } = useTheme();
  const [draftDate, setDraftDate] = useState(date);
  const [draftTime, setDraftTime] = useState<string | null>(time);
  const [draftDuration, setDraftDuration] = useState(duration);
  const [moreDates, setMoreDates] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setDraftDate(date);
    setDraftTime(time);
    setDraftDuration(duration);
    setMoreDates(![dateKey(DATES[0]), dateKey(DATES[1])].includes(dateKey(date)));
  }, [visible, date, time, duration]);

  return (
    <SheetFrame visible={visible} title="Date & Time" onDismiss={onDismiss}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
        <View style={styles.segmentRow}>
          {[
            { label: 'Today', date: DATES[0] },
            { label: 'Tomorrow', date: DATES[1] },
          ].map(item => {
            const active = !moreDates && dateKey(draftDate) === dateKey(item.date);
            return (
              <TouchableOpacity
                key={item.label}
                style={[styles.segment, { borderColor: active ? Colors.blue : theme.border, backgroundColor: active ? theme.selectedBg : theme.cardBg }]}
                onPress={() => { setDraftDate(item.date); setMoreDates(false); }}>
                <Text style={[styles.segmentText, { color: active ? Colors.blue : theme.textSecondary }]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={[styles.segment, { borderColor: moreDates ? Colors.blue : theme.border, backgroundColor: moreDates ? theme.selectedBg : theme.cardBg }]}
            onPress={() => setMoreDates(true)}>
            <Text style={[styles.segmentText, { color: moreDates ? Colors.blue : theme.textSecondary }]}>More Dates</Text>
          </TouchableOpacity>
        </View>

        {moreDates && (
          <View style={styles.dateGrid}>
            {DATES.map(item => {
              const active = dateKey(item) === dateKey(draftDate);
              return (
                <TouchableOpacity
                  key={dateKey(item)}
                  style={[styles.dateCell, { backgroundColor: active ? Colors.blue : theme.surface2 }]}
                  onPress={() => setDraftDate(item)}>
                  <Text style={[styles.dateDow, { color: active ? Colors.white : theme.textMuted }]}>{item.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</Text>
                  <Text style={[styles.dateNumber, { color: active ? Colors.white : theme.textPrimary }]}>{item.getDate()}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={styles.sheetSectionHeader}>
          <Clock3 size={20} color={Colors.blue} />
          <Text style={[styles.sheetSectionTitle, { color: theme.textPrimary }]}>Choose Start Time</Text>
        </View>
        <TimeSlotWheel
          slots={TIME_SLOTS}
          selectedSlot={draftTime}
          onSelectSlot={setDraftTime}
          weather={weather}
          outdoor
          showWeatherFallback
          sheetDate={draftDate}
          now={today}
          theme={theme}
        />

        <Text style={[styles.sheetSectionTitle, { color: theme.textPrimary }]}>Duration</Text>
        <View style={styles.durationRow}>
          {[60, 90, 120].map(value => (
            <TouchableOpacity
              key={value}
              style={[styles.durationChip, { borderColor: draftDuration === value ? Colors.blue : theme.border, backgroundColor: draftDuration === value ? theme.selectedBg : theme.cardBg }]}
              onPress={() => setDraftDuration(value)}>
              <Text style={[styles.durationText, { color: draftDuration === value ? Colors.blue : theme.textSecondary }]}>{value} min</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
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
      const [{ data: memberships }, { data: profile }, { data: allCourts }] = await Promise.all([
        supabase.from('hoa_memberships').select('hoa_id').eq('user_id', user.id).eq('status', 'approved'),
        supabase.from('profiles').select('home_court_id, preferred_court_locations').eq('id', user.id).maybeSingle(),
        (supabase as any).from('courts').select('id, name, hoa_id, hoas(name, address)').limit(100),
      ]);
      const hoaIds = new Set((memberships ?? []).map(item => item.hoa_id));
      const mapped: MatchLocation[] = (allCourts ?? []).map((court: any) => ({
        id: court.id,
        name: court.name,
        city: court.hoas?.address || court.hoas?.name || 'Puerto Rico',
        distance: '',
        source: hoaIds.has(court.hoa_id) ? 'hoa' : (profile?.home_court_id === court.id ? 'club' : 'directory'),
      }));
      if (profile?.preferred_court_locations && !mapped.some(item => item.source === 'club')) {
        mapped.push({
          id: null,
          name: profile.preferred_court_locations,
          city: 'Favorite club',
          distance: '',
          source: 'club',
        });
      }
      setLocations(mapped);
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
              {source === 'hoa' ? 'No HOA tennis facilities are linked to your account.' : source === 'club' ? 'No favorite club is set.' : 'No facilities match your search.'}
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
  dateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  dateCell: { width: '17.8%', minHeight: 62, borderRadius: Radius.chip, alignItems: 'center', justifyContent: 'center' },
  dateDow: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 10 },
  dateNumber: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 19, marginTop: 3 },
  sheetSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  sheetSectionTitle: { fontFamily: FontFamily.spaceGroteskBold, fontSize: FontSize.cardTitle, marginVertical: 12 },
  durationRow: { flexDirection: 'row', gap: 9, marginBottom: 8 },
  durationChip: { flex: 1, minHeight: 46, borderWidth: 1, borderRadius: Radius.chip, alignItems: 'center', justifyContent: 'center' },
  durationText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label },
  sheetSave: { minHeight: 52, backgroundColor: Colors.blue, borderRadius: Radius.button, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  locationSearch: { minHeight: 52, borderWidth: 1, borderRadius: Radius.input, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, marginBottom: 8 },
  locationSearchInput: { flex: 1, fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body },
  locationOption: { minHeight: 76, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  locationState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyLocations: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, lineHeight: 24, textAlign: 'center', padding: 28 },
});
