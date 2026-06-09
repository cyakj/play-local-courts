import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Star } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

interface ReviewRow {
  id: string;
  rating: number;
  reviewText: string | null;
  playerName: string | null;
  createdAt: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StarRow({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={12}
          strokeWidth={0}
          fill={i <= rating ? '#F59E0B' : 'rgba(154,163,184,0.30)'}
          color={i <= rating ? '#F59E0B' : 'rgba(154,163,184,0.30)'}
        />
      ))}
    </View>
  );
}

export default function CoachReviewsScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const insets = useSafeAreaInsets();
  const [reviews,   setReviews]   = useState<ReviewRow[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [loading,   setLoading]   = useState(true);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: rows } = await supabase
      .from('coach_reviews')
      .select('id, rating, review_text, player_id, created_at')
      .eq('coach_id', user.id)
      .order('created_at', { ascending: false });

    if (!rows) { setLoading(false); return; }

    const playerIds = [...new Set(rows.map(r => r.player_id as string))];
    let nameMap = new Map<string, string>();
    if (playerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', playerIds);
      nameMap = new Map((profiles ?? []).map(p => [p.id as string, (p.full_name as string) ?? 'Player']));
    }

    const avg = rows.length > 0
      ? rows.reduce((s, r) => s + (r.rating as number), 0) / rows.length
      : null;
    setAvgRating(avg != null ? Math.round(avg * 10) / 10 : null);
    setReviews(rows.map(r => ({
      id:         r.id as string,
      rating:     r.rating as number,
      reviewText: r.review_text as string | null,
      playerName: nameMap.get(r.player_id as string) ?? 'Player',
      createdAt:  r.created_at as string | null,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.pageBg }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
          <ArrowLeft color="#FFFFFF" size={22} strokeWidth={1.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Reviews</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {avgRating != null && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryRating}>{avgRating.toFixed(1)}</Text>
            <View>
              <StarRow rating={Math.round(avgRating)} />
              <Text style={styles.summaryCount}>
                {reviews.length} review{reviews.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        )}

        {loading && <Text style={styles.emptyText}>Loading…</Text>}

        {!loading && reviews.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No reviews yet</Text>
            <Text style={styles.emptySub}>
              Reviews appear here after players rate completed lessons.
            </Text>
          </View>
        )}

        {reviews.map(review => {
          const initials = (review.playerName ?? 'P')
            .split(' ')
            .map(w => w[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
          return (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
                <View style={styles.reviewMeta}>
                  <Text style={styles.reviewerName} numberOfLines={1}>
                    {review.playerName}
                  </Text>
                  <View style={styles.metaRow}>
                    <StarRow rating={review.rating} />
                    <Text style={styles.reviewDate}>{formatDate(review.createdAt)}</Text>
                  </View>
                </View>
              </View>
              {review.reviewText && (
                <Text style={styles.reviewText}>"{review.reviewText}"</Text>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen: { flex: 1 },
    header: {
      backgroundColor: '#0A1628',
      paddingHorizontal: Spacing.pagePx,
      paddingBottom: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(45,224,255,0.18)',
    },
    backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    headerTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: 18,
      color: '#FFFFFF',
    },
    content: { padding: Spacing.pagePx, paddingBottom: 100, gap: 12 },
    summaryCard: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.cardPadding,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    summaryRating: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: 36,
      color: theme.textPrimary,
      letterSpacing: -0.5,
    },
    summaryCount: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
      marginTop: 4,
    },
    reviewCard: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.cardPadding,
      gap: 10,
    },
    reviewHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(45,107,255,0.20)',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    avatarText: {
      fontFamily: FontFamily.manropeBold ?? FontFamily.manropeSemiBold,
      fontSize: 13,
      color: Colors.blue,
    },
    reviewMeta: { flex: 1, gap: 4 },
    reviewerName: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textPrimary,
    },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    reviewDate: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: 11,
      color: theme.textMuted,
    },
    reviewText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textSecondary,
      lineHeight: 20,
      fontStyle: 'italic',
    },
    emptyText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
      textAlign: 'center',
      paddingTop: 40,
    },
    emptyState: { paddingTop: 60, alignItems: 'center', gap: 8 },
    emptyTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle ?? 18,
      color: theme.textSecondary,
    },
    emptySub: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
      textAlign: 'center',
    },
  }), [theme]);
}
