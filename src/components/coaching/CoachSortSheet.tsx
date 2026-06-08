import { useMemo } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import type { SortOption } from '@/hooks/useCoachData';

const SORT_OPTIONS: { label: string; value: SortOption; description: string }[] = [
  { label: 'Best Match',       value: 'best_match',       description: 'Rating, reviews, distance & availability' },
  { label: 'Highest Rated',    value: 'highest_rated',    description: 'Average star rating'                      },
  { label: 'Most Reviews',     value: 'most_reviews',     description: 'Number of reviews'                        },
  { label: 'Most Experienced', value: 'most_experienced', description: 'Years of experience'                      },
  { label: 'Lowest Price',     value: 'lowest_price',     description: 'Hourly rate, low to high'                 },
  { label: 'Highest Price',    value: 'highest_price',    description: 'Hourly rate, high to low'                 },
  { label: 'Closest Distance', value: 'closest_distance', description: 'Nearest coaches first'                    },
];

interface Props {
  visible:  boolean;
  onClose:  () => void;
  sort:     SortOption;
  onSelect: (s: SortOption) => void;
}

export function CoachSortSheet({ visible, onClose, sort, onSelect }: Props) {
  const { theme } = useTheme();
  const styles = useStyles(theme);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modal}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={20} strokeWidth={2} color={theme.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sort By</Text>
          <View style={{ width: 20 }} />
        </View>

        <View style={styles.list}>
          {SORT_OPTIONS.map(opt => {
            const active = sort === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.row, active && styles.rowActive]}
                onPress={() => { onSelect(opt.value); onClose(); }}
                activeOpacity={0.75}
              >
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, active && styles.rowLabelActive]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.rowDesc}>{opt.description}</Text>
                </View>
                {active && <Check size={16} strokeWidth={2.5} color={Colors.cyan} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

export const SORT_LABELS: Record<SortOption, string> = {
  best_match:       'Best Match',
  highest_rated:    'Top Rated',
  most_reviews:     'Most Reviews',
  most_experienced: 'Most Exp.',
  lowest_price:     'Lowest Price',
  highest_price:    'Highest Price',
  closest_distance: 'Closest',
};

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    modal: {
      flex: 1,
      backgroundColor: theme.pageBg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.pagePx,
      paddingTop: 20,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
    },
    list: {
      paddingTop: 8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.pagePx,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    rowActive: {
      backgroundColor: 'rgba(45,224,255,0.04)',
    },
    rowText: {
      flex: 1,
      gap: 3,
    },
    rowLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: theme.textPrimary,
    },
    rowLabelActive: {
      color: Colors.cyan,
    },
    rowDesc: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
    },
  }), [theme]);
}
