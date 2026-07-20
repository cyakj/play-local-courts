import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react-native';

import { ScheduleTimePicker } from '@/components/coach/schedule/ScheduleTimePicker';
import { MatchCard } from '@/components/match/MatchCard';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';

type MatchFormat = 'singles' | 'doubles' | 'casual_hit';
type MatchKind = 'all' | 'casual' | 'competitive';
type PlayWith = 'men' | 'women' | 'mixed' | 'all';
type TimeMode = 'all_day' | 'morning' | 'afternoon' | 'evening' | 'specific';

export interface DiscoveryFilters {
  dates: string[];
  timeMode: TimeMode;
  startTime: string;
  endTime: string;
  format: MatchFormat | null;
  playWith: PlayWith[];
  ntrpMin: number;
  ntrpMax: number;
  distanceMiles: number;
}

interface Listing {
  id: string;
  creator_id: string;
  format: MatchFormat;
  match_type: Exclude<MatchKind, 'all'>;
  play_with: PlayWith;
  match_date: string;
  start_time: string;
  end_time: string;
  utr_min: number;
  utr_max: number;
  ntrp_min?: number;
  ntrp_max?: number;
  location: string;
  court_reserved?: boolean;
  duration_minutes?: number;
  note: string | null;
  creator?: { full_name: string | null; avatar_url: string | null } | null;
}

const today = new Date();
today.setHours(0, 0, 0, 0);

const DATE_OPTIONS = Array.from({ length: 15 }, (_, index) => {
  const value = new Date(today);
  value.setDate(today.getDate() + index);
  return {
    date: value,
    key: toDateKey(value),
    day: value.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    number: value.getDate(),
    month: value.toLocaleDateString('en-US', { month: 'short' }),
  };
});

const DEFAULT_FILTERS: DiscoveryFilters = {
  dates: [],
  timeMode: 'all_day',
  startTime: '16:00',
  endTime: '19:00',
  format: null,
  playWith: ['all'],
  ntrpMin: 1,
  ntrpMax: 7,
  distanceMiles: 25,
};

const INITIAL_FILTERS: DiscoveryFilters = {
  ...DEFAULT_FILTERS,
  dates: [DATE_OPTIONS[1].key],
};

const TIME_OPTIONS: { value: TimeMode; label: string; detail: string }[] = [
  { value: 'all_day', label: 'All day', detail: '' },
  { value: 'morning', label: 'Morning', detail: '6:00 AM - 12:00 PM' },
  { value: 'afternoon', label: 'Afternoon', detail: '12:00 PM - 6:00 PM' },
  { value: 'evening', label: 'Evening', detail: '6:00 PM - 12:00 AM' },
  { value: 'specific', label: 'Specific hours', detail: 'Max. 6 hours' },
];

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatTime(value: string) {
  const [hourString, minute = '00'] = value.slice(0, 5).split(':');
  const hour = Number(hourString);
  const period = hour >= 12 ? 'PM' : 'AM';
  const normalized = hour % 12 || 12;
  return minute === '00' ? `${normalized} ${period}` : `${normalized}:${minute} ${period}`;
}

function minutes(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function dateLabel(dates: string[]) {
  if (dates.length === 0) return 'Any Date';
  if (dates.length > 1) return `${dates.length} Days`;
  if (dates[0] === DATE_OPTIONS[0].key) return 'Today';
  if (dates[0] === DATE_OPTIONS[1].key) return 'Tomorrow';
  const date = new Date(`${dates[0]}T00:00:00`);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function timeLabel(filters: DiscoveryFilters) {
  if (filters.timeMode === 'all_day') return 'All day';
  if (filters.timeMode === 'specific') {
    return `${formatTime(filters.startTime)} - ${formatTime(filters.endTime)}`;
  }
  return TIME_OPTIONS.find(option => option.value === filters.timeMode)?.label ?? 'All day';
}

function scheduleLabel(filters: DiscoveryFilters) {
  return `${dateLabel(filters.dates)}, ${timeLabel(filters)}`;
}

function formatLabel(format: MatchFormat) {
  if (format === 'casual_hit') return 'Casual Hit';
  return format === 'singles' ? 'Singles' : 'Doubles';
}

function selectionTimeRange(filters: DiscoveryFilters): [number, number] | null {
  switch (filters.timeMode) {
    case 'morning': return [360, 720];
    case 'afternoon': return [720, 1080];
    case 'evening': return [1080, 1440];
    case 'specific': return [minutes(filters.startTime), minutes(filters.endTime)];
    default: return null;
  }
}

function DateTimeSheet({
  visible,
  filters,
  onApply,
  onDismiss,
}: {
  visible: boolean;
  filters: DiscoveryFilters;
  onApply: (filters: DiscoveryFilters) => void;
  onDismiss: () => void;
}) {
  const { theme } = useTheme();
  const [draft, setDraft] = useState(filters);
  const [dateScrolled, setDateScrolled] = useState(false);

  useEffect(() => {
    if (visible) setDraft(filters);
    setDateScrolled(false);
  }, [visible, filters]);

  function toggleDate(key: string) {
    setDraft(current => {
      const selected = current.dates.includes(key);
      if (!selected && current.dates.length >= 7) {
        Alert.alert('Maximum 7 days', 'You can select up to 7 days.');
        return current;
      }
      return {
        ...current,
        dates: selected ? current.dates.filter(date => date !== key) : [...current.dates, key],
      };
    });
  }

  function apply() {
    if (draft.timeMode === 'specific') {
      const duration = minutes(draft.endTime) - minutes(draft.startTime);
      if (duration <= 0 || duration > 360) {
        Alert.alert('Choose a valid time window', 'Specific hours must be after the start time and no longer than 6 hours.');
        return;
      }
    }
    onApply(draft);
    onDismiss();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={[styles.backdrop, { backgroundColor: theme.backdrop }]}>
        <TouchableOpacity style={styles.backdropTap} onPress={onDismiss} />
        <View style={[styles.sheet, { backgroundColor: theme.sheetBg }, theme.shadowSheet]}>
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>When do you want to play?</Text>
            <TouchableOpacity style={styles.iconButton} onPress={onDismiss}>
              <X size={24} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Choose your days (max. 7)</Text>
            <Text style={[styles.sectionHelp, { color: theme.textSecondary }]}>You can select up to 7 days</Text>
            <View style={{ position: 'relative' }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dateRow}
                onScroll={(e) => { if (!dateScrolled && e.nativeEvent.contentOffset.x > 8) setDateScrolled(true); }}
                scrollEventThrottle={32}>
                {DATE_OPTIONS.map(option => {
                  const active = draft.dates.includes(option.key);
                  return (
                    <TouchableOpacity key={option.key} style={styles.dateOption} onPress={() => toggleDate(option.key)}>
                      <Text style={[styles.dateDay, { color: active ? Colors.cyan : theme.textMuted }]}>{option.day}</Text>
                      <View style={[styles.dateNumber, active && { backgroundColor: Colors.courtBlue, borderColor: Colors.cyan }]}>
                        <Text style={[styles.dateNumberText, { color: active ? Colors.white : theme.textPrimary }]}>{option.number}</Text>
                      </View>
                      <Text style={[styles.dateMonth, { color: theme.textSecondary }]}>{option.month}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              {!dateScrolled && (
                <View pointerEvents="none" style={styles.dateScrollHint}>
                  <View style={[styles.dateScrollHintBadge, { backgroundColor: theme.sheetBg, borderColor: theme.border }]}>
                    <ChevronRight size={14} color={Colors.blue} strokeWidth={2} />
                  </View>
                </View>
              )}
            </View>

            <Text style={[styles.sectionTitle, styles.timeHeading, { color: theme.textPrimary }]}>Choose your time</Text>
            {TIME_OPTIONS.map(option => {
              const active = draft.timeMode === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={styles.radioRow}
                  onPress={() => setDraft(current => ({ ...current, timeMode: option.value }))}>
                  <View style={[styles.radio, { borderColor: active ? Colors.blue : theme.borderStrong }]}>
                    {active && <View style={styles.radioDot} />}
                  </View>
                  <Text style={[styles.radioLabel, { color: theme.textPrimary }]}>{option.label}</Text>
                  {!!option.detail && <Text style={[styles.radioDetail, { color: theme.textSecondary }]}>{option.detail}</Text>}
                </TouchableOpacity>
              );
            })}

            {draft.timeMode === 'specific' && (
              <View style={styles.pickerGrid}>
                <ScheduleTimePicker
                  label="START TIME"
                  value={draft.startTime}
                  onChange={startTime => setDraft(current => ({ ...current, startTime }))}
                />
                <ScheduleTimePicker
                  label="END TIME"
                  value={draft.endTime}
                  onChange={endTime => setDraft(current => ({ ...current, endTime }))}
                />
              </View>
            )}
            <View style={{ height: 100 }} />
          </ScrollView>

          <View style={[styles.fixedCta, { backgroundColor: theme.sheetBg, borderTopColor: theme.border }]}>
            <TouchableOpacity style={styles.primaryButton} onPress={apply}>
              <Text style={styles.primaryButtonText}>See Results</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  radio = false,
  onPress,
}: {
  label: string;
  description?: string;
  checked: boolean;
  radio?: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      accessibilityRole={radio ? 'radio' : 'checkbox'}
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={styles.toggleRow}
      onPress={onPress}>
      <View style={[
        radio ? styles.radio : styles.checkbox,
        {
          borderColor: checked ? Colors.blue : theme.borderStrong,
          backgroundColor: checked && !radio ? Colors.blue : 'transparent',
        },
      ]}>
        {checked && (radio ? <View style={styles.radioDot} /> : <Check size={15} color={Colors.white} />)}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.toggleLabel, { color: theme.textPrimary }]}>{label}</Text>
        {!!description && <Text style={[styles.toggleDescription, { color: theme.textSecondary }]}>{description}</Text>}
      </View>
    </TouchableOpacity>
  );
}

function ContinuousSlider({
  label,
  value,
  min,
  max,
  step,
  suffix = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  const { theme } = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const percent = (value - min) / (max - min);

  function updateFromX(x: number) {
    if (!trackWidth) return;
    const raw = min + Math.max(0, Math.min(1, x / trackWidth)) * (max - min);
    const snapped = Math.round(raw / step) * step;
    onChange(Number(Math.max(min, Math.min(max, snapped)).toFixed(step < 1 ? 1 : 0)));
  }

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: event => updateFromX(event.nativeEvent.locationX),
    onPanResponderMove: event => updateFromX(event.nativeEvent.locationX),
  }), [trackWidth, min, max, step]);

  return (
    <View style={styles.sliderBlock}>
      <View style={styles.sliderHeader}>
        <Text style={[styles.sliderLabel, { color: theme.textPrimary }]}>{label}</Text>
        <Text style={styles.sliderValue}>{value.toFixed(step < 1 ? 1 : 0)}{suffix}</Text>
      </View>
      <View
        accessibilityLabel={`${label} ${value}${suffix}`}
        style={styles.sliderTouchArea}
        onLayout={event => setTrackWidth(event.nativeEvent.layout.width)}
        {...panResponder.panHandlers}>
        <View style={[styles.sliderTrack, { backgroundColor: theme.surface2 }]}>
          <View style={[styles.sliderFill, { width: `${percent * 100}%` }]} />
          <View style={[styles.sliderThumb, { left: `${percent * 100}%` }]} />
        </View>
      </View>
    </View>
  );
}

function MoreFiltersSheet({
  visible,
  filters,
  onApply,
  onClear,
  onDismiss,
}: {
  visible: boolean;
  filters: DiscoveryFilters;
  onApply: (filters: DiscoveryFilters) => void;
  onClear: () => void;
  onDismiss: () => void;
}) {
  const { theme } = useTheme();
  const [draft, setDraft] = useState(filters);

  useEffect(() => {
    if (visible) setDraft(filters);
  }, [visible, filters]);

  function togglePlayWith(value: PlayWith) {
    setDraft(current => {
      if (value === 'all') return { ...current, playWith: ['all'] };
      const base = current.playWith.filter(item => item !== 'all');
      const next = base.includes(value) ? base.filter(item => item !== value) : [...base, value];
      return { ...current, playWith: next.length ? next : ['all'] };
    });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={[styles.backdrop, { backgroundColor: theme.backdrop }]}>
        <View style={[styles.fullSheet, { backgroundColor: theme.sheetBg }]}>
          <View style={styles.moreHeader}>
            <TouchableOpacity style={styles.headerAction} onPress={onDismiss}>
              <Text style={[styles.headerActionText, { color: theme.textSecondary }]}>Back</Text>
            </TouchableOpacity>
            <Text style={[styles.moreTitle, { color: theme.textPrimary }]}>More Filters</Text>
            <TouchableOpacity
              style={styles.headerAction}
              onPress={() => {
                setDraft(DEFAULT_FILTERS);
                onClear();
                onDismiss();
              }}>
              <Text style={[styles.headerActionText, { color: Colors.cyan }]}>Clear All</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.moreContent} showsVerticalScrollIndicator={false}>
            <Text style={[styles.filterSectionTitle, { color: theme.textPrimary }]}>Match Format</Text>
            {([
              ['singles', 'Singles', '1 versus 1'],
              ['doubles', 'Doubles', '2 versus 2'],
            ] as const).map(([value, label, description]) => (
              <ToggleRow
                key={value}
                radio
                label={label}
                description={description}
                checked={draft.format === value}
                onPress={() => setDraft(current => ({ ...current, format: value }))}
              />
            ))}

            <Text style={[styles.filterSectionTitle, { color: theme.textPrimary }]}>Play With</Text>
            {([
              ['men', 'Men Only'],
              ['women', 'Women Only'],
              ['mixed', 'Mixed'],
              ['all', 'All Players'],
            ] as const).map(([value, label]) => (
              <ToggleRow
                key={value}
                label={label}
                description={value === 'mixed' ? 'One man and one woman on each doubles team.' : undefined}
                checked={draft.playWith.includes(value)}
                onPress={() => togglePlayWith(value)}
              />
            ))}

            <Text style={[styles.filterSectionTitle, { color: theme.textPrimary }]}>NTRP Range</Text>
            <ContinuousSlider label="Minimum NTRP" value={draft.ntrpMin} min={1} max={7} step={0.5} onChange={ntrpMin => setDraft(current => ({ ...current, ntrpMin: Math.min(ntrpMin, current.ntrpMax) }))} />
            <ContinuousSlider label="Maximum NTRP" value={draft.ntrpMax} min={1} max={7} step={0.5} onChange={ntrpMax => setDraft(current => ({ ...current, ntrpMax: Math.max(ntrpMax, current.ntrpMin) }))} />

            <Text style={[styles.filterSectionTitle, { color: theme.textPrimary }]}>Distance</Text>
            <ContinuousSlider label="Maximum distance" value={draft.distanceMiles} min={0} max={100} step={1} suffix=" mi" onChange={distanceMiles => setDraft(current => ({ ...current, distanceMiles }))} />
            <View style={{ height: 100 }} />
          </ScrollView>

          <View style={[styles.fixedCta, { backgroundColor: theme.sheetBg, borderTopColor: theme.border }]}>
            <TouchableOpacity style={styles.primaryButton} onPress={() => { onApply(draft); onDismiss(); }}>
              <Text style={styles.primaryButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function MatchDiscovery({ userId }: { userId: string }) {
  const { theme } = useTheme();
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [query, setQuery] = useState('');
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateSheet, setDateSheet] = useState(false);
  const [moreFilters, setMoreFilters] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  async function load() {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('open_match_listings')
      .select('*')
      .eq('status', 'open')
      .gte('match_date', DATE_OPTIONS[0].key)
      .lte('match_date', DATE_OPTIONS[14].key)
      .order('match_date')
      .order('start_time');
    if (error) {
      setListings([]);
    } else {
      const rows = (data ?? []) as Listing[];
      const creatorIds = [...new Set(rows.map(row => row.creator_id))];
      const { data: profiles } = creatorIds.length
        ? await supabase.from('profiles').select('id, full_name, avatar_url').in('id', creatorIds)
        : { data: [] };
      const profileMap = new Map((profiles ?? []).map(profile => [profile.id, profile]));
      setListings(rows.map(row => ({ ...row, creator: profileMap.get(row.creator_id) ?? null })));
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    if (!userId) return;
    const channel = supabase
      .channel(`match-discovery-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'open_match_listings' }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId]);

  const filtered = useMemo(() => {
    const range = selectionTimeRange(filters);
    return listings.filter(listing => {
      if (listing.creator_id === userId) return false;
      if (filters.dates.length && !filters.dates.includes(listing.match_date)) return false;
      if (filters.format && listing.format !== filters.format) return false;
      if (!filters.playWith.includes('all') && !filters.playWith.includes(listing.play_with)) return false;
      const listingNtrpMin = listing.ntrp_min ?? 1;
      const listingNtrpMax = listing.ntrp_max ?? 7;
      if (listingNtrpMax < filters.ntrpMin || listingNtrpMin > filters.ntrpMax) return false;
      if ((listing as Listing & { distance_miles?: number }).distance_miles != null
        && (listing as Listing & { distance_miles: number }).distance_miles > filters.distanceMiles) return false;
      if (range) {
        const start = minutes(listing.start_time);
        if (start < range[0] || start >= range[1]) return false;
      }
      if (query.trim()) {
        const haystack = `${listing.location} ${listing.note ?? ''} ${listing.creator?.full_name ?? ''}`.toLowerCase();
        if (!haystack.includes(query.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [filters, listings, query, userId]);

  async function join(listing: Listing) {
    setJoiningId(listing.id);
    const { error } = await (supabase as any).from('open_match_listing_participants').insert({
      listing_id: listing.id,
      user_id: userId,
    });
    setJoiningId(null);
    Alert.alert(error ? 'Unable to join' : 'Request sent', error?.message ?? 'The match creator can now confirm the details with you.');
  }

  return (
    <View style={styles.discovery}>
      <View style={[styles.searchBar, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
        <Search size={22} color={theme.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          style={[styles.searchInput, { color: theme.textPrimary }]}
          placeholder="Search matches or locations"
          placeholderTextColor={theme.textDisabled}
        />
      </View>

      <View style={styles.filterToolbar}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="More Filters"
          style={[styles.filterIcon, { borderColor: theme.border }]}
          onPress={() => setMoreFilters(true)}>
          <SlidersHorizontal size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Schedule filter: ${scheduleLabel(filters)}`}
            style={[styles.filterChip, { backgroundColor: theme.chipActiveBg }]}
            onPress={() => setDateSheet(true)}>
            <Text style={styles.filterChipText}>{scheduleLabel(filters)}</Text>
            <ChevronDown size={15} color={Colors.white} />
          </TouchableOpacity>
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={Colors.cyan} /></View>
      ) : filtered.length ? (
        <View style={styles.list}>
          <Text style={[styles.resultsTitle, { color: theme.textPrimary }]}>Matches near you</Text>
          {filtered.map(listing => (
            <MatchCard
              key={listing.id}
              match={listing}
              onPress={() => router.push(`/match/${listing.id}` as any)}
              onJoin={() => join(listing)}
              joining={joiningId === listing.id}
              theme={theme}
            />
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIllustration, { backgroundColor: theme.surface2 }]}>
            <Users size={58} color={Colors.cyan} strokeWidth={1.4} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No Matches Found</Text>
          <Text style={[styles.emptyDescription, { color: theme.textSecondary }]}>
            No open matches match your filters. Adjust filters above or create one with "Create Match".
          </Text>
        </View>
      )}

      <DateTimeSheet visible={dateSheet} filters={filters} onApply={setFilters} onDismiss={() => setDateSheet(false)} />
      <MoreFiltersSheet
        visible={moreFilters}
        filters={filters}
        onApply={setFilters}
        onClear={() => setFilters(DEFAULT_FILTERS)}
        onDismiss={() => setMoreFilters(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  discovery: { paddingTop: 20 },
  searchBar: { minHeight: 56, marginHorizontal: Spacing.pagePx, borderWidth: 1, borderRadius: Radius.lg, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  searchInput: { flex: 1, fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body },
  filterToolbar: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  filterIcon: { width: 52, height: 48, marginLeft: Spacing.pagePx, borderWidth: 1, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  chipRow: { paddingHorizontal: 10, paddingRight: Spacing.pagePx, gap: 8 },
  filterChip: { minHeight: 48, borderRadius: Radius.pill, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 7 },
  filterChipText: { color: Colors.white, fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label },
  loading: { minHeight: 280, alignItems: 'center', justifyContent: 'center' },
  list: { padding: Spacing.pagePx, gap: 14 },
  resultsTitle: { fontFamily: FontFamily.spaceGroteskBold, fontSize: FontSize.sectionTitle, marginTop: 4 },
  emptyState: { minHeight: 430, paddingHorizontal: 28, paddingTop: 48, alignItems: 'center' },
  emptyIllustration: { width: 150, height: 130, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { marginTop: 24, fontFamily: FontFamily.spaceGroteskBold, fontSize: 24, textAlign: 'center' },
  emptyDescription: { marginTop: 14, fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, lineHeight: 25, textAlign: 'center' },
  createButton: { marginTop: 24, minHeight: 52, borderRadius: Radius.button, paddingHorizontal: 34, alignItems: 'center', justifyContent: 'center' },
  createButtonText: { color: Colors.white, fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  backdropTap: { flex: 1 },
  sheet: { height: '82%', borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, paddingTop: 18, paddingHorizontal: Spacing.pagePx, overflow: 'hidden' },
  fullSheet: { flex: 1, paddingTop: 18, paddingHorizontal: Spacing.pagePx },
  sheetHeader: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { flex: 1, fontFamily: FontFamily.spaceGroteskBold, fontSize: 24 },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontFamily: FontFamily.spaceGroteskBold, fontSize: FontSize.cardTitle, marginTop: 18 },
  sectionHelp: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, marginTop: 4 },
  dateRow: { paddingVertical: 24, gap: 8 },
  dateScrollHint: { position: 'absolute', right: 0, top: 24, bottom: 0, justifyContent: 'center' },
  dateScrollHintBadge: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingLeft: 1 },
  dateOption: { width: 66, alignItems: 'center', gap: 7 },
  dateDay: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.label },
  dateNumber: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  dateNumberText: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 20 },
  dateMonth: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label },
  timeHeading: { marginBottom: 8 },
  radioRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14 },
  radio: { width: 28, height: 28, borderRadius: 14, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.blue },
  radioLabel: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body },
  radioDetail: { flex: 1, fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label },
  pickerGrid: { gap: 16, marginTop: 16 },
  fixedCta: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: 1, padding: Spacing.pagePx, paddingBottom: 34 },
  primaryButton: { minHeight: 52, backgroundColor: Colors.blue, borderRadius: Radius.button, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: Colors.white, fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body },
  moreHeader: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  moreTitle: { fontFamily: FontFamily.spaceGroteskBold, fontSize: FontSize.cardTitle },
  headerAction: { minWidth: 76, minHeight: 48, justifyContent: 'center' },
  headerActionText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label },
  moreContent: { paddingBottom: 30 },
  filterSectionTitle: { fontFamily: FontFamily.spaceGroteskBold, fontSize: FontSize.cardTitle, marginTop: 24, marginBottom: 8 },
  toggleRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14 },
  checkbox: { width: 28, height: 28, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  toggleLabel: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body },
  toggleDescription: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, lineHeight: 20, marginTop: 2 },
  sliderBlock: { marginTop: 14, gap: 12 },
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sliderLabel: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body },
  sliderValue: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.label, color: Colors.cyan },
  sliderTouchArea: { height: 44, justifyContent: 'center' },
  sliderTrack: { height: 6, borderRadius: 3, position: 'relative' },
  sliderFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3, backgroundColor: Colors.blue },
  sliderThumb: { position: 'absolute', top: -7, width: 20, height: 20, marginLeft: -10, borderRadius: 10, backgroundColor: Colors.blue, borderWidth: 3, borderColor: Colors.white },
});
