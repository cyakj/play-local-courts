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
import { Heart, MapPin, Star } from 'lucide-react-native';
import { Header } from '@/components/ui/Header';
import { CoachAvailabilityGrid } from '@/components/coaching/CoachAvailabilityGrid';
import { BookLessonSheet } from '@/components/coaching/BookLessonSheet';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { supabase } from '@/lib/supabase';
import { useCoachAvailability } from '@/hooks/useCoachAvailability';

const LEVEL_LABELS: Record<string, string> = {
  beginner:         'Beginner',
  intermediate:     'Intermediate',
  high_performance: 'High Performance',
};

const LESSON_TYPE_LABELS: Record<string, string> = {
  private_lesson:      'Private Lesson',
  semi_private_lesson: 'Semi-Private Lesson',
  group_clinic:        'Group Clinic',
  practice_session:    'Practice Session',
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
  const [bookSheetVisible, setBookSheetVisible] = useState(false);

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

      const [profileRes, reviewsRes, favRes] = await Promise.all([
        supabase.from('profiles').select('full_name, avatar_url').eq('id', userId).single(),
        supabase.from('coach_reviews').select('id, rating, review_text, created_at, player_id')
          .eq('coach_id', userId).order('created_at', { ascending: false }).limit(3),
        supabase.from('coach_favorites').select('id')
          .eq('player_id', user.id).eq('coach_id', userId).maybeSingle(),
      ]);

      if (cancelled) return;

      const allReviewsRes = await supabase
        .from('coach_reviews').select('rating', { count: 'exact' }).eq('coach_id', userId);

      if (cancelled) return;

      const allRatings = allReviewsRes.data ?? [];
      const avgRating = allRatings.length > 0
        ? allRatings.reduce((sum, r) => sum + (r.rating as number), 0) / allRatings.length
        : null;

      const reviewRows = reviewsRes.data ?? [];
      const playerIds = reviewRows.map(r => r.player_id as string).filter(Boolean);
      let reviewerProfiles: { id: string; full_name: string | null }[] = [];
      if (playerIds.length > 0) {
        const { data } = await supabase.from('profiles').select('id, full_name').in('id', playerIds);
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
      await supabase.from('coach_favorites').delete()
        .eq('player_id', user.id).eq('coach_id', coach.userId);
    } else {
      setIsFavorited(true);
      await supabase.from('coach_favorites').insert({ player_id: user.id, coach_id: coach.userId });
    }
  }

  if (loading) {
    return (
      <View style={styles.screen}>
        <Header variant="inner" title="Coach Profile" onBack={() => router.back()} />
        <ActivityIndicator color={Colors.cyan} style={{ marginTop: 60 }} />
      </View>
    );
  }

  if (error || !coach) {
    return (
      <View style={styles.screen}>
        <Header variant="inner" title="Coach Profile" onBack={() => router.back()} />
        <View style={styles.errorWrap}>
          <Text style={styles.errorTxt}>{error ?? 'Coach not found'}</Text>
          <TouchableOpacity style={styles.errorBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Text style={styles.errorBtnLabel}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const displayName = coach.businessName ?? coach.fullName ?? 'Coach';
  const imageUri = coach.profileImageUrl ?? coach.avatarUrl;
  const initials = displayName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

  const lessonTypes = Object.keys(LESSON_TYPE_LABELS);

  return (
    <View style={styles.screen}>
      {/* Header with working back button */}
      <Header variant="inner" title="Coach Profile" onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile Card ── */}
        <View style={styles.profileCard}>
          {/* Avatar */}
          <View style={styles.avatarWrap}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.avatar} resizeMode="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
          </View>

          {/* Coach info */}
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={2}>{displayName}</Text>

            {coach.credentials ? (
              <View style={styles.credentialChip}>
                <Text style={styles.credentialText}>{coach.credentials.toUpperCase()}</Text>
              </View>
            ) : null}

            {/* Rating row */}
            {coach.avgRating != null ? (
              <View style={styles.metaRow}>
                <Star size={12} strokeWidth={0} fill="#F59E0B" color="#F59E0B" />
                <Text style={styles.metaTxt}>
                  {coach.avgRating.toFixed(1)}
                  <Text style={styles.metaMuted}> ({coach.reviewCount})</Text>
                </Text>
              </View>
            ) : (
              <Text style={styles.metaMuted}>No reviews yet</Text>
            )}

            {/* Location + rate row */}
            <View style={styles.metaRow}>
              {coach.homeBase ? (
                <>
                  <MapPin size={11} strokeWidth={2} color={theme.textMuted} />
                  <Text style={styles.metaMuted} numberOfLines={1}>{coach.homeBase}</Text>
                  {coach.hourlyRate != null && <Text style={styles.metaMuted}>·</Text>}
                </>
              ) : null}
              {coach.hourlyRate != null && (
                <Text style={styles.rateTxt}>${Math.round(coach.hourlyRate)}/hr</Text>
              )}
            </View>
          </View>

          {/* Favorite heart */}
          <TouchableOpacity style={styles.heartBtn} onPress={toggleFavorite} activeOpacity={0.75}>
            <Heart
              size={20}
              strokeWidth={2}
              color={isFavorited ? Colors.negative : theme.textMuted}
              fill={isFavorited ? Colors.negative : 'transparent'}
            />
          </TouchableOpacity>
        </View>

        {/* ── About ── */}
        {(coach.bio || coach.yearsExperience != null || coach.willingToTravel) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            {coach.bio ? (
              <Text style={styles.bio}>{coach.bio}</Text>
            ) : null}
            {(coach.yearsExperience != null || coach.willingToTravel) && (
              <View style={styles.statsRow}>
                {coach.yearsExperience != null && (
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{coach.yearsExperience}</Text>
                    <Text style={styles.statLabel}>YRS EXP</Text>
                  </View>
                )}
                {coach.willingToTravel && (
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>✓</Text>
                    <Text style={styles.statLabel}>TRAVELS</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* ── Lesson Types ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lesson Types</Text>
          <View style={styles.chipRow}>
            {lessonTypes.map(lt => (
              <View key={lt} style={styles.typeChip}>
                <Text style={styles.typeChipText}>
                  {LESSON_TYPE_LABELS[lt] ?? lt}
                </Text>
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
            {/* Legend */}
            {weeklySlots.length > 0 && (
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, styles.legendDotAvail]} />
                  <Text style={styles.legendLabel}>Available</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, styles.legendDotUnavail]} />
                  <Text style={styles.legendLabel}>Unavailable</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* ── Packages (deferred) ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Packages</Text>
          <View style={styles.deferredCard}>
            <Text style={styles.deferredEyebrow}>COMING SOON</Text>
            <Text style={styles.deferredTitle}>Lesson Packages</Text>
            <Text style={styles.deferredBody}>
              Multi-lesson packages with discounted rates will be available soon.
            </Text>
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

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Sticky Footer — Request Lesson only ── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.footerPrimary}
          onPress={() => setBookSheetVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.footerPrimaryLabel}>Request Lesson</Text>
        </TouchableOpacity>
      </View>

      <BookLessonSheet
        visible={bookSheetVisible}
        onClose={() => setBookSheetVisible(false)}
        onSuccess={() => router.push('/my-coaching' as any)}
        coachUserId={coach.userId}
        coachName={displayName}
        homeBase={coach.homeBase}
        weeklySlots={weeklySlots}
        unavailabilityBlocks={unavailabilityBlocks}
      />
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
      <View style={styles.reviewTopRow}>
        <View>
          <View style={styles.starsRow}>
            {stars.map((filled, i) => (
              <Star
                key={i}
                size={12}
                strokeWidth={0}
                fill={filled ? '#F59E0B' : theme.border}
                color={filled ? '#F59E0B' : theme.border}
              />
            ))}
          </View>
          <Text style={styles.reviewerName}>{review.playerName ?? 'Resident'}</Text>
        </View>
        {date ? <Text style={styles.reviewDate}>{date}</Text> : null}
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
      paddingTop: 20,
      paddingBottom: 20,
    },

    // ── Profile card ──
    profileCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 14,
      marginHorizontal: Spacing.pagePx,
      marginBottom: 28,
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
    },
    avatarWrap: {
      flexShrink: 0,
    },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
    },
    avatarFallback: {
      backgroundColor: 'rgba(45,107,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: 'rgba(45,107,255,0.30)',
    },
    avatarInitials: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: 26,
      color: Colors.cyan,
    },
    profileInfo: {
      flex: 1,
      gap: 5,
    },
    profileName: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: 20,
      color: theme.textPrimary,
      letterSpacing: -0.3,
      lineHeight: 26,
    },
    credentialChip: {
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(45,107,255,0.18)',
      borderRadius: Radius.xs,
      paddingHorizontal: 7,
      paddingVertical: 3,
    },
    credentialText: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 9,
      color: Colors.blueHi,
      letterSpacing: 0.8,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 4,
    },
    metaTxt: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    metaMuted: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
    },
    rateTxt: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textPrimary,
    },
    heartBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },

    // ── Sections ──
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
    statsRow: {
      flexDirection: 'row',
      gap: 12,
    },
    statItem: {
      backgroundColor: theme.bgElevated,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 16,
      paddingVertical: 10,
      alignItems: 'center',
      gap: 2,
    },
    statValue: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: 20,
      color: theme.textPrimary,
    },
    statLabel: {
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

    // Availability card
    card: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.cardPadding,
      gap: 12,
    },
    legendRow: {
      flexDirection: 'row',
      gap: 16,
      paddingTop: 4,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendDotAvail: {
      backgroundColor: 'rgba(45,224,255,0.55)',
      borderWidth: 1,
      borderColor: 'rgba(45,224,255,0.70)',
    },
    legendDotUnavail: {
      backgroundColor: 'rgba(154,163,184,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(154,163,184,0.20)',
    },
    legendLabel: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: 12,
      color: theme.textMuted,
    },

    // Packages deferred
    deferredCard: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderStyle: 'dashed',
      padding: 20,
      alignItems: 'center',
      gap: 6,
    },
    deferredEyebrow: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 9,
      color: theme.textMuted,
      letterSpacing: 1.2,
    },
    deferredTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: 15,
      color: theme.textSecondary,
      letterSpacing: -0.2,
    },
    deferredBody: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: 13,
      color: theme.textMuted,
      textAlign: 'center',
      lineHeight: 20,
    },

    // Reviews
    reviewList: {
      gap: 12,
    },
    reviewCard: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      gap: 10,
    },
    reviewTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    starsRow: {
      flexDirection: 'row',
      gap: 3,
      marginBottom: 4,
    },
    reviewerName: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    reviewDate: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: 12,
      color: theme.textMuted,
    },
    reviewText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textSecondary,
      lineHeight: 22,
    },

    // Footer
    footer: {
      paddingHorizontal: Spacing.pagePx,
      paddingVertical: 14,
      paddingBottom: 30,
      backgroundColor: 'rgba(12,15,24,0.96)',
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    footerPrimary: {
      height: 52,
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
    errorBtn: {
      backgroundColor: Colors.blue,
      paddingHorizontal: 24,
      paddingVertical: 13,
      borderRadius: Radius.sm,
    },
    errorBtnLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.white,
    },
  }), [theme]);
}
