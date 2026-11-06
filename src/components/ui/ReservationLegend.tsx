import { StyleSheet, Text, View } from 'react-native';

import { Availability, FontFamily } from '@/constants/design';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { LEGEND_LABELS } from '@/lib/reservationCopy';

/** Solid dot colour per state. Same colours as the dots on the wheel rows. */
export const LEGEND_DOT_COLOR: Record<string, string> = {
  available: Availability.available,
  selected: Availability.selected,
  reserved: Availability.reserved,
  blocked: Availability.blocked,
  mine: Availability.mine,
  pending: Availability.minePending,
  past: Availability.past,
};

export const LEGEND_KEYS = {
  picker: ['available', 'selected', 'reserved', 'blocked', 'mine', 'pending'],
  schedule: ['available', 'reserved', 'blocked', 'mine', 'pending', 'past'],
} as const;

/**
 * One compact legend for the booking picker and View Schedule: a wrapping row of small solid colour dots, each beside a
 * ONE-word label (words always accompany colour, so colour is never the only cue). Each item carries its full description as its
 * accessibility label ("Reserved by someone else", "My request, pending approval", ...). `hoursNote` is one short line
 * (for example "Available to book: 7 AM–7 PM"), shown only when there is something to say.
 */
export function ReservationLegend({ theme, variant, hoursNote, testID }: {
  theme: ThemeTokens; variant: 'picker' | 'schedule'; hoursNote?: string | null; testID?: string;
}) {
  return (
    <View testID={testID ?? (variant === 'picker' ? 'availability-legend' : 'schedule-legend')} style={styles.wrap}>
      <View style={styles.grid}>
        {LEGEND_KEYS[variant].map((k) => {
          const label = LEGEND_LABELS[k];
          return (
            <View key={k} style={styles.item} testID={`legend-${k}`} accessible accessibilityLabel={label.full}>
              <View testID={`legend-dot-${k}`} style={[styles.dot, { backgroundColor: LEGEND_DOT_COLOR[k] }]} />
              <Text style={[styles.text, { color: theme.textSecondary }]} maxFontSizeMultiplier={1.3}>{label.short}</Text>
            </View>
          );
        })}
      </View>
      {hoursNote ? <Text testID="legend-hours-note" style={[styles.note, { color: theme.textMuted }]}>{hoursNote}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 8, paddingBottom: 2, paddingHorizontal: 4, gap: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 6, justifyContent: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  text: { fontFamily: FontFamily.manropeMedium, fontSize: 12 },
  note: { fontFamily: FontFamily.manropeMedium, fontSize: 12, textAlign: 'center' },
});
