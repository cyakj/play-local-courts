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
import {
  createSessionToken,
  retrieveLocation,
  suggestLocations,
} from '@/lib/mapboxSearch';
import {
  LocationProviderError,
  describeProviderFailure,
  isLocalLocationId,
  localLocationFromId,
  searchLocalLocations,
  type FailureNotice,
  type LocationSuggestion,
  type LocationValue,
} from '@/lib/locationSearch';

const DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 3;
// Give a tap on a suggestion time to land before blur tears the dropdown down.
const BLUR_GRACE_MS = 200;

interface LocationAutocompleteProps {
  value: LocationValue | null;
  onChange: (value: LocationValue | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Online search uses Mapbox. When the provider cannot answer (offline, token rejected,
 * rate limited, server error) the field falls back to the bundled list of Puerto Rico
 * municipios, so a resident can always pick their municipio — and the message says what
 * actually went wrong instead of blaming the connection.
 */
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
  const [notice, setNotice] = useState<FailureNotice | null>(null);
  const [searched, setSearched] = useState(false);
  const [focused, setFocused] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      if (blurRef.current) clearTimeout(blurRef.current);
      abortRef.current?.abort();
    };
  }, []);

  function cancelPending() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();
  }

  function handleChangeText(text: string) {
    setQuery(text);
    setNotice(null);
    setSearched(false);

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
          setSearched(true);
          setLoading(false);
        })
        .catch(err => {
          if (err?.name === 'AbortError') return;
          const kind = err instanceof LocationProviderError ? err.kind : 'offline';
          const local = searchLocalLocations(trimmed);
          setSuggestions(local);
          setNotice(describeProviderFailure(kind, local.length > 0));
          setSearched(true);
          setLoading(false);
        });
    }, DEBOUNCE_MS);
  }

  async function handleSelect(suggestion: LocationSuggestion) {
    cancelPending();
    if (blurRef.current) clearTimeout(blurRef.current);
    setSuggestions([]);
    setNotice(null);

    // Bundled municipio: no network needed.
    if (isLocalLocationId(suggestion.mapboxId)) {
      const local = localLocationFromId(suggestion.mapboxId);
      if (local) {
        onChange(local);
        setQuery(local.display_name);
        setFocused(false);
      }
      return;
    }

    setRetrieving(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const location = await retrieveLocation(suggestion.mapboxId, sessionTokenRef.current, controller.signal);
      if (!location) {
        setNotice({ tone: 'error', message: 'Could not load that location. Please try another.' });
        setRetrieving(false);
        return;
      }
      onChange(location);
      setQuery(location.display_name);
      setFocused(false);
      sessionTokenRef.current = createSessionToken();
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      const kind = err instanceof LocationProviderError ? err.kind : 'offline';
      // Fall back to the municipio of the chosen suggestion when we have it bundled.
      const local = searchLocalLocations(suggestion.name, 1)[0];
      const fallback = local ? localLocationFromId(local.mapboxId) : null;
      if (fallback && fallback.display_name.toLowerCase() === suggestion.name.toLowerCase()) {
        onChange(fallback);
        setQuery(fallback.display_name);
        setFocused(false);
      } else {
        setNotice(describeProviderFailure(kind, false));
      }
    } finally {
      setRetrieving(false);
    }
  }

  function handleBlur() {
    if (blurRef.current) clearTimeout(blurRef.current);
    blurRef.current = setTimeout(() => {
      setFocused(false);
      // Revert stray text that was never confirmed via selection.
      setQuery(q => (q !== (value?.display_name ?? '') ? (value?.display_name ?? '') : q));
      setSuggestions([]);
      setNotice(null);
    }, BLUR_GRACE_MS);
  }

  const trimmedLength = query.trim().length;
  const noResults = searched && !loading && suggestions.length === 0 && !notice;
  const showDropdown = focused && (
    loading || retrieving || !!notice || suggestions.length > 0 || noResults
  );

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
          testID="location-input"
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
          onFocus={() => { if (blurRef.current) clearTimeout(blurRef.current); setFocused(true); }}
          onBlur={handleBlur}
          accessibilityLabel="Location search"
          accessibilityHint="Type at least 3 characters to search, then select a suggestion"
        />
        {(loading || retrieving) && <ActivityIndicator size="small" color={Colors.cyan} />}
      </View>

      {focused && trimmedLength > 0 && trimmedLength < MIN_QUERY_LENGTH && (
        <Text style={styles.hintText}>Type at least {MIN_QUERY_LENGTH} characters to search.</Text>
      )}

      {showDropdown && (
        <View
          testID="location-dropdown"
          style={[styles.dropdown, { borderColor: theme.border, backgroundColor: theme.cardBg }]}>
          {notice && (
            <Text
              testID={notice.tone === 'error' ? 'location-error' : 'location-notice'}
              style={notice.tone === 'error' ? styles.errorText : styles.infoText}>
              {notice.message}
            </Text>
          )}
          {loading || retrieving ? (
            <View style={styles.centerRow}>
              <ActivityIndicator size="small" color={Colors.cyan} />
              <Text style={styles.mutedText}>{retrieving ? 'Loading location…' : 'Searching…'}</Text>
            </View>
          ) : noResults ? (
            <Text testID="location-no-results" style={styles.mutedText}>
              No locations found for “{query.trim()}”. Try a different spelling.
            </Text>
          ) : (
            suggestions.map((s, idx) => (
              <TouchableOpacity
                key={s.mapboxId}
                testID="location-suggestion"
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
      paddingHorizontal: 14, paddingVertical: 14, minHeight: 48,
    },
    suggestionName: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label },
    suggestionDetail: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.metadata, marginTop: 2 },

    centerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 14 },
    mutedText: {
      fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label,
      color: Colors.fg3, paddingHorizontal: 14, paddingVertical: 14,
    },
    hintText: {
      fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label,
      color: Colors.fg3, marginTop: 6,
    },
    infoText: {
      fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, lineHeight: 20,
      color: Colors.fg2, paddingHorizontal: 14, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: Colors.border,
    },
    errorText: {
      fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, lineHeight: 20,
      color: Colors.negative, paddingHorizontal: 14, paddingVertical: 14,
    },
  }), []);
}
