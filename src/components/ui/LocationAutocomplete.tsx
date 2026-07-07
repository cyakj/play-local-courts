import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MapPin, Search } from 'lucide-react-native';

import { Colors, FontFamily, FontSize, Radius } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import { isMapboxConfigured } from '@/config/mapbox';
import {
  createSessionToken,
  retrieveLocation,
  suggestLocations,
  type LocationSuggestion,
  type LocationValue,
} from '@/lib/mapboxSearch';

const DEBOUNCE_MS = 500;
const MIN_QUERY_LENGTH = 3;

interface LocationAutocompleteProps {
  value: LocationValue | null;
  onChange: (value: LocationValue | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function LocationAutocomplete({
  value,
  onChange,
  placeholder = 'City, neighborhood, or community',
  disabled = false,
}: LocationAutocompleteProps) {
  const { theme } = useTheme();
  const styles = useStyles();

  const [query, setQuery] = useState(value?.display_name ?? '');
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [retrieving, setRetrieving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sessionTokenRef = useRef(createSessionToken());

  // Keep the input text in sync when the confirmed value changes externally
  // (e.g. loading a saved profile), without clobbering in-progress typing.
  useEffect(() => {
    setQuery(value?.display_name ?? '');
  }, [value?.mapbox_place_id]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  function cancelPending() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();
  }

  function handleChangeText(text: string) {
    setQuery(text);
    setError(null);

    if (value !== null) {
      onChange(null);
    }

    cancelPending();

    const trimmed = text.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;

      suggestLocations(trimmed, sessionTokenRef.current, controller.signal)
        .then(results => {
          setSuggestions(results);
          setLoading(false);
        })
        .catch(err => {
          if (err?.name === 'AbortError') return;
          setError('Could not search locations. Check your connection and try again.');
          setSuggestions([]);
          setLoading(false);
        });
    }, DEBOUNCE_MS);
  }

  async function handleSelect(suggestion: LocationSuggestion) {
    cancelPending();
    setSuggestions([]);
    setRetrieving(true);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const location = await retrieveLocation(suggestion.mapboxId, sessionTokenRef.current, controller.signal);
      if (!location) {
        setError('Could not load that location. Please try another.');
        setRetrieving(false);
        return;
      }
      onChange(location);
      setQuery(location.display_name);
      sessionTokenRef.current = createSessionToken();
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setError('Could not load that location. Please try another.');
    } finally {
      setRetrieving(false);
    }
  }

  function handleBlur() {
    setFocused(false);
    // Revert stray text that was never confirmed via selection.
    if (query !== (value?.display_name ?? '')) {
      setQuery(value?.display_name ?? '');
    }
    setSuggestions([]);
    setError(null);
  }

  const showDropdown = focused && (loading || retrieving || error || suggestions.length > 0 ||
    (query.trim().length >= MIN_QUERY_LENGTH && !loading));

  if (!isMapboxConfigured) {
    return (
      <View>
        <View style={[styles.inputWrap, { borderColor: theme.border, backgroundColor: theme.inputBg, opacity: 0.6 }]}>
          <Search size={16} color={theme.textDisabled} strokeWidth={1.75} />
          <Text style={[styles.input, { color: theme.textDisabled }]} numberOfLines={1}>
            Location search unavailable
          </Text>
        </View>
        {__DEV__ && (
          <Text style={styles.devWarning}>
            EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN is not set — add it to .env to enable location search.
          </Text>
        )}
      </View>
    );
  }

  return (
    <View>
      <View
        style={[
          styles.inputWrap,
          { borderColor: theme.border, backgroundColor: theme.inputBg },
          focused && styles.inputWrapFocused,
        ]}>
        <Search size={16} color={theme.textMuted} strokeWidth={1.75} />
        <TextInput
          style={[styles.input, { color: theme.textPrimary }]}
          value={query}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textDisabled}
          autoCapitalize="words"
          autoCorrect={false}
          autoComplete="off"
          returnKeyType="search"
          editable={!disabled}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          accessibilityLabel="Location search"
          accessibilityHint="Type at least 3 characters to search, then select a suggestion"
        />
        {(loading || retrieving) && <ActivityIndicator size="small" color={Colors.cyan} />}
      </View>

      {showDropdown && (
        <View style={[styles.dropdown, { borderColor: theme.border, backgroundColor: theme.cardBg }]}>
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : loading || retrieving ? (
            <View style={styles.centerRow}>
              <ActivityIndicator size="small" color={Colors.cyan} />
              <Text style={styles.mutedText}>Searching...</Text>
            </View>
          ) : suggestions.length === 0 ? (
            <Text style={styles.mutedText}>No locations found</Text>
          ) : (
            suggestions.map((s, idx) => (
              <TouchableOpacity
                key={s.mapboxId}
                style={[styles.suggestionRow, idx < suggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}
                onPress={() => handleSelect(s)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Select ${s.name}, ${s.placeFormatted}`}>
                <MapPin size={16} color={theme.textMuted} strokeWidth={1.75} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.suggestionName, { color: theme.textPrimary }]} numberOfLines={1}>
                    {s.name}
                  </Text>
                  {!!s.placeFormatted && (
                    <Text style={[styles.suggestionDetail, { color: theme.textMuted }]} numberOfLines={1}>
                      {s.placeFormatted}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}
    </View>
  );
}

function useStyles() {
  return useMemo(() => StyleSheet.create({
    inputWrap: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      borderWidth: 1.5, borderRadius: Radius.sm, paddingHorizontal: 14, paddingVertical: 14,
      outlineWidth: 0,
    } as any,
    inputWrapFocused: { borderColor: Colors.blue, borderWidth: 1.5 },
    input: { flex: 1, fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body },

    dropdown: {
      marginTop: 6, borderWidth: 1, borderRadius: Radius.sm, overflow: 'hidden',
    },
    suggestionRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 14, paddingVertical: 12,
    },
    suggestionName: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label },
    suggestionDetail: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.metadata, marginTop: 2 },

    centerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 14 },
    mutedText: {
      fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label,
      color: Colors.fg3, paddingHorizontal: 14, paddingVertical: 14,
    },
    errorText: {
      fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label,
      color: Colors.negative, paddingHorizontal: 14, paddingVertical: 14,
    },
    devWarning: {
      fontFamily: FontFamily.manropeMedium, fontSize: FontSize.metadata,
      color: Colors.negative, marginTop: 6,
    },
  }), []);
}
