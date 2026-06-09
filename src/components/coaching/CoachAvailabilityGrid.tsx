import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, FontFamily, FontSize, Radius } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import {
  HOURS,
  type TimeHour,
  type CoachAvailabilitySlot,
  type CoachUnavailabilityBlock,
  type CellMode,
} from '@/hooks/useCoachAvailability';

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function normTime(t: string): string { return t.slice(0, 5); }

interface Props {
  weeklySlots: CoachAvailabilitySlot[];
  unavailabilityBlocks?: CoachUnavailabilityBlock[];
  selectedHour?: TimeHour | null;
  onSelectHour?: (hour: TimeHour) => void;
  compact?: boolean;
  getCellMode?: (dow: number, hour: TimeHour) => CellMode | null;
  onCellPress?: (dow: number, hour: TimeHour) => void;
}

export function CoachAvailabilityGrid({
  weeklySlots,
  unavailabilityBlocks = [],
  selectedHour = null,
  onSelectHour,
  compact = false,
  getCellMode,
  onCellPress,
}: Props) {
  const { theme } = useTheme();
  const styles = useStyles(theme, compact);
  const isCellInteractive = !!onCellPress;

  const availSet = useMemo(() => {
    const s = new Set<string>();
    for (const slot of weeklySlots) {
      s.add(`${slot.day_of_week}|${normTime(slot.start_time)}`);
    }
    return s;
  }, [weeklySlots]);

  const upcomingBlocks = useMemo(() => {
    if (!unavailabilityBlocks.length) return [];
    const today = new Date();
    return unavailabilityBlocks
      .filter(b => b.recurs_annually || new Date(b.end_date) >= today)
      .slice(0, 3);
  }, [unavailabilityBlocks]);

  if (!weeklySlots.length && !isCellInteractive) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Schedule not posted — request any time</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
        <View>
          <View style={styles.headerRow}>
            <View style={styles.hourLabelCell} />
            {DAYS.map(day => (
              <View key={day} style={styles.dayHeaderCell}>
                <Text style={styles.dayHeaderText}>{day}</Text>
              </View>
            ))}
          </View>

          {HOURS.map(hour => {
            const isSelected = !isCellInteractive && selectedHour?.start === hour.start;
            return (
              <TouchableOpacity
                key={hour.start}
                activeOpacity={onSelectHour ? 0.7 : 1}
                onPress={onSelectHour ? () => onSelectHour(hour) : undefined}
                style={[styles.hourRow, isSelected && styles.hourRowSelected]}>
                <View style={styles.hourLabelCell}>
                  <Text style={[styles.hourLabel, isSelected && styles.hourLabelSelected]}>
                    {hour.label}
                  </Text>
                </View>
                {DAYS.map((_, dow) => {
                  let cellStyle;
                  if (isCellInteractive) {
                    const mode = getCellMode?.(dow, hour) ?? null;
                    cellStyle = mode === 'coach_facility' ? styles.cellFacility
                               : mode === 'traveling'    ? styles.cellTraveling
                               : mode === 'both'         ? styles.cellBoth
                               : null;
                  } else {
                    const available = availSet.has(`${dow}|${hour.start}`);
                    cellStyle = available ? (isSelected ? styles.cellAvailableSelected : styles.cellAvailable) : null;
                  }

                  if (isCellInteractive) {
                    return (
                      <TouchableOpacity
                        key={dow}
                        activeOpacity={0.7}
                        onPress={() => onCellPress!(dow, hour)}
                        style={[styles.cell, cellStyle]}
                      />
                    );
                  }
                  return <View key={dow} style={[styles.cell, cellStyle]} />;
                })}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {upcomingBlocks.length > 0 && (
        <View style={styles.blocksContainer}>
          {upcomingBlocks.map(block => (
            <View key={block.id} style={styles.blockRow}>
              <Text style={styles.blockDot}>●</Text>
              <Text style={styles.blockText}>
                {block.title ?? 'Away'}{' · '}
                {block.recurs_annually
                  ? `${block.start_date.slice(5)} (annual)`
                  : `${block.start_date}–${block.end_date}`}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function useStyles(theme: ThemeTokens, compact: boolean) {
  return useMemo(() => StyleSheet.create({
    root: { gap: 8 },
    scroll: { flexGrow: 0 },
    emptyContainer: { paddingVertical: 16, alignItems: 'center' },
    emptyText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
      textAlign: 'center',
    },
    headerRow: { flexDirection: 'row', marginBottom: 2 },
    hourLabelCell: { width: 48, paddingRight: 4, justifyContent: 'center' },
    dayHeaderCell: { width: compact ? 32 : 36, alignItems: 'center' },
    dayHeaderText: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 9,
      color: theme.textMuted,
      letterSpacing: 0.8,
    },
    hourRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: compact ? 1 : 2,
      paddingHorizontal: 2,
      borderRadius: Radius.xs ?? 4,
      marginBottom: 1,
    },
    hourRowSelected: {
      backgroundColor: 'rgba(45,224,255,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(45,224,255,0.30)',
    },
    hourLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 9,
      color: theme.textMuted,
      letterSpacing: 0.4,
    },
    hourLabelSelected: { color: Colors.cyan },
    cell: {
      width: compact ? 32 : 36,
      height: compact ? 16 : 20,
      borderRadius: Radius.xs ?? 4,
      backgroundColor: 'rgba(154,163,184,0.06)',
      borderWidth: 1,
      borderColor: 'rgba(154,163,184,0.10)',
    },
    cellAvailable: {
      backgroundColor: 'rgba(45,224,255,0.10)',
      borderColor: 'rgba(45,224,255,0.25)',
    },
    cellAvailableSelected: {
      backgroundColor: 'rgba(45,224,255,0.18)',
      borderColor: Colors.cyan,
    },
    cellFacility: {
      backgroundColor: 'rgba(45,107,255,0.18)',
      borderColor: 'rgba(45,107,255,0.40)',
    },
    cellTraveling: {
      backgroundColor: 'rgba(214,255,61,0.14)',
      borderColor: 'rgba(214,255,61,0.32)',
    },
    cellBoth: {
      backgroundColor: 'rgba(45,224,255,0.14)',
      borderColor: 'rgba(45,224,255,0.32)',
    },
    blocksContainer: { marginTop: 4, gap: 4 },
    blockRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    blockDot: { fontFamily: FontFamily.manropeMedium, fontSize: 8, color: Colors.volt },
    blockText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
      flex: 1,
    },
  }), [theme, compact]);
}
