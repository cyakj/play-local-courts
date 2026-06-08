import { useCallback, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Heart } from 'lucide-react-native';
import { Header } from '@/components/ui/Header';
import { CoachCard, CoachCardSkeleton } from '@/components/coaching/CoachCard';
import { Colors, FontFamily, FontSize, MaxWidth, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import { useCoachData } from '@/hooks/useCoachData';

export default function CoachFavoritesScreen() {
  const { theme } = useTheme();
  const [refreshTick, setRefreshTick] = useState(0);

  const { coaches, loading, favoriteIds, toggleFavorite, refresh } = useCoachData({
    search:       '',
    distanceKm:   null,
    levels:       [],
    priceRange:   null,
    lessonTypes:  [],
    availability: null,
  });

  useFocusEffect(useCallback(() => {
    refresh();
  }, [refresh]));

  const favoriteCoaches = coaches.filter(c => favoriteIds.has(c.userId));

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.pageBg }}>
        <Header variant="inner" title="Favourite Coaches" />
        <View style={styles.skeletonList}>
          <CoachCardSkeleton />
          <CoachCardSkeleton />
          <CoachCardSkeleton />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.pageBg }}>
      <Header variant="inner" title="Favourite Coaches" />
      <FlatList
        data={favoriteCoaches}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <CoachCard
              coach={item}
              isFavorited
              onToggleFavorite={() => toggleFavorite(item.userId)}
              onViewCoach={() => router.push(`/coach-profile/${item.id}` as any)}
            />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Heart size={40} strokeWidth={1.5} color={theme.textMuted} />
            <Text style={styles.emptyTitle}>No favourites yet</Text>
            <Text style={styles.emptyBody}>
              Tap the heart on any coach to save them here.
            </Text>
            <TouchableOpacity
              style={styles.discoverBtn}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <Text style={styles.discoverBtnLabel}>Discover Coaches</Text>
            </TouchableOpacity>
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

const styles = StyleSheet.create({
  skeletonList: {
    paddingHorizontal: Spacing.pagePx,
    paddingTop: 16,
    gap: 16,
  },
  cardWrap: {
    paddingHorizontal: Spacing.pagePx,
  },
  listContent: {
    paddingTop: 16,
    paddingBottom: 100,
    gap: 16,
    maxWidth: MaxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  emptyWrap: {
    paddingHorizontal: Spacing.pagePx,
    paddingTop: 80,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontFamily: FontFamily.spaceGroteskBold,
    fontSize: FontSize.sectionTitle,
    color: '#F5F8FF',
  },
  emptyBody: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.body,
    color: '#7A839A',
    textAlign: 'center',
  },
  discoverBtn: {
    marginTop: 8,
    backgroundColor: Colors.blue,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 10,
  },
  discoverBtnLabel: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.label,
    color: Colors.white,
  },
});
