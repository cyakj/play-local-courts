// src/components/match/steps/StepLocation.tsx
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Search } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import type { MatchLocation } from '@/hooks/createMatchDraft';

type LocationTab = 'hoa' | 'club' | 'directory';

const TABS: { value: LocationTab; label: string }[] = [
  { value: 'hoa', label: 'My HOA' },
  { value: 'club', label: 'My Club' },
  { value: 'directory', label: 'Other Locations' },
];

// Tap feedback: scale(0.97) at 140ms with a snappy ease — matches DESIGN.md's
// documented Interaction Pattern ("Tap feedback: scale(0.97) at --t-fast with
// --ease-snap") and the Animated-driven treatment StepActivity/StepProgress
// use elsewhere in this same wizard. Applied here to the tab row, which — like
// StepActivity's ACTIVITY/FORMAT options — is a fixed, known-length set, so a
// one-Animated.Value-per-item ref array is safe. The options list below is
// dynamic (async-loaded, search-filtered), so it keeps plain TouchableOpacity
// + activeOpacity instead of a per-row Animated.Value.
const EASE_SNAP = Easing.bezier(0.34, 1.56, 0.64, 1);
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function animatePressScale(value: Animated.Value, toValue: number) {
  Animated.timing(value, { toValue, duration: 140, easing: EASE_SNAP, useNativeDriver: true }).start();
}

interface Props {
  location: MatchLocation | null;
  onSelect: (loc: MatchLocation) => void;
}

export function StepLocation({ location, onSelect }: Props) {
  const { theme } = useTheme();
  const [tab, setTab] = useState<LocationTab>('hoa');
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<MatchLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFocused, setSearchFocused] = useState(false);

  const tabScales = useRef(TABS.map(() => new Animated.Value(1))).current;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      if (tab === 'hoa') {
        const { data: memberships } = await supabase.from('hoa_memberships').select('hoa_id').eq('user_id', user.id).eq('status', 'approved');
        const hoaIds = (memberships ?? []).map(m => m.hoa_id);
        const { data: courts } = hoaIds.length
          ? await (supabase as any).from('courts').select('id, name, hoa_id, hoas(name, address)').in('hoa_id', hoaIds).eq('court_type', 'tennis')
          : { data: [] };
        if (!cancelled) {
          setOptions((courts ?? []).map((c: any) => ({ id: c.id, name: c.name, city: c.hoas?.address ?? '', distance: '', source: 'hoa' as const })));
        }
      } else if (tab === 'directory') {
        const { data: facilities } = await (supabase as any).from('tennis_facilities').select('id, name, city').eq('is_active', true).order('name');
        if (!cancelled) {
          setOptions((facilities ?? []).map((f: any) => ({ id: f.id, name: f.name, city: f.city, distance: '', source: 'directory' as const })));
        }
      } else {
        if (!cancelled) setOptions([]); // My Club: no club-membership table wired yet in the existing app — preserved as an empty state, matching today's behavior
      }
      if (!cancelled) setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [tab]);

  const filtered = query.trim()
    ? options.filter(o => o.name.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>LOCATION</Text>

      <View style={styles.tabRow}>
        {TABS.map((t, i) => {
          const active = tab === t.value;
          const scale = tabScales[i];
          return (
            <AnimatedTouchable
              key={t.value}
              style={[
                styles.tab,
                { borderColor: active ? Colors.blue : theme.border, backgroundColor: active ? theme.selectedBg : theme.cardBg },
                { transform: [{ scale }] },
              ]}
              onPress={() => setTab(t.value)}
              onPressIn={() => animatePressScale(scale, 0.97)}
              onPressOut={() => animatePressScale(scale, 1)}
              activeOpacity={0.85}>
              <Text style={[styles.tabText, { color: active ? Colors.blue : theme.textSecondary }]}>{t.label}</Text>
            </AnimatedTouchable>
          );
        })}
      </View>

      <View
        style={[
          styles.search,
          { backgroundColor: theme.inputBg, borderColor: searchFocused ? Colors.cyan : theme.border },
          searchFocused && styles.searchFocusGlow,
        ]}>
        <Search size={20} color={theme.textMuted} strokeWidth={1.5} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          style={[styles.searchInput, { color: theme.textPrimary }]}
          placeholder="Search locations"
          placeholderTextColor={theme.textDisabled}
        />
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.cyan} style={{ marginTop: 24 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {filtered.map(opt => {
            const active = location?.id === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[styles.option, { borderBottomColor: theme.border, backgroundColor: active ? theme.selectedBg : 'transparent' }]}
                onPress={() => onSelect(opt)}
                activeOpacity={0.7}>
                <Text style={[styles.optionName, { color: active ? Colors.blue : theme.textPrimary }]}>{opt.name}</Text>
                {!!opt.city && <Text style={[styles.optionCity, { color: theme.textSecondary }]}>{opt.city}</Text>}
              </TouchableOpacity>
            );
          })}
          {!loading && !filtered.length && (
            <Text style={[styles.empty, { color: theme.textSecondary }]}>
              {tab === 'club' ? 'Club locations are coming soon.' : 'Nothing here yet.'}
            </Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: Spacing.pagePx, gap: 10 },
  sectionLabel: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.eyebrow, letterSpacing: 1.2, marginBottom: 2 },
  tabRow: { flexDirection: 'row', gap: 8 },
  tab: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: Radius.chip, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  tabText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label, textAlign: 'center' },
  search: { minHeight: 52, borderWidth: 1, borderRadius: Radius.input, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  searchFocusGlow: {
    shadowColor: Colors.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: { flex: 1, fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body },
  option: { minHeight: 64, borderBottomWidth: 1, justifyContent: 'center', paddingHorizontal: 4 },
  optionName: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body },
  optionCity: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, marginTop: 2 },
  empty: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, textAlign: 'center', padding: 28 },
});
