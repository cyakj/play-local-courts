import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { GraduationCap, Heart, SlidersHorizontal, X } from 'lucide-react-native';
import { Header } from '@/components/ui/Header';
import { CoachCard, CoachCardSkeleton } from '@/components/coaching/CoachCard';
import { CoachSearchBar } from '@/components/coaching/CoachSearchBar';
import {
  CoachFiltersSheet,
  DEFAULT_FILTERS,
  activeFilterCount,
  type CoachFiltersState,
} from '@/components/coaching/CoachFiltersSheet';
import { Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { useCoachData, type CoachFilters } from '@/hooks/useCoachData';

const PRICE_LABELS: Record<string, string> = {
  under75:  '<$75',
  '75to100':  '$75–$100',
  '100to150': '$100–$150',
  '150plus':  '$150+',
};

const DIST_LABELS: Record<string, string> = {
  '8':  '5 mi',
  '16': '10 mi',
  '40': '25 mi',
  '80': '50 mi',
};

const AVAIL_LABELS: Record<string, string> = {
  today:     'Today',
  tomorrow:  'Tomorrow',
  this_week: 'This Week',
  weekend:   'Weekend',
};

function buildFilterSummary(f: CoachFiltersState): string {
  const parts: string[] = [];
  if (f.distanceKm != null) parts.push(DIST_LABELS[String(f.distanceKm)] ?? '');
  f.levels.forEach(l => parts.push(
    l === 'beginner' ? 'Beginner' : l === 'intermediate' ? 'Intermediate' : 'High Perf',
  ));
  if (f.priceRange != null) parts.push(PRICE_LABELS[f.priceRange] ?? '');
  f.lessonTypes.forEach(lt => parts.push(lt));
  if (f.availability != null) parts.push(AVAIL_LABELS[f.availability] ?? '');
  return parts.filter(Boolean).join(' · ');
}

export default function CoachesScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);

  const [searchText,      setSearchText]      = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filtersVisible,  setFiltersVisible]  = useState(false);
  const [appliedFilters,  setAppliedFilters]  = useState<CoachFiltersState>(DEFAULT_FILTERS);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filters: CoachFilters = useMemo(() => ({
    search:       debouncedSearch,
    distanceKm:   appliedFilters.distanceKm,
    levels:       appliedFilters.levels,
    priceRange:   appliedFilters.priceRange,
    lessonTypes:  appliedFilters.lessonTypes,
    availability: appliedFilters.availability,
  }), [debouncedSearch, appliedFilters]);

  const { coaches, loading, error, refresh, favoriteIds, toggleFavorite, playerHasCoordinates } =
    useCoachData(filters);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  function handleSearchChange(text: string) {
    setSearchText(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(text), 300);
  }

  const activeCount   = activeFilterCount(appliedFilters);
  const filterSummary = activeCount > 0 ? buildFilterSummary(appliedFilters) : '';
  const hasActiveFilters = activeCount > 0 || debouncedSearch.trim().length > 0;

  function clearAllFilters() {
    setAppliedFilters(DEFAULT_FILTERS);
    setSearchText('');
    setDebouncedSearch('');
  }

  const ListHeader = useMemo(() => (
    <View>
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>COACHES</Text>
        <Text style={styles.heroTitle}>Find a Coach</Text>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <CoachSearchBar value={searchText} onChangeText={handleSearchChange} />
      </View>

      {/* Filter bar: summary + Filters button */}
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filtersBtn, activeCount > 0 && styles.filtersBtnActive]}
          onPress={() => setFiltersVisible(true)}
          activeOpacity={0.8}
        >
          <SlidersHorizontal
            size={14}
            strokeWidth={2}
            color={activeCount > 0 ? Colors.cyan : theme.textSecondary}
          />
          <Text style={[styles.filtersBtnLabel, activeCount > 0 && styles.filtersBtnLabelActive]}>
            Filters{activeCount > 0 ? ` (${activeCount})` : ''}
          </Text>
        </TouchableOpacity>

        {filterSummary ? (
          <View style={styles.filterSummaryRow}>
            <Text style={styles.filterSummaryTxt} numberOfLines={1}>{filterSummary}</Text>
            <TouchableOpacity
              onPress={() => setAppliedFilters(DEFAULT_FILTERS)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={13} strokeWidth={2} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {/* Favorites shortcut */}
      <TouchableOpacity
        style={styles.favoritesRow}
        onPress={() => router.push('/coach-favorites')}
        activeOpacity={0.8}
      >
        <Heart size={14} strokeWidth={2} color={Colors.negative} fill={Colors.negative} />
        <Text style={styles.favoritesLabel}>My Favourite Coaches</Text>
        <Text style={styles.favoritesChevron}>›</Text>
      </TouchableOpacity>

      {/* Count row */}
      {!loading && !error && (
        <View style={styles.countRow}>
          <Text style={styles.countTxt}>
            {coaches.length === 0
              ? 'No coaches match'
              : `${coaches.length} coach${coaches.length === 1 ? '' : 'es'}`}
          </Text>
          {hasActiveFilters && (
            <TouchableOpacity onPress={clearAllFilters}>
              <Text style={styles.clearTxt}>Clear all</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Error */}
      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorTxt}>Failed to load coaches. Tap to retry.</Text>
          <TouchableOpacity onPress={refresh} style={styles.retryBtn}>
            <Text style={styles.retryTxt}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [searchText, appliedFilters, activeCount, filterSummary, coaches.length, loading, error, theme]);

  if (loading) {
    return (
      <View style={styles.screen}>
        <Header variant="resident" />
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>COACHES</Text>
          <Text style={styles.heroTitle}>Find a Coach</Text>
        </View>
        <View style={[styles.searchWrap, { paddingHorizontal: Spacing.pagePx }]}>
          <CoachSearchBar value="" onChangeText={() => {}} />
        </View>
        <View style={styles.skeletonList}>
          <CoachCardSkeleton />
          <CoachCardSkeleton />
          <CoachCardSkeleton />
        </View>
        <ActivityIndicator color={Colors.cyan} style={{ marginTop: 8 }} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Header variant="resident" />
      <FlatList
        data={coaches}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <CoachCard
              coach={item}
              isFavorited={favoriteIds.has(item.userId)}
              onToggleFavorite={() => toggleFavorite(item.userId)}
              onViewCoach={() => router.push(`/coach-profile/${item.id}` as any)}
            />
          </View>
        )}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <GraduationCap color={theme.textMuted} size={40} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>No coaches found</Text>
            <Text style={styles.emptyBody}>
              {hasActiveFilters
                ? 'Try adjusting your search or filters.'
                : 'No coaches are available yet.'}
            </Text>
            {hasActiveFilters && (
              <TouchableOpacity style={styles.clearFiltersBtn} onPress={clearAllFilters} activeOpacity={0.8}>
                <Text style={styles.clearFiltersBtnLabel}>Clear Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={refresh}
            tintColor={Colors.cyan}
          />
        }
      />

      <CoachFiltersSheet
        visible={filtersVisible}
        onClose={() => setFiltersVisible(false)}
        filters={appliedFilters}
        onApply={setAppliedFilters}
        playerHasCoords={playerHasCoordinates}
        resultCount={coaches.length}
      />
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.pageBg,
    },
    hero: {
      paddingHorizontal: Spacing.pagePx,
      paddingTop: 8,
      paddingBottom: 20,
    },
    heroLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      color: Colors.cyan,
      letterSpacing: 2.2,
      marginBottom: 4,
    },
    heroTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: 32,
      color: theme.textPrimary,
      lineHeight: 36,
      letterSpacing: -0.5,
    },
    searchWrap: {
      paddingHorizontal: Spacing.pagePx,
      marginBottom: 10,
    },
    filterBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: Spacing.pagePx,
      marginBottom: 8,
      flexWrap: 'wrap',
    },
    filtersBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: theme.cardBg,
      borderRadius: Radius.chip,
      borderWidth: 1,
      borderColor: theme.border,
    },
    filtersBtnActive: {
      backgroundColor: 'rgba(45,224,255,0.08)',
      borderColor: 'rgba(45,224,255,0.35)',
    },
    filtersBtnLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    filtersBtnLabelActive: {
      color: Colors.cyan,
    },
    filterSummaryRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    filterSummaryTxt: {
      flex: 1,
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    favoritesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginHorizontal: Spacing.pagePx,
      marginTop: 4,
      marginBottom: 4,
      paddingVertical: 10,
      paddingHorizontal: 14,
      backgroundColor: theme.cardBg,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
    },
    favoritesLabel: {
      flex: 1,
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textPrimary,
    },
    favoritesChevron: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: 18,
      color: theme.textMuted,
      lineHeight: 22,
    },
    countRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.pagePx,
      paddingVertical: 8,
      gap: 8,
    },
    countTxt: {
      flex: 1,
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
    },
    clearTxt: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.cyan,
    },
    errorBanner: {
      margin: Spacing.pagePx,
      backgroundColor: 'rgba(255,92,107,0.10)',
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: 'rgba(255,92,107,0.25)',
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    errorTxt: {
      flex: 1,
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: Colors.negative,
    },
    retryBtn: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      backgroundColor: 'rgba(255,92,107,0.15)',
      borderRadius: Radius.sm,
    },
    retryTxt: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.negative,
    },
    cardWrap: {
      paddingHorizontal: Spacing.pagePx,
    },
    listContent: {
      paddingBottom: 100,
      gap: Spacing.cardGap,
      maxWidth: MaxWidth,
      width: '100%',
      alignSelf: 'center',
    },
    skeletonList: {
      paddingHorizontal: Spacing.pagePx,
      gap: Spacing.cardGap,
      marginTop: 16,
    },
    emptyWrap: {
      paddingHorizontal: Spacing.pagePx,
      paddingTop: 60,
      alignItems: 'center',
      gap: 12,
    },
    emptyTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.sectionTitle,
      color: theme.textPrimary,
    },
    emptyBody: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textMuted,
      textAlign: 'center',
    },
    clearFiltersBtn: {
      marginTop: 4,
      paddingHorizontal: 20,
      paddingVertical: 10,
      backgroundColor: theme.cardBg,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
    },
    clearFiltersBtnLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
  }), [theme]);
}
