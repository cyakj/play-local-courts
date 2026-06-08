import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { TIME_BANDS, type TimeBand, type CoachAvailabilitySlot, type CoachUnavailabilityBlock, type CellMode } from '@/hooks/useCoachAvailability';

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

interface Props {
  weeklySlots: CoachAvailabilitySlot[];
  unavailabilityBlocks?: CoachUnavailabilityBlock[];
  // interactive mode
  interactive?: boolean;
  selectedBand?: TimeBand | null;
  onSelectBand?: (band: TimeBand) => void;
  // layout
  compact?: boolean;
  // new cell-level interaction (editor mode)
  getCellMode?: (dow: number, band: TimeBand) => CellMode | null;
  onCellPress?: (dow: number, band: TimeBand) => void;
}

function overlaps(slotStart: string, slotEnd: string, band: TimeBand): boolean {
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  return toMin(slotStart) < toMin(band.end) && toMin(slotEnd) > toMin(band.start);
}

export function CoachAvailabilityGrid({
  weeklySlots,
  unavailabilityBlocks = [],
  interactive = false,
  selectedBand = null,
  onSelectBand,
  compact = false,
  getCellMode,
  onCellPress,
}: Props) {
  const { theme } = useTheme();
  const styles = useStyles(theme, compact);

  // For each (day, band) cell: is the coach scheduled?
  const grid = useMemo(() => {
    return TIME_BANDS.map(band => ({
      band,
      days: DAYS.map((_, dow) =>
        weeklySlots.some(s => s.day_of_week === dow && overlaps(s.start_time, s.end_time, band)),
      ),
    }));
  }, [weeklySlots]);

  // Upcoming unavailability blocks to display below grid
  const upcomingBlocks = useMemo(() => {
    if (!unavailabilityBlocks.length) return [];
    const today = new Date();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + 60);
    return unavailabilityBlocks
      .filter(b => {
        if (b.recurs_annually) return true;
        return new Date(b.end_date) >= today && new Date(b.start_date) <= cutoff;
      })
      .slice(0, 3);
  }, [unavailabilityBlocks]);

  const isCellInteractive = !!onCellPress;
  const hasAnyAvailability = weeklySlots.length > 0;

  if (!hasAnyAvailability && !isCellInteractive) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Schedule not posted — request any time</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Day headers */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
        <View>
          <View style={styles.headerRow}>
            <View style={styles.bandLabelCell} />
            {DAYS.map(day => (
              <View key={day} style={styles.dayHeaderCell}>
                <Text style={styles.dayHeaderText}>{day}</Text>
              </View>
            ))}
          </View>

          {/* Band rows */}
          {grid.map(({ band, days }) => {
            const isSelected = interactive && selectedBand?.label === band.label;
            const BandRowContainer = isCellInteractive ? View : TouchableOpacity;
            const bandRowProps = isCellInteractive
              ? {}
              : {
                  activeOpacity: interactive ? 0.7 : 1,
                  onPress: interactive ? () => onSelectBand?.(band) : undefined,
                };
            return (
              <BandRowContainer
                key={band.label}
                {...bandRowProps}
                style={[styles.bandRow, isSelected && styles.bandRowSelected]}
              >
                <View style={styles.bandLabelCell}>
                  <Text style={[styles.bandLabel, isSelected && styles.bandLabelSelected]}>
                    {band.label}
                  </Text>
                  <Text style={[styles.bandTime, isSelected && styles.bandTimeSelected]}>
                    {band.start}–{band.end}
                  </Text>
                </View>
                {days.map((available, dow) => {
                  const cellMode = getCellMode?.(dow, band) ?? null;
                  const cellVisualStyle = isCellInteractive
                    ? (cellMode === 'coach_facility' ? styles.cellFacility
                       : cellMode === 'traveling'    ? styles.cellTraveling
                       : cellMode === 'both'         ? styles.cellBoth
                       : null)
                    : (available ? (isSelected ? styles.cellAvailableSelected : styles.cellAvailable) : null);
                  if (isCellInteractive) {
                    return (
                      <TouchableOpacity
                        key={dow}
                        activeOpacity={0.7}
                        onPress={() => onCellPress!(dow, band)}
                        style={[styles.cell, cellVisualStyle]}
                      />
                    );
                  }
                  return (
                    <View
                      key={dow}
                      style={[styles.cell, cellVisualStyle]}
                    />
                  );
                })}
              </BandRowContainer>
            );
          })}
        </View>
      </ScrollView>

      {/* Upcoming unavailability notice */}
      {upcomingBlocks.length > 0 && (
        <View style={styles.blocksContainer}>
          {upcomingBlocks.map(block => (
            <View key={block.id} style={styles.blockRow}>
              <Text style={styles.blockDot}>●</Text>
              <Text style={styles.blockText}>
                {block.title ?? 'Away'}{' · '}
                {block.recurs_annually
                  ? formatMonthDay(block.start_date)
                  : `${formatDate(block.start_date)}–${formatDate(block.end_date)}`}
                {block.recurs_annually ? ' (annual)' : ''}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatMonthDay(iso: string): string {
  const [, m, d] = iso.split('-');
  const dt = new Date(`2000-${m}-${d}T00:00:00`);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function useStyles(theme: ThemeTokens, compact: boolean) {
  return useMemo(() => StyleSheet.create({
    root:        { gap: 8 },
    scroll:      { flexGrow: 0 },
    emptyContainer: {
      paddingVertical: 16,
      alignItems: 'center',
    },
    emptyText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
      textAlign: 'center',
    },
    headerRow: {
      flexDirection: 'row',
      marginBottom: 4,
    },
    bandLabelCell: {
      width: 88,
      paddingRight: 8,
      justifyContent: 'center',
    },
    dayHeaderCell: {
      width: compact ? 34 : 38,
      alignItems: 'center',
    },
    dayHeaderText: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 9,
      color: theme.textMuted,
      letterSpacing: 0.8,
    },
    bandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: compact ? 6 : 8,
      paddingHorizontal: 8,
      borderRadius: Radius.sm,
      marginBottom: 2,
    },
    bandRowSelected: {
      backgroundColor: 'rgba(45,224,255,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(45,224,255,0.30)',
    },
    bandLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 9,
      color: theme.textSecondary,
      letterSpacing: 0.8,
    },
    bandLabelSelected: {
      color: Colors.cyan,
    },
    bandTime: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: 10,
      color: theme.textMuted,
      marginTop: 1,
    },
    bandTimeSelected: {
      color: Colors.cyan,
    },
    cell: {
      width: compact ? 34 : 38,
      height: compact ? 22 : 26,
      borderRadius: Radius.xs,
      backgroundColor: 'rgba(154,163,184,0.06)',
      borderWidth: 1,
      borderColor: 'rgba(154,163,184,0.10)',
      marginHorizontal: 1,
    },
    cellAvailable: {
      backgroundColor: 'rgba(45,224,255,0.10)',
      borderColor: 'rgba(45,224,255,0.25)',
    },
    cellAvailableSelected: {
      backgroundColor: 'rgba(45,224,255,0.18)',
      borderColor: Colors.cyan,
    },
    // Editor mode cell styles
    cellFacility: {
      backgroundColor: 'rgba(45,107,255,0.15)',
      borderColor:     'rgba(45,107,255,0.35)',
    },
    cellTraveling: {
      backgroundColor: 'rgba(214,255,61,0.12)',
      borderColor:     'rgba(214,255,61,0.30)',
    },
    cellBoth: {
      backgroundColor: 'rgba(45,224,255,0.12)',
      borderColor:     'rgba(45,224,255,0.30)',
    },
    // Unavailability notices
    blocksContainer: {
      marginTop: 4,
      gap: 4,
    },
    blockRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    blockDot: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: 8,
      color: Colors.volt,
    },
    blockText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
      flex: 1,
    },
  }), [theme, compact]);
}
