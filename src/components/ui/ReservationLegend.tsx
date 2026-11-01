import { StyleSheet, Text, View } from 'react-native';
import { Check, CircleDot, Clock, History, Lock, MousePointerClick, UserRound } from 'lucide-react-native';

import { Availability, FontFamily } from '@/constants/design';
import type { ThemeTokens } from '@/constants/theme-tokens';

type Item = { key: string; label: string; accent: string; bg: string; icon: 'avail' | 'selected' | 'reserved' | 'lock' | 'mine' | 'clock' | 'past' };

const ALL: Record<Item['key'], Item> = {
  available: { key: 'available', label: 'Available', accent: Availability.available, bg: Availability.availableBg, icon: 'avail' },
  selected: { key: 'selected', label: 'Selected', accent: Availability.selected, bg: Availability.mineBg, icon: 'selected' },
  reserved: { key: 'reserved', label: 'Reserved by someone else', accent: Availability.reserved, bg: Availability.reservedBg, icon: 'reserved' },
  blocked: { key: 'blocked', label: 'Blocked by management', accent: Availability.blocked, bg: Availability.blockedBg, icon: 'lock' },
  mine: { key: 'mine', label: 'My reservation', accent: Availability.mine, bg: Availability.mineBg, icon: 'mine' },
  pending: { key: 'pending', label: 'My request - pending approval', accent: Availability.minePending, bg: Availability.minePendingBg, icon: 'clock' },
  past: { key: 'past', label: 'Completed / passed', accent: Availability.past, bg: Availability.pastBg, icon: 'past' },
};

export const LEGEND_KEYS = {
  picker: ['available', 'selected', 'reserved', 'blocked', 'mine', 'pending'],
  schedule: ['available', 'reserved', 'blocked', 'mine', 'pending', 'past'],
} as const;

function Glyph({ icon, color }: { icon: Item['icon']; color: string }) {
  const p = { color, size: 11, strokeWidth: 2.5 } as const;
  if (icon === 'lock') return <Lock {...p} />;
  if (icon === 'mine') return <Check {...p} />;
  if (icon === 'clock') return <Clock {...p} />;
  if (icon === 'past') return <History {...p} />;
  if (icon === 'selected') return <MousePointerClick {...p} />;
  if (icon === 'reserved') return <UserRound {...p} />;
  return <CircleDot {...p} />;
}

/**
 * One legend for the booking picker and View Schedule. Every state is a swatch with an icon AND words, so colour is
 * never the only cue. `hoursNote` explains that time outside operating hours is simply not offered (not "blocked").
 */
export function ReservationLegend({ theme, variant, hoursNote, testID }: {
  theme: ThemeTokens; variant: 'picker' | 'schedule'; hoursNote?: string | null; testID?: string;
}) {
  return (
    <View testID={testID ?? (variant === 'picker' ? 'availability-legend' : 'schedule-legend')} style={styles.wrap}>
      <View style={styles.grid}>
        {LEGEND_KEYS[variant].map((k) => {
          const it = ALL[k];
          return (
            <View key={it.key} style={styles.item} testID={`legend-${it.key}`}>
              <View style={[styles.swatch, { backgroundColor: it.bg, borderColor: it.accent }]}>
                <Glyph icon={it.icon} color={it.accent} />
              </View>
              <Text style={[styles.text, { color: theme.textSecondary }]}>{it.label}</Text>
            </View>
          );
        })}
      </View>
      {hoursNote ? <Text testID="legend-hours-note" style={[styles.note, { color: theme.textMuted }]}>{hoursNote}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 8, paddingHorizontal: 4, gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: FontFamily.manropeMedium, fontSize: 12 },
  note: { fontFamily: FontFamily.manropeMedium, fontSize: 12 },
});
