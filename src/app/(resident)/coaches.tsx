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
import { GraduationCap, Heart } from 'lucide-react-native';
import { Header } from '@/components/ui/Header';
import { CoachCard, CoachCardSkeleton } from '@/components/coaching/CoachCard';
import { CoachSearchBar } from '@/components/coaching/CoachSearchBar';
import { CoachFilterBar } from '@/components/coaching/CoachFilterBar';
import { Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { useCoachData, type CoachFilters, type DistanceFilterKm, type LevelFilter } from '@/hooks/useCoachData';

export default function CoachesScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);

  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [distanceKm, setDistanceKm] = useState<DistanceFilterKm>(null);
  const [levels, setLevels] = useState<LevelFilter[]>([]);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filters: CoachFilters = useMemo(() => ({
    search: debouncedSearch,
    distanceKm,
    levels,
  }), [debouncedSearch, distanceKm, levels]);

  const { coaches, loading, error, refresh, favoriteIds, toggleFavorite } = useCoachData(filters);

  // Refresh on tab focus
  useFocusEffect(useCallback(() => {
    refresh();
  }, [refresh]));

  function handleSearchChange(text: string) {
    setSearchText(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(text), 300);
  }

  // Player coordinates: useCoachData reads them internally; expose existence for FilterBar
  // We check by watching if any coach has distanceKm (means RPC ran = player has coords)
  const playerHasCoordinates = coaches.some(c => c.distanceKm != null);

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

      {/* Filters */}
      <View style={styles.filterWrap}>
        <CoachFilterBar
          distanceKm={distanceKm}
          onDistanceChange={setDistanceKm}
          levels={levels}
          onLevelsChange={setLevels}
          playerHasCoordinates={playerHasCoordinates}
        />
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
  ), [searchText, distanceKm, levels, playerHasCoordinates, coaches.length, loading, error, theme]);

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
              onViewProfile={() => router.push(`/coach-profile/${item.id}` as any)}
              onBookLesson={() => router.push(`/coach-profile/${item.id}` as any)}
            />
          </View>
        )}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <GraduationCap color={theme.textMuted} size={40} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>No coaches found</Text>
            <Text style={styles.emptyBody}>
              {debouncedSearch || levels.length > 0 || distanceKm != null
                ? 'Try adjusting your search or filters.'
                : 'No coaches are available in your community yet.'}
            </Text>
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
    filterWrap: {
      marginBottom: 6,
    },
    favoritesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginHorizontal: Spacing.pagePx,
      marginTop: 8,
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
      paddingHorizontal: Spacing.pagePx,
      paddingVertical: 8,
    },
    countTxt: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
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
  }), [theme]);
}
