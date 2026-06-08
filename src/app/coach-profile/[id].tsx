import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Heart, MapPin, MessageCircle, Star } from 'lucide-react-native';
import { Header } from '@/components/ui/Header';
import { CoachAvailabilityGrid } from '@/components/coaching/CoachAvailabilityGrid';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { supabase } from '@/lib/supabase';
import { useCoachAvailability } from '@/hooks/useCoachAvailability';

const LESSON_TYPES = [
  'Private Lesson',
  'Semi-Private Lesson',
  'Group Clinic',
  'Practice Session',
];

const LEVEL_LABELS: Record<string, string> = {
  beginner:         'Beginner',
  intermediate:     'Intermediate',
  high_performance: 'High Performance',
};

interface CoachDetail {
  id: string;
  userId: string;
  businessName: string | null;
  credentials: string | null;
  yearsExperience: number | null;
  sportsOffered: string[];
  homeBase: string | null;
  willingToTravel: boolean;
  hourlyRate: number | null;
  bio: string | null;
  profileImageUrl: string | null;
  levelsServed: string[];
  fullName: string | null;
  avatarUrl: string | null;
  avgRating: number | null;
  reviewCount: number;
}

interface ReviewRow {
  id: string;
  rating: number;
  reviewText: string | null;
  createdAt: string | null;
  playerName: string | null;
}

export default function CoachProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const styles = useStyles(theme);

  const [coach, setCoach] = useState<CoachDetail | null>(null);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [isFavorited, setIsFavorited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { weeklySlots, unavailabilityBlocks } = useCoachAvailability(
    coach?.userId ?? null,
  );

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Fetch coach row
      const { data: coachRow, error: coachErr } = await supabase
        .from('coaches')
        .select('id, user_id, business_name, credentials, years_experience, sports_offered, home_base, willing_to_travel, hourly_rate, bio, profile_image_url, levels_served')
        .eq('id', id)
        .single();

      if (cancelled) return;
      if (coachErr || !coachRow) {
        setError(coachErr?.message ?? 'Coach not found');
        setLoading(false);
        return;
      }

      const userId = coachRow.user_id as string;

      // Parallel: profile + reviews + favorite status
      const [profileRes, reviewsRes, favRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', userId)
          .single(),
        supabase
          .from('coach_reviews')
          .select('id, rating, review_text, created_at, player_id')
          .eq('coach_id', userId)
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('coach_favorites')
          .select('id')
          .eq('player_id', user.id)
          .eq('coach_id', userId)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      // Build rating stats
      const allReviewsRes = await supabase
        .from('coach_reviews')
        .select('rating', { count: 'exact' })
        .eq('coach_id', userId);

      if (cancelled) return;

      const allRatings = allReviewsRes.data ?? [];
      const avgRating = allRatings.length > 0
        ? allRatings.reduce((sum, r) => sum + (r.rating as number), 0) / allRatings.length
        : null;

      // Fetch reviewer names
      const reviewRows = reviewsRes.data ?? [];
      const playerIds = reviewRows.map(r => r.player_id as string).filter(Boolean);
      let reviewerProfiles: { id: string; full_name: string | null }[] = [];
      if (playerIds.length > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', playerIds);
        if (!cancelled) reviewerProfiles = data ?? [];
      }

      if (cancelled) return;

      const reviewerMap = new Map(reviewerProfiles.map(p => [p.id, p.full_name]));

      setCoach({
        id: coachRow.id as string,
        userId,
        businessName: coachRow.business_name as string | null,
        credentials: coachRow.credentials as string | null,
        yearsExperience: coachRow.years_experience as number | null,
        sportsOffered: (coachRow.sports_offered as string[]) ?? [],
        homeBase: coachRow.home_base as string | null,
        willingToTravel: (coachRow.willing_to_travel as boolean) ?? false,
        hourlyRate: coachRow.hourly_rate != null ? Number(coachRow.hourly_rate) : null,
        bio: coachRow.bio as string | null,
        profileImageUrl: coachRow.profile_image_url as string | null,
        levelsServed: (coachRow.levels_served as string[]) ?? [],
        fullName: profileRes.data?.full_name ?? null,
        avatarUrl: profileRes.data?.avatar_url ?? null,
        avgRating,
        reviewCount: allReviewsRes.count ?? allRatings.length,
      });

      setReviews(reviewRows.map(r => ({
        id: r.id as string,
        rating: r.rating as number,
        reviewText: r.review_text as string | null,
        createdAt: r.created_at as string | null,
        playerName: reviewerMap.get(r.player_id as string) ?? null,
      })));

      setIsFavorited(!!favRes.data);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [id]);

  async function toggleFavorite() {
    if (!coach) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (isFavorited) {
      setIsFavorited(false);
      await supabase
        .from('coach_favorites')
        .delete()
        .eq('player_id', user.id)
        .eq('coach_id', coach.userId);
    } else {
      setIsFavorited(true);
      await supabase
        .from('coach_favorites')
        .insert({ player_id: user.id, coach_id: coach.userId });
    }
  }

  function handleSendRequest() {
    // BookLessonSheet wired in Phase 4
    // Navigate back to coaches for now (temporary)
    router.push(`/coach-profile/${id}/book` as any);
  }

  if (loading) {
    return (
      <View style={styles.screen}>
        <Header variant="inner" title="" />
        <ActivityIndicator color={Colors.cyan} style={{ marginTop: 60 }} />
      </View>
    );
  }

  if (error || !coach) {
    return (
      <View style={styles.screen}>
        <Header variant="inner" title="Coach Profile" />
        <View style={styles.errorWrap}>
          <Text style={styles.errorTxt}>{error ?? 'Coach not found'}</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Text style={styles.backBtnLabel}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const displayName = coach.businessName ?? coach.fullName ?? 'Coach';
  const imageUri = coach.profileImageUrl ?? coach.avatarUrl;
  const initials = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <View style={styles.screen}>
      <Header variant="inner" title="" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <View style={styles.heroContainer}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={[styles.heroImage, styles.heroFallback]}>
              <Text style={styles.heroInitials}>{initials}</Text>
            </View>
          )}
          <View style={styles.heroGradient} />
          {/* Heart */}
          <TouchableOpacity style={styles.heartBtn} onPress={toggleFavorite} activeOpacity={0.8}>
            <Heart
              size={20}
              strokeWidth={2}
              color={isFavorited ? Colors.negative : Colors.white}
              fill={isFavorited ? Colors.negative : 'transparent'}
            />
          </TouchableOpacity>

          {/* Name + meta overlay */}
          <View style={styles.heroOverlay}>
            <Text style={styles.heroName}>{displayName}</Text>
            {coach.credentials ? (
              <View style={styles.credentialChip}>
                <Text style={styles.credentialText}>{coach.credentials}</Text>
              </View>
            ) : null}
            <View style={styles.heroMeta}>
              {coach.avgRating != null ? (
                <View style={styles.ratingRow}>
                  <Star size={13} strokeWidth={0} fill="#F59E0B" color="#F59E0B" />
                  <Text style={styles.ratingTxt}>
                    {coach.avgRating.toFixed(1)}
                    <Text style={styles.ratingCount}> ({coach.reviewCount})</Text>
                  </Text>
                </View>
              ) : (
                <Text style={styles.noRating}>No reviews yet</Text>
              )}
              {coach.homeBase ? (
                <View style={styles.locationRow}>
                  <MapPin size={12} strokeWidth={2} color={Colors.fg2} />
                  <Text style={styles.locationTxt}>{coach.homeBase}</Text>
                </View>
              ) : null}
              {coach.hourlyRate != null && (
                <Text style={styles.rateTxt}>${Math.round(coach.hourlyRate)}/hr</Text>
              )}
            </View>
          </View>
        </View>

        {/* ── About ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          {coach.bio ? <Text style={styles.bio}>{coach.bio}</Text> : null}
          <View style={styles.aboutGrid}>
            {coach.yearsExperience != null && (
              <View style={styles.aboutItem}>
                <Text style={styles.aboutValue}>{coach.yearsExperience}</Text>
                <Text style={styles.aboutLabel}>YRS EXP</Text>
              </View>
            )}
            {coach.willingToTravel && (
              <View style={styles.aboutItem}>
                <Text style={styles.aboutValue}>✓</Text>
                <Text style={styles.aboutLabel}>TRAVELS</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Lesson Types ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lesson Types</Text>
          <View style={styles.chipRow}>
            {LESSON_TYPES.map(lt => (
              <View key={lt} style={styles.typeChip}>
                <Text style={styles.typeChipText}>{lt}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Skill Levels ── */}
        {coach.levelsServed.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Skill Levels</Text>
            <View style={styles.chipRow}>
              {coach.levelsServed.map(lv => (
                <View key={lv} style={styles.levelChip}>
                  <Text style={styles.levelChipText}>
                    {LEVEL_LABELS[lv] ?? lv}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Availability ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Availability</Text>
          <View style={styles.card}>
            <CoachAvailabilityGrid
              weeklySlots={weeklySlots}
              unavailabilityBlocks={unavailabilityBlocks}
            />
          </View>
        </View>

        {/* ── Packages (deferred) ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Packages</Text>
          <View style={[styles.card, styles.deferredCard]}>
            <Text style={styles.deferredTxt}>Package options coming soon</Text>
          </View>
        </View>

        {/* ── Reviews ── */}
        {reviews.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reviews</Text>
            <View style={styles.reviewList}>
              {reviews.map(r => (
                <ReviewCard key={r.id} review={r} theme={theme} />
              ))}
            </View>
          </View>
        )}

        {/* Bottom padding for sticky footer */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Sticky Footer ── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.footerGhost}
          onPress={() => router.push({ pathname: '/messages', params: { recipientId: coach.userId } } as any)}
          activeOpacity={0.8}
        >
          <MessageCircle size={16} strokeWidth={2} color={theme.textSecondary} />
          <Text style={styles.footerGhostLabel}>Message</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.footerPrimary}
          onPress={handleSendRequest}
          activeOpacity={0.8}
        >
          <Text style={styles.footerPrimaryLabel}>Send Lesson Request</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ReviewCard({ review, theme }: { review: ReviewRow; theme: ThemeTokens }) {
  const styles = useStyles(theme);
  const stars = Array.from({ length: 5 }, (_, i) => i < review.rating);
  const date = review.createdAt
    ? new Date(review.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null;

  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.starsRow}>
          {stars.map((filled, i) => (
            <Star key={i} size={11} strokeWidth={0} fill={filled ? '#F59E0B' : theme.textMuted} color={filled ? '#F59E0B' : theme.textMuted} />
          ))}
        </View>
        <Text style={styles.reviewMeta}>
          {review.playerName ?? 'Resident'}
          {date ? ` · ${date}` : ''}
        </Text>
      </View>
      {review.reviewText ? (
        <Text style={styles.reviewText}>{review.reviewText}</Text>
      ) : null}
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.pageBg,
    },
    scrollContent: {
      paddingBottom: 20,
    },

    // Hero
    heroContainer: {
      height: 220,
      position: 'relative',
      marginBottom: 20,
    },
    heroImage: {
      width: '100%',
      height: '100%',
    },
    heroFallback: {
      backgroundColor: 'rgba(45,107,255,0.20)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroInitials: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: 56,
      color: Colors.cyan,
    },
    heroGradient: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 160,
      backgroundColor: 'rgba(12,15,24,0.55)',
    },
    heartBtn: {
      position: 'absolute',
      top: 16,
      right: 16,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(12,15,24,0.50)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroOverlay: {
      position: 'absolute',
      bottom: 16,
      left: Spacing.pagePx,
      right: Spacing.pagePx,
      gap: 6,
    },
    heroName: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: 26,
      color: Colors.white,
      letterSpacing: -0.4,
    },
    credentialChip: {
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(45,107,255,0.25)',
      borderRadius: Radius.xs,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    credentialText: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 9,
      color: Colors.blueHi,
      letterSpacing: 0.6,
    },
    heroMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 10,
    },
    ratingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    ratingTxt: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.white,
    },
    ratingCount: {
      fontFamily: FontFamily.manropeMedium,
      color: Colors.fg2,
    },
    noRating: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: Colors.fg2,
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    locationTxt: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: Colors.fg2,
    },
    rateTxt: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.white,
    },

    // Sections
    section: {
      paddingHorizontal: Spacing.pagePx,
      marginBottom: 28,
      gap: 12,
    },
    sectionTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
      letterSpacing: -0.2,
    },

    // About
    bio: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textSecondary,
      lineHeight: 24,
    },
    aboutGrid: {
      flexDirection: 'row',
      gap: 12,
    },
    aboutItem: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 16,
      paddingVertical: 12,
      alignItems: 'center',
      gap: 2,
    },
    aboutValue: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: 22,
      color: theme.textPrimary,
    },
    aboutLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 9,
      color: theme.textMuted,
      letterSpacing: 0.8,
    },

    // Chips
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    typeChip: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.chip,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    typeChipText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    levelChip: {
      backgroundColor: 'rgba(45,224,255,0.08)',
      borderRadius: Radius.chip,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    levelChipText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.cyan,
    },

    // Availability + packages card wrapper
    card: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.cardPadding,
    },
    deferredCard: {
      alignItems: 'center',
      paddingVertical: 24,
    },
    deferredTxt: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textMuted,
    },

    // Reviews
    reviewList: {
      gap: 10,
    },
    reviewCard: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      gap: 8,
    },
    reviewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    starsRow: {
      flexDirection: 'row',
      gap: 2,
    },
    reviewMeta: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
      flex: 1,
      textAlign: 'right',
    },
    reviewText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textSecondary,
      lineHeight: 22,
    },

    // Footer
    footer: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: Spacing.pagePx,
      paddingVertical: 14,
      paddingBottom: 28,
      backgroundColor: 'rgba(12,15,24,0.95)',
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    footerGhost: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      height: 50,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
    },
    footerGhostLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    footerPrimary: {
      flex: 1,
      height: 50,
      backgroundColor: Colors.blue,
      borderRadius: Radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    footerPrimaryLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: Colors.white,
    },

    // Error state
    errorWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      paddingHorizontal: Spacing.pagePx,
    },
    errorTxt: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textMuted,
      textAlign: 'center',
    },
    backBtn: {
      backgroundColor: Colors.blue,
      paddingHorizontal: 24,
      paddingVertical: 13,
      borderRadius: Radius.sm,
    },
    backBtnLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.white,
    },
  }), [theme]);
}
