import { StyleSheet, Text, View } from 'react-native';
import { Check, CircleDot, Clock, History, Lock, MousePointerClick, UserRound } from 'lucide-react-native';

import { Availability, FontFamily } from '@/constants/design';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { LEGEND_LABELS } from '@/lib/reservationCopy';

type Item = { key: string; accent: string; bg: string; icon: 'avail' | 'selected' | 'reserved' | 'lock' | 'mine' | 'clock' | 'past' };

const ALL: Record<string, Item> = {
  available: { key: 'available', accent: Availability.available, bg: Availability.availableBg, icon: 'avail' },
  selected: { key: 'selected', accent: Availability.selected, bg: Availability.mineBg, icon: 'selected' },
  reserved: { key: 'reserved', accent: Availability.reserved, bg: Availability.reservedBg, icon: 'reserved' },
  blocked: { key: 'blocked', accent: Availability.blocked, bg: Availability.blockedBg, icon: 'lock' },
  mine: { key: 'mine', accent: Availability.mine, bg: Availability.mineBg, icon: 'mine' },
  pending: { key: 'pending', accent: Availability.minePending, bg: Availability.minePendingBg, icon: 'clock' },
  past: { key: 'past', accent: Availability.past, bg: Availability.pastBg, icon: 'past' },
};

export const LEGEND_KEYS = {
  picker: ['available', 'selected', 'reserved', 'blocked', 'mine', 'pending'],
  schedule: ['available', 'reserved', 'blocked', 'mine', 'pending', 'past'],
} as const;

function Glyph({ icon, color }: { icon: Item['icon']; color: string }) {
  const p = { color, size: 10, strokeWidth: 2.5 } as const;
  if (icon === 'lock') return <Lock {...p} />;
  if (icon === 'mine') return <Check {...p} />;
  if (icon === 'clock') return <Clock {...p} />;
  if (icon === 'past') return <History {...p} />;
  if (icon === 'selected') return <MousePointerClick {...p} />;
  if (icon === 'reserved') return <UserRound {...p} />;
  return <CircleDot {...p} />;
}

/**
 * One compact legend for the booking picker and View Schedule: a wrapping row of small icon swatches with ONE-word labels.
 * Every state keeps an icon AND words (colour is never the only cue), and each item carries its full description as its
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
          const it = ALL[k];
          const label = LEGEND_LABELS[k];
          return (
            <View key={it.key} style={styles.item} testID={`legend-${it.key}`} accessible accessibilityLabel={label.full}>
              <View style={[styles.swatch, { backgroundColor: it.bg, borderColor: it.accent }]}>
                <Glyph icon={it.icon} color={it.accent} />
              </View>
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
  item: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  swatch: { width: 16, height: 16, borderRadius: 5, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: FontFamily.manropeMedium, fontSize: 12 },
  note: { fontFamily: FontFamily.manropeMedium, fontSize: 12, textAlign: 'center' },
});
