import { useMemo } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Heart, MapPin, Star } from 'lucide-react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { Skeleton } from '@/components/ui/Skeleton';
import type { CoachWithProfile } from '@/hooks/useCoachData';

const LEVEL_LABELS: Record<string, string> = {
  beginner:         'BEGINNER',
  intermediate:     'INTER',
  high_performance: 'HIGH PERF',
};

const LOCATION_TYPE_LABELS: Record<string, string> = {
  facility_coach:  'Facility Coach',
  traveling_coach: 'Traveling Coach',
  facility_travel: 'Facility + Travel',
};

const ITF_CERT_LABELS: Record<string, string> = {
  itf_1: 'ITF L1',
  itf_2: 'ITF L2',
  itf_3: 'ITF L3',
  itf_4: 'ITF L4',
};

const LESSON_CHIP_LABELS: Record<string, string> = {
  private_lesson:      'Private',
  semi_private_lesson: 'Semi-Private',
  group_lesson:        'Group',
  hitting_partner:     'Hitting',
};

interface Props {
  coach: CoachWithProfile;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  onViewCoach: () => void;
}

export function CoachCard({ coach, isFavorited, onToggleFavorite, onViewCoach }: Props) {
  const { theme } = useTheme();
  const styles = useStyles(theme);

  const displayName = coach.businessName ?? coach.fullName ?? 'Coach';
  const imageUri = coach.profileImageUrl ?? coach.avatarUrl;
  const initials = displayName
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const ratingText = coach.avgRating != null ? coach.avgRating.toFixed(1) : null;

  return (
    <View style={styles.card}>
      {/* Heart */}
      <TouchableOpacity
        style={styles.heartBtn}
        onPress={onToggleFavorite}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Heart
          size={18}
          strokeWidth={2}
          color={isFavorited ? Colors.negative : theme.textMuted}
          fill={isFavorited ? Colors.negative : 'transparent'}
        />
      </TouchableOpacity>

      <View style={styles.row}>
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
        </View>

        {/* Main content */}
        <View style={styles.content}>
          {/* 1. Name */}
          <Text style={styles.name} numberOfLines={1}>{displayName}</Text>

          {/* 2. Location type badge */}
          {coach.coachingLocationType && LOCATION_TYPE_LABELS[coach.coachingLocationType] && (
            <View style={styles.locationBadge}>
              <MapPin size={10} color={Colors.cyan} strokeWidth={2} />
              <Text style={styles.locationBadgeText}>
                {LOCATION_TYPE_LABELS[coach.coachingLocationType]}
              </Text>
            </View>
          )}

          {/* 3. Lesson type chips (max 3 + overflow) */}
          {coach.lessonTypesOffered.length > 0 && (
            <View style={styles.lessonRow}>
              {coach.lessonTypesOffered.slice(0, 3).map(lt => (
                <View key={lt} style={styles.lessonChip}>
                  <Text style={styles.lessonChipText}>{LESSON_CHIP_LABELS[lt] ?? lt}</Text>
                </View>
              ))}
              {coach.lessonTypesOffered.length > 3 && (
                <Text style={styles.moreText}>+{coach.lessonTypesOffered.length - 3}</Text>
              )}
            </View>
          )}

          {/* 4. Rating row */}
          <View style={styles.ratingRow}>
            <Star size={12} strokeWidth={0}
              fill={ratingText ? '#F59E0B' : theme.textMuted}
              color={ratingText ? '#F59E0B' : theme.textMuted} />
            {ratingText ? (
              <Text style={styles.ratingTxt}>
                {ratingText}
                <Text style={styles.reviewCount}> ({coach.reviewCount})</Text>
              </Text>
            ) : (
              <Text style={styles.noRating}>No reviews yet</Text>
            )}
          </View>

          {/* 5. Stats row: years + price + distance */}
          <View style={styles.statsRow}>
            {coach.yearsExperience != null && (
              <Text style={styles.statText}>{coach.yearsExperience} yrs</Text>
            )}
            {coach.yearsExperience != null && <View style={styles.dot} />}
            <Text style={styles.statText}>
              {coach.hourlyRate != null ? `$${Math.round(coach.hourlyRate)}/hr` : 'Rate TBD'}
            </Text>
            {coach.distanceKm != null && <View style={styles.dot} />}
            {coach.distanceKm != null && (
              <Text style={styles.statText}>{(coach.distanceKm * 0.621371).toFixed(1)} mi</Text>
            )}
          </View>

          {/* 6. ITF cert badge */}
          {coach.itfCertification && coach.itfCertification !== 'none' && ITF_CERT_LABELS[coach.itfCertification] && (
            <View style={styles.certBadge}>
              <Text style={styles.certBadgeText}>
                {ITF_CERT_LABELS[coach.itfCertification]}
              </Text>
            </View>
          )}

          {/* 7. Level chips */}
          {coach.levelsServed.length > 0 && (
            <View style={styles.levelRow}>
              {coach.levelsServed.map(lv => (
                <View key={lv} style={styles.levelChip}>
                  <Text style={styles.levelChipText}>{LEVEL_LABELS[lv] ?? lv.toUpperCase()}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Single CTA */}
      <TouchableOpacity style={styles.ctaPrimary} onPress={onViewCoach} activeOpacity={0.75}>
        <Text style={styles.ctaPrimaryLabel}>View Coach</Text>
      </TouchableOpacity>
    </View>
  );
}

export function CoachCardSkeleton() {
  const { theme } = useTheme();
  return (
    <View style={{
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.cardPadding,
      gap: 12,
    }}>
      <View style={{ flexDirection: 'row', gap: 14 }}>
        <Skeleton width={52} height={52} borderRadius={26} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="55%" height={16} />
          <Skeleton width="75%" height={12} />
          <Skeleton width="40%" height={12} />
        </View>
      </View>
      <Skeleton width="100%" height={40} borderRadius={Radius.sm} />
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.cardPadding,
      gap: 14,
    },
    heartBtn: {
      position: 'absolute',
      top: Spacing.cardPadding,
      right: Spacing.cardPadding,
      zIndex: 1,
    },
    row: {
      flexDirection: 'row',
      gap: 14,
      paddingRight: 32,
    },
    avatarWrap: {
      flexShrink: 0,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
    },
    avatarFallback: {
      backgroundColor: 'rgba(45,107,255,0.20)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitials: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: 18,
      color: Colors.cyan,
    },
    content: {
      flex: 1,
      gap: 5,
    },
    name: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
      letterSpacing: -0.3,
    },
    locationBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    locationBadgeText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: 11,
      color: Colors.cyan,
    },
    lessonRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
    },
    lessonChip: {
      backgroundColor: 'rgba(45,107,255,0.10)',
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    lessonChipText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: 10,
      color: Colors.blue,
    },
    moreText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: 10,
      color: theme.textMuted,
      alignSelf: 'center',
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    statText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textPrimary,
    },
    certBadge: {
      backgroundColor: 'rgba(45,224,255,0.10)',
      borderRadius: 4,
      paddingHorizontal: 7,
      paddingVertical: 2,
      alignSelf: 'flex-start',
    },
    certBadgeText: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 9,
      color: Colors.cyan,
      letterSpacing: 0.6,
    },
    ratingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    ratingTxt: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textPrimary,
    },
    reviewCount: {
      fontFamily: FontFamily.manropeMedium,
      color: theme.textSecondary,
    },
    noRating: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
    },
    dot: {
      width: 3,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: theme.textMuted,
    },
    levelRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 5,
      marginTop: 2,
    },
    levelChip: {
      backgroundColor: 'rgba(45,224,255,0.08)',
      borderRadius: Radius.xs,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    levelChipText: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 9,
      color: Colors.cyan,
      letterSpacing: 0.8,
    },
    ctaPrimary: {
      height: 42,
      backgroundColor: Colors.blue,
      borderRadius: Radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaPrimaryLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.white,
    },
  }), [theme]);
}
