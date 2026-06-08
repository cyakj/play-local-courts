import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import type { DistanceFilterKm, LevelFilter } from '@/hooks/useCoachData';

const DISTANCE_OPTIONS: { label: string; value: DistanceFilterKm }[] = [
  { label: '5 mi',  value: 8  },
  { label: '10 mi', value: 16 },
  { label: '25 mi', value: 40 },
  { label: '50 mi', value: 80 },
];

const LEVEL_OPTIONS: { label: string; value: LevelFilter }[] = [
  { label: 'Beginner',     value: 'beginner'        },
  { label: 'Intermediate', value: 'intermediate'     },
  { label: 'High Perf',    value: 'high_performance' },
];

interface Props {
  distanceKm: DistanceFilterKm;
  onDistanceChange: (v: DistanceFilterKm) => void;
  levels: LevelFilter[];
  onLevelsChange: (v: LevelFilter[]) => void;
  playerHasCoordinates: boolean;
}

export function CoachFilterBar({
  distanceKm,
  onDistanceChange,
  levels,
  onLevelsChange,
  playerHasCoordinates,
}: Props) {
  const { theme } = useTheme();
  const styles = useStyles(theme);

  function toggleDistance(val: DistanceFilterKm) {
    onDistanceChange(distanceKm === val ? null : val);
  }

  function toggleLevel(val: LevelFilter) {
    if (levels.includes(val)) {
      onLevelsChange(levels.filter(l => l !== val));
    } else {
      onLevelsChange([...levels, val]);
    }
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {/* Distance chips */}
      {DISTANCE_OPTIONS.map(opt => {
        const active = distanceKm === opt.value;
        const disabled = !playerHasCoordinates;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled]}
            onPress={() => !disabled && toggleDistance(opt.value)}
            activeOpacity={disabled ? 1 : 0.75}
          >
            <MapPin
              color={active ? Colors.cyan : disabled ? theme.textMuted : theme.textSecondary}
              size={11}
              strokeWidth={2}
            />
            <Text style={[styles.chipLabel, active && styles.chipLabelActive, disabled && styles.chipLabelDisabled]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}

      <View style={styles.divider} />

      {/* Level chips */}
      {LEVEL_OPTIONS.map(opt => {
        const active = levels.includes(opt.value);
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => toggleLevel(opt.value)}
            activeOpacity={0.75}
          >
            <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: Spacing.pagePx,
      paddingVertical: 2,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: theme.cardBg,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: Radius.chip,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    chipActive: {
      backgroundColor: 'rgba(45,224,255,0.10)',
      borderColor: 'rgba(45,224,255,0.40)',
    },
    chipDisabled: {
      opacity: 0.4,
    },
    chipLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    chipLabelActive: {
      color: Colors.cyan,
    },
    chipLabelDisabled: {
      color: theme.textMuted,
    },
    divider: {
      width: 1,
      height: 20,
      backgroundColor: theme.border,
      marginHorizontal: 4,
    },
  }), [theme]);
}
