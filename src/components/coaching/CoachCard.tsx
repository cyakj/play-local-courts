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

interface Props {
  coach: CoachWithProfile;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  onViewProfile: () => void;
  onBookLesson: () => void;
}

export function CoachCard({ coach, isFavorited, onToggleFavorite, onViewProfile, onBookLesson }: Props) {
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

  const ratingText = coach.avgRating != null
    ? coach.avgRating.toFixed(1)
    : null;

  const distanceText = coach.distanceKm != null
    ? `${(coach.distanceKm * 0.621371).toFixed(1)} mi`
    : 'Distance unknown';

  const hasDistance = coach.distanceKm != null;

  return (
    <View style={styles.card}>
      {/* Heart */}
      <TouchableOpacity style={styles.heartBtn} onPress={onToggleFavorite} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
          <Text style={styles.name} numberOfLines={1}>{displayName}</Text>

          {/* Credential + distance row */}
          <View style={styles.metaRow}>
            {coach.credentials ? (
              <View style={styles.credentialChip}>
                <Text style={styles.credentialText}>{coach.credentials}</Text>
              </View>
            ) : null}
            <View style={styles.distanceRow}>
              <MapPin color={hasDistance ? theme.textSecondary : theme.textMuted} size={11} strokeWidth={2} />
              <Text style={[styles.distanceTxt, !hasDistance && styles.unknownTxt]}>
                {distanceText}
              </Text>
            </View>
          </View>

          {/* Club/facility */}
          {coach.homeBase ? (
            <Text style={styles.homeBase} numberOfLines={1}>{coach.homeBase}</Text>
          ) : null}

          {/* Rating + price */}
          <View style={styles.ratingRow}>
            <Star
              size={12}
              strokeWidth={0}
              fill={ratingText ? '#F59E0B' : theme.textMuted}
              color={ratingText ? '#F59E0B' : theme.textMuted}
            />
            {ratingText ? (
              <Text style={styles.ratingTxt}>
                {ratingText}
                <Text style={styles.reviewCount}> ({coach.reviewCount})</Text>
              </Text>
            ) : (
              <Text style={styles.noRating}>No reviews yet</Text>
            )}
            <View style={styles.dot} />
            <Text style={styles.rate}>
              {coach.hourlyRate != null ? `$${Math.round(coach.hourlyRate)}/hr` : 'Rate TBD'}
            </Text>
          </View>

          {/* Level chips */}
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

      {/* CTAs */}
      <View style={styles.ctaRow}>
        <TouchableOpacity style={[styles.cta, styles.ctaGhost]} onPress={onViewProfile} activeOpacity={0.75}>
          <Text style={styles.ctaGhostLabel}>View Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.cta, styles.ctaPrimary]} onPress={onBookLesson} activeOpacity={0.75}>
          <Text style={styles.ctaPrimaryLabel}>Book Lesson</Text>
        </TouchableOpacity>
      </View>
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
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Skeleton width="48%" height={36} borderRadius={Radius.sm} />
        <Skeleton width="48%" height={36} borderRadius={Radius.sm} />
      </View>
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
      paddingRight: 32, // space for heart button
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
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
    },
    credentialChip: {
      backgroundColor: 'rgba(45,107,255,0.12)',
      borderRadius: Radius.xs,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    credentialText: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 9,
      color: Colors.blueHi,
      letterSpacing: 0.6,
    },
    distanceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    distanceTxt: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    unknownTxt: {
      color: theme.textMuted,
      fontStyle: 'italic',
    },
    homeBase: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textSecondary,
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
      borderRadius: 2,
      backgroundColor: theme.textMuted,
      marginHorizontal: 2,
    },
    rate: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textPrimary,
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
    ctaRow: {
      flexDirection: 'row',
      gap: 10,
    },
    cta: {
      flex: 1,
      height: 40,
      borderRadius: Radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaGhost: {
      borderWidth: 1,
      borderColor: theme.border,
    },
    ctaGhostLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    ctaPrimary: {
      backgroundColor: Colors.blue,
    },
    ctaPrimaryLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.white,
    },
  }), [theme]);
}
