import { useMemo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Package } from 'lucide-react-native';
import { Colors, FontFamily, FontSize, Radius } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import type { LessonPackage } from '@/hooks/useLessonPackages';

const LESSON_TYPE_LABELS: Record<string, string> = {
  'private':      'Private',
  'semi-private': 'Semi-Private',
  'group':        'Group',
  'junior':       'Junior',
};

function formatPrice(price: number): string {
  return `$${price % 1 === 0 ? price.toFixed(0) : price.toFixed(2)}`;
}

interface PackageCardProps {
  pkg: LessonPackage;
}

function PackageCard({ pkg }: PackageCardProps) {
  const { theme } = useTheme();
  const styles = useCardStyles(theme);
  const typeLabel = pkg.lessonType ? LESSON_TYPE_LABELS[pkg.lessonType] : null;
  const perSession = pkg.numSessions > 1 ? pkg.price / pkg.numSessions : null;

  return (
    <View style={styles.card}>
      {/* Top row: title + price */}
      <View style={styles.topRow}>
        <Text style={styles.title} numberOfLines={2}>{pkg.title}</Text>
        <View style={styles.priceCol}>
          <Text style={styles.price}>{formatPrice(pkg.price)}</Text>
          {perSession && (
            <Text style={styles.perSession}>{formatPrice(perSession)}/ea</Text>
          )}
        </View>
      </View>

      {/* Meta row */}
      <View style={styles.metaRow}>
        {typeLabel && (
          <View style={styles.typeChip}>
            <Text style={styles.typeChipTxt}>{typeLabel.toUpperCase()}</Text>
          </View>
        )}
        <Text style={styles.metaTxt}>
          {pkg.durationMin} min
          {pkg.numSessions > 1 ? ` · ${pkg.numSessions} sessions` : ' · 1 session'}
        </Text>
      </View>

      {pkg.description ? (
        <Text style={styles.description} numberOfLines={3}>{pkg.description}</Text>
      ) : null}
    </View>
  );
}

interface PackagesListProps {
  packages: LessonPackage[];
  loading?: boolean;
  error?: string | null;
}

export function PackagesList({ packages, loading, error }: PackagesListProps) {
  const { theme } = useTheme();
  const styles = useStyles(theme);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color={Colors.cyan} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorWrap}>
        <Text style={styles.errorTxt}>Could not load packages.</Text>
      </View>
    );
  }

  if (packages.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Package size={28} strokeWidth={1.5} color={theme.textMuted} />
        <Text style={styles.emptyTitle}>No packages available</Text>
        <Text style={styles.emptyBody}>
          This coach hasn't created any lesson packages yet.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {packages.map(pkg => (
        <PackageCard key={pkg.id} pkg={pkg} />
      ))}
    </View>
  );
}

function useCardStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: theme.bgElevated,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      gap: 8,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    title: {
      flex: 1,
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: theme.textPrimary,
      lineHeight: 22,
    },
    priceCol: {
      alignItems: 'flex-end',
      flexShrink: 0,
    },
    price: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: 20,
      color: theme.textPrimary,
      letterSpacing: -0.3,
    },
    perSession: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: 11,
      color: theme.textMuted,
      textAlign: 'right',
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
    },
    typeChip: {
      backgroundColor: 'rgba(45,107,255,0.12)',
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    typeChipTxt: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 9,
      color: Colors.blueHi,
      letterSpacing: 0.6,
    },
    metaTxt: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
    },
    description: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textSecondary,
      lineHeight: 20,
    },
  }), [theme]);
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    loadingWrap: {
      paddingVertical: 20,
      alignItems: 'center',
    },
    errorWrap: {
      padding: 14,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: 'rgba(255,92,107,0.25)',
      backgroundColor: 'rgba(255,92,107,0.08)',
    },
    errorTxt: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: Colors.negative,
    },
    emptyWrap: {
      padding: 20,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBg,
      alignItems: 'center',
      gap: 8,
    },
    emptyTitle: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: theme.textSecondary,
    },
    emptyBody: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
      textAlign: 'center',
      lineHeight: 20,
    },
    list: {
      gap: 8,
    },
  }), [theme]);
}
